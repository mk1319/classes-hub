// backend/auth/tests/handler.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { getPool } from '@classes-hub/shared';

// Only the one "unexpected error" test below needs login() to throw something
// other than INVALID_CREDENTIALS. Wrapping the real implementation in vi.fn()
// means every other test still exercises the real login() against Postgres —
// only that single test overrides it, and only for one call.
vi.mock('../src/login', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/login')>();
  return {
    ...actual,
    login: vi.fn(actual.login),
  };
});

import { app } from '../src/handler';
import { login } from '../src/login';

describe('auth handler', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    vi.mocked(login).mockClear();

    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    const tenantResult = await pool.query("INSERT INTO tenants (name) VALUES ('Test Tutor') RETURNING id");
    const passwordHash = await bcrypt.hash('correct-password', 10);
    await pool.query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name)
       VALUES ($1, 'teacher', 'teacher@example.com', $2, 'Test Teacher')`,
      [tenantResult.rows[0].id, passwordHash]
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('POST /auth/login with correct credentials returns 200 and a token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /auth/login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'wrong-password', deviceId: 'device-1' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('POST /auth/login with a missing deviceId returns 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'correct-password' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(login).not.toHaveBeenCalled();
  });

  it('POST /auth/login returns 500 when login() throws an unexpected error', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error('boom'));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(login).toHaveBeenCalledOnce();
  });
});
