# Backend — Current State

- Monorepo scaffold created: npm workspaces root, shared tsconfig base.
- Local Postgres dev environment via `docker-compose.yml` (postgres:16, credentials in `.env.example`) and `migrations/` folder for `node-pg-migrate`.
- DB schema: `tenants`, `users`, `sessions` tables via `migrations/1_init.js`.
- No features implemented yet.
