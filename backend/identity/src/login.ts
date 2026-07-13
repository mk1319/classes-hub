import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { getPool, signSessionToken } from '@classes-hub/shared';

// Partial unique index name from migrations/2_sessions.js — only one active
// session per user is allowed. Concurrent logins can collide on it.
const ACTIVE_SESSION_INDEX = 'sessions_one_active_per_user';
const MAX_SESSION_CREATE_ATTEMPTS = 3;

function isActiveSessionConflict(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string } | null;
  return e != null && e.code === '23505' && e.constraint === ACTIVE_SESSION_INDEX;
}

// Deactivate any existing active sessions and insert a fresh active one, in a
// single transaction. Under READ COMMITTED, two concurrent logins can each
// snapshot before the other commits, so both deactivate the same old rows and
// then both INSERT an active row — the second INSERT hits the partial unique
// index (23505). We retry: a fresh transaction's UPDATE sees the now-committed
// conflicting active session and deactivates it, so the retried INSERT succeeds.
async function createActiveSession(
  pool: Pool,
  userId: number,
  input: LoginInput
): Promise<number> {
  for (let attempt = 1; attempt <= MAX_SESSION_CREATE_ATTEMPTS; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [userId]);
      const sessionResult = await client.query(
        `INSERT INTO sessions (user_id, device_id, device_model, os_version, app_version, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          userId,
          input.deviceId,
          input.deviceModel ?? null,
          input.osVersion ?? null,
          input.appVersion ?? null,
          input.ipAddress ?? null,
        ]
      );
      await client.query('COMMIT');
      return sessionResult.rows[0].id;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (isActiveSessionConflict(err) && attempt < MAX_SESSION_CREATE_ATTEMPTS) {
        continue;
      }
      if (isActiveSessionConflict(err)) {
        throw new Error('SESSION_CREATE_FAILED');
      }
      throw err;
    } finally {
      client.release();
    }
  }
  // Unreachable: loop either returns or throws on every path.
  throw new Error('SESSION_CREATE_FAILED');
}

export interface LoginInput {
  email: string;
  password: string;
  deviceId: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  ipAddress?: string;
}

export interface LoginResult {
  token: string;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const pool = getPool();
  const userResult = await pool.query(
    'SELECT id, role, name, password_hash FROM users WHERE email = $1',
    [input.email]
  );
  if (userResult.rowCount === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const user = userResult.rows[0];
  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const sessionId = await createActiveSession(pool, user.id, input);

  const token = signSessionToken({ userId: user.id, role: user.role, sessionId, name: user.name });
  return { token };
}

export async function logout(sessionId: number): Promise<void> {
  await getPool().query('UPDATE sessions SET is_active = false WHERE id = $1', [sessionId]);
}
