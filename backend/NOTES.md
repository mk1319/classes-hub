# Backend — Current State

- Monorepo scaffold created: npm workspaces root, shared tsconfig base.
- Local Postgres dev environment via `docker-compose.yml` (postgres:16, credentials in `.env.example`) and `migrations/` folder for `node-pg-migrate`.
- DB schema: `tenants`, `users`, `sessions` tables via `migrations/1_init.js`.
- Shared package `@classes-hub/shared`: `getPool()` (Postgres client), `signSessionToken`/`verifySessionToken` (JWT with `SessionClaims`: userId, tenantId, role, sessionId).
- No features implemented yet.
