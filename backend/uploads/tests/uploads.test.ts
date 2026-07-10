import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Request } from 'express';
import type { AuthContext } from '@classes-hub/shared';
import { buildApp } from '../src/handler';
import { buildKey, isAllowedContentType } from '../src/presign';

function testAuth(req: Request): AuthContext | null {
  const raw = req.header('x-test-auth');
  return raw ? (JSON.parse(raw) as AuthContext) : null;
}

// Fake signer echoes the key so we can assert tenant-prefixing without AWS.
const fakePresign = async (key: string) => `https://s3.example/${key}?sig=abc`;
const app = buildApp(testAuth, fakePresign);
const as = (ctx: AuthContext) => JSON.stringify(ctx);

const teacher: AuthContext = { userId: 1, tenantId: 7, role: 'teacher', sessionId: 1 };
const student: AuthContext = { userId: 2, tenantId: 7, role: 'student', sessionId: 2 };

describe('uploads presign', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });

  it('buildKey is tenant-prefixed with the right extension', () => {
    expect(buildKey(7, 'image/png')).toMatch(/^tenants\/7\/uploads\/[0-9a-f-]+\.png$/);
    expect(buildKey(7, 'image/jpeg')).toMatch(/\.jpg$/);
  });

  it('isAllowedContentType allows images only', () => {
    expect(isAllowedContentType('image/png')).toBe(true);
    expect(isAllowedContentType('application/pdf')).toBe(false);
  });

  it('returns a presigned URL scoped to the caller tenant', async () => {
    const res = await request(app).post('/uploads/presign').set('x-test-auth', as(teacher)).send({ contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^tenants\/7\/uploads\//);
    expect(res.body.url).toContain(res.body.key);
  });

  it('rejects an unsupported content type', async () => {
    const res = await request(app).post('/uploads/presign').set('x-test-auth', as(teacher)).send({ contentType: 'application/zip' });
    expect(res.status).toBe(400);
  });

  it('forbids students from requesting an upload URL', async () => {
    const res = await request(app).post('/uploads/presign').set('x-test-auth', as(student)).send({ contentType: 'image/png' });
    expect(res.status).toBe(403);
  });
});
