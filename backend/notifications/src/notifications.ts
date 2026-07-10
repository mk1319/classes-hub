// backend/notifications/src/notifications.ts
//
// Announcements + push dispatch. Tenant/course-scoped announcements are
// admin-only; batch-scoped ones may also be sent by a teacher managing that
// batch. On create we record the row, resolve recipients from the scope, and
// fan out an FCM push to their registered device tokens.

import {
  badRequest,
  forbidden,
  getPool,
  isAdmin,
  managesBatch,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import { sendPush } from './fcm';
import type { CreateAnnouncementInput } from './schema';

const COLS = 'id, tenant_id, scope, scope_id, title, body, created_by, sent_at, created_at';

/** Register (or refresh) the caller's FCM device token. */
export async function registerToken(ctx: AuthContext, token: string): Promise<void> {
  const tenantId = requireTenant(ctx);
  await getPool().query(
    `INSERT INTO device_tokens (tenant_id, user_id, token) VALUES ($1,$2,$3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, tenant_id = EXCLUDED.tenant_id`,
    [tenantId, ctx.userId, token]
  );
}

/** Collect device tokens for everyone an announcement targets. */
async function recipientTokens(tenantId: number, scope: string, scopeId?: number): Promise<string[]> {
  let rows;
  if (scope === 'tenant') {
    rows = await getPool().query(`SELECT token FROM device_tokens WHERE tenant_id = $1`, [tenantId]);
  } else if (scope === 'batch') {
    rows = await getPool().query(
      `SELECT dt.token FROM device_tokens dt
        WHERE dt.tenant_id = $1 AND (
          dt.user_id IN (SELECT student_id FROM enrollments WHERE batch_id = $2)
          OR dt.user_id IN (SELECT user_id FROM batch_teachers WHERE batch_id = $2))`,
      [tenantId, scopeId]
    );
  } else {
    // course: everyone enrolled in / teaching any batch under the course.
    rows = await getPool().query(
      `SELECT dt.token FROM device_tokens dt
        WHERE dt.tenant_id = $1 AND dt.user_id IN (
          SELECT e.student_id FROM enrollments e
            JOIN batches b ON b.id = e.batch_id
            JOIN subjects s ON s.id = b.subject_id
           WHERE s.course_id = $2
          UNION
          SELECT bt.user_id FROM batch_teachers bt
            JOIN batches b ON b.id = bt.batch_id
            JOIN subjects s ON s.id = b.subject_id
           WHERE s.course_id = $2)`,
      [tenantId, scopeId]
    );
  }
  return rows.rows.map((r) => r.token);
}

export async function createAnnouncement(ctx: AuthContext, input: CreateAnnouncementInput) {
  const tenantId = requireTenant(ctx);

  // Authorization by scope.
  if (input.scope === 'batch') {
    if (!(await managesBatch(ctx, input.scopeId!))) throw forbidden('NOT_BATCH_MANAGER');
  } else {
    // tenant-wide and course-wide are admin-only.
    if (!isAdmin(ctx.role)) throw forbidden('ADMIN_ONLY');
    if (input.scope === 'course') {
      const owned = await getPool().query(`SELECT 1 FROM courses WHERE id = $1 AND tenant_id = $2`, [
        input.scopeId,
        tenantId,
      ]);
      if (owned.rowCount === 0) throw badRequest('COURSE_NOT_FOUND');
    }
  }

  const r = await getPool().query(
    `INSERT INTO announcements (tenant_id, scope, scope_id, title, body, created_by, sent_at)
     VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING ${COLS}`,
    [tenantId, input.scope, input.scopeId ?? null, input.title, input.body, ctx.userId]
  );
  const announcement = r.rows[0];

  const tokens = await recipientTokens(tenantId, input.scope, input.scopeId);
  const push = await sendPush(tokens, { title: input.title, body: input.body, data: { announcementId: String(announcement.id) } });

  return { ...announcement, pushTargeted: push.targeted, pushDelivered: push.delivered };
}

export async function listAnnouncements(ctx: AuthContext, scope?: string) {
  const tenantId = requireTenant(ctx);

  if (ctx.role === 'student') {
    // A student sees tenant-wide announcements plus those for courses/batches
    // they're enrolled in.
    const r = await getPool().query(
      `SELECT ${COLS} FROM announcements a
        WHERE a.tenant_id = $1 AND (
          a.scope = 'tenant'
          OR (a.scope = 'batch' AND a.scope_id IN (SELECT batch_id FROM enrollments WHERE student_id = $2))
          OR (a.scope = 'course' AND a.scope_id IN (
                SELECT s.course_id FROM enrollments e
                  JOIN batches b ON b.id = e.batch_id
                  JOIN subjects s ON s.id = b.subject_id
                 WHERE e.student_id = $2)))
        ORDER BY a.created_at DESC`,
      [tenantId, ctx.userId]
    );
    return r.rows;
  }

  const params: unknown[] = [tenantId];
  let where = 'tenant_id = $1';
  if (scope) {
    params.push(scope);
    where += ` AND scope = $${params.length}`;
  }
  const r = await getPool().query(`SELECT ${COLS} FROM announcements WHERE ${where} ORDER BY created_at DESC`, params);
  return r.rows;
}
