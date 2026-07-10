import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Request } from 'express';
import { getPool, type AuthContext } from '@classes-hub/shared';
import { buildApp } from '../src/handler';

// Test auth provider: reads the caller identity from an `x-test-auth` JSON
// header so supertest can drive the app as any role without a real authorizer.
function testAuth(req: Request): AuthContext | null {
  const raw = req.header('x-test-auth');
  return raw ? (JSON.parse(raw) as AuthContext) : null;
}

const app = buildApp(testAuth);

const superAdmin: AuthContext = { userId: 1, tenantId: null, role: 'super_admin', sessionId: 1 };
const tutor: AuthContext = { userId: 2, tenantId: 1, role: 'tutor', sessionId: 2 };

const as = (ctx: AuthContext) => JSON.stringify(ctx);

describe('tenants feature', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    await getPool().query('DELETE FROM tenants');
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('creates a tenant with branding (super-admin)', async () => {
    const res = await request(app)
      .post('/tenants')
      .set('x-test-auth', as(superAdmin))
      .send({ name: 'Bright Minds', branding: { accentColor: '#2563EB', appName: 'Bright' } });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bright Minds');
    expect(res.body.branding.accentColor).toBe('#2563EB');
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('forbids a non-super-admin from creating a tenant', async () => {
    const res = await request(app)
      .post('/tenants')
      .set('x-test-auth', as(tutor))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/tenants').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid body', async () => {
    const res = await request(app)
      .post('/tenants')
      .set('x-test-auth', as(superAdmin))
      .send({ branding: { accentColor: 'not-a-hex' } });
    expect(res.status).toBe(400);
  });

  it('lists tenants alphabetically', async () => {
    await request(app).post('/tenants').set('x-test-auth', as(superAdmin)).send({ name: 'Zeta' });
    await request(app).post('/tenants').set('x-test-auth', as(superAdmin)).send({ name: 'Alpha' });
    const res = await request(app).get('/tenants').set('x-test-auth', as(superAdmin));
    expect(res.status).toBe(200);
    expect(res.body.map((t: { name: string }) => t.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('gets a tenant by id and 404s for a missing one', async () => {
    const created = await request(app)
      .post('/tenants')
      .set('x-test-auth', as(superAdmin))
      .send({ name: 'Solo' });
    const ok = await request(app).get(`/tenants/${created.body.id}`).set('x-test-auth', as(superAdmin));
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Solo');
    const missing = await request(app).get('/tenants/999999').set('x-test-auth', as(superAdmin));
    expect(missing.status).toBe(404);
  });

  it('merges branding on patch without wiping other keys', async () => {
    const created = await request(app)
      .post('/tenants')
      .set('x-test-auth', as(superAdmin))
      .send({ name: 'Merge Co', branding: { accentColor: '#111111', appName: 'Keep' } });
    const patched = await request(app)
      .patch(`/tenants/${created.body.id}`)
      .set('x-test-auth', as(superAdmin))
      .send({ branding: { accentColor: '#222222' } });
    expect(patched.status).toBe(200);
    expect(patched.body.branding.accentColor).toBe('#222222');
    expect(patched.body.branding.appName).toBe('Keep');
  });
});
