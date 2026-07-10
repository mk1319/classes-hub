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
  for (const t of [
    'attempt_answers',
    'test_attempts',
    'test_questions',
    'tests',
    'questions',
    'enrollments',
    'batch_teachers',
    'batches',
    'subjects',
    'courses',
    'users',
    'tenants',
  ]) {
    await pool.query(`DELETE FROM ${t}`);
  }
  const t = await pool.query("INSERT INTO tenants (name) VALUES ('T1') RETURNING id");
  tenantId = t.rows[0].id;
  const mk = async (role: string, email: string) =>
    (
      await pool.query(
        `INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,$2,$3,'x',$4) RETURNING id`,
        [tenantId, role, email, email]
      )
    ).rows[0].id;
  const adminId = await mk('tutor', 'admin@x.com');
  const teacherId = await mk('teacher', 'teach@x.com');
  const studentId = await mk('student', 'stud@x.com');
  admin = { userId: adminId, tenantId, role: 'tutor', sessionId: 1 };
  teacher = { userId: teacherId, tenantId, role: 'teacher', sessionId: 2 };
  student = { userId: studentId, tenantId, role: 'student', sessionId: 3 };

  const course = await pool.query(`INSERT INTO courses (tenant_id, name) VALUES ($1,'C') RETURNING id`, [tenantId]);
  const subject = await pool.query(
    `INSERT INTO subjects (tenant_id, course_id, name) VALUES ($1,$2,'S') RETURNING id`,
    [tenantId, course.rows[0].id]
  );
  const batch = await pool.query(
    `INSERT INTO batches (tenant_id, subject_id, name) VALUES ($1,$2,'B') RETURNING id`,
    [tenantId, subject.rows[0].id]
  );
  batchId = batch.rows[0].id;
  await pool.query(`INSERT INTO batch_teachers (batch_id, user_id) VALUES ($1,$2)`, [batchId, teacherId]);
  await pool.query(`INSERT INTO enrollments (batch_id, student_id) VALUES ($1,$2)`, [batchId, studentId]);
}

async function makeQuestion(auth: AuthContext, overrides: Record<string, unknown>) {
  const res = await request(app)
    .post('/questions')
    .set('x-test-auth', as(auth))
    .send({ type: 'mcq_single', body: 'Q', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answerKey: 'a', ...overrides });
  return res.body.id as number;
}

describe('tests feature', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });
  beforeEach(reset);
  afterAll(async () => {
    await getPool().end();
  });

  it('teacher builds a test; student cannot see answer keys via getTest', async () => {
    const q = await makeQuestion(teacher, {});
    const test = await request(app)
      .post('/tests')
      .set('x-test-auth', as(teacher))
      .send({ batchId, title: 'Quiz 1', questions: [{ questionId: q, marks: 2 }] });
    expect(test.status).toBe(201);

    const staffView = await request(app).get(`/tests/${test.body.id}`).set('x-test-auth', as(teacher));
    expect(staffView.body.questions[0].answer_key).toBe('a');

    const studentView = await request(app).get(`/tests/${test.body.id}`).set('x-test-auth', as(student));
    expect(studentView.status).toBe(200);
    expect(studentView.body.questions[0].answer_key).toBeUndefined();
    expect(studentView.body.questions[0].solution).toBeUndefined();
  });

  it('auto-grades an all-MCQ submission and reveals results immediately', async () => {
    const q1 = await makeQuestion(teacher, { answerKey: 'a' });
    const q2 = await makeQuestion(teacher, { answerKey: 'b' });
    const test = await request(app)
      .post('/tests')
      .set('x-test-auth', as(teacher))
      .send({ batchId, title: 'Auto', revealResults: true, questions: [{ questionId: q1, marks: 2 }, { questionId: q2, marks: 3 }] });

    const attempt = await request(app).post(`/tests/${test.body.id}/attempts`).set('x-test-auth', as(student));
    expect(attempt.status).toBe(201);

    const submit = await request(app)
      .patch(`/attempts/${attempt.body.id}`)
      .set('x-test-auth', as(student))
      .send({ answers: [{ questionId: q1, answer: 'a' }, { questionId: q2, answer: 'a' }] });
    expect(submit.status).toBe(200);
    expect(submit.body.status).toBe('graded'); // no manual questions
    expect(Number(submit.body.score)).toBe(2); // q1 right (2), q2 wrong (0)

    const result = await request(app).get(`/attempts/${attempt.body.id}/result`).set('x-test-auth', as(student));
    expect(result.body.revealed).toBe(true);
    expect(Number(result.body.score)).toBe(2);
    expect(result.body.questions).toHaveLength(2);
  });

  it('queues text answers for manual grading and withholds results until graded', async () => {
    const mcq = await makeQuestion(teacher, { answerKey: 'a' });
    const textQ = await request(app)
      .post('/questions')
      .set('x-test-auth', as(teacher))
      .send({ type: 'text', body: 'Explain' });
    const test = await request(app)
      .post('/tests')
      .set('x-test-auth', as(teacher))
      .send({ batchId, title: 'Mixed', revealResults: true, questions: [{ questionId: mcq, marks: 2 }, { questionId: textQ.body.id, marks: 5 }] });

    const attempt = await request(app).post(`/tests/${test.body.id}/attempts`).set('x-test-auth', as(student));
    const submit = await request(app)
      .patch(`/attempts/${attempt.body.id}`)
      .set('x-test-auth', as(student))
      .send({ answers: [{ questionId: mcq, answer: 'a' }, { questionId: textQ.body.id, answer: 'my essay' }] });
    expect(submit.body.status).toBe('submitted'); // pending manual

    // Student result is withheld while pending.
    const pending = await request(app).get(`/attempts/${attempt.body.id}/result`).set('x-test-auth', as(student));
    expect(pending.body.revealed).toBe(false);

    // Teacher grades the text answer.
    const grade = await request(app)
      .patch(`/attempts/${attempt.body.id}/grade`)
      .set('x-test-auth', as(teacher))
      .send({ grades: [{ questionId: textQ.body.id, marksAwarded: 4, isCorrect: true }] });
    expect(grade.body.status).toBe('graded');
    expect(Number(grade.body.score)).toBe(6); // 2 (mcq) + 4 (text)

    const revealed = await request(app).get(`/attempts/${attempt.body.id}/result`).set('x-test-auth', as(student));
    expect(revealed.body.revealed).toBe(true);
    expect(Number(revealed.body.score)).toBe(6);
  });

  it('hides results from the student when reveal is off, but staff still sees them', async () => {
    const q = await makeQuestion(teacher, { answerKey: 'a' });
    const test = await request(app)
      .post('/tests')
      .set('x-test-auth', as(teacher))
      .send({ batchId, title: 'Hidden', revealResults: false, questions: [{ questionId: q, marks: 2 }] });
    const attempt = await request(app).post(`/tests/${test.body.id}/attempts`).set('x-test-auth', as(student));
    await request(app).patch(`/attempts/${attempt.body.id}`).set('x-test-auth', as(student)).send({ answers: [{ questionId: q, answer: 'a' }] });

    const studentResult = await request(app).get(`/attempts/${attempt.body.id}/result`).set('x-test-auth', as(student));
    expect(studentResult.body.revealed).toBe(false);
    const staffResult = await request(app).get(`/attempts/${attempt.body.id}/result`).set('x-test-auth', as(teacher));
    expect(staffResult.body.revealed).toBe(true);
    expect(Number(staffResult.body.score)).toBe(2);
  });

  it('rejects a non-enrolled student starting an attempt', async () => {
    const q = await makeQuestion(teacher, {});
    const test = await request(app).post('/tests').set('x-test-auth', as(teacher)).send({ batchId, title: 'T', questions: [{ questionId: q }] });
    const outsider: AuthContext = { userId: 999, tenantId, role: 'student', sessionId: 9 };
    const res = await request(app).post(`/tests/${test.body.id}/attempts`).set('x-test-auth', as(outsider));
    expect(res.status).toBe(403);
  });

  it('forbids a teacher who does not manage the batch from creating a test', async () => {
    const q = await makeQuestion(admin, {});
    const otherTeacher: AuthContext = { userId: 777, tenantId, role: 'teacher', sessionId: 7 };
    const res = await request(app)
      .post('/tests')
      .set('x-test-auth', as(otherTeacher))
      .send({ batchId, title: 'Nope', questions: [{ questionId: q }] });
    expect(res.status).toBe(403);
  });
});
