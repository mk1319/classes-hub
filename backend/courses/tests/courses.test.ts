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
let admin: AuthContext;
let teacherId: number;
let studentId: number;

async function seedUser(role: string, email: string): Promise<number> {
  const r = await getPool().query(
    `INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,$2,$3,'x',$4) RETURNING id`,
    [tenantId, role, email, email]
  );
  return r.rows[0].id;
}

describe('courses feature', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM enrollments');
    await pool.query('DELETE FROM batch_teachers');
    await pool.query('DELETE FROM batches');
    await pool.query('DELETE FROM subjects');
    await pool.query('DELETE FROM courses');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    const t = await pool.query("INSERT INTO tenants (name) VALUES ('T1') RETURNING id");
    tenantId = t.rows[0].id;
    admin = { userId: 1, tenantId, role: 'tutor', sessionId: 1 };
    teacherId = await seedUser('teacher', 'teach@example.com');
    studentId = await seedUser('student', 'stud@example.com');
  });

  afterAll(async () => {
    await getPool().end();
  });

  async function makeBatch() {
    const course = await request(app).post('/courses').set('x-test-auth', as(admin)).send({ name: 'Class 10', type: 'school' });
    const subject = await request(app)
      .post(`/courses/${course.body.id}/subjects`)
      .set('x-test-auth', as(admin))
      .send({ name: 'Physics' });
    const batch = await request(app)
      .post(`/subjects/${subject.body.id}/batches`)
      .set('x-test-auth', as(admin))
      .send({ name: 'Morning A', scheduleInfo: 'Mon/Wed 7am' });
    return { courseId: course.body.id, subjectId: subject.body.id, batchId: batch.body.id };
  }

  it('creates the full course/subject/batch hierarchy', async () => {
    const { batchId } = await makeBatch();
    const batch = await request(app).get(`/batches/${batchId}`).set('x-test-auth', as(admin));
    expect(batch.status).toBe(200);
    expect(batch.body.name).toBe('Morning A');
    expect(batch.body.show_progress_to_students).toBe(false);
  });

  it('forbids a teacher from creating a course', async () => {
    const teacher: AuthContext = { userId: teacherId, tenantId, role: 'teacher', sessionId: 5 };
    const res = await request(app).post('/courses').set('x-test-auth', as(teacher)).send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  it('assigns/lists/removes a teacher, and rejects assigning a student', async () => {
    const { batchId } = await makeBatch();
    const bad = await request(app)
      .post(`/batches/${batchId}/teachers`)
      .set('x-test-auth', as(admin))
      .send({ userId: studentId });
    expect(bad.status).toBe(400); // student can't be a teacher

    const ok = await request(app)
      .post(`/batches/${batchId}/teachers`)
      .set('x-test-auth', as(admin))
      .send({ userId: teacherId });
    expect(ok.status).toBe(204);

    const list = await request(app).get(`/batches/${batchId}/teachers`).set('x-test-auth', as(admin));
    expect(list.body).toHaveLength(1);

    const del = await request(app)
      .delete(`/batches/${batchId}/teachers/${teacherId}`)
      .set('x-test-auth', as(admin));
    expect(del.status).toBe(204);
  });

  it('enrolls and unenrolls a student', async () => {
    const { batchId } = await makeBatch();
    const enroll = await request(app)
      .post(`/batches/${batchId}/enrollments`)
      .set('x-test-auth', as(admin))
      .send({ studentId });
    expect(enroll.status).toBe(204);
    const list = await request(app).get(`/batches/${batchId}/enrollments`).set('x-test-auth', as(admin));
    expect(list.body.map((s: { id: number }) => s.id)).toContain(studentId);
    const un = await request(app)
      .delete(`/batches/${batchId}/enrollments/${studentId}`)
      .set('x-test-auth', as(admin));
    expect(un.status).toBe(204);
  });

  it('lets an assigned teacher toggle show_progress but not rename the batch', async () => {
    const { batchId } = await makeBatch();
    await request(app).post(`/batches/${batchId}/teachers`).set('x-test-auth', as(admin)).send({ userId: teacherId });
    const teacher: AuthContext = { userId: teacherId, tenantId, role: 'teacher', sessionId: 7 };

    const toggle = await request(app)
      .patch(`/batches/${batchId}`)
      .set('x-test-auth', as(teacher))
      .send({ showProgressToStudents: true });
    expect(toggle.status).toBe(200);
    expect(toggle.body.show_progress_to_students).toBe(true);

    const rename = await request(app)
      .patch(`/batches/${batchId}`)
      .set('x-test-auth', as(teacher))
      .send({ name: 'Hacked' });
    expect(rename.status).toBe(403);
  });

  it('forbids an unassigned teacher from toggling show_progress', async () => {
    const { batchId } = await makeBatch();
    const teacher: AuthContext = { userId: teacherId, tenantId, role: 'teacher', sessionId: 8 };
    const res = await request(app)
      .patch(`/batches/${batchId}`)
      .set('x-test-auth', as(teacher))
      .send({ showProgressToStudents: true });
    expect(res.status).toBe(403);
  });
});
