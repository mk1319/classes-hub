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
let subjectId: number;
let batchId: number;
let admin: AuthContext;
let teacher: AuthContext;
let student: AuthContext;
let outsider: AuthContext;

async function reset() {
  const pool = getPool();
  for (const t of ['resource_files', 'resources', 'enrollments', 'batch_teachers', 'batches', 'subjects', 'courses', 'users', 'tenants']) {
    await pool.query(`DELETE FROM ${t}`);
  }
  tenantId = (await pool.query("INSERT INTO tenants (name) VALUES ('T') RETURNING id")).rows[0].id;
  const mk = async (role: string, email: string) =>
    (await pool.query(`INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,$2,$3,'x',$4) RETURNING id`, [tenantId, role, email, email])).rows[0].id;
  admin = { userId: await mk('tutor', 'a@x'), tenantId, role: 'tutor', sessionId: 1 };
  teacher = { userId: await mk('teacher', 't@x'), tenantId, role: 'teacher', sessionId: 2 };
  student = { userId: await mk('student', 's@x'), tenantId, role: 'student', sessionId: 3 };
  outsider = { userId: await mk('student', 'o@x'), tenantId, role: 'student', sessionId: 4 };
  const c = (await pool.query(`INSERT INTO courses (tenant_id, name) VALUES ($1,'C') RETURNING id`, [tenantId])).rows[0].id;
  subjectId = (await pool.query(`INSERT INTO subjects (tenant_id, course_id, name) VALUES ($1,$2,'S') RETURNING id`, [tenantId, c])).rows[0].id;
  batchId = (await pool.query(`INSERT INTO batches (tenant_id, subject_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenantId, subjectId])).rows[0].id;
  await pool.query(`INSERT INTO batch_teachers (batch_id, user_id) VALUES ($1,$2)`, [batchId, teacher.userId]);
  await pool.query(`INSERT INTO enrollments (batch_id, student_id) VALUES ($1,$2)`, [batchId, student.userId]);
}

describe('resources feature', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });
  beforeEach(reset);
  afterAll(async () => { await getPool().end(); });

  it('teacher uploads a file resource; enrolled student streams it, outsider blocked', async () => {
    const dataBase64 = Buffer.from('hello pdf').toString('base64');
    const create = await request(app)
      .post('/resources')
      .set('x-test-auth', as(teacher))
      .send({ batchId, type: 'pdf', title: 'Notes', storageType: 'upload', file: { filename: 'n.pdf', mimeType: 'application/pdf', dataBase64 } });
    expect(create.status).toBe(201);
    expect(create.body.is_downloadable).toBe(true);

    const file = await request(app).get(`/resources/${create.body.id}/file`).set('x-test-auth', as(student));
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect(file.body.toString()).toBe('hello pdf');

    const blocked = await request(app).get(`/resources/${create.body.id}/file`).set('x-test-auth', as(outsider));
    expect(blocked.status).toBe(403);
  });

  it('enforces exactly-one-scope and link-vs-upload requirements', async () => {
    const both = await request(app)
      .post('/resources')
      .set('x-test-auth', as(admin))
      .send({ subjectId, batchId, type: 'pdf', title: 'x', storageType: 'link', linkUrl: 'https://drive.example/x' });
    expect(both.status).toBe(400);

    const noLink = await request(app)
      .post('/resources')
      .set('x-test-auth', as(admin))
      .send({ subjectId, type: 'video', title: 'x', storageType: 'link' });
    expect(noLink.status).toBe(400);
  });

  it('creates a subject-scoped link; visible to a student enrolled in a batch under that subject', async () => {
    const create = await request(app)
      .post('/resources')
      .set('x-test-auth', as(admin))
      .send({ subjectId, type: 'video', title: 'Lecture', storageType: 'link', linkUrl: 'https://youtu.be/x' });
    expect(create.status).toBe(201);
    expect(create.body.is_downloadable).toBe(false); // links are never downloadable

    const list = await request(app).get('/resources').set('x-test-auth', as(student));
    expect(list.body.map((r: { title: string }) => r.title)).toContain('Lecture');

    // Outsider (not enrolled anywhere) sees nothing.
    const none = await request(app).get('/resources').set('x-test-auth', as(outsider));
    expect(none.body).toHaveLength(0);
  });

  it('forbids a teacher from adding a resource to a subject they do not teach', async () => {
    const other: AuthContext = { userId: 888, tenantId, role: 'teacher', sessionId: 8 };
    const res = await request(app)
      .post('/resources')
      .set('x-test-auth', as(other))
      .send({ subjectId, type: 'pdf', title: 'x', storageType: 'link', linkUrl: 'https://x.example' });
    expect(res.status).toBe(403);
  });

  it('streams-guard: file endpoint 400s for a link resource', async () => {
    const create = await request(app)
      .post('/resources')
      .set('x-test-auth', as(admin))
      .send({ batchId, type: 'video', title: 'L', storageType: 'link', linkUrl: 'https://x.example' });
    const res = await request(app).get(`/resources/${create.body.id}/file`).set('x-test-auth', as(admin));
    expect(res.status).toBe(400);
  });
});
