import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '@classes-hub/shared';
import { publicApp, authedApp } from '../src/handler';

function withAuth(auth: { userId: string; role: string; sessionId: string }) {
  const wrapper = express();
  wrapper.use((req, _res, next) => {
    (req as unknown as { requestContext: unknown }).requestContext = { authorizer: auth };
    next();
  });
  wrapper.use(authedApp);
  return wrapper;
}

describe('identity handler', () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    const passwordHash = await bcrypt.hash('correct-password', 10);
    await pool.query(
      `INSERT INTO users (role, email, password_hash, name) VALUES ('teacher', 'teacher@example.com', $1, 'Test Teacher')`,
      [passwordHash]
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('POST /auth/login returns 200 + token on correct credentials', async () => {
    const res = await request(publicApp)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('POST /auth/login returns 401 on wrong password', async () => {
    const res = await request(publicApp)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'wrong-password', deviceId: 'device-1' });
    expect(res.status).toBe(401);
  });

  it('POST /auth/login returns 400 on missing deviceId', async () => {
    const res = await request(publicApp)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'correct-password' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/logout deactivates the session', async () => {
    await request(publicApp)
      .post('/auth/login')
      .send({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });

    const pool = getPool();
    const sessionResult = await pool.query('SELECT id FROM sessions WHERE is_active = true LIMIT 1');
    const sessionId = sessionResult.rows[0].id;

    const res = await request(withAuth({ userId: '1', role: 'teacher', sessionId: String(sessionId) })).post(
      '/auth/logout'
    );
    expect(res.status).toBe(204);

    const after = await pool.query('SELECT is_active FROM sessions WHERE id = $1', [sessionId]);
    expect(after.rows[0].is_active).toBe(false);
  });

  it('POST /auth/logout returns 401 without auth context', async () => {
    const res = await request(authedApp).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
