import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Request } from 'express';
import { getPool, type AuthContext } from '@classes-hub/shared';
import { buildApp } from '../src/handler';

function testAuth(req: Request): AuthContext | null {
  const raw = req.header('x-test-auth');
  return raw ? (JSON.parse(raw) as AuthContext) : null;
}

const app = buildApp(testAuth);
const as = (ctx: AuthContext) => JSON.stringify(ctx);

let tenantId: number;
let otherTenantId: number;
let admin: AuthContext;
let teacher: AuthContext;

describe('users feature', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    const t = await pool.query("INSERT INTO tenants (name) VALUES ('T1') RETURNING id");
    tenantId = t.rows[0].id;
    const t2 = await pool.query("INSERT INTO tenants (name) VALUES ('T2') RETURNING id");
    otherTenantId = t2.rows[0].id;
    admin = { userId: 1, tenantId, role: 'tutor', sessionId: 1 };
    teacher = { userId: 2, tenantId, role: 'teacher', sessionId: 2 };
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('admin creates a student, hash is never returned', async () => {
    const res = await request(app)
      .post('/users')
      .set('x-test-auth', as(admin))
      .send({ email: 'Stu@Example.com', name: 'Stu', role: 'student', password: 'secret1' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('stu@example.com'); // lowercased
    expect(res.body.role).toBe('student');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('forbids a teacher from creating users', async () => {
    const res = await request(app)
      .post('/users')
      .set('x-test-auth', as(teacher))
      .send({ email: 'x@example.com', name: 'X', role: 'student', password: 'secret1' });
    expect(res.status).toBe(403);
  });

  it('rejects a duplicate email (global uniqueness)', async () => {
    const body = { email: 'dup@example.com', name: 'D', role: 'student', password: 'secret1' };
    await request(app).post('/users').set('x-test-auth', as(admin)).send(body);
    const res = await request(app).post('/users').set('x-test-auth', as(admin)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('lists users filtered by role, tenant-scoped', async () => {
    await request(app).post('/users').set('x-test-auth', as(admin)).send({ email: 't@example.com', name: 'T', role: 'teacher', password: 'secret1' });
    await request(app).post('/users').set('x-test-auth', as(admin)).send({ email: 's@example.com', name: 'S', role: 'student', password: 'secret1' });
    // A user in another tenant must not appear.
    await getPool().query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name) VALUES ($1,'student','other@example.com','x','Other')`,
      [otherTenantId]
    );
    const students = await request(app).get('/users?role=student').set('x-test-auth', as(admin));
    expect(students.status).toBe(200);
    expect(students.body.map((u: { email: string }) => u.email)).toEqual(['s@example.com']);
  });

  it('bulk-imports a CSV, reporting per-row errors', async () => {
    const csv = [
      'email,name,role,password',
      'a@example.com,Alice,student,secret1',
      'b@example.com,Bob,teacher,secret1',
      'bad@example.com,Bad,wizard,secret1', // invalid role
      'a@example.com,Alice2,student,secret1', // duplicate of row 1
    ].join('\n');
    const res = await request(app).post('/users/bulk-import').set('x-test-auth', as(admin)).send({ csv });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors.map((e: { row: number }) => e.row)).toEqual([4, 5]);
  });

  it('updates and deletes a user; cross-tenant access 404s', async () => {
    const created = await request(app)
      .post('/users')
      .set('x-test-auth', as(admin))
      .send({ email: 'u@example.com', name: 'U', role: 'student', password: 'secret1' });
    const id = created.body.id;

    const patched = await request(app).patch(`/users/${id}`).set('x-test-auth', as(admin)).send({ name: 'Renamed' });
    expect(patched.body.name).toBe('Renamed');

    // An admin of another tenant cannot see it.
    const otherAdmin: AuthContext = { userId: 9, tenantId: otherTenantId, role: 'admin', sessionId: 9 };
    const cross = await request(app).get(`/users/${id}`).set('x-test-auth', as(otherAdmin));
    expect(cross.status).toBe(404);

    const del = await request(app).delete(`/users/${id}`).set('x-test-auth', as(admin));
    expect(del.status).toBe(204);
    const gone = await request(app).get(`/users/${id}`).set('x-test-auth', as(admin));
    expect(gone.status).toBe(404);
  });

  it('returns a user session/device history', async () => {
    const created = await request(app)
      .post('/users')
      .set('x-test-auth', as(admin))
      .send({ email: 'sess@example.com', name: 'Sess', role: 'student', password: 'secret1' });
    const id = created.body.id;
    await getPool().query(
      `INSERT INTO sessions (tenant_id, user_id, device_id, device_model, is_active)
       VALUES ($1,$2,'dev-1','Pixel 8', true)`,
      [tenantId, id]
    );
    const res = await request(app).get(`/users/${id}/sessions`).set('x-test-auth', as(admin));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].device_model).toBe('Pixel 8');
  });
});
