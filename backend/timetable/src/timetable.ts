// backend/timetable/src/timetable.ts
//
// Per-batch schedule with optional weekly recurrence. Writes require managing
// the batch (teacher/admin); reads are open to anyone who can view the batch
// (admin/teacher in tenant, or an enrolled student). See plan/05-backend-api.md.

import { randomUUID } from 'node:crypto';
import {
  canViewBatch,
  forbidden,
  getPool,
  managesBatch,
  notFound,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import type { CreateSessionInput, UpdateSessionInput } from './schema';

const COLS = 'id, tenant_id, batch_id, title, session_date, start_time, end_time, recurrence, series_id, created_at';

/** Expand a weekly recurrence into ISO dates (inclusive) from start through until. */
export function weeklyDates(start: string, until: string): string[] {
  const out: string[] = [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const untilMs = Date.parse(`${until}T00:00:00Z`);
  const week = 7 * 24 * 60 * 60 * 1000;
  for (let ms = startMs; ms <= untilMs; ms += week) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

export async function createSessions(ctx: AuthContext, batchId: number, input: CreateSessionInput) {
  const tenantId = requireTenant(ctx);
  if (!(await managesBatch(ctx, batchId))) throw forbidden('NOT_BATCH_MANAGER');

  const dates =
    input.recurrence === 'weekly' && input.recurUntil
      ? weeklyDates(input.sessionDate, input.recurUntil)
      : [input.sessionDate];
  const seriesId = dates.length > 1 ? randomUUID() : null;
  const recurrence = input.recurrence ?? 'none';

  const created = [];
  for (const d of dates) {
    const r = await getPool().query(
      `INSERT INTO timetable_sessions (tenant_id, batch_id, title, session_date, start_time, end_time, recurrence, series_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
      [tenantId, batchId, input.title ?? null, d, input.startTime, input.endTime, recurrence, seriesId]
    );
    created.push(r.rows[0]);
  }
  return created;
}

export async function listSessions(ctx: AuthContext, batchId: number, from?: string, to?: string) {
  requireTenant(ctx);
  if (!(await canViewBatch(ctx, batchId))) throw forbidden('NO_BATCH_ACCESS');
  const params: unknown[] = [batchId, ctx.tenantId];
  let where = 'batch_id = $1 AND tenant_id = $2';
  if (from) {
    params.push(from);
    where += ` AND session_date >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += ` AND session_date <= $${params.length}`;
  }
  const r = await getPool().query(
    `SELECT ${COLS} FROM timetable_sessions WHERE ${where} ORDER BY session_date ASC, start_time ASC`,
    params
  );
  return r.rows;
}

export async function updateSession(ctx: AuthContext, batchId: number, sessionId: number, input: UpdateSessionInput) {
  const tenantId = requireTenant(ctx);
  if (!(await managesBatch(ctx, batchId))) throw forbidden('NOT_BATCH_MANAGER');
  const r = await getPool().query(
    `UPDATE timetable_sessions SET
        title = COALESCE($4, title),
        session_date = COALESCE($5, session_date),
        start_time = COALESCE($6, start_time),
        end_time = COALESCE($7, end_time)
      WHERE id = $1 AND batch_id = $2 AND tenant_id = $3 RETURNING ${COLS}`,
    [
      sessionId,
      batchId,
      tenantId,
      input.title ?? null,
      input.sessionDate ?? null,
      input.startTime ?? null,
      input.endTime ?? null,
    ]
  );
  if (r.rowCount === 0) throw notFound('SESSION_NOT_FOUND');
  return r.rows[0];
}

/** Delete a single session, or the whole series when `series=true`. */
export async function deleteSession(ctx: AuthContext, batchId: number, sessionId: number, series: boolean) {
  const tenantId = requireTenant(ctx);
  if (!(await managesBatch(ctx, batchId))) throw forbidden('NOT_BATCH_MANAGER');

  if (series) {
    const found = await getPool().query(
      `SELECT series_id FROM timetable_sessions WHERE id = $1 AND batch_id = $2 AND tenant_id = $3`,
      [sessionId, batchId, tenantId]
    );
    if (found.rowCount === 0) throw notFound('SESSION_NOT_FOUND');
    const seriesId = found.rows[0].series_id;
    if (seriesId) {
      await getPool().query(`DELETE FROM timetable_sessions WHERE series_id = $1 AND tenant_id = $2`, [
        seriesId,
        tenantId,
      ]);
      return;
    }
  }
  const r = await getPool().query(
    `DELETE FROM timetable_sessions WHERE id = $1 AND batch_id = $2 AND tenant_id = $3`,
    [sessionId, batchId, tenantId]
  );
  if (r.rowCount === 0) throw notFound('SESSION_NOT_FOUND');
}
