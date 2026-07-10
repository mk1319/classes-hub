// backend/tests/src/tests.ts
//
// Question bank, test builder, attempts, grading, and results — all tenant-scoped
// from the JWT. See plan/03-features-v1.md §Tests & Assignments and
// plan/05-backend-api.md §tests.
//
// Authorization model:
//   - questions/tests: teacher (managing the batch) or admin may write.
//   - attempts (start/submit): the enrolled student only.
//   - grade: managing teacher or admin.
//   - result: the owning student (subject to reveal config) or teacher/admin.

import {
  badRequest,
  forbidden,
  getPool,
  isAdmin,
  notFound,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import type { PoolClient } from 'pg';
import { gradeAnswer, type GradableQuestion } from './grading';
import type { CreateQuestionInput, CreateTestInput, GradeAttemptInput, SubmitAttemptInput } from './schema';

function requireTeacherOrAdmin(ctx: AuthContext): number {
  const tenantId = requireTenant(ctx);
  if (!isAdmin(ctx.role) && ctx.role !== 'teacher') throw forbidden('STAFF_ONLY');
  return tenantId;
}

async function managesBatch(tenantId: number, batchId: number, ctx: AuthContext): Promise<boolean> {
  if (isAdmin(ctx.role)) {
    const r = await getPool().query(`SELECT 1 FROM batches WHERE id = $1 AND tenant_id = $2`, [batchId, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }
  const r = await getPool().query(
    `SELECT 1 FROM batch_teachers bt JOIN batches b ON b.id = bt.batch_id
      WHERE bt.batch_id = $1 AND bt.user_id = $2 AND b.tenant_id = $3`,
    [batchId, ctx.userId, tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}

async function isEnrolled(tenantId: number, batchId: number, studentId: number): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM enrollments e JOIN batches b ON b.id = e.batch_id
      WHERE e.batch_id = $1 AND e.student_id = $2 AND b.tenant_id = $3`,
    [batchId, studentId, tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}

// ---- Question bank --------------------------------------------------------

const QUESTION_COLS =
  'id, tenant_id, subject_id, type, body, options, answer_key, solution, solution_image_url, created_by, created_at';

export async function createQuestion(ctx: AuthContext, input: CreateQuestionInput) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const r = await getPool().query(
    `INSERT INTO questions (tenant_id, subject_id, type, body, options, answer_key, solution, solution_image_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${QUESTION_COLS}`,
    [
      tenantId,
      input.subjectId ?? null,
      input.type,
      input.body,
      input.options ? JSON.stringify(input.options) : null,
      input.answerKey !== undefined ? JSON.stringify(input.answerKey) : null,
      input.solution ?? null,
      input.solutionImageUrl ?? null,
      ctx.userId,
    ]
  );
  return r.rows[0];
}

export async function listQuestions(ctx: AuthContext, filters: { subjectId?: number; type?: string }) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const params: unknown[] = [tenantId];
  let where = 'tenant_id = $1';
  if (filters.subjectId) {
    params.push(filters.subjectId);
    where += ` AND subject_id = $${params.length}`;
  }
  if (filters.type) {
    params.push(filters.type);
    where += ` AND type = $${params.length}`;
  }
  const r = await getPool().query(
    `SELECT ${QUESTION_COLS} FROM questions WHERE ${where} ORDER BY id DESC`,
    params
  );
  return r.rows;
}

export async function getQuestion(ctx: AuthContext, id: number) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const r = await getPool().query(`SELECT ${QUESTION_COLS} FROM questions WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  if (r.rowCount === 0) throw notFound('QUESTION_NOT_FOUND');
  return r.rows[0];
}

export async function updateQuestion(ctx: AuthContext, id: number, input: Partial<CreateQuestionInput>) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const existing = await getPool().query(`SELECT created_by FROM questions WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  if (existing.rowCount === 0) throw notFound('QUESTION_NOT_FOUND');
  if (!isAdmin(ctx.role) && existing.rows[0].created_by !== ctx.userId) throw forbidden('NOT_OWNER');

  const r = await getPool().query(
    `UPDATE questions SET
        subject_id = COALESCE($3, subject_id),
        type = COALESCE($4, type),
        body = COALESCE($5, body),
        options = COALESCE($6, options),
        answer_key = COALESCE($7, answer_key),
        solution = COALESCE($8, solution),
        solution_image_url = COALESCE($9, solution_image_url)
      WHERE id = $1 AND tenant_id = $2
      RETURNING ${QUESTION_COLS}`,
    [
      id,
      tenantId,
      input.subjectId ?? null,
      input.type ?? null,
      input.body ?? null,
      input.options ? JSON.stringify(input.options) : null,
      input.answerKey !== undefined ? JSON.stringify(input.answerKey) : null,
      input.solution ?? null,
      input.solutionImageUrl ?? null,
    ]
  );
  return r.rows[0];
}

export async function deleteQuestion(ctx: AuthContext, id: number) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const existing = await getPool().query(`SELECT created_by FROM questions WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  if (existing.rowCount === 0) throw notFound('QUESTION_NOT_FOUND');
  if (!isAdmin(ctx.role) && existing.rows[0].created_by !== ctx.userId) throw forbidden('NOT_OWNER');
  await getPool().query(`DELETE FROM questions WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

// ---- Test builder ---------------------------------------------------------

const TEST_COLS =
  'id, tenant_id, batch_id, title, negative_marking, negative_marking_value, reveal_results, created_by, created_at';

async function setTestQuestions(
  client: PoolClient,
  tenantId: number,
  testId: number,
  questions: NonNullable<CreateTestInput['questions']>
) {
  await client.query(`DELETE FROM test_questions WHERE test_id = $1`, [testId]);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const owned = await client.query(`SELECT 1 FROM questions WHERE id = $1 AND tenant_id = $2`, [
      q.questionId,
      tenantId,
    ]);
    if (owned.rowCount === 0) throw badRequest('QUESTION_NOT_IN_TENANT', `Question ${q.questionId} not found`);
    await client.query(
      `INSERT INTO test_questions (test_id, question_id, position, marks) VALUES ($1,$2,$3,$4)`,
      [testId, q.questionId, q.position ?? i, q.marks ?? 1]
    );
  }
}

export async function createTest(ctx: AuthContext, input: CreateTestInput) {
  const tenantId = requireTeacherOrAdmin(ctx);
  if (!(await managesBatch(tenantId, input.batchId, ctx))) throw forbidden('NOT_BATCH_MANAGER');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO tests (tenant_id, batch_id, title, negative_marking, negative_marking_value, reveal_results, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${TEST_COLS}`,
      [
        tenantId,
        input.batchId,
        input.title,
        input.negativeMarking ?? false,
        input.negativeMarkingValue ?? 0,
        input.revealResults ?? true,
        ctx.userId,
      ]
    );
    const test = r.rows[0];
    if (input.questions?.length) await setTestQuestions(client, tenantId, test.id, input.questions);
    await client.query('COMMIT');
    return test;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listTests(ctx: AuthContext, batchId?: number) {
  const tenantId = requireTenant(ctx);
  if (ctx.role === 'student') {
    // Students only see tests for batches they're enrolled in.
    const r = await getPool().query(
      `SELECT t.id, t.tenant_id, t.batch_id, t.title, t.negative_marking,
              t.negative_marking_value, t.reveal_results, t.created_by, t.created_at
         FROM tests t
         JOIN enrollments e ON e.batch_id = t.batch_id
        WHERE t.tenant_id = $1 AND e.student_id = $2
          AND ($3::int IS NULL OR t.batch_id = $3)
        ORDER BY t.created_at DESC`,
      [tenantId, ctx.userId, batchId ?? null]
    );
    return r.rows;
  }
  const params: unknown[] = [tenantId];
  let where = 'tenant_id = $1';
  if (batchId) {
    params.push(batchId);
    where += ` AND batch_id = $${params.length}`;
  }
  const r = await getPool().query(`SELECT ${TEST_COLS} FROM tests WHERE ${where} ORDER BY created_at DESC`, params);
  return r.rows;
}

/** Full test with ordered questions. Students never receive answer keys/solutions here. */
export async function getTest(ctx: AuthContext, id: number) {
  const tenantId = requireTenant(ctx);
  const testR = await getPool().query(`SELECT ${TEST_COLS} FROM tests WHERE id = $1 AND tenant_id = $2`, [
    id,
    tenantId,
  ]);
  if (testR.rowCount === 0) throw notFound('TEST_NOT_FOUND');
  const test = testR.rows[0];

  const isStaff = isAdmin(ctx.role) || ctx.role === 'teacher';
  if (ctx.role === 'student' && !(await isEnrolled(tenantId, test.batch_id, ctx.userId))) {
    throw forbidden('NOT_ENROLLED');
  }

  const cols = isStaff
    ? 'q.id, q.type, q.body, q.options, q.answer_key, q.solution, q.solution_image_url, tq.position, tq.marks'
    : 'q.id, q.type, q.body, q.options, tq.position, tq.marks';
  const qR = await getPool().query(
    `SELECT ${cols} FROM test_questions tq JOIN questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1 ORDER BY tq.position ASC, q.id ASC`,
    [id]
  );
  return { ...test, questions: qR.rows };
}

export async function updateTest(
  ctx: AuthContext,
  id: number,
  input: Partial<CreateTestInput> & { questions?: CreateTestInput['questions'] }
) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const testR = await getPool().query(`SELECT batch_id FROM tests WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (testR.rowCount === 0) throw notFound('TEST_NOT_FOUND');
  if (!(await managesBatch(tenantId, testR.rows[0].batch_id, ctx))) throw forbidden('NOT_BATCH_MANAGER');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE tests SET
          title = COALESCE($3, title),
          negative_marking = COALESCE($4, negative_marking),
          negative_marking_value = COALESCE($5, negative_marking_value),
          reveal_results = COALESCE($6, reveal_results)
        WHERE id = $1 AND tenant_id = $2 RETURNING ${TEST_COLS}`,
      [
        id,
        tenantId,
        input.title ?? null,
        input.negativeMarking ?? null,
        input.negativeMarkingValue ?? null,
        input.revealResults ?? null,
      ]
    );
    if (input.questions) await setTestQuestions(client, tenantId, id, input.questions);
    await client.query('COMMIT');
    return r.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteTest(ctx: AuthContext, id: number) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const testR = await getPool().query(`SELECT batch_id FROM tests WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (testR.rowCount === 0) throw notFound('TEST_NOT_FOUND');
  if (!(await managesBatch(tenantId, testR.rows[0].batch_id, ctx))) throw forbidden('NOT_BATCH_MANAGER');
  await getPool().query(`DELETE FROM tests WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}

// ---- Attempts -------------------------------------------------------------

export async function startAttempt(ctx: AuthContext, testId: number) {
  const tenantId = requireTenant(ctx);
  if (ctx.role !== 'student') throw forbidden('STUDENTS_ONLY');
  const testR = await getPool().query(`SELECT batch_id FROM tests WHERE id = $1 AND tenant_id = $2`, [
    testId,
    tenantId,
  ]);
  if (testR.rowCount === 0) throw notFound('TEST_NOT_FOUND');
  if (!(await isEnrolled(tenantId, testR.rows[0].batch_id, ctx.userId))) throw forbidden('NOT_ENROLLED');

  // Resume an in-progress attempt rather than creating duplicates.
  const existing = await getPool().query(
    `SELECT id, status, score, started_at, submitted_at FROM test_attempts
      WHERE test_id = $1 AND student_id = $2 AND status = 'in_progress'`,
    [testId, ctx.userId]
  );
  if ((existing.rowCount ?? 0) > 0) return existing.rows[0];

  const r = await getPool().query(
    `INSERT INTO test_attempts (tenant_id, test_id, student_id) VALUES ($1,$2,$3)
     RETURNING id, status, score, started_at, submitted_at`,
    [tenantId, testId, ctx.userId]
  );
  return r.rows[0];
}

export async function submitAttempt(ctx: AuthContext, attemptId: number, input: SubmitAttemptInput) {
  const tenantId = requireTenant(ctx);
  const aR = await getPool().query(
    `SELECT a.id, a.test_id, a.student_id, a.status, t.negative_marking, t.negative_marking_value
       FROM test_attempts a JOIN tests t ON t.id = a.test_id
      WHERE a.id = $1 AND a.tenant_id = $2`,
    [attemptId, tenantId]
  );
  if (aR.rowCount === 0) throw notFound('ATTEMPT_NOT_FOUND');
  const attempt = aR.rows[0];
  if (attempt.student_id !== ctx.userId) throw forbidden('NOT_ATTEMPT_OWNER');
  if (attempt.status !== 'in_progress') throw badRequest('ATTEMPT_NOT_OPEN');

  // Load this test's questions (marks + grading key).
  const tqR = await getPool().query(
    `SELECT tq.question_id, tq.marks, q.type, q.answer_key
       FROM test_questions tq JOIN questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1`,
    [attempt.test_id]
  );
  const byId = new Map<number, { marks: number; type: string; answer_key: unknown }>();
  for (const row of tqR.rows) byId.set(row.question_id, row);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    let anyManual = false;
    for (const submitted of input.answers) {
      const meta = byId.get(submitted.questionId);
      if (!meta) throw badRequest('QUESTION_NOT_IN_TEST', `Question ${submitted.questionId} is not in this test`);
      const graded = gradeAnswer(meta as GradableQuestion, submitted.answer, {
        marks: Number(meta.marks),
        negativeMarking: attempt.negative_marking,
        negativeMarkingValue: Number(attempt.negative_marking_value),
      });
      if (graded.manual) anyManual = true;
      await client.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, answer, marks_awarded, is_correct)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET answer = EXCLUDED.answer, marks_awarded = EXCLUDED.marks_awarded, is_correct = EXCLUDED.is_correct`,
        [
          attemptId,
          submitted.questionId,
          submitted.answer !== undefined ? JSON.stringify(submitted.answer) : null,
          graded.marksAwarded,
          graded.isCorrect,
        ]
      );
    }
    // Score so far = sum of auto-graded marks (manual answers contribute once graded).
    const score = await recomputeScore(client, attemptId);
    const status = anyManual ? 'submitted' : 'graded';
    const r = await client.query(
      `UPDATE test_attempts SET status = $2, score = $3, submitted_at = now()
        WHERE id = $1 RETURNING id, status, score, started_at, submitted_at`,
      [attemptId, status, score]
    );
    await client.query('COMMIT');
    return r.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function recomputeScore(client: PoolClient, attemptId: number): Promise<number> {
  const r = await client.query(
    `SELECT COALESCE(SUM(marks_awarded), 0) AS score FROM attempt_answers WHERE attempt_id = $1`,
    [attemptId]
  );
  return Number(r.rows[0].score);
}

export async function gradeAttempt(ctx: AuthContext, attemptId: number, input: GradeAttemptInput) {
  const tenantId = requireTeacherOrAdmin(ctx);
  const aR = await getPool().query(
    `SELECT a.id, a.test_id, t.batch_id FROM test_attempts a JOIN tests t ON t.id = a.test_id
      WHERE a.id = $1 AND a.tenant_id = $2`,
    [attemptId, tenantId]
  );
  if (aR.rowCount === 0) throw notFound('ATTEMPT_NOT_FOUND');
  if (!(await managesBatch(tenantId, aR.rows[0].batch_id, ctx))) throw forbidden('NOT_BATCH_MANAGER');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const g of input.grades) {
      const upd = await client.query(
        `UPDATE attempt_answers SET marks_awarded = $3, is_correct = $4, graded_by = $5
          WHERE attempt_id = $1 AND question_id = $2`,
        [attemptId, g.questionId, g.marksAwarded, g.isCorrect ?? null, ctx.userId]
      );
      if (upd.rowCount === 0) throw badRequest('ANSWER_NOT_FOUND', `No answer for question ${g.questionId}`);
    }
    const score = await recomputeScore(client, attemptId);
    // Fully graded once no answer is still missing a mark.
    const pending = await client.query(
      `SELECT 1 FROM attempt_answers WHERE attempt_id = $1 AND marks_awarded IS NULL LIMIT 1`,
      [attemptId]
    );
    const status = (pending.rowCount ?? 0) > 0 ? 'submitted' : 'graded';
    const r = await client.query(
      `UPDATE test_attempts SET score = $2, status = $3 WHERE id = $1
        RETURNING id, status, score, started_at, submitted_at`,
      [attemptId, score, status]
    );
    await client.query('COMMIT');
    return r.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getResult(ctx: AuthContext, attemptId: number) {
  const tenantId = requireTenant(ctx);
  const aR = await getPool().query(
    `SELECT a.id, a.test_id, a.student_id, a.status, a.score, a.submitted_at, t.batch_id, t.reveal_results, t.title
       FROM test_attempts a JOIN tests t ON t.id = a.test_id
      WHERE a.id = $1 AND a.tenant_id = $2`,
    [attemptId, tenantId]
  );
  if (aR.rowCount === 0) throw notFound('ATTEMPT_NOT_FOUND');
  const attempt = aR.rows[0];

  const isStaff = isAdmin(ctx.role) || ctx.role === 'teacher';
  const isOwner = attempt.student_id === ctx.userId;
  if (!isStaff && !isOwner) throw forbidden('NOT_ALLOWED');
  if (isStaff && !(await managesBatch(tenantId, attempt.batch_id, ctx)))
    throw forbidden('NOT_BATCH_MANAGER');

  // Staff always see full detail. A student sees marks/solutions only when the
  // test reveals results AND grading is complete.
  const revealed = isStaff || (attempt.reveal_results && attempt.status === 'graded');
  const base = {
    id: attempt.id,
    testId: attempt.test_id,
    title: attempt.title,
    status: attempt.status,
    revealed,
  };
  if (!revealed) return base;

  const detail = await getPool().query(
    `SELECT q.id AS question_id, q.type, q.body, q.options, q.answer_key, q.solution, q.solution_image_url,
            tq.marks, aa.answer, aa.marks_awarded, aa.is_correct
       FROM test_questions tq
       JOIN questions q ON q.id = tq.question_id
       LEFT JOIN attempt_answers aa ON aa.attempt_id = $1 AND aa.question_id = q.id
      WHERE tq.test_id = $2 ORDER BY tq.position ASC, q.id ASC`,
    [attemptId, attempt.test_id]
  );
  return { ...base, score: attempt.score == null ? null : Number(attempt.score), questions: detail.rows };
}
