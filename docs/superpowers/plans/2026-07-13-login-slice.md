# Single-Institute Login Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend (authorizer + identity Lambdas, users/sessions tables) and dashboard (login screen + authed shell) for login/logout only, on the new single-institute architecture — no `tenant_id` anywhere, roles `admin | teacher | student`.

**Architecture:** Two Lambdas (`authorizer`, `identity`) behind API Gateway, sharing a `packages/shared` library (DB pool, JWT, HTTP helpers). `identity` exports two Express apps — `publicApp` (just `/auth/login`) and `authedApp` (just `/auth/logout`) — so both SAM (via per-route `Auth` config) and the local `dev-server.ts` shim can apply the authorizer to the right routes. Dashboard is Vite + React + TanStack Router/Query, proxying `/api/v1` to the local backend, with a `/login` route and a `/_authed` guard layout.

**Tech Stack:** Node.js + TypeScript, Express + serverless-http, AWS SAM, node-pg-migrate, Postgres (Supabase for local dev), Vitest + Supertest, bcryptjs, jsonwebtoken, zod. Dashboard: Vite, React, TanStack Router + Query, Tailwind.

## Global Constraints

- No `tenant_id` column or tenant concept anywhere in this slice — single institute.
- Roles are exactly `admin | teacher | student` (no `super_admin`).
- JWT signing must pin the algorithm explicitly (`HS256`) on both sign and verify — never accept an unverified algorithm.
- Passwords hashed with bcrypt (bcryptjs), never stored/logged in plaintext.
- Single-active-session is enforced at the DB level via a partial unique index (`UNIQUE (user_id) WHERE is_active`), not just in application code.
- Integration tests run against a real Postgres database (the existing Supabase instance via `backend/.env`) — no mocking the DB.
- TypeScript strict mode everywhere.
- Commit after each task.
- `backend/.env` and `dashboard/.env.local` hold real secrets and must never be committed (already covered by `*.env` / `*.local` gitignore patterns — recreate the `.gitignore` files since `backend/` is currently empty).

---

## Task 1: Backend workspace scaffold + shared package

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.base.json`
- Create: `backend/.gitignore`
- Create: `backend/.env.example`
- Create: `backend/packages/shared/package.json`
- Create: `backend/packages/shared/tsconfig.json`
- Create: `backend/packages/shared/src/db.ts`
- Create: `backend/packages/shared/src/http.ts`
- Create: `backend/packages/shared/src/webapp.ts`
- Create: `backend/packages/shared/src/jwt.ts`
- Create: `backend/packages/shared/src/index.ts`
- Test: `backend/packages/shared/src/jwt.test.ts`

**Interfaces:**
- Produces: `getPool(): Pool`; `SessionClaims { userId: number; role: string; sessionId: number }`; `signSessionToken(claims: SessionClaims): string`; `verifySessionToken(token: string): SessionClaims`; `AuthContext { userId: number; role: string; sessionId: number }`; `getAuthFromRequest(req: unknown): AuthContext | null`; `HttpError` class; `badRequest/unauthorized/forbidden/notFound(code?: string, message?: string): HttpError`; `requireRole(ctx: AuthContext, ...roles: string[]): void`; `createFeatureApp(): express.Express`; `asyncHandler(fn): RequestHandler`; `errorHandler: ErrorRequestHandler`.

- [ ] **Step 1: Create the workspace root files**

`backend/package.json`:
```json
{
  "name": "backend",
  "private": true,
  "workspaces": [
    "packages/*",
    "authorizer",
    "identity"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "migrate": "node-pg-migrate",
    "seed": "node scripts/seed.cjs",
    "dev": "esbuild dev-server.ts --bundle --platform=node --outfile=dev-server.cjs && node dev-server.cjs"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "node-pg-migrate": "^7.6.1",
    "esbuild": "^0.21.5",
    "@types/node": "^20.14.15"
  }
}
```

`backend/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false
  }
}
```

`backend/.gitignore`:
```
node_modules/
dist/
.aws-sam/
*.env
```

`backend/.env.example`:
```
DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub
JWT_SECRET=dev-secret-change-me
```

- [ ] **Step 2: Create the shared package manifest**

`backend/packages/shared/package.json`:
```json
{
  "name": "@classes-hub/shared",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "pg": "^8.12.0",
    "jsonwebtoken": "^9.0.2",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/pg": "^8.11.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/express": "^4.17.21"
  }
}
```

`backend/packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing JWT test**

`backend/packages/shared/src/jwt.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/packages/shared`): `npx vitest run src/jwt.test.ts`
Expected: FAIL — `Cannot find module './jwt'` (file doesn't exist yet).

- [ ] **Step 3: Write the shared modules**

`backend/packages/shared/src/db.ts`:
```ts
import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}
```

`backend/packages/shared/src/jwt.ts`:
```ts
import jwt from 'jsonwebtoken';

export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
}

const ALGORITHM = 'HS256';
const EXPIRES_IN = '12h';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, getSecret(), { algorithm: ALGORITHM, expiresIn: EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionClaims {
  const decoded = jwt.verify(token, getSecret(), { algorithms: [ALGORITHM] });
  return decoded as unknown as SessionClaims;
}
```

`backend/packages/shared/src/http.ts`:
```ts
export interface AuthContext {
  userId: number;
  role: string;
  sessionId: number;
}

/**
 * Extract the authenticated caller. Checks `apiGateway.event.requestContext.authorizer`
 * (the real serverless-http/API-Gateway shape) first, falling back to a plain
 * `requestContext.authorizer` (used by the local dev-server shim and by tests
 * that inject auth context directly without going through serverless-http).
 */
export function getAuthFromRequest(req: unknown): AuthContext | null {
  const r = req as {
    apiGateway?: { event?: { requestContext?: { authorizer?: Record<string, unknown> } } };
    requestContext?: { authorizer?: Record<string, unknown> };
  };
  const a = r?.apiGateway?.event?.requestContext?.authorizer ?? r?.requestContext?.authorizer;
  if (!a || a.userId == null) return null;
  return {
    userId: Number(a.userId),
    role: String(a.role),
    sessionId: Number(a.sessionId),
  };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export const badRequest = (code = 'BAD_REQUEST', message?: string) => new HttpError(400, code, message);
export const unauthorized = (code = 'UNAUTHORIZED', message?: string) => new HttpError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message?: string) => new HttpError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message?: string) => new HttpError(404, code, message);

/** Throws 403 unless the caller's role is in the allowed list. */
export function requireRole(ctx: AuthContext, ...roles: string[]): void {
  if (!roles.includes(ctx.role)) {
    throw forbidden('FORBIDDEN', `Requires one of: ${roles.join(', ')}`);
  }
}
```

`backend/packages/shared/src/webapp.ts`:
```ts
import express, { Express, RequestHandler, ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { HttpError } from './http';

export function createFeatureApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
```

`backend/packages/shared/src/index.ts`:
```ts
export * from './db';
export * from './jwt';
export * from './http';
export * from './webapp';
```

- [ ] **Step 4: Install dependencies**

Run (from `backend/`): `npm install`
Expected: installs cleanly, no errors.

- [ ] **Step 5: Run test to verify it passes**

Run (from `backend/packages/shared`): `npx vitest run src/jwt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/tsconfig.base.json backend/.gitignore backend/.env.example backend/packages backend/package-lock.json
git commit -m "feat(backend): scaffold workspace + shared package (db, jwt, http, webapp)"
```

---

## Task 2: Migrations — `users` and `sessions` tables

**Files:**
- Create: `backend/migrations/1_users.js`
- Create: `backend/migrations/2_sessions.js`

**Interfaces:**
- Consumes: `backend/.env`'s `DATABASE_URL` (already restored, points at the Supabase Postgres cleared earlier in this session).
- Produces: `users(id, role, email, password_hash, name, created_at)`, `sessions(id, user_id, device_id, device_model, os_version, app_version, ip_address, is_active, created_at)` tables, plus the partial unique index `sessions_one_active_per_user`.

- [ ] **Step 1: Write the users migration**

`backend/migrations/1_users.js`:
```js
/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    role: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
```

- [ ] **Step 2: Write the sessions migration**

`backend/migrations/2_sessions.js`:
```js
/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('sessions', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    device_id: { type: 'text', notNull: true },
    device_model: { type: 'text' },
    os_version: { type: 'text' },
    app_version: { type: 'text' },
    ip_address: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('sessions', 'user_id');
  pgm.createIndex('sessions', 'user_id', {
    name: 'sessions_one_active_per_user',
    unique: true,
    where: 'is_active',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('sessions', 'user_id', { name: 'sessions_one_active_per_user' });
  pgm.dropTable('sessions');
};
```

- [ ] **Step 3: Run the migrations against Supabase**

Run (from `backend/`):
```bash
export $(cat .env | xargs) && npx node-pg-migrate up -m migrations --envPath .env
```
Expected: `### MIGRATION 1_users (UP) ###` then `### MIGRATION 2_sessions (UP) ###`, ending `Migrations complete!`.

- [ ] **Step 4: Verify the tables exist**

Run:
```bash
export $(cat .env | xargs) && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(async () => {
  const r = await c.query(\"select table_name from information_schema.tables where table_schema='public' order by 1\");
  console.log(r.rows.map(x => x.table_name));
  await c.end();
});
"
```
Expected: `[ 'pgmigrations', 'sessions', 'users' ]`.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations
git commit -m "feat(backend): add users and sessions migrations"
```

---

## Task 3: Login/logout business logic (TDD)

**Files:**
- Create: `backend/identity/package.json`
- Create: `backend/identity/tsconfig.json`
- Create: `backend/identity/vitest.config.ts`
- Create: `backend/identity/src/login.ts`
- Test: `backend/identity/tests/login.test.ts`

**Interfaces:**
- Consumes: `getPool`, `signSessionToken`, `SessionClaims` from `@classes-hub/shared` (Task 1); `users`/`sessions` tables (Task 2).
- Produces: `LoginInput { email: string; password: string; deviceId: string; deviceModel?: string; osVersion?: string; appVersion?: string; ipAddress?: string }`; `LoginResult { token: string }`; `login(input: LoginInput): Promise<LoginResult>` (throws `Error('INVALID_CREDENTIALS')` on bad email/password); `logout(sessionId: number): Promise<void>`.

- [ ] **Step 1: Create the identity package manifest**

`backend/identity/package.json`:
```json
{
  "name": "identity",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "build": "true"
  },
  "dependencies": {
    "@classes-hub/shared": "*",
    "bcryptjs": "^2.4.3",
    "express": "^4.19.2",
    "serverless-http": "^3.2.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "vitest": "^2.0.5"
  }
}
```

`backend/identity/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`backend/identity/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

// Tests share the same Postgres tables and reseed in beforeEach — must run
// serially or they race each other's setup.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
```

- [ ] **Step 2: Write the failing tests**

`backend/identity/tests/login.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `backend/identity`, with `backend/.env` loaded): `export $(cat ../.env | xargs) && npx vitest run tests/login.test.ts`
Expected: FAIL — `Cannot find module '../src/login'`.

- [ ] **Step 4: Write the implementation**

`backend/identity/src/login.ts`:
```ts
import bcrypt from 'bcryptjs';
import { getPool, signSessionToken } from '@classes-hub/shared';

export interface LoginInput {
  email: string;
  password: string;
  deviceId: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  ipAddress?: string;
}

export interface LoginResult {
  token: string;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const pool = getPool();
  const userResult = await pool.query(
    'SELECT id, role, password_hash FROM users WHERE email = $1',
    [input.email]
  );
  if (userResult.rowCount === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const user = userResult.rows[0];
  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const client = await pool.connect();
  let sessionId: number;
  try {
    await client.query('BEGIN');
    await client.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [user.id]);
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, device_id, device_model, os_version, app_version, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        user.id,
        input.deviceId,
        input.deviceModel ?? null,
        input.osVersion ?? null,
        input.appVersion ?? null,
        input.ipAddress ?? null,
      ]
    );
    sessionId = sessionResult.rows[0].id;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const token = signSessionToken({ userId: user.id, role: user.role, sessionId });
  return { token };
}

export async function logout(sessionId: number): Promise<void> {
  await getPool().query('UPDATE sessions SET is_active = false WHERE id = $1', [sessionId]);
}
```

- [ ] **Step 5: Install and run tests to verify they pass**

Run (from `backend/`): `npm install`
Run (from `backend/identity`, with env loaded): `export $(cat ../.env | xargs) && npx vitest run tests/login.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/identity/package.json backend/identity/tsconfig.json backend/identity/vitest.config.ts backend/identity/src/login.ts backend/identity/tests backend/package-lock.json
git commit -m "feat(backend): identity login/logout business logic with concurrent-session test"
```

---

## Task 4: `identity` Lambda handler (routes + validation)

**Files:**
- Create: `backend/identity/src/schema.ts`
- Create: `backend/identity/src/handler.ts`
- Test: `backend/identity/tests/handler.test.ts`

**Interfaces:**
- Consumes: `login`, `logout` from `./login` (Task 3); `createFeatureApp`, `asyncHandler`, `errorHandler`, `getAuthFromRequest`, `unauthorized`, `badRequest` from `@classes-hub/shared` (Task 1).
- Produces: `publicApp: Express` (just `POST /auth/login`); `authedApp: Express` (just `POST /auth/logout`); `handler` (serverless-http-wrapped combination of both, for the real Lambda deployment).

- [ ] **Step 1: Write the failing tests**

`backend/identity/tests/handler.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/identity`, with env loaded): `export $(cat ../.env | xargs) && npx vitest run tests/handler.test.ts`
Expected: FAIL — `Cannot find module '../src/handler'`.

- [ ] **Step 3: Write the schema and handler**

`backend/identity/src/schema.ts`:
```ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().min(1),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
  ipAddress: z.string().optional(),
});
```

`backend/identity/src/handler.ts`:
```ts
import serverlessHttp from 'serverless-http';
import {
  createFeatureApp,
  asyncHandler,
  errorHandler,
  getAuthFromRequest,
  unauthorized,
  badRequest,
} from '@classes-hub/shared';
import { login, logout } from './login';
import { loginSchema } from './schema';

// Public routes — API Gateway wires these with Auth: NONE (see template.yaml).
export const publicApp = createFeatureApp();
publicApp.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('BAD_REQUEST', 'Invalid request body');
    try {
      const result = await login(parsed.data);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
        throw unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
      }
      throw err;
    }
  })
);
publicApp.use(errorHandler);

// Authenticated routes — behind the custom authorizer.
export const authedApp = createFeatureApp();
authedApp.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const auth = getAuthFromRequest(req);
    if (!auth) throw unauthorized();
    await logout(auth.sessionId);
    res.status(204).send();
  })
);
authedApp.use(errorHandler);

// Combined app for the real Lambda — API Gateway decides which incoming
// requests carry authorizer context; this handler just serves whichever
// path it's given.
const combined = createFeatureApp();
combined.use(publicApp);
combined.use(authedApp);
combined.use(errorHandler);

export const handler = serverlessHttp(combined);
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/identity`, with env loaded): `export $(cat ../.env | xargs) && npx vitest run tests/handler.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/identity/src/schema.ts backend/identity/src/handler.ts backend/identity/tests/handler.test.ts backend/package-lock.json
git commit -m "feat(backend): identity Lambda handler with public/authed route split"
```

---

## Task 5: `authorizer` Lambda

**Files:**
- Create: `backend/authorizer/package.json`
- Create: `backend/authorizer/tsconfig.json`
- Create: `backend/authorizer/vitest.config.ts`
- Create: `backend/authorizer/src/handler.ts`
- Test: `backend/authorizer/tests/handler.test.ts`

**Interfaces:**
- Consumes: `getPool`, `verifySessionToken` from `@classes-hub/shared` (Task 1); `sessions` table (Task 2).
- Produces: `handler(event: { authorizationToken?: string; headers?: Record<string,string>; methodArn: string }): Promise<{ principalId: string; policyDocument: object; context: { userId: string; role: string; sessionId: string } }>` — throws `Error('Unauthorized')` on any failure (bad token, expired token, deactivated session).

- [ ] **Step 1: Create the package manifest**

`backend/authorizer/package.json`:
```json
{
  "name": "authorizer",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "build": "true"
  },
  "dependencies": {
    "@classes-hub/shared": "*"
  },
  "devDependencies": {
    "vitest": "^2.0.5"
  }
}
```

`backend/authorizer/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`backend/authorizer/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
```

- [ ] **Step 2: Write the failing tests**

`backend/authorizer/tests/handler.test.ts`:
```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `backend/authorizer`, with env loaded): `export $(cat ../.env | xargs) && npx vitest run tests/handler.test.ts`
Expected: FAIL — `Cannot find module '../src/handler'`.

- [ ] **Step 4: Write the implementation**

`backend/authorizer/src/handler.ts`:
```ts
import { getPool, verifySessionToken } from '@classes-hub/shared';

interface AuthorizerEvent {
  authorizationToken?: string;
  headers?: Record<string, string>;
  methodArn: string;
}

interface AuthorizerResult {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{ Action: string; Effect: string; Resource: string }>;
  };
  context: { userId: string; role: string; sessionId: string };
}

function generatePolicy(principalId: string, resource: string, context: AuthorizerResult['context']): AuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: resource }],
    },
    context,
  };
}

export async function handler(event: AuthorizerEvent): Promise<AuthorizerResult> {
  const raw = event.authorizationToken ?? event.headers?.Authorization ?? '';
  const token = raw.replace(/^Bearer\s+/i, '');
  try {
    const claims = verifySessionToken(token);
    const result = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    if (result.rowCount === 0 || !result.rows[0].is_active) {
      throw new Error('inactive');
    }
    return generatePolicy(String(claims.userId), event.methodArn, {
      userId: String(claims.userId),
      role: claims.role,
      sessionId: String(claims.sessionId),
    });
  } catch {
    throw new Error('Unauthorized');
  }
}
```

- [ ] **Step 5: Install and run test to verify it passes**

Run (from `backend/`): `npm install`
Run (from `backend/authorizer`, with env loaded): `export $(cat ../.env | xargs) && npx vitest run tests/handler.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/authorizer backend/package-lock.json
git commit -m "feat(backend): authorizer Lambda (JWT + active-session verification)"
```

---

## Task 6: SAM template, local dev server, seed script

**Files:**
- Create: `backend/template.yaml`
- Create: `backend/samconfig.toml`
- Create: `backend/dev-server.ts`
- Create: `backend/scripts/seed.cjs`

**Interfaces:**
- Consumes: `publicApp`, `authedApp` from `backend/identity/src/handler.ts` (Task 4); `getPool`, `verifySessionToken` from `@classes-hub/shared` (Task 1).
- Produces: a running local backend on `http://localhost:3000`; seeded `admin@classeshub.test` / `teacher@classeshub.test` / `student@classeshub.test` users, password `password123`.

- [ ] **Step 1: Write the SAM template**

`backend/template.yaml`:
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Classes Hub backend (single institute)

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 10
    MemorySize: 256
    Environment:
      Variables:
        DATABASE_URL: !Ref DatabaseUrl
        JWT_SECRET: !Ref JwtSecret

Parameters:
  DatabaseUrl:
    Type: String
    NoEcho: true
  JwtSecret:
    Type: String
    NoEcho: true

Resources:
  ApiGateway:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Auth:
        DefaultAuthorizer: JwtAuthorizer
        Authorizers:
          JwtAuthorizer:
            FunctionArn: !GetAtt ApiAuthorizerFunction.Arn
            Identity:
              Header: Authorization

  ApiAuthorizerFunction:
    Type: AWS::Serverless::Function
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: false
        Target: node20
        EntryPoints:
          - src/handler.ts
    Properties:
      CodeUri: authorizer/
      Handler: src/handler.handler

  IdentityFunction:
    Type: AWS::Serverless::Function
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: false
        Target: node20
        EntryPoints:
          - src/handler.ts
    Properties:
      CodeUri: identity/
      Handler: src/handler.handler
      Events:
        Login:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /auth/login
            Method: post
            Auth:
              Authorizer: NONE
        Logout:
          Type: Api
          Properties:
            RestApiId: !Ref ApiGateway
            Path: /auth/logout
            Method: post

Outputs:
  ApiUrl:
    Value: !Sub https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/prod/
```

- [ ] **Step 2: Write the SAM config**

`backend/samconfig.toml`:
```toml
version = 0.1

[default.build.parameters]
cached = true
parallel = true
build_in_source = true

[default.deploy.parameters]
stack_name = "classes-hub-backend"
resolve_s3 = true
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
```

- [ ] **Step 3: Write the local dev server**

`backend/dev-server.ts`:
```ts
// backend/dev-server.ts
//
// Local all-in-one dev server: mounts identity's public/authed apps behind a
// JWT-decoding middleware that reproduces what the API Gateway custom
// authorizer does in production (verify token + check the session is active,
// then inject the authorizer context). NOT for production — SAM/API Gateway is
// the real entry point. This exists so the dashboard can run against a live
// backend locally without Docker/SAM.
// Run: npm run dev (esbuild-bundles this to dev-server.cjs, then runs it).

import express from 'express';
import { getPool, verifySessionToken } from '@classes-hub/shared';
import { publicApp, authedApp } from './identity/src/handler';

const root = express();
root.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Public routes (no authorizer) — currently just POST /auth/login.
root.use(publicApp);

// Authorizer shim: verify JWT + active session, then inject the same context
// shape the real authorizer produces.
async function authorize(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    const claims = verifySessionToken(token);
    const s = await getPool().query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);
    if (s.rowCount === 0 || !s.rows[0].is_active) throw new Error('inactive');
    (req as unknown as { requestContext: unknown }).requestContext = {
      authorizer: {
        userId: String(claims.userId),
        role: claims.role,
        sessionId: String(claims.sessionId),
      },
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Everything else (currently just POST /auth/logout) — behind the authorizer shim.
root.use(authorize);
root.use(authedApp);

const port = Number(process.env.PORT ?? 3000);
root.listen(port, () => console.log(`dev backend on http://localhost:${port}`));
```

- [ ] **Step 4: Write the seed script**

`backend/scripts/seed.cjs`:
```js
// backend/scripts/seed.cjs
//
// Local/dev-only seed data: wipes users/sessions and inserts one demo user per
// role (admin/teacher/student) so there's something to log in as. Never run
// against production.
//
// Usage: npm run seed (reads DATABASE_URL from backend/.env)

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const DEMO_PASSWORD = 'password123';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE users, sessions RESTART IDENTITY CASCADE');

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const users = [
      { role: 'admin', email: 'admin@classeshub.test', name: 'Admin User' },
      { role: 'teacher', email: 'teacher@classeshub.test', name: 'Teacher User' },
      { role: 'student', email: 'student@classeshub.test', name: 'Student User' },
    ];
    for (const u of users) {
      await client.query(`INSERT INTO users (role, email, password_hash, name) VALUES ($1, $2, $3, $4)`, [
        u.role,
        u.email,
        passwordHash,
        u.name,
      ]);
    }

    await client.query('COMMIT');

    console.log('Seed complete.\n');
    console.log('Login credentials (all passwords: %s):', DEMO_PASSWORD);
    for (const u of users) console.log('  %s  %s', u.role.padEnd(8), u.email);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Install, seed, and start the dev server**

Run (from `backend/`):
```bash
npm install
npm run seed
npm run dev
```
Expected: seed prints the three demo logins; dev server prints `dev backend on http://localhost:3000` and keeps running (run it with `run_in_background` if executing this plan via an agent).

- [ ] **Step 6: Smoke-test login and logout end to end**

Run (in a separate shell, backend still running):
```bash
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@classeshub.test","password":"password123","deviceId":"smoke-test"}'
```
Expected: `{"token":"..."}`.

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@classeshub.test","password":"password123","deviceId":"smoke-test-2"}' \
  | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).token))")
curl -s -o /dev/null -w "logout status: %{http_code}\n" -X POST http://localhost:3000/auth/logout -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "reuse after logout status: %{http_code}\n" http://localhost:3000/auth/logout -X POST -H "Authorization: Bearer $TOKEN"
```
Expected: `logout status: 204`, then `reuse after logout status: 401` (session deactivated).

- [ ] **Step 7: Commit**

```bash
git add backend/template.yaml backend/samconfig.toml backend/dev-server.ts backend/scripts backend/package-lock.json
git commit -m "feat(backend): SAM template, local dev server, seed script"
```

---

## Task 7: Dashboard scaffold

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tailwind.config.js`
- Create: `dashboard/postcss.config.js`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/index.html`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/vite-env.d.ts`
- Create: `dashboard/src/styles/globals.css`
- Create: `dashboard/src/routes/__root.tsx`
- Create: `dashboard/.gitignore`

**Interfaces:**
- Produces: a running Vite dev server on `http://localhost:5173`, proxying `/api/v1/*` to `http://localhost:3000/*`; TanStack Router file-based routing wired up (generates `src/routeTree.gen.ts`, gitignored).

- [ ] **Step 1: Write the package manifest**

`dashboard/package.json`:
```json
{
  "name": "dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.51.23",
    "@tanstack/react-router": "^1.49.2",
    "clsx": "^2.1.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "^1.49.2",
    "@types/node": "^20.14.15",
    "@types/react": "^18.3.4",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.2"
  }
}
```

- [ ] **Step 2: Write the Vite config with the `/api/v1` proxy**

`dashboard/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ''),
      },
    },
  },
});
```

- [ ] **Step 3: Write the remaining config + entry files**

`dashboard/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`dashboard/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`dashboard/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

`dashboard/.gitignore`:
```
node_modules/
dist/
*.local
src/routeTree.gen.ts
```

`dashboard/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Classes Hub</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`dashboard/src/styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`dashboard/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`dashboard/src/routes/__root.tsx`:
```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => <Outlet />,
});
```

`dashboard/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';

const queryClient = new QueryClient();
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root')!;
createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 4: Install and verify the dev server starts**

Run (from `dashboard/`):
```bash
npm install
npm run dev
```
Expected: Vite starts on `http://localhost:5173` (generates `src/routeTree.gen.ts` with just the root route). Stop the server after confirming (Ctrl-C, or kill the background process if run via an agent).

- [ ] **Step 5: Commit**

```bash
git add dashboard/package.json dashboard/vite.config.ts dashboard/tailwind.config.js dashboard/postcss.config.js dashboard/tsconfig.json dashboard/.gitignore dashboard/index.html dashboard/src/main.tsx dashboard/src/vite-env.d.ts dashboard/src/styles dashboard/src/routes/__root.tsx dashboard/package-lock.json
git commit -m "feat(dashboard): scaffold Vite + React + TanStack Router/Query + Tailwind"
```

---

## Task 8: Dashboard API client + auth storage

**Files:**
- Create: `dashboard/src/lib/api.ts`
- Create: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/features/auth/api.ts`
- Create: `dashboard/.env.local`

**Interfaces:**
- Consumes: nothing new (browser `fetch`, `localStorage`).
- Produces: `apiFetch<T>(path: string, opts?: { method?: string; body?: unknown; anonymous?: boolean }): Promise<T>`; `ApiError`; `getToken()/setToken(token)/clearToken()`; `SessionClaims { userId: number; role: string; sessionId: number; exp: number }`; `getSession(): SessionClaims | null`; `useLogin()`, `useLogout()` (TanStack Query mutation hooks).

- [ ] **Step 1: Write the auth storage module**

`dashboard/src/lib/auth.ts`:
```ts
// dashboard/src/lib/auth.ts
//
// Client-side token storage + JWT decode for UI purposes only — the backend
// re-verifies every call via the authorizer.

const TOKEN_KEY = 'classeshub_token';

export interface SessionClaims {
  userId: number;
  role: string;
  sessionId: number;
  exp: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function decodeToken(token: string): SessionClaims | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload)) as SessionClaims;
  } catch {
    return null;
  }
}

export function getSession(): SessionClaims | null {
  const token = getToken();
  if (!token) return null;
  const claims = decodeToken(token);
  if (!claims) return null;
  if (claims.exp * 1000 < Date.now()) {
    clearToken();
    return null;
  }
  return claims;
}
```

- [ ] **Step 2: Write the API client**

`dashboard/src/lib/api.ts`:
```ts
// dashboard/src/lib/api.ts
//
// The single API client. Nothing else calls fetch directly — routes/components
// go through features/<name>/api.ts, which use this.

import { clearToken, getToken } from './auth';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the Authorization header (login only). */
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!opts.anonymous) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !opts.anonymous) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }

  if (!res.ok) {
    let code: string | undefined;
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error ?? message;
      code = data.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 3: Write the auth feature's query hooks**

`dashboard/src/features/auth/api.ts`:
```ts
// dashboard/src/features/auth/api.ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { setToken, clearToken } from '@/lib/auth';

interface LoginInput {
  email: string;
  password: string;
  deviceId: string;
}

interface LoginResult {
  token: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<LoginResult>('/auth/login', { method: 'POST', body: input, anonymous: true }),
    onSuccess: (data) => setToken(data.token),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => clearToken(),
  });
}
```

- [ ] **Step 4: Write the local env file**

`dashboard/.env.local` (gitignored via `*.local`):
```
VITE_API_URL=/api/v1
```

- [ ] **Step 5: Typecheck**

Run (from `dashboard/`): `npm run typecheck`
Expected: no errors (unused-file warnings aside — `features/auth/api.ts` isn't imported yet until Task 9).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib dashboard/src/features
git commit -m "feat(dashboard): API client, token storage, auth query hooks"
```

---

## Task 9: Login route, authed guard, landing page

**Files:**
- Create: `dashboard/src/routes/login.tsx`
- Create: `dashboard/src/routes/_authed.tsx`
- Create: `dashboard/src/routes/_authed/index.tsx`

**Interfaces:**
- Consumes: `useLogin`, `useLogout` from `@/features/auth/api` (Task 8); `getSession` from `@/lib/auth` (Task 8).
- Produces: working `/login` and `/` (guarded) routes.

- [ ] **Step 1: Write the login route**

`dashboard/src/routes/login.tsx`:
```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useLogin } from '@/features/auth/api';
import { getSession } from '@/lib/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function deviceId(): string {
  const key = 'classeshub_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (getSession()) {
    navigate({ to: '/' });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ email, password, deviceId: deviceId() }, { onSuccess: () => navigate({ to: '/' }) });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Classes Hub</h1>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {login.isError && <p className="mb-3 text-sm text-red-600">Invalid email or password.</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write the authed guard layout**

`dashboard/src/routes/_authed.tsx`:
```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '@/lib/auth';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => {
    if (!getSession()) {
      throw redirect({ to: '/login' });
    }
  },
  component: () => <Outlet />,
});
```

- [ ] **Step 3: Write the landing page**

`dashboard/src/routes/_authed/index.tsx`:
```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { getSession } from '@/lib/auth';
import { useLogout } from '@/features/auth/api';

export const Route = createFileRoute('/_authed/')({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const logout = useLogout();
  const session = getSession();

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <p className="text-slate-900">
        Logged in as <span className="font-semibold">{session?.role}</span> (user #{session?.userId})
      </p>
      <button onClick={handleLogout} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white">
        Log out
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run (from `dashboard/`): `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/routes
git commit -m "feat(dashboard): login route, authed guard, landing page"
```

---

## Task 10: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run backend tests**

Run (from `backend/`, with `.env` present): `export $(cat .env | xargs) && npm test`
Expected: all suites pass (`packages/shared` jwt tests, `identity` login + handler tests, `authorizer` tests).

- [ ] **Step 2: Start backend and dashboard together**

Run (from `backend/`): `npm run migrate` (confirm already-applied migrations are a no-op), `npm run seed`, `npm run dev` (background)
Run (from `dashboard/`): `npm run dev` (background)

- [ ] **Step 3: Verify login/logout through the dashboard proxy for all three roles**

For each of `admin@classeshub.test`, `teacher@classeshub.test`, `student@classeshub.test` (password `password123`):
```bash
TOKEN=$(curl -s -X POST http://localhost:5173/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<email>","password":"password123","deviceId":"e2e-test"}' \
  | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).token))")
curl -s -o /dev/null -w "logout: %{http_code}\n" -X POST http://localhost:5173/api/v1/auth/logout -H "Authorization: Bearer $TOKEN"
```
Expected: `logout: 204` for each role.

- [ ] **Step 4: Manual browser check**

Open `http://localhost:5173` — should redirect to `/login`. Log in as `admin@classeshub.test` / `password123` — should land on `/` showing "Logged in as admin (user #1)". Click "Log out" — should return to `/login`. Confirm this for at least one of the three seeded roles.

- [ ] **Step 5: Stop the dev servers**

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs -r kill
lsof -nP -iTCP:5173 -sTCP:LISTEN -t | xargs -r kill
```

No commit for this task (verification only).

---

## Task 11: Rewrite `plan/` docs for the single-institute architecture

**Files:**
- Modify: `plan/00-overview.md`
- Modify: `plan/01-architecture.md`
- Modify: `plan/02-domain-model.md`
- Modify: `plan/03-features-v1.md`
- Modify: `plan/05-backend-api.md`
- Modify: `plan/04-future-phases.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Rewrite `plan/00-overview.md`**

Replace the "What we're building" and "Roles" sections to describe a single-institute product (drop "whitelabel", "tenant", "Super-admin" from the current-state description). State explicitly: multi-tenancy/whitelabel is a future phase (link to `04-future-phases.md`), added once this single-institute version is validated with a real client. Roles become `admin | teacher | student`.

- [ ] **Step 2: Rewrite `plan/01-architecture.md`**

Replace the "Multi-tenancy & Whitelabel" section with a "Single institute" section: one Postgres database, no `tenant_id`, login resolves the user by email directly (no tenant lookup). Update the tech stack table: database → plain managed Postgres (no Aurora). Update "Backend feature folders" section to the 4-Lambda grouping (`authorizer`, `identity`, `academics`, `content`) with their route ownership, replacing the old 10-Lambda-per-feature list. Remove the `tenants` feature Lambda entirely (superseded by future-phases).

- [ ] **Step 3: Rewrite `plan/02-domain-model.md`**

Remove `tenant_id` from every table in the "Core data model" list and remove the `tenants` table itself. Update `users` to drop `tenant_id`. Keep everything else (courses/subjects/batches/questions/tests/etc.) as-is structurally.

- [ ] **Step 4: Rewrite `plan/03-features-v1.md`**

Remove any tenant-management feature description (tenant CRUD, branding config, per-tenant onboarding). Keep the rest of the V1 feature descriptions (accounts, tests, timetable, notifications, resources, syllabus) but strip tenant-scoping language.

- [ ] **Step 5: Rewrite `plan/05-backend-api.md`**

Remove tenant-scoped path/permission notes and the `/tenants` endpoint group if present; note the new Lambda grouping matches `01-architecture.md`.

- [ ] **Step 6: Update `plan/04-future-phases.md`**

Add multi-tenancy/whitelabel as an explicit future phase: reintroducing `tenant_id` across tables, the `tenants` table, a `super_admin` role, per-tenant Flutter build flavors, and tenant resolution at login — all deferred until the single-institute version is validated with a real client.

- [ ] **Step 7: Commit**

```bash
git add plan/00-overview.md plan/01-architecture.md plan/02-domain-model.md plan/03-features-v1.md plan/05-backend-api.md plan/04-future-phases.md
git commit -m "docs: rewrite plan/ for single-institute architecture, defer whitelabel to future phases"
```
