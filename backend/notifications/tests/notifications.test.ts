import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Request } from 'express';
import { getPool, type AuthContext } from '@classes-hub/shared';
import { buildApp } from '../src/handler';

function testAuth(req: Request): AuthContext | null {
  const raw = req.header('x-test-auth');
  return raw ? (JSON.parse(raw) as AuthContext) : null;
}
const app = buildApp(testAuth);
const as = (ctx: AuthContext) => JSON.stringify(ctx);

let tenantId: number;
let batchId: number;
let admin: AuthContext;
let teacher: AuthContext;
let student: AuthContext;

async function reset() {
  const pool = getPool();
  for (const t of ['device_tokens', 'announcements', 'enrollments', 'batch_teachers', 'batches', 'subjects', 'courses', 'users', 'tenants']) {
    await pool.query(`DELETE FROM ${t}`);
  }
  tenantId = (await pool.query("INSERT INTO tenants (name) VALUES ('T') RETURNING id")).rows[0].id;
  const mk = async (role: string, email: string) =>
    (await pool.query(`INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,$2,$3,'x',$4) RETURNING id`, [tenantId, role, email, email])).rows[0].id;
  admin = { userId: await mk('tutor', 'a@x'), tenantId, role: 'tutor', sessionId: 1 };
  teacher = { userId: await mk('teacher', 't@x'), tenantId, role: 'teacher', sessionId: 2 };
  student = { userId: await mk('student', 's@x'), tenantId, role: 'student', sessionId: 3 };
  const c = (await pool.query(`INSERT INTO courses (tenant_id, name) VALUES ($1,'C') RETURNING id`, [tenantId])).rows[0].id;
  const s = (await pool.query(`INSERT INTO subjects (tenant_id, course_id, name) VALUES ($1,$2,'S') RETURNING id`, [tenantId, c])).rows[0].id;
  batchId = (await pool.query(`INSERT INTO batches (tenant_id, subject_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenantId, s])).rows[0].id;
  await pool.query(`INSERT INTO batch_teachers (batch_id, user_id) VALUES ($1,$2)`, [batchId, teacher.userId]);
  await pool.query(`INSERT INTO enrollments (batch_id, student_id) VALUES ($1,$2)`, [batchId, student.userId]);
}

describe('notifications feature', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });
  beforeEach(reset);
  afterAll(async () => { await getPool().end(); });

  it('sends a batch announcement and targets enrolled/assigned device tokens', async () => {
    await request(app).post('/announcements/tokens').set('x-test-auth', as(student)).send({ token: 'stu-token' });
    await request(app).post('/announcements/tokens').set('x-test-auth', as(teacher)).send({ token: 'teach-token' });

    const res = await request(app)
      .post('/announcements')
      .set('x-test-auth', as(teacher))
      .send({ scope: 'batch', scopeId: batchId, title: 'Quiz tomorrow', body: 'Be ready' });
    expect(res.status).toBe(201);
    expect(res.body.sent_at).toBeTruthy();
    expect(res.body.pushTargeted).toBe(2); // student + teacher tokens
    expect(res.body.pushDelivered).toBe(false); // no FCM key configured in tests
  });

  it('forbids a non-managing teacher from a batch announcement, and a teacher from tenant-wide', async () => {
    const other: AuthContext = { userId: 999, tenantId, role: 'teacher', sessionId: 9 };
    const batchRes = await request(app)
      .post('/announcements')
      .set('x-test-auth', as(other))
      .send({ scope: 'batch', scopeId: batchId, title: 'x', body: 'y' });
    expect(batchRes.status).toBe(403);

    const tenantRes = await request(app)
      .post('/announcements')
      .set('x-test-auth', as(teacher))
      .send({ scope: 'tenant', title: 'x', body: 'y' });
    expect(tenantRes.status).toBe(403);
  });

  it('rejects a tenant announcement that includes a scopeId', async () => {
    const res = await request(app)
      .post('/announcements')
      .set('x-test-auth', as(admin))
      .send({ scope: 'tenant', scopeId: 5, title: 'x', body: 'y' });
    expect(res.status).toBe(400);
  });

  it('shows a student only their relevant announcements', async () => {
    await request(app).post('/announcements').set('x-test-auth', as(admin)).send({ scope: 'tenant', title: 'All', body: 'b' });
    await request(app).post('/announcements').set('x-test-auth', as(teacher)).send({ scope: 'batch', scopeId: batchId, title: 'Batch', body: 'b' });
    // An announcement for a different batch the student isn't in.
    const pool = getPool();
    const b2 = (await pool.query(`INSERT INTO batches (tenant_id, subject_id, name) SELECT tenant_id, subject_id, 'B2' FROM batches WHERE id=$1 RETURNING id`, [batchId])).rows[0].id;
    await request(app).post('/announcements').set('x-test-auth', as(admin)).send({ scope: 'batch', scopeId: b2, title: 'Other', body: 'b' });

    const list = await request(app).get('/announcements').set('x-test-auth', as(student));
    expect(list.status).toBe(200);
    const titles = list.body.map((a: { title: string }) => a.title).sort();
    expect(titles).toEqual(['All', 'Batch']);
  });
});
