// backend/auth/tests/login.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { getPool } from '@classes-hub/shared';
import { verifySessionToken } from '@classes-hub/shared';
import { login } from '../src/login';

describe('login', () => {
  let tenantId: number;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    const tenantResult = await pool.query("INSERT INTO tenants (name) VALUES ('Test Tutor') RETURNING id");
    tenantId = tenantResult.rows[0].id;
    const passwordHash = await bcrypt.hash('correct-password', 10);
    await pool.query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name)
       VALUES ($1, 'teacher', 'teacher@example.com', $2, 'Test Teacher')`,
      [tenantId, passwordHash]
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('returns a valid JWT for correct credentials', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);
    expect(claims.tenantId).toBe(tenantId);
    expect(claims.role).toBe('teacher');
  });

  it('rejects an incorrect password', async () => {
    await expect(
      login({ email: 'teacher@example.com', password: 'wrong-password', deviceId: 'device-1' })
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email', async () => {
    await expect(
      login({ email: 'nobody@example.com', password: 'whatever', deviceId: 'device-1' })
    ).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('deactivates the previous session when logging in again', async () => {
    const first = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const firstClaims = verifySessionToken(first.token);

    await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-2' });

    const pool = getPool();
    const sessionResult = await pool.query('SELECT is_active FROM sessions WHERE id = $1', [firstClaims.sessionId]);
    expect(sessionResult.rows[0].is_active).toBe(false);
  });

  it('leaves exactly one active session after concurrent logins for the same user', async () => {
    // Seed one pre-existing session so both concurrent logins have to race over
    // deactivating it, exercising the transactional deactivate+insert pair
    // (see finding: two concurrent logins previously could both deactivate-all
    // then both insert, leaving two active sessions at once).
    await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-0' });

    await Promise.all([
      login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' }),
      login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-2' }),
    ]);

    const pool = getPool();
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', ['teacher@example.com']);
    const activeResult = await pool.query(
      'SELECT count(*)::int AS count FROM sessions WHERE user_id = $1 AND is_active = true',
      [userResult.rows[0].id]
    );
    expect(activeResult.rows[0].count).toBe(1);
  });
});
