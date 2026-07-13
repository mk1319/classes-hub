import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getPool, signSessionToken } from '@classes-hub/shared';
import { handler } from '../src/handler';

describe('authorizer', () => {
  let userId: number;
  let sessionId: number;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    const userResult = await pool.query(
      `INSERT INTO users (role, email, password_hash, name) VALUES ('admin', 'admin@example.com', 'x', 'Admin') RETURNING id`
    );
    userId = userResult.rows[0].id;
    const sessionResult = await pool.query(
      `INSERT INTO sessions (user_id, device_id) VALUES ($1, 'device-1') RETURNING id`,
      [userId]
    );
    sessionId = sessionResult.rows[0].id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('allows a valid token with an active session', async () => {
    const token = signSessionToken({ userId, role: 'admin', sessionId });
    const result = await handler({
      authorizationToken: `Bearer ${token}`,
      methodArn: 'arn:aws:execute-api:region:account:api/*/POST/auth/logout',
    });
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context.role).toBe('admin');
  });

  it('rejects a malformed token', async () => {
    await expect(
      handler({
        authorizationToken: 'Bearer not-a-real-token',
        methodArn: 'arn:aws:execute-api:region:account:api/*/POST/auth/logout',
      })
    ).rejects.toThrow('Unauthorized');
  });

  it('rejects a token whose session has been deactivated', async () => {
    const token = signSessionToken({ userId, role: 'admin', sessionId });
    await getPool().query('UPDATE sessions SET is_active = false WHERE id = $1', [sessionId]);
    await expect(
      handler({
        authorizationToken: `Bearer ${token}`,
        methodArn: 'arn:aws:execute-api:region:account:api/*/POST/auth/logout',
      })
    ).rejects.toThrow('Unauthorized');
  });
});
