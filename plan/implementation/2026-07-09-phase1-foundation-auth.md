# Phase 1: Foundation + Auth Implementation Plan

> **Note (single-institute update):** This doc predates the shift to a single-institute-first V1 (no multi-tenancy). References to `tenant_id`, `super_admin`, tenant/whitelabel concepts, or Aurora below describe the deferred future multi-tenant phase — see [`04-future-phases.md`](../04-future-phases.md) — not the current single-institute architecture (see [`01-architecture.md`](../01-architecture.md)).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the backend monorepo skeleton, the Postgres schema for tenants/users/sessions, shared DB/JWT utilities, and a working `POST /auth/login` endpoint that enforces one active session per user — the foundation every other backend feature (Phases 2+) depends on.

**Architecture:** AWS SAM project with one Lambda per feature folder (esbuild-bundled TypeScript), a shared npm workspace package for DB/JWT code, Postgres via `node-pg-migrate` migrations, a custom Lambda authorizer that validates JWTs against the `sessions` table.

**Tech Stack:** Node.js 20 + TypeScript, AWS SAM (esbuild build method), PostgreSQL (`pg` client), `node-pg-migrate`, Express + `serverless-http` per function, `jsonwebtoken`, `bcryptjs`, Vitest, Docker Compose (local Postgres).

## Global Constraints

- Backend runtime: Node.js + TypeScript on AWS Lambda (per `plan/01-architecture.md`)
- Database: PostgreSQL — Aurora Serverless v2 in prod, plain Postgres via Docker locally (wire-compatible) (per `plan/01-architecture.md`)
- IaC: AWS SAM (per `plan/01-architecture.md`)
- One Lambda per feature folder, handling all its own routes internally (per `plan/01-architecture.md`)
- Every tenant-scoped table has `tenant_id`; every query scoped by it from JWT claims (per `plan/01-architecture.md` §Non-functional Notes)
- Auth: custom email+password + JWT, bcrypt password hashing, no Cognito/OTP (per `plan/01-architecture.md`)
- One active session per user; a new login deactivates the user's prior sessions (per `plan/15-account-security-anti-fraud.md`)
- Every folder gets a `CLAUDE.md` (rules) and a `NOTES.md` (current state), updated in the same change as any code addition (per `plan/09-agent-workflow-policy.md`)

---

### Task 1: Monorepo & backend workspace scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.base.json`
- Create: `backend/.gitignore`
- Create: `backend/CLAUDE.md`
- Create: `backend/NOTES.md`

**Interfaces:**
- Produces: npm workspaces root at `backend/`, listing `packages/*` plus one entry per feature folder — later tasks/phases add their folder name to the `workspaces` array here.

- [ ] **Step 1: Create the root package.json**

```json
{
  "name": "backend",
  "private": true,
  "workspaces": [
    "packages/*",
    "auth",
    "authorizer"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "migrate": "node-pg-migrate"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "node-pg-migrate": "^7.6.1",
    "@types/node": "^20.14.15"
  }
}
```

- [ ] **Step 2: Create the shared TypeScript base config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create backend/.gitignore**

```
node_modules/
dist/
.aws-sam/
*.env
```

- [ ] **Step 4: Create backend/CLAUDE.md**

```markdown
# Backend — Rules

Stack: Node.js + TypeScript on AWS Lambda, AWS SAM (esbuild build method), PostgreSQL.

- One Lambda per feature folder (this directory's siblings: `auth`, `authorizer`,
  and future feature folders), handling all of that feature's routes internally
  via Express + `serverless-http`.
- Shared code (DB client, JWT helpers, shared types) lives in `packages/shared`
  and is imported as `@classes-hub/shared/*` — never duplicated per function.
- Every query must be scoped by `tenant_id` taken from the authorizer's request
  context — never trust a `tenantId` value from the request body/query string.
- Whenever you add or change code in this folder or a subfolder, update that
  folder's `NOTES.md` in the same change (see `plan/09-agent-workflow-policy.md`
  in the project root's `plan/` folder for the full policy).
- Test with Vitest; integration tests that touch Postgres run against the local
  Docker Compose database (`backend/docker-compose.yml`).
```

- [ ] **Step 5: Create backend/NOTES.md**

```markdown
# Backend — Current State

- Monorepo scaffold created: npm workspaces root, shared tsconfig base.
- No features implemented yet.
```

- [ ] **Step 6: Verify the workspace installs**

Run: `cd backend && npm install`
Expected: completes with no errors (no workspace packages exist yet besides devDependencies, so this just validates the root `package.json` is well-formed).

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/tsconfig.base.json backend/.gitignore backend/CLAUDE.md backend/NOTES.md backend/package-lock.json
git commit -m "chore: scaffold backend monorepo workspace"
```

---

### Task 2: Local Postgres dev environment + migration tooling

**Files:**
- Create: `backend/docker-compose.yml`
- Create: `backend/.env.example`
- Create: `backend/migrations/.gitkeep`

**Interfaces:**
- Produces: a running local Postgres reachable at `postgres://classeshub:classeshub@localhost:5432/classeshub`, and `node-pg-migrate` configured to read `DATABASE_URL` from `backend/.env`.

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: classeshub
      POSTGRES_PASSWORD: classeshub
      POSTGRES_DB: classeshub
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Create .env.example**

```
DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub
JWT_SECRET=dev-secret-change-me
```

- [ ] **Step 3: Copy it to a real local .env (not committed)**

Run: `cp backend/.env.example backend/.env`
Expected: `backend/.env` now exists (already covered by `.gitignore`'s `*.env` rule from Task 1).

- [ ] **Step 4: Start Postgres and verify it's reachable**

Run: `cd backend && docker compose up -d && sleep 2 && docker compose exec postgres pg_isready -U classeshub`
Expected: `accepting connections`

- [ ] **Step 5: Add the migrations folder placeholder**

Run: `mkdir -p backend/migrations && touch backend/migrations/.gitkeep`

- [ ] **Step 6: Commit**

```bash
git add backend/docker-compose.yml backend/.env.example backend/migrations/.gitkeep
git commit -m "chore: add local Postgres dev environment and migrations folder"
```

---

### Task 3: Initial migration — tenants, users, sessions

**Files:**
- Create: `backend/migrations/1_init.js`

**Interfaces:**
- Produces: `tenants(id, name, branding, created_at)`, `users(id, tenant_id, role, email, password_hash, name, created_at)`, `sessions(id, tenant_id, user_id, device_id, device_model, os_version, app_version, ip_address, is_active, created_at)` — every later feature's migrations build on these.

- [ ] **Step 1: Create the migration file**

```js
exports.up = (pgm) => {
  pgm.createTable('tenants', {
    id: 'id',
    name: { type: 'text', notNull: true },
    branding: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('users', {
    id: 'id',
    tenant_id: { type: 'integer', references: 'tenants', onDelete: 'CASCADE' },
    role: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('users', 'tenant_id');

  pgm.createTable('sessions', {
    id: 'id',
    tenant_id: { type: 'integer', references: 'tenants', onDelete: 'CASCADE' },
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
};

exports.down = (pgm) => {
  pgm.dropTable('sessions');
  pgm.dropTable('users');
  pgm.dropTable('tenants');
};
```

- [ ] **Step 2: Run the migration against local Postgres**

Run: `cd backend && npx node-pg-migrate up --envPath .env -m migrations`
Expected: output shows `1_init` migration run, no errors.

- [ ] **Step 3: Verify the tables exist**

Run: `docker compose exec postgres psql -U classeshub -d classeshub -c '\dt'`
Expected: lists `tenants`, `users`, `sessions`, and node-pg-migrate's own `pgmigrations` table.

- [ ] **Step 4: Update backend/NOTES.md**

Add under "Current State":
```markdown
- DB schema: `tenants`, `users`, `sessions` tables via `migrations/1_init.js`.
```

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/1_init.js backend/NOTES.md
git commit -m "feat: add initial migration for tenants, users, sessions"
```

---

### Task 4: Shared package — DB client + JWT utilities

**Files:**
- Create: `backend/packages/shared/package.json`
- Create: `backend/packages/shared/tsconfig.json`
- Create: `backend/packages/shared/src/db.ts`
- Create: `backend/packages/shared/src/jwt.ts`
- Create: `backend/packages/shared/src/jwt.test.ts`

**Interfaces:**
- Produces:
  - `getPool(): Pool` — from `@classes-hub/shared/db`
  - `SessionClaims { userId: number; tenantId: number | null; role: string; sessionId: number }`, `signSessionToken(claims: SessionClaims): string`, `verifySessionToken(token: string): SessionClaims` — from `@classes-hub/shared/jwt`
- Consumes: `pg`, `jsonwebtoken` packages; `process.env.DATABASE_URL`, `process.env.JWT_SECRET`

- [ ] **Step 1: Create the shared package's package.json**

```json
{
  "name": "@classes-hub/shared",
  "version": "0.0.0",
  "private": true,
  "main": "src/index.ts",
  "dependencies": {
    "pg": "^8.12.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/pg": "^8.11.6",
    "@types/jsonwebtoken": "^9.0.6"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create the package's tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing test for JWT sign/verify round-trip**

```ts
// backend/packages/shared/src/jwt.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend/packages/shared && npm install && npx vitest run src/jwt.test.ts`
Expected: FAIL — `Cannot find module './jwt'`

- [ ] **Step 3: Implement db.ts and jwt.ts**

```ts
// backend/packages/shared/src/db.ts
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

```ts
// backend/packages/shared/src/jwt.ts
import jwt from 'jsonwebtoken';

export interface SessionClaims {
  userId: number;
  tenantId: number | null;
  role: string;
  sessionId: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signSessionToken(claims: SessionClaims): string {
  return jwt.sign(claims, getSecret(), { expiresIn: '12h' });
}

export function verifySessionToken(token: string): SessionClaims {
  return jwt.verify(token, getSecret()) as SessionClaims;
}
```

```ts
// backend/packages/shared/src/index.ts
export * from './db';
export * from './jwt';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/jwt.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Update backend/NOTES.md**

Add:
```markdown
- Shared package `@classes-hub/shared`: `getPool()` (Postgres client), `signSessionToken`/`verifySessionToken` (JWT with `SessionClaims`: userId, tenantId, role, sessionId).
```

- [ ] **Step 6: Commit**

```bash
git add backend/packages/shared backend/NOTES.md
git commit -m "feat: add shared DB client and JWT utilities"
```

---

### Task 5: Auth login logic (business logic, integration-tested against Postgres)

**Files:**
- Create: `backend/auth/package.json`
- Create: `backend/auth/tsconfig.json`
- Create: `backend/auth/src/login.ts`
- Create: `backend/auth/tests/login.test.ts`

**Interfaces:**
- Consumes: `getPool` and `signSessionToken`/`verifySessionToken`/`SessionClaims` from `@classes-hub/shared`
- Produces: `LoginInput { email: string; password: string; deviceId: string; deviceModel?: string; osVersion?: string; appVersion?: string; ipAddress?: string }`, `LoginResult { token: string }`, `login(input: LoginInput): Promise<LoginResult>` — from `../src/login`, consumed by Task 6's handler.

- [ ] **Step 1: Create backend/auth/package.json**

```json
{
  "name": "auth",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "@classes-hub/shared": "*",
    "bcryptjs": "^2.4.3",
    "express": "^4.19.2",
    "serverless-http": "^3.2.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/bcryptjs": "^2.4.6",
    "@types/aws-lambda": "^8.10.145"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create backend/auth/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing tests**

```ts
// backend/auth/tests/login.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { getPool } from '@classes-hub/shared';
import { verifySessionToken } from '@classes-hub/shared';
import { login } from '../src/login';

describe('login', () => {
  let tenantId: number;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    const tenantResult = await pool.query("INSERT INTO tenants (name) VALUES ('Test Tutor') RETURNING id");
    tenantId = tenantResult.rows[0].id;
    const passwordHash = await bcrypt.hash('correct-password', 10);
    await pool.query(
      `INSERT INTO users (tenant_id, role, email, password_hash, name)
       VALUES ($1, 'teacher', 'teacher@example.com', $2, 'Test Teacher')`,
      [tenantId, passwordHash]
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('returns a valid JWT for correct credentials', async () => {
    const result = await login({ email: 'teacher@example.com', password: 'correct-password', deviceId: 'device-1' });
    const claims = verifySessionToken(result.token);
    expect(claims.tenantId).toBe(tenantId);
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

    const pool = getPool();
    const sessionResult = await pool.query('SELECT is_active FROM sessions WHERE id = $1', [firstClaims.sessionId]);
    expect(sessionResult.rows[0].is_active).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend/auth && npm install && DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub npx vitest run tests/login.test.ts`
Expected: FAIL — `Cannot find module '../src/login'`

- [ ] **Step 5: Implement login.ts**

```ts
// backend/auth/src/login.ts
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
    'SELECT id, tenant_id, role, password_hash FROM users WHERE email = $1',
    [input.email]
  );

  if (userResult.rowCount === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = userResult.rows[0];
  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordMatches) {
    throw new Error('INVALID_CREDENTIALS');
  }

  await pool.query('UPDATE sessions SET is_active = false WHERE user_id = $1', [user.id]);

  const sessionResult = await pool.query(
    `INSERT INTO sessions (tenant_id, user_id, device_id, device_model, os_version, app_version, ip_address, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id`,
    [
      user.tenant_id,
      user.id,
      input.deviceId,
      input.deviceModel ?? null,
      input.osVersion ?? null,
      input.appVersion ?? null,
      input.ipAddress ?? null,
    ]
  );

  const token = signSessionToken({
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    sessionId: sessionResult.rows[0].id,
  });

  return { token };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub npx vitest run tests/login.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/auth/package.json backend/auth/tsconfig.json backend/auth/src/login.ts backend/auth/tests/login.test.ts
git commit -m "feat: add auth login logic with session enforcement"
```

---

### Task 6: Auth Lambda handler (Express + serverless-http)

**Files:**
- Create: `backend/auth/src/handler.ts`
- Create: `backend/auth/CLAUDE.md`

**Interfaces:**
- Consumes: `login` from `./login`
- Produces: `export const handler` — the Lambda entry point wired into `template.yaml` in Task 8, mounted at `POST /auth/login`.

- [ ] **Step 1: Implement the handler**

```ts
// backend/auth/src/handler.ts
import serverlessHttp from 'serverless-http';
import express from 'express';
import { login } from './login';

const app = express();
app.use(express.json());

app.post('/auth/login', async (req, res) => {
  try {
    const result = await login(req.body);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const handler = serverlessHttp(app);
```

- [ ] **Step 2: Create backend/auth/CLAUDE.md**

```markdown
# auth — Rules

Handles all `/auth/*` routes in one Lambda (Express + serverless-http). Business
logic lives in `src/login.ts` (and future `src/*.ts` files, e.g. refresh) — the
handler only wires routes to that logic and maps errors to HTTP responses. Add new
`/auth/*` endpoints as new files in `src/`, wired into `handler.ts`.
```

- [ ] **Step 3: Verify it builds**

Run: `cd backend/auth && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Update backend/NOTES.md**

Add:
```markdown
- `auth` feature: `POST /auth/login` — email+password, creates a session, deactivates prior sessions, returns a JWT.
```

- [ ] **Step 5: Commit**

```bash
git add backend/auth/src/handler.ts backend/auth/CLAUDE.md backend/NOTES.md
git commit -m "feat: add auth Lambda handler for POST /auth/login"
```

---

### Task 7: JWT Lambda authorizer

**Files:**
- Create: `backend/authorizer/package.json`
- Create: `backend/authorizer/tsconfig.json`
- Create: `backend/authorizer/src/handler.ts`
- Create: `backend/authorizer/tests/handler.test.ts`
- Create: `backend/authorizer/CLAUDE.md`

**Interfaces:**
- Consumes: `verifySessionToken`, `getPool` from `@classes-hub/shared`
- Produces: `export async function handler(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult>` — wired as the API Gateway custom authorizer in Task 8. On success, its `context` carries `userId`, `tenantId`, `role`, `sessionId` as strings, readable by every other feature's handlers via `event.requestContext.authorizer`.

- [ ] **Step 1: Create backend/authorizer/package.json**

```json
{
  "name": "authorizer",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "@classes-hub/shared": "*"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create backend/authorizer/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing tests**

```ts
// backend/authorizer/tests/handler.test.ts
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
    expect(result.context?.sessionId).toBe(String(sessionId));
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend/authorizer && npm install && DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub npx vitest run tests/handler.test.ts`
Expected: FAIL — `Cannot find module '../src/handler'`

- [ ] **Step 5: Implement the authorizer**

```ts
// backend/authorizer/src/handler.ts
import type { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';
import { getPool, verifySessionToken } from '@classes-hub/shared';

export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  const token = event.authorizationToken?.replace(/^Bearer\s+/i, '') ?? '';

  let claims;
  try {
    claims = verifySessionToken(token);
  } catch {
    throw new Error('Unauthorized');
  }

  const pool = getPool();
  const sessionResult = await pool.query('SELECT is_active FROM sessions WHERE id = $1', [claims.sessionId]);

  if (sessionResult.rowCount === 0 || !sessionResult.rows[0].is_active) {
    throw new Error('Unauthorized');
  }

  return {
    principalId: String(claims.userId),
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        },
      ],
    },
    context: {
      userId: String(claims.userId),
      tenantId: claims.tenantId === null ? '' : String(claims.tenantId),
      role: claims.role,
      sessionId: String(claims.sessionId),
    },
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub npx vitest run tests/handler.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Create backend/authorizer/CLAUDE.md**

```markdown
# authorizer — Rules

The single API Gateway custom authorizer for the whole backend. Validates the JWT
and checks the session it references is still `is_active` in the `sessions` table
(this is what makes single-active-session enforcement actually take effect, not
just the login-time deactivation). On success, its `context` (userId, tenantId,
role, sessionId — all strings) is how every other feature's handler reads who's
calling. Never modify this to skip the session-active check.
```

- [ ] **Step 8: Update backend/NOTES.md**

Add:
```markdown
- `authorizer` feature: API Gateway custom authorizer — verifies JWT + checks the session is still active; exposes userId/tenantId/role/sessionId to downstream functions via request context.
```

- [ ] **Step 9: Commit**

```bash
git add backend/authorizer backend/NOTES.md
git commit -m "feat: add JWT authorizer with session-active enforcement"
```

---

### Task 8: SAM template — wire it all together and smoke-test

**Files:**
- Create: `backend/template.yaml`
- Create: `backend/samconfig.toml`

**Interfaces:**
- Produces: a deployable/locally-runnable API Gateway + Lambda stack exposing `POST /auth/login` (no auth required) as the only route in this phase; every later phase adds its function + routes to this same template.

- [ ] **Step 1: Create template.yaml**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Classes Hub backend

Parameters:
  JwtSecret:
    Type: String
    NoEcho: true
  DatabaseUrl:
    Type: String
    NoEcho: true

Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 10
    MemorySize: 256
    Environment:
      Variables:
        JWT_SECRET: !Ref JwtSecret
        DATABASE_URL: !Ref DatabaseUrl

Resources:
  Api:
    Type: AWS::Serverless::Api
    Properties:
      StageName: dev
      Auth:
        DefaultAuthorizer: JwtAuthorizer
        Authorizers:
          JwtAuthorizer:
            FunctionArn: !GetAtt AuthorizerFunction.Arn
            FunctionPayloadType: TOKEN
            Identity:
              Header: Authorization

  AuthorizerFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: authorizer/
      Handler: src/handler.handler
      Metadata:
        BuildMethod: esbuild
        BuildProperties:
          EntryPoints: [src/handler.ts]

  AuthFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: auth/
      Handler: src/handler.handler
      Metadata:
        BuildMethod: esbuild
        BuildProperties:
          EntryPoints: [src/handler.ts]
      Events:
        Login:
          Type: Api
          Properties:
            RestApiId: !Ref Api
            Path: /auth/login
            Method: post
            Auth:
              Authorizer: NONE

Outputs:
  ApiUrl:
    Value: !Sub "https://${Api}.execute-api.${AWS::Region}.amazonaws.com/dev/"
```

- [ ] **Step 2: Create samconfig.toml**

```toml
version = 0.1

[default.build.parameters]
cached = true
parallel = true

[default.deploy.parameters]
stack_name = "classes-hub-backend"
resolve_s3 = true
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
```

- [ ] **Step 3: Build**

Run: `cd backend && sam build`
Expected: `Build Succeeded`

- [ ] **Step 4: Run locally and smoke-test login**

Run (in one terminal): `sam local start-api --env-vars <(echo '{"AuthFunction":{"JWT_SECRET":"dev-secret","DATABASE_URL":"postgres://classeshub:classeshub@host.docker.internal:5432/classeshub"},"AuthorizerFunction":{"JWT_SECRET":"dev-secret","DATABASE_URL":"postgres://classeshub:classeshub@host.docker.internal:5432/classeshub"}}')`

Run (in another terminal, after seeding a test user with a bcrypt-hashed password via `psql`): `curl -s -X POST http://127.0.0.1:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"teacher@example.com","password":"correct-password","deviceId":"device-1"}'`

Expected: `{"token":"<a JWT string>"}`

- [ ] **Step 5: Update backend/NOTES.md**

Add:
```markdown
- SAM template (`template.yaml`) wires `authorizer` as the default API Gateway authorizer and `auth` function at `POST /auth/login` (unauthenticated). Local smoke test verified via `sam local start-api`.
```

- [ ] **Step 6: Commit**

```bash
git add backend/template.yaml backend/samconfig.toml backend/NOTES.md
git commit -m "feat: wire SAM template for auth + authorizer, verify local smoke test"
```

---

## Self-Review Notes

- **Spec coverage:** monorepo scaffold ✓ (Task 1), DB schema for tenants/users/sessions ✓ (Task 3), shared DB/JWT utilities ✓ (Task 4), login with session enforcement ✓ (Task 5), Lambda handler ✓ (Task 6), authorizer enforcing single-active-session ✓ (Task 7), SAM wiring + smoke test ✓ (Task 8).
- **Type consistency:** `SessionClaims` (userId, tenantId, role, sessionId) used identically in `jwt.ts`, `login.ts`, and `authorizer/handler.ts`. `LoginInput`/`LoginResult` defined once in `login.ts`, consumed as-is by `handler.ts` (no retyping).
- **Not covered here (future phases):** `tenants`, `users`, `courses`, `tests`, `timetable`, `notifications`, `resources`, `syllabus` features (Phases 2–9); dashboard and Flutter app (Phases 10–13). `POST /auth/login`'s `NONE` authorizer override is the only unauthenticated route — every other route added in later phases inherits the `JwtAuthorizer` default.
