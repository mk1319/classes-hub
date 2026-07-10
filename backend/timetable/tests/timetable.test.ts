import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Request } from 'express';
import { getPool, type AuthContext } from '@classes-hub/shared';
import { buildApp } from '../src/handler';
import { weeklyDates } from '../src/timetable';

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
  for (const t of ['timetable_sessions', 'enrollments', 'batch_teachers', 'batches', 'subjects', 'courses', 'users', 'tenants']) {
    await pool.query(`DELETE FROM ${t}`);
  }
  tenantId = (await pool.query("INSERT INTO tenants (name) VALUES ('T') RETURNING id")).rows[0].id;
  const mk = async (role: string, email: string) =>
    (await pool.query(`INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,$2,$3,'x',$4) RETURNING id`, [tenantId, role, email, email])).rows[0].id;
  const adminId = await mk('tutor', 'a@x');
  const teacherId = await mk('teacher', 't@x');
  const studentId = await mk('student', 's@x');
  admin = { userId: adminId, tenantId, role: 'tutor', sessionId: 1 };
  teacher = { userId: teacherId, tenantId, role: 'teacher', sessionId: 2 };
  student = { userId: studentId, tenantId, role: 'student', sessionId: 3 };
  const c = (await pool.query(`INSERT INTO courses (tenant_id, name) VALUES ($1,'C') RETURNING id`, [tenantId])).rows[0].id;
  const s = (await pool.query(`INSERT INTO subjects (tenant_id, course_id, name) VALUES ($1,$2,'S') RETURNING id`, [tenantId, c])).rows[0].id;
  batchId = (await pool.query(`INSERT INTO batches (tenant_id, subject_id, name) VALUES ($1,$2,'B') RETURNING id`, [tenantId, s])).rows[0].id;
  await pool.query(`INSERT INTO batch_teachers (batch_id, user_id) VALUES ($1,$2)`, [batchId, teacherId]);
  await pool.query(`INSERT INTO enrollments (batch_id, student_id) VALUES ($1,$2)`, [batchId, studentId]);
}

describe('timetable feature', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });
  beforeEach(reset);
  afterAll(async () => { await getPool().end(); });

  it('weeklyDates expands inclusive weekly occurrences', () => {
    expect(weeklyDates('2026-01-05', '2026-01-26')).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  });

  it('admin creates a one-off session; enrolled student can read it', async () => {
    const create = await request(app)
      .post(`/batches/${batchId}/sessions`)
      .set('x-test-auth', as(admin))
      .send({ title: 'Lecture', sessionDate: '2026-02-01', startTime: '09:00', endTime: '10:00' });
    expect(create.status).toBe(201);
    expect(create.body).toHaveLength(1);

    const list = await request(app).get(`/batches/${batchId}/sessions`).set('x-test-auth', as(student));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('generates a weekly series and deletes it as a series', async () => {
    const create = await request(app)
      .post(`/batches/${batchId}/sessions`)
      .set('x-test-auth', as(teacher))
      .send({ title: 'Weekly', sessionDate: '2026-03-02', startTime: '07:00', endTime: '08:00', recurrence: 'weekly', recurUntil: '2026-03-23' });
    expect(create.body).toHaveLength(4);
    const seriesId = create.body[0].series_id;
    expect(seriesId).toBeTruthy();

    const one = create.body[0].id;
    const del = await request(app).delete(`/batches/${batchId}/sessions/${one}?series=true`).set('x-test-auth', as(teacher));
    expect(del.status).toBe(204);
    const list = await request(app).get(`/batches/${batchId}/sessions`).set('x-test-auth', as(teacher));
    expect(list.body).toHaveLength(0);
  });

  it('forbids a non-managing teacher from creating sessions', async () => {
    const other: AuthContext = { userId: 555, tenantId, role: 'teacher', sessionId: 5 };
    const res = await request(app)
      .post(`/batches/${batchId}/sessions`)
      .set('x-test-auth', as(other))
      .send({ sessionDate: '2026-02-01', startTime: '09:00', endTime: '10:00' });
    expect(res.status).toBe(403);
  });

  it('rejects a non-enrolled student reading the schedule', async () => {
    const other: AuthContext = { userId: 556, tenantId, role: 'student', sessionId: 6 };
    const res = await request(app).get(`/batches/${batchId}/sessions`).set('x-test-auth', as(other));
    expect(res.status).toBe(403);
  });
});
