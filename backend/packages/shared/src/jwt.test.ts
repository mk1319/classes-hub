import { describe, it, expect, beforeAll } from 'vitest';
import jwtLib from 'jsonwebtoken';
import { signSessionToken, verifySessionToken } from './jwt';

describe('jwt', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('round-trips claims through sign and verify', () => {
    const token = signSessionToken({ userId: 1, role: 'admin', sessionId: 2 });
    const claims = verifySessionToken(token);
    expect(claims.userId).toBe(1);
    expect(claims.role).toBe('admin');
    expect(claims.sessionId).toBe(2);
  });

  it('rejects a token signed with a different secret', () => {
    const badToken = jwtLib.sign({ userId: 1, role: 'admin', sessionId: 2 }, 'wrong-secret', { algorithm: 'HS256' });
    expect(() => verifySessionToken(badToken)).toThrow();
  });

  it('rejects a token signed with a different algorithm', () => {
    const badToken = jwtLib.sign({ userId: 1, role: 'admin', sessionId: 2 }, 'test-secret', { algorithm: 'HS384' });
    expect(() => verifySessionToken(badToken)).toThrow();
  });
});
