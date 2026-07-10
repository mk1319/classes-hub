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

async function reset() {
  const pool = getPool();
  for (const t of ['chapter_coverage', 'chapters', 'enrollments', 'batch_teachers', 'batches', 'subjects', 'courses', 'users', 'tenants']) {
    await pool.query(`DELETE FROM ${t}`);
  }
  tenantId = (await pool.query("INSERT INTO tenants (name) VALUES ('T') RETURNING id")).rows[0].id;
  const mk = async (role: string, email: string) =>
    (await pool.query(`INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,$2,$3,'x',$4) RETURNING id`, [tenantId, role, email, email])).rows[0].id;
  admin = { userId: await mk('tutor', 'a@x'), tenantId, role: 'tutor', sessionId: 1 };
  teacher = { userId: await mk('teacher', 't@x'), tenantId, role: 'teacher', sessionId: 2 };
  student = { userId: await mk('student', 's@x'), tenantId, role: 'student', sessionId: 3 };
  const c = (await pool.query(`INSERT INTO courses (tenant_id, name) VALUES ($1,'C') RETURNING id`, [tenantId])).rows[0].id;
  subjectId = (await pool.query(`INSERT INTO subjects (tenant_id, course_id, name) VALUES ($1,$2,'S') RETURNING id`, [tenantId, c])).rows[0].id;
  batchId = (await pool.query(`INSERT INTO batches (tenant_id, subject_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenantId, subjectId])).rows[0].id;
  await pool.query(`INSERT INTO batch_teachers (batch_id, user_id) VALUES ($1,$2)`, [batchId, teacher.userId]);
  await pool.query(`INSERT INTO enrollments (batch_id, student_id) VALUES ($1,$2)`, [batchId, student.userId]);
}

async function setProgress(visible: boolean) {
  await getPool().query(`UPDATE batches SET show_progress_to_students = $2 WHERE id = $1`, [batchId, visible]);
}

describe('syllabus feature', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });
  beforeEach(reset);
  afterAll(async () => { await getPool().end(); });

  it('teacher creates chapters and logs coverage against one', async () => {
    const ch = await request(app)
      .post(`/subjects/${subjectId}/chapters`)
      .set('x-test-auth', as(teacher))
      .send({ title: 'Ch 1: Kinematics', position: 1 });
    expect(ch.status).toBe(201);

    const cov = await request(app)
      .post(`/batches/${batchId}/coverage`)
      .set('x-test-auth', as(teacher))
      .send({ chapterId: ch.body.id, coveredDate: '2026-02-10' });
    expect(cov.status).toBe(201);
    expect(cov.body.title).toBe('Ch 1: Kinematics'); // resolved from the chapter
  });

  it('supports free-form coverage entries with no chapter', async () => {
    const cov = await request(app)
      .post(`/batches/${batchId}/coverage`)
      .set('x-test-auth', as(teacher))
      .send({ title: 'Covered projectile motion basics', coveredDate: '2026-02-11', notes: 'extra class' });
    expect(cov.status).toBe(201);
    expect(cov.body.title).toBe('Covered projectile motion basics');
  });

  it('hides coverage from students unless show_progress is on', async () => {
    await request(app).post(`/batches/${batchId}/coverage`).set('x-test-auth', as(teacher)).send({ title: 'X', coveredDate: '2026-02-12' });

    await setProgress(false);
    const hidden = await request(app).get(`/batches/${batchId}/coverage`).set('x-test-auth', as(student));
    expect(hidden.status).toBe(403);

    await setProgress(true);
    const visible = await request(app).get(`/batches/${batchId}/coverage`).set('x-test-auth', as(student));
    expect(visible.status).toBe(200);
    expect(visible.body).toHaveLength(1);
  });

  it('staff always see coverage regardless of the toggle', async () => {
    await request(app).post(`/batches/${batchId}/coverage`).set('x-test-auth', as(admin)).send({ title: 'X', coveredDate: '2026-02-12' });
    await setProgress(false);
    const res = await request(app).get(`/batches/${batchId}/coverage`).set('x-test-auth', as(teacher));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('forbids a non-managing teacher from logging coverage', async () => {
    const other: AuthContext = { userId: 999, tenantId, role: 'teacher', sessionId: 9 };
    const res = await request(app)
      .post(`/batches/${batchId}/coverage`)
      .set('x-test-auth', as(other))
      .send({ title: 'X', coveredDate: '2026-02-12' });
    expect(res.status).toBe(403);
  });
});
