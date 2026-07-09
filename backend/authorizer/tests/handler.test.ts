import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getPool, signSessionToken } from '@classes-hub/shared';
import { handler } from '../src/handler';

function tokenEvent(token: string) {
  return {
    type: 'TOKEN' as const,
    authorizationToken: `Bearer ${token}`,
    methodArn: 'arn:aws:execute-api:us-east-1:123456789012:abc123/dev/GET/tests',
  };
}

describe('authorizer handler', () => {
  let sessionId: number;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    const tenantResult = await pool.query("INSERT INTO tenants (name) VALUES ('Test Tutor') RETURNING id");
    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name)
       VALUES ($1, 'teacher', 'teacher@example.com', 'x', 'Test Teacher') RETURNING id`,
      [tenantResult.rows[0].id]
    );
    const sessionResult = await pool.query(
      `INSERT INTO sessions (tenant_id, user_id, device_id, is_active) VALUES ($1, $2, 'device-1', true) RETURNING id`,
      [tenantResult.rows[0].id, userResult.rows[0].id]
    );
    sessionId = sessionResult.rows[0].id;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('allows a token whose session is active', async () => {
    const token = signSessionToken({ userId: 1, tenantId: 1, role: 'teacher', sessionId });
    const result = await handler(tokenEvent(token) as any);
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.principalId).toBe('1');
    expect(result.context?.userId).toBe('1');
    expect(result.context?.tenantId).toBe('1');
    expect(result.context?.role).toBe('teacher');
    expect(result.context?.sessionId).toBe(String(sessionId));
  });

  it('returns an empty string context.tenantId for a super-admin token (null tenantId)', async () => {
    const pool = getPool();
    const userResult = await pool.query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name)
       VALUES (NULL, 'super_admin', 'super-admin@example.com', 'x', 'Test Super Admin') RETURNING id`
    );
    const sessionResult = await pool.query(
      `INSERT INTO sessions (tenant_id, user_id, device_id, is_active) VALUES (NULL, $1, 'device-2', true) RETURNING id`,
      [userResult.rows[0].id]
    );
    const superAdminSessionId = sessionResult.rows[0].id;

    const token = signSessionToken({
      userId: userResult.rows[0].id,
      tenantId: null,
      role: 'super_admin',
      sessionId: superAdminSessionId,
    });
    const result = await handler(tokenEvent(token) as any);
    expect(result.context?.tenantId).toBe('');
  });

  it('rejects a token whose session was deactivated', async () => {
    await getPool().query('UPDATE sessions SET is_active = false WHERE id = $1', [sessionId]);
    const token = signSessionToken({ userId: 1, tenantId: 1, role: 'teacher', sessionId });
    await expect(handler(tokenEvent(token) as any)).rejects.toThrow('Unauthorized');
  });

  it('rejects a malformed token', async () => {
    await expect(handler(tokenEvent('not-a-real-token') as any)).rejects.toThrow('Unauthorized');
  });
});
