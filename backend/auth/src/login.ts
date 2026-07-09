// backend/auth/src/login.ts
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
    'SELECT id, tenant_id, role, password_hash FROM users WHERE email = $1',
    [input.email]
  );

  if (userResult.rowCount === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = userResult.rows[0];
  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatches) {
    throw new Error('INVALID_CREDENTIALS');
  }

  await pool.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [user.id]);

  const sessionResult = await pool.query(
    `INSERT INTO sessions (tenant_id, user_id, device_id, device_model, os_version, app_version, ip_address, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id`,
    [
      user.tenant_id,
      user.id,
      input.deviceId,
      input.deviceModel ?? null,
      input.osVersion ?? null,
      input.appVersion ?? null,
      input.ipAddress ?? null,
    ]
  );

  const token = signSessionToken({
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    sessionId: sessionResult.rows[0].id,
  });

  return { token };
}
