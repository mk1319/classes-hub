// backend/packages/shared/src/access.ts
//
// Batch-level access checks reused by the batch-scoped features (timetable,
// resources, syllabus). Kept here because the exact same three questions —
// "does this batch belong to my tenant / do I manage it / am I enrolled?" —
// recur across features and must be answered identically everywhere.

import { getPool } from './db';
import { isAdmin, type AuthContext } from './http';

/** True if the batch exists within the caller's tenant. */
export async function batchInTenant(tenantId: number, batchId: number): Promise<boolean> {
  const r = await getPool().query(`SELECT 1 FROM batches WHERE id = $1 AND tenant_id = $2`, [batchId, tenantId]);
  return (r.rowCount ?? 0) > 0;
}

/** Admins manage any batch in their tenant; teachers only their assigned batches. */
export async function managesBatch(ctx: AuthContext, batchId: number): Promise<boolean> {
  if (ctx.tenantId == null) return false;
  if (isAdmin(ctx.role)) return batchInTenant(ctx.tenantId, batchId);
  const r = await getPool().query(
    `SELECT 1 FROM batch_teachers bt JOIN batches b ON b.id = bt.batch_id
      WHERE bt.batch_id = $1 AND bt.user_id = $2 AND b.tenant_id = $3`,
    [batchId, ctx.userId, ctx.tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}

/** True if the caller (a student) is enrolled in the batch. */
export async function isEnrolled(ctx: AuthContext, batchId: number): Promise<boolean> {
  if (ctx.tenantId == null) return false;
  const r = await getPool().query(
    `SELECT 1 FROM enrollments e JOIN batches b ON b.id = e.batch_id
      WHERE e.batch_id = $1 AND e.student_id = $2 AND b.tenant_id = $3`,
    [batchId, ctx.userId, ctx.tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Read access to a batch: admins & teachers (any batch in their tenant) plus
 * enrolled students. Used by the read side of batch-scoped features.
 */
export async function canViewBatch(ctx: AuthContext, batchId: number): Promise<boolean> {
  if (ctx.tenantId == null) return false;
  if (isAdmin(ctx.role) || ctx.role === 'teacher') return batchInTenant(ctx.tenantId, batchId);
  return isEnrolled(ctx, batchId);
}
