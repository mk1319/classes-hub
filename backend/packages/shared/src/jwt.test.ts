import { describe, it, expect, beforeAll } from 'vitest';
import { signSessionToken, verifySessionToken } from './jwt';

describe('signSessionToken / verifySessionToken', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('round-trips the claims it was given', () => {
    const token = signSessionToken({ userId: 1, tenantId: 2, role: 'teacher', sessionId: 3 });
    const claims = verifySessionToken(token);
    expect(claims.userId).toBe(1);
    expect(claims.tenantId).toBe(2);
    expect(claims.role).toBe('teacher');
    expect(claims.sessionId).toBe(3);
  });

  it('supports a null tenantId for super-admin claims', () => {
    const token = signSessionToken({ userId: 1, tenantId: null, role: 'super_admin', sessionId: 3 });
    const claims = verifySessionToken(token);
    expect(claims.tenantId).toBeNull();
  });

  it('throws on a tampered token', () => {
    const token = signSessionToken({ userId: 1, tenantId: null, role: 'super_admin', sessionId: 3 });
    expect(() => verifySessionToken(token + 'x')).toThrow();
  });
});
