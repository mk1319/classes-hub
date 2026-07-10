// backend/courses/src/courses.ts
//
// Academic structure CRUD: Course -> Subject -> Batch, teacher assignment, and
// student enrollment. Everything is tenant-scoped from the JWT. Mutations are
// admin-only, with one deliberate exception: an assigned teacher may toggle
// `show_progress_to_students` on their own batch (plan/11-syllabus-tracking-feature.md).

import {
  badRequest,
  forbidden,
  getPool,
  isAdmin,
  notFound,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import type {
  CreateBatchInput,
  CreateCourseInput,
  UpdateBatchInput,
  UpdateCourseInput,
} from './schema';

function requireAdmin(ctx: AuthContext): number {
  const tenantId = requireTenant(ctx);
  if (!isAdmin(ctx.role)) throw forbidden('ADMIN_ONLY');
  return tenantId;
}

/** True if the user is assigned to teach the given batch (within the tenant). */
async function isBatchTeacher(tenantId: number, batchId: number, userId: number): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM batch_teachers bt
       JOIN batches b ON b.id = bt.batch_id
      WHERE bt.batch_id = $1 AND bt.user_id = $2 AND b.tenant_id = $3`,
    [batchId, userId, tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}

// ---- Courses --------------------------------------------------------------

export async function createCourse(ctx: AuthContext, input: CreateCourseInput) {
  const tenantId = requireAdmin(ctx);
  const r = await getPool().query(
    `INSERT INTO courses (tenant_id, name, type) VALUES ($1,$2,$3)
     RETURNING id, tenant_id, name, type, created_at`,
    [tenantId, input.name, input.type ?? null]
  );
  return r.rows[0];
}

export async function listCourses(ctx: AuthContext) {
  const tenantId = requireTenant(ctx);
  const r = await getPool().query(
    `SELECT id, tenant_id, name, type, created_at FROM courses WHERE tenant_id = $1 ORDER BY name ASC`,
    [tenantId]
  );
  return r.rows;
}

export async function getCourse(ctx: AuthContext, id: number) {
  const tenantId = requireTenant(ctx);
  const r = await getPool().query(
    `SELECT id, tenant_id, name, type, created_at FROM courses WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (r.rowCount === 0) throw notFound('COURSE_NOT_FOUND');
  return r.rows[0];
}

export async function updateCourse(ctx: AuthContext, id: number, input: UpdateCourseInput) {
  const tenantId = requireAdmin(ctx);
  const r = await getPool().query(
    `UPDATE courses SET name = COALESCE($3, name), type = COALESCE($4, type)
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, tenant_id, name, type, created_at`,
    [id, tenantId, input.name ?? null, input.type ?? null]
  );
  if (r.rowCount === 0) throw notFound('COURSE_NOT_FOUND');
  return r.rows[0];
}

export async function deleteCourse(ctx: AuthContext, id: number) {
  const tenantId = requireAdmin(ctx);
  const r = await getPool().query(`DELETE FROM courses WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (r.rowCount === 0) throw notFound('COURSE_NOT_FOUND');
}

// ---- Subjects -------------------------------------------------------------

async function assertCourse(tenantId: number, courseId: number) {
  const r = await getPool().query(`SELECT 1 FROM courses WHERE id = $1 AND tenant_id = $2`, [courseId, tenantId]);
  if (r.rowCount === 0) throw notFound('COURSE_NOT_FOUND');
}

export async function createSubject(ctx: AuthContext, courseId: number, name: string) {
  const tenantId = requireAdmin(ctx);
  await assertCourse(tenantId, courseId);
  const r = await getPool().query(
    `INSERT INTO subjects (tenant_id, course_id, name) VALUES ($1,$2,$3)
     RETURNING id, tenant_id, course_id, name, created_at`,
    [tenantId, courseId, name]
  );
  return r.rows[0];
}

export async function listSubjects(ctx: AuthContext, courseId: number) {
  const tenantId = requireTenant(ctx);
  await assertCourse(tenantId, courseId);
  const r = await getPool().query(
    `SELECT id, tenant_id, course_id, name, created_at FROM subjects
      WHERE course_id = $1 AND tenant_id = $2 ORDER BY name ASC`,
    [courseId, tenantId]
  );
  return r.rows;
}

export async function updateSubject(ctx: AuthContext, courseId: number, subjectId: number, name: string) {
  const tenantId = requireAdmin(ctx);
  const r = await getPool().query(
    `UPDATE subjects SET name = $4 WHERE id = $1 AND course_id = $2 AND tenant_id = $3
     RETURNING id, tenant_id, course_id, name, created_at`,
    [subjectId, courseId, tenantId, name]
  );
  if (r.rowCount === 0) throw notFound('SUBJECT_NOT_FOUND');
  return r.rows[0];
}

export async function deleteSubject(ctx: AuthContext, courseId: number, subjectId: number) {
  const tenantId = requireAdmin(ctx);
  const r = await getPool().query(
    `DELETE FROM subjects WHERE id = $1 AND course_id = $2 AND tenant_id = $3`,
    [subjectId, courseId, tenantId]
  );
  if (r.rowCount === 0) throw notFound('SUBJECT_NOT_FOUND');
}

// ---- Batches --------------------------------------------------------------

async function assertSubject(tenantId: number, subjectId: number) {
  const r = await getPool().query(`SELECT 1 FROM subjects WHERE id = $1 AND tenant_id = $2`, [subjectId, tenantId]);
  if (r.rowCount === 0) throw notFound('SUBJECT_NOT_FOUND');
}

const BATCH_COLS =
  'id, tenant_id, subject_id, name, schedule_info, show_progress_to_students, created_at';

export async function createBatch(ctx: AuthContext, subjectId: number, input: CreateBatchInput) {
  const tenantId = requireAdmin(ctx);
  await assertSubject(tenantId, subjectId);
  const r = await getPool().query(
    `INSERT INTO batches (tenant_id, subject_id, name, schedule_info) VALUES ($1,$2,$3,$4)
     RETURNING ${BATCH_COLS}`,
    [tenantId, subjectId, input.name, input.scheduleInfo ?? null]
  );
  return r.rows[0];
}

export async function listBatches(ctx: AuthContext, subjectId: number) {
  const tenantId = requireTenant(ctx);
  await assertSubject(tenantId, subjectId);
  const r = await getPool().query(
    `SELECT ${BATCH_COLS} FROM batches WHERE subject_id = $1 AND tenant_id = $2 ORDER BY name ASC`,
    [subjectId, tenantId]
  );
  return r.rows;
}

export async function getBatch(ctx: AuthContext, batchId: number) {
  const tenantId = requireTenant(ctx);
  const r = await getPool().query(`SELECT ${BATCH_COLS} FROM batches WHERE id = $1 AND tenant_id = $2`, [
    batchId,
    tenantId,
  ]);
  if (r.rowCount === 0) throw notFound('BATCH_NOT_FOUND');
  return r.rows[0];
}

export async function updateBatch(ctx: AuthContext, batchId: number, input: UpdateBatchInput) {
  const tenantId = requireTenant(ctx);
  const admin = isAdmin(ctx.role);

  if (!admin) {
    // A non-admin may only be an assigned teacher toggling progress visibility —
    // nothing else on the batch.
    const onlyToggle =
      input.showProgressToStudents !== undefined &&
      input.name === undefined &&
      input.scheduleInfo === undefined;
    if (!onlyToggle) throw forbidden('ADMIN_ONLY');
    if (!(await isBatchTeacher(tenantId, batchId, ctx.userId))) throw forbidden('NOT_BATCH_TEACHER');
  }

  const r = await getPool().query(
    `UPDATE batches
        SET name = COALESCE($3, name),
            schedule_info = COALESCE($4, schedule_info),
            show_progress_to_students = COALESCE($5, show_progress_to_students)
      WHERE id = $1 AND tenant_id = $2
      RETURNING ${BATCH_COLS}`,
    [
      batchId,
      tenantId,
      input.name ?? null,
      input.scheduleInfo ?? null,
      input.showProgressToStudents ?? null,
    ]
  );
  if (r.rowCount === 0) throw notFound('BATCH_NOT_FOUND');
  return r.rows[0];
}

export async function deleteBatch(ctx: AuthContext, batchId: number) {
  const tenantId = requireAdmin(ctx);
  const r = await getPool().query(`DELETE FROM batches WHERE id = $1 AND tenant_id = $2`, [batchId, tenantId]);
  if (r.rowCount === 0) throw notFound('BATCH_NOT_FOUND');
}

// ---- Teacher assignment ---------------------------------------------------

async function assertBatch(tenantId: number, batchId: number) {
  const r = await getPool().query(`SELECT 1 FROM batches WHERE id = $1 AND tenant_id = $2`, [batchId, tenantId]);
  if (r.rowCount === 0) throw notFound('BATCH_NOT_FOUND');
}

async function assertTenantUser(tenantId: number, userId: number, role: string) {
  const r = await getPool().query(`SELECT role FROM users WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);
  if (r.rowCount === 0) throw notFound('USER_NOT_FOUND');
  if (r.rows[0].role !== role) throw badRequest('WRONG_ROLE', `User is not a ${role}`);
}

export async function assignTeacher(ctx: AuthContext, batchId: number, userId: number) {
  const tenantId = requireAdmin(ctx);
  await assertBatch(tenantId, batchId);
  await assertTenantUser(tenantId, userId, 'teacher');
  await getPool().query(
    `INSERT INTO batch_teachers (batch_id, user_id) VALUES ($1,$2)
     ON CONFLICT (batch_id, user_id) DO NOTHING`,
    [batchId, userId]
  );
}

export async function listTeachers(ctx: AuthContext, batchId: number) {
  const tenantId = requireTenant(ctx);
  await assertBatch(tenantId, batchId);
  const r = await getPool().query(
    `SELECT u.id, u.name, u.email FROM batch_teachers bt
       JOIN users u ON u.id = bt.user_id
      WHERE bt.batch_id = $1 AND u.tenant_id = $2 ORDER BY u.name ASC`,
    [batchId, tenantId]
  );
  return r.rows;
}

export async function removeTeacher(ctx: AuthContext, batchId: number, userId: number) {
  const tenantId = requireAdmin(ctx);
  await assertBatch(tenantId, batchId);
  const r = await getPool().query(`DELETE FROM batch_teachers WHERE batch_id = $1 AND user_id = $2`, [
    batchId,
    userId,
  ]);
  if (r.rowCount === 0) throw notFound('ASSIGNMENT_NOT_FOUND');
}

// ---- Enrollment -----------------------------------------------------------

export async function enrollStudent(ctx: AuthContext, batchId: number, studentId: number) {
  const tenantId = requireAdmin(ctx);
  await assertBatch(tenantId, batchId);
  await assertTenantUser(tenantId, studentId, 'student');
  await getPool().query(
    `INSERT INTO enrollments (batch_id, student_id) VALUES ($1,$2)
     ON CONFLICT (batch_id, student_id) DO NOTHING`,
    [batchId, studentId]
  );
}

export async function listEnrollments(ctx: AuthContext, batchId: number) {
  const tenantId = requireTenant(ctx);
  await assertBatch(tenantId, batchId);
  const r = await getPool().query(
    `SELECT u.id, u.name, u.email FROM enrollments e
       JOIN users u ON u.id = e.student_id
      WHERE e.batch_id = $1 AND u.tenant_id = $2 ORDER BY u.name ASC`,
    [batchId, tenantId]
  );
  return r.rows;
}

export async function unenrollStudent(ctx: AuthContext, batchId: number, studentId: number) {
  const tenantId = requireAdmin(ctx);
  await assertBatch(tenantId, batchId);
  const r = await getPool().query(`DELETE FROM enrollments WHERE batch_id = $1 AND student_id = $2`, [
    batchId,
    studentId,
  ]);
  if (r.rowCount === 0) throw notFound('ENROLLMENT_NOT_FOUND');
}
