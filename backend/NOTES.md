# Backend — Current State

- Monorepo scaffold created: npm workspaces root, shared tsconfig base.
- Local Postgres dev environment via `docker-compose.yml` (postgres:16, credentials in `.env.example`) and `migrations/` folder for `node-pg-migrate`.
- DB schema: `tenants`, `users`, `sessions` tables via `migrations/1_init.js`.
- Shared package `@classes-hub/shared`: `getPool()` (Postgres client), `signSessionToken`/`verifySessionToken` (JWT with `SessionClaims`: userId, tenantId, role, sessionId).
- `auth` package (`backend/auth`): `login(input: LoginInput): Promise<LoginResult>` business logic in `src/login.ts`. Looks up the user by email, verifies the password with bcrypt, deactivates any existing sessions for that user (`UPDATE sessions SET is_active = false WHERE user_id = $1`) before inserting the new session row, then signs and returns a session JWT. Throws `Error('INVALID_CREDENTIALS')` for both unknown email and wrong password. Integration-tested in `tests/login.test.ts` against Postgres (not yet run in this environment — no live DB available; verified via `tsc --noEmit` and manual trace only). Not yet wired into a Lambda handler (Task 6).
