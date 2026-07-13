import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { getPool, verifySessionToken } from '@classes-hub/shared';
import { login, logout } from '../src/login';

describe('login', () => {
  let userId: number;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    const passwordHash = await bcrypt.hash('correct-password', 10);
    const userResult = await pool.query(
      `INSERT INTO users (role, email, password_hash, name)
       VALUES ('teacher', 'teacher@example.com', $1, 'Test Teacher') RETURNING id`,
      [passwordHash]
    );
    userId = userResult.rows[0].id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('returns a valid JWT for correct credentials', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);
    expect(claims.userId).toBe(userId);
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

    const sessionResult = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [firstClaims.sessionId]);
    expect(sessionResult.rows[0].is_active).toBe(false);
  });

  it('leaves exactly one active session after concurrent logins for the same user', async () => {
    await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-0' });

    await Promise.all([
      login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' }),
      login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-2' }),
    ]);

    const activeResult = await getPool().query(
      'SELECT count(*)::int AS count FROM sessions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    expect(activeResult.rows[0].count).toBe(1);
  });

  it('logout deactivates the current session', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);

    await logout(claims.sessionId);

    const sessionResult = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    expect(sessionResult.rows[0].is_active).toBe(false);
  });
});
