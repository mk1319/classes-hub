// backend/syllabus/src/syllabus.ts
//
// Optional predefined chapter list per subject + per-batch coverage log.
// See plan/11-syllabus-tracking-feature.md.
//
// Coverage writes require managing the batch (teacher/admin). Coverage reads are
// visible to enrolled students ONLY when the batch's show_progress_to_students
// flag is on (toggled via the courses feature). Chapter-list writes require
// managing the subject; reads are open to anyone who can see the subject's batches.

import {
  badRequest,
  forbidden,
  getPool,
  isAdmin,
  isEnrolled,
  managesBatch,
  notFound,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import type { CreateChapterInput, CreateCoverageInput, UpdateCoverageInput } from './schema';

// ---- Chapters (per subject) ----------------------------------------------

async function canManageSubject(ctx: AuthContext, subjectId: number): Promise<boolean> {
  const tenantId = ctx.tenantId!;
  const owned = await getPool().query(`SELECT 1 FROM subjects WHERE id = $1 AND tenant_id = $2`, [subjectId, tenantId]);
  if (owned.rowCount === 0) return false;
  if (isAdmin(ctx.role)) return true;
  const r = await getPool().query(
    `SELECT 1 FROM batch_teachers bt JOIN batches b ON b.id = bt.batch_id
      WHERE b.subject_id = $1 AND bt.user_id = $2 AND b.tenant_id = $3`,
    [subjectId, ctx.userId, tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}

const CHAPTER_COLS = 'id, tenant_id, subject_id, title, position, created_at';

export async function createChapter(ctx: AuthContext, subjectId: number, input: CreateChapterInput) {
  const tenantId = requireTenant(ctx);
  if (!(await canManageSubject(ctx, subjectId))) throw forbidden('NO_SUBJECT_ACCESS');
  const r = await getPool().query(
    `INSERT INTO chapters (tenant_id, subject_id, title, position) VALUES ($1,$2,$3,$4) RETURNING ${CHAPTER_COLS}`,
    [tenantId, subjectId, input.title, input.position ?? 0]
  );
  return r.rows[0];
}

export async function listChapters(ctx: AuthContext, subjectId: number) {
  const tenantId = requireTenant(ctx);
  const owned = await getPool().query(`SELECT 1 FROM subjects WHERE id = $1 AND tenant_id = $2`, [subjectId, tenantId]);
  if (owned.rowCount === 0) throw notFound('SUBJECT_NOT_FOUND');
  const r = await getPool().query(
    `SELECT ${CHAPTER_COLS} FROM chapters WHERE subject_id = $1 AND tenant_id = $2 ORDER BY position ASC, id ASC`,
    [subjectId, tenantId]
  );
  return r.rows;
}

export async function updateChapter(ctx: AuthContext, subjectId: number, chapterId: number, input: Partial<CreateChapterInput>) {
  const tenantId = requireTenant(ctx);
  if (!(await canManageSubject(ctx, subjectId))) throw forbidden('NO_SUBJECT_ACCESS');
  const r = await getPool().query(
    `UPDATE chapters SET title = COALESCE($4, title), position = COALESCE($5, position)
      WHERE id = $1 AND subject_id = $2 AND tenant_id = $3 RETURNING ${CHAPTER_COLS}`,
    [chapterId, subjectId, tenantId, input.title ?? null, input.position ?? null]
  );
  if (r.rowCount === 0) throw notFound('CHAPTER_NOT_FOUND');
  return r.rows[0];
}

export async function deleteChapter(ctx: AuthContext, subjectId: number, chapterId: number) {
  const tenantId = requireTenant(ctx);
  if (!(await canManageSubject(ctx, subjectId))) throw forbidden('NO_SUBJECT_ACCESS');
  const r = await getPool().query(`DELETE FROM chapters WHERE id = $1 AND subject_id = $2 AND tenant_id = $3`, [
    chapterId,
    subjectId,
    tenantId,
  ]);
  if (r.rowCount === 0) throw notFound('CHAPTER_NOT_FOUND');
}

// ---- Coverage (per batch) -------------------------------------------------

const COVERAGE_SELECT = `
  SELECT cc.id, cc.tenant_id, cc.batch_id, cc.chapter_id,
         COALESCE(cc.title, ch.title) AS title, cc.covered_date, cc.notes, cc.created_by, cc.created_at
    FROM chapter_coverage cc
    LEFT JOIN chapters ch ON ch.id = cc.chapter_id`;

export async function createCoverage(ctx: AuthContext, batchId: number, input: CreateCoverageInput) {
  const tenantId = requireTenant(ctx);
  if (!(await managesBatch(ctx, batchId))) throw forbidden('NOT_BATCH_MANAGER');

  if (input.chapterId) {
    // Chapter must belong to the batch's subject.
    const ok = await getPool().query(
      `SELECT 1 FROM chapters ch JOIN batches b ON b.subject_id = ch.subject_id
        WHERE ch.id = $1 AND b.id = $2 AND ch.tenant_id = $3`,
      [input.chapterId, batchId, tenantId]
    );
    if (ok.rowCount === 0) throw badRequest('CHAPTER_NOT_IN_SUBJECT');
  }

  const r = await getPool().query(
    `INSERT INTO chapter_coverage (tenant_id, batch_id, chapter_id, title, covered_date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [tenantId, batchId, input.chapterId ?? null, input.title ?? null, input.coveredDate, input.notes ?? null, ctx.userId]
  );
  return getCoverageRow(tenantId, r.rows[0].id);
}

async function getCoverageRow(tenantId: number, id: number) {
  const r = await getPool().query(`${COVERAGE_SELECT} WHERE cc.id = $1 AND cc.tenant_id = $2`, [id, tenantId]);
  return r.rows[0];
}

/**
 * Coverage log for a batch. Staff and managing teachers always see it. A student
 * sees it only when enrolled AND the batch has show_progress_to_students on.
 */
export async function listCoverage(ctx: AuthContext, batchId: number) {
  const tenantId = requireTenant(ctx);
  const batch = await getPool().query(
    `SELECT show_progress_to_students FROM batches WHERE id = $1 AND tenant_id = $2`,
    [batchId, tenantId]
  );
  if (batch.rowCount === 0) throw notFound('BATCH_NOT_FOUND');

  const staff = isAdmin(ctx.role) || ctx.role === 'teacher';
  if (!staff) {
    if (!batch.rows[0].show_progress_to_students) throw forbidden('PROGRESS_HIDDEN');
    if (!(await isEnrolled(ctx, batchId))) throw forbidden('NOT_ENROLLED');
  }

  const r = await getPool().query(
    `${COVERAGE_SELECT} WHERE cc.batch_id = $1 AND cc.tenant_id = $2 ORDER BY cc.covered_date DESC, cc.id DESC`,
    [batchId, tenantId]
  );
  return r.rows;
}

export async function updateCoverage(ctx: AuthContext, batchId: number, coverageId: number, input: UpdateCoverageInput) {
  const tenantId = requireTenant(ctx);
  if (!(await managesBatch(ctx, batchId))) throw forbidden('NOT_BATCH_MANAGER');
  const r = await getPool().query(
    `UPDATE chapter_coverage SET
        title = COALESCE($4, title),
        covered_date = COALESCE($5, covered_date),
        notes = COALESCE($6, notes)
      WHERE id = $1 AND batch_id = $2 AND tenant_id = $3 RETURNING id`,
    [coverageId, batchId, tenantId, input.title ?? null, input.coveredDate ?? null, input.notes ?? null]
  );
  if (r.rowCount === 0) throw notFound('COVERAGE_NOT_FOUND');
  return getCoverageRow(tenantId, coverageId);
}

export async function deleteCoverage(ctx: AuthContext, batchId: number, coverageId: number) {
  const tenantId = requireTenant(ctx);
  if (!(await managesBatch(ctx, batchId))) throw forbidden('NOT_BATCH_MANAGER');
  const r = await getPool().query(`DELETE FROM chapter_coverage WHERE id = $1 AND batch_id = $2 AND tenant_id = $3`, [
    coverageId,
    batchId,
    tenantId,
  ]);
  if (r.rowCount === 0) throw notFound('COVERAGE_NOT_FOUND');
}
