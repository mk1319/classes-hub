// backend/resources/src/resources.ts
//
// Study materials attached to exactly one of a subject or a batch. Uploaded
// files are stored as Postgres bytea in resource_files (kept separate so listing
// never pulls blobs); external links store just a URL. See
// plan/10-resources-feature.md.
//
// Visibility: a student sees a resource if enrolled in the batch it targets, or
// in any batch under the subject it targets. Teachers/admins manage within tenant.

import {
  badRequest,
  forbidden,
  getPool,
  isAdmin,
  managesBatch,
  notFound,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import type { CreateResourceInput, UpdateResourceInput } from './schema';

const COLS =
  'id, tenant_id, subject_id, batch_id, type, title, storage_type, link_url, is_downloadable, created_by, created_at';

/** Admin: any subject in tenant. Teacher: assigned to some batch under the subject. */
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

async function canManageResourceScope(ctx: AuthContext, subjectId: number | null, batchId: number | null): Promise<boolean> {
  if (batchId != null) return managesBatch(ctx, batchId);
  if (subjectId != null) return canManageSubject(ctx, subjectId);
  return false;
}

/** Can the caller view (open/list) a specific resource row? */
async function canViewResource(
  ctx: AuthContext,
  resource: { subject_id: number | null; batch_id: number | null }
): Promise<boolean> {
  if (isAdmin(ctx.role) || ctx.role === 'teacher') return true; // tenant already enforced by query
  // Student: must be enrolled in the target batch, or a batch under the subject.
  if (resource.batch_id != null) {
    const r = await getPool().query(`SELECT 1 FROM enrollments WHERE batch_id = $1 AND student_id = $2`, [
      resource.batch_id,
      ctx.userId,
    ]);
    return (r.rowCount ?? 0) > 0;
  }
  const r = await getPool().query(
    `SELECT 1 FROM enrollments e JOIN batches b ON b.id = e.batch_id
      WHERE b.subject_id = $1 AND e.student_id = $2`,
    [resource.subject_id, ctx.userId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function createResource(ctx: AuthContext, input: CreateResourceInput) {
  const tenantId = requireTenant(ctx);
  if (!(await canManageResourceScope(ctx, input.subjectId ?? null, input.batchId ?? null)))
    throw forbidden('NO_SCOPE_ACCESS');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    // is_downloadable only meaningful for uploads; force false for links.
    const isDownloadable = input.storageType === 'upload' ? input.isDownloadable ?? true : false;
    const r = await client.query(
      `INSERT INTO resources (tenant_id, subject_id, batch_id, type, title, storage_type, link_url, is_downloadable, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLS}`,
      [
        tenantId,
        input.subjectId ?? null,
        input.batchId ?? null,
        input.type,
        input.title,
        input.storageType,
        input.storageType === 'link' ? input.linkUrl : null,
        isDownloadable,
        ctx.userId,
      ]
    );
    const resource = r.rows[0];
    if (input.storageType === 'upload' && input.file) {
      const bytes = Buffer.from(input.file.dataBase64, 'base64');
      await client.query(
        `INSERT INTO resource_files (resource_id, filename, mime_type, file_size, file_data)
         VALUES ($1,$2,$3,$4,$5)`,
        [resource.id, input.file.filename, input.file.mimeType, bytes.length, bytes]
      );
    }
    await client.query('COMMIT');
    return resource;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listResources(ctx: AuthContext, filters: { subjectId?: number; batchId?: number }) {
  const tenantId = requireTenant(ctx);
  const staff = isAdmin(ctx.role) || ctx.role === 'teacher';

  const params: unknown[] = [tenantId];
  let where = 'r.tenant_id = $1';
  if (filters.subjectId) {
    params.push(filters.subjectId);
    where += ` AND r.subject_id = $${params.length}`;
  }
  if (filters.batchId) {
    params.push(filters.batchId);
    where += ` AND r.batch_id = $${params.length}`;
  }

  if (!staff) {
    // Constrain a student to resources they can see.
    params.push(ctx.userId);
    const uidParam = `$${params.length}`;
    where += ` AND (
      r.batch_id IN (SELECT batch_id FROM enrollments WHERE student_id = ${uidParam})
      OR r.subject_id IN (
        SELECT b.subject_id FROM enrollments e JOIN batches b ON b.id = e.batch_id
         WHERE e.student_id = ${uidParam}))`;
  }

  const r = await getPool().query(`SELECT ${COLS} FROM resources r WHERE ${where} ORDER BY r.created_at DESC`, params);
  return r.rows;
}

async function loadResource(tenantId: number, id: number) {
  const r = await getPool().query(`SELECT ${COLS} FROM resources WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (r.rowCount === 0) throw notFound('RESOURCE_NOT_FOUND');
  return r.rows[0];
}

export async function getResource(ctx: AuthContext, id: number) {
  const tenantId = requireTenant(ctx);
  const resource = await loadResource(tenantId, id);
  if (!(await canViewResource(ctx, resource))) throw forbidden('NO_ACCESS');
  return resource;
}

export interface ResourceFile {
  filename: string;
  mime_type: string;
  file_size: number;
  file_data: Buffer;
}

/** Fetch the blob for an uploaded resource, after an access check. */
export async function getResourceFile(ctx: AuthContext, id: number): Promise<ResourceFile> {
  const tenantId = requireTenant(ctx);
  const resource = await loadResource(tenantId, id);
  if (resource.storage_type !== 'upload') throw badRequest('NOT_AN_UPLOAD');
  if (!(await canViewResource(ctx, resource))) throw forbidden('NO_ACCESS');
  const f = await getPool().query(
    `SELECT filename, mime_type, file_size, file_data FROM resource_files WHERE resource_id = $1`,
    [id]
  );
  if (f.rowCount === 0) throw notFound('FILE_NOT_FOUND');
  return f.rows[0];
}

export async function updateResource(ctx: AuthContext, id: number, input: UpdateResourceInput) {
  const tenantId = requireTenant(ctx);
  const resource = await loadResource(tenantId, id);
  if (!(await canManageResourceScope(ctx, resource.subject_id, resource.batch_id))) throw forbidden('NO_SCOPE_ACCESS');
  const r = await getPool().query(
    `UPDATE resources SET
        title = COALESCE($3, title),
        link_url = CASE WHEN storage_type = 'link' THEN COALESCE($4, link_url) ELSE link_url END,
        is_downloadable = CASE WHEN storage_type = 'upload' THEN COALESCE($5, is_downloadable) ELSE is_downloadable END
      WHERE id = $1 AND tenant_id = $2 RETURNING ${COLS}`,
    [id, tenantId, input.title ?? null, input.linkUrl ?? null, input.isDownloadable ?? null]
  );
  return r.rows[0];
}

export async function deleteResource(ctx: AuthContext, id: number) {
  const tenantId = requireTenant(ctx);
  const resource = await loadResource(tenantId, id);
  if (!(await canManageResourceScope(ctx, resource.subject_id, resource.batch_id))) throw forbidden('NO_SCOPE_ACCESS');
  await getPool().query(`DELETE FROM resources WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
}
