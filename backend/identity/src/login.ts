import bcrypt from 'bcryptjs';
import { getPool, signSessionToken } from '@classes-hub/shared';

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
    'SELECT id, role, password_hash FROM users WHERE email = $1',
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

  const client = await pool.connect();
  let sessionId: number;
  try {
    await client.query('BEGIN');
    await client.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [user.id]);
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, device_id, device_model, os_version, app_version, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        user.id,
        input.deviceId,
        input.deviceModel ?? null,
        input.osVersion ?? null,
        input.appVersion ?? null,
        input.ipAddress ?? null,
      ]
    );
    sessionId = sessionResult.rows[0].id;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const token = signSessionToken({ userId: user.id, role: user.role, sessionId });
  return { token };
}

export async function logout(sessionId: number): Promise<void> {
  await getPool().query('UPDATE sessions SET is_active = false WHERE id = $1', [sessionId]);
}
