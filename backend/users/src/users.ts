// backend/users/src/users.ts
//
// Tenant-scoped teacher/student account management. All mutations are
// admin-only (tutor/admin role). Every query is scoped by the caller's
// tenant_id from the JWT — an admin can never see or touch another tenant's
// users (plan/01-architecture.md §Non-functional notes).

import bcrypt from 'bcryptjs';
import {
  badRequest,
  forbidden,
  getPool,
  isAdmin,
  notFound,
  requireTenant,
  type AuthContext,
} from '@classes-hub/shared';
import type { CreateUserInput, UpdateUserInput } from './schema';

export interface User {
  id: number;
  tenant_id: number;
  role: string;
  email: string;
  name: string;
  created_at: string;
}

export interface SessionRecord {
  id: number;
  device_id: string;
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
  ip_address: string | null;
  is_active: boolean;
  created_at: string;
}

// Columns returned to callers — never the password hash.
const USER_COLS = 'id, tenant_id, role, email, name, created_at';

function requireAdmin(ctx: AuthContext): number {
  const tenantId = requireTenant(ctx);
  if (!isAdmin(ctx.role)) throw forbidden('ADMIN_ONLY');
  return tenantId;
}

export async function createUser(ctx: AuthContext, input: CreateUserInput): Promise<User> {
  const tenantId = requireAdmin(ctx);
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const result = await getPool().query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_COLS}`,
      [tenantId, input.role, input.email.toLowerCase(), passwordHash, input.name]
    );
    return result.rows[0];
  } catch (err) {
    if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
      throw badRequest('EMAIL_TAKEN', 'A user with this email already exists');
    }
    throw err;
  }
}

export interface BulkImportResult {
  created: number;
  errors: { row: number; email: string; error: string }[];
}

/**
 * Parse a CSV string with header row `email,name,role,password` and create each
 * user. Rows that fail (bad role, duplicate email, missing field) are reported
 * per-row rather than failing the whole import — a partial import is more useful
 * to an admin uploading a large roster than an all-or-nothing failure.
 */
export async function bulkImport(ctx: AuthContext, csv: string): Promise<BulkImportResult> {
  requireAdmin(ctx);
  const rows = parseCsv(csv);
  if (rows.length === 0) throw badRequest('EMPTY_CSV');

  const result: BulkImportResult = { created: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.email || !row.name || !row.password) throw new Error('Missing required field');
      if (row.role !== 'teacher' && row.role !== 'student') throw new Error('Invalid role');
      await createUser(ctx, {
        email: row.email,
        name: row.name,
        role: row.role,
        password: row.password,
      });
      result.created++;
    } catch (err) {
      result.errors.push({
        row: i + 2, // +1 for 0-index, +1 for the header row
        email: row.email ?? '',
        error: err instanceof Error ? messageFor(err) : 'Unknown error',
      });
    }
  }
  return result;
}

function messageFor(err: Error): string {
  // Surface our stable codes cleanly in the per-row report.
  if (err.message.includes('EMAIL_TAKEN')) return 'EMAIL_TAKEN';
  return err.message;
}

interface CsvRow {
  email?: string;
  name?: string;
  role?: string;
  password?: string;
}

// Minimal CSV parser: comma-separated, no embedded commas/quotes. Sufficient for
// a roster of email,name,role,password. Trims whitespace and skips blank lines.
export function parseCsv(csv: string): CsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const emailIdx = idx('email');
  const nameIdx = idx('name');
  const roleIdx = idx('role');
  const passwordIdx = idx('password');

  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    return {
      email: emailIdx >= 0 ? cells[emailIdx] : undefined,
      name: nameIdx >= 0 ? cells[nameIdx] : undefined,
      role: roleIdx >= 0 ? cells[roleIdx] : undefined,
      password: passwordIdx >= 0 ? cells[passwordIdx] : undefined,
    };
  });
}

export async function listUsers(ctx: AuthContext, role?: string): Promise<User[]> {
  const tenantId = requireAdmin(ctx);
  const params: unknown[] = [tenantId];
  let where = 'tenant_id = $1';
  if (role) {
    params.push(role);
    where += ` AND role = $${params.length}`;
  }
  const result = await getPool().query(
    `SELECT ${USER_COLS} FROM users WHERE ${where} ORDER BY name ASC`,
    params
  );
  return result.rows;
}

export async function getUser(ctx: AuthContext, id: number): Promise<User> {
  const tenantId = requireAdmin(ctx);
  const result = await getPool().query(
    `SELECT ${USER_COLS} FROM users WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (result.rowCount === 0) throw notFound('USER_NOT_FOUND');
  return result.rows[0];
}

export async function updateUser(ctx: AuthContext, id: number, input: UpdateUserInput): Promise<User> {
  const tenantId = requireAdmin(ctx);
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
  const result = await getPool().query(
    `UPDATE users
        SET name = COALESCE($3, name),
            role = COALESCE($4, role),
            password_hash = COALESCE($5, password_hash)
      WHERE id = $1 AND tenant_id = $2
      RETURNING ${USER_COLS}`,
    [id, tenantId, input.name ?? null, input.role ?? null, passwordHash]
  );
  if (result.rowCount === 0) throw notFound('USER_NOT_FOUND');
  return result.rows[0];
}

export async function deleteUser(ctx: AuthContext, id: number): Promise<void> {
  const tenantId = requireAdmin(ctx);
  const result = await getPool().query(
    `DELETE FROM users WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (result.rowCount === 0) throw notFound('USER_NOT_FOUND');
}

/** Login/device history for a user — tutor/admin only, tenant-scoped. */
export async function getUserSessions(ctx: AuthContext, id: number): Promise<SessionRecord[]> {
  const tenantId = requireAdmin(ctx);
  // Confirm the target user is in the caller's tenant before exposing sessions.
  const userResult = await getPool().query(
    `SELECT id FROM users WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (userResult.rowCount === 0) throw notFound('USER_NOT_FOUND');

  const result = await getPool().query(
    `SELECT id, device_id, device_model, os_version, app_version, ip_address, is_active, created_at
       FROM sessions
      WHERE user_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC`,
    [id, tenantId]
  );
  return result.rows;
}
