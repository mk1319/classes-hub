# Backend — Rules

Stack: Node.js + TypeScript on AWS Lambda, AWS SAM (esbuild build method), PostgreSQL.

- One Lambda per feature folder (this directory's siblings: `auth`, `authorizer`,
  and future feature folders), handling all of that feature's routes internally
  via Express + `serverless-http`.
- Shared code (DB client, JWT helpers, shared types) lives in `packages/shared`
  and is imported as `@classes-hub/shared` (the package's barrel export) —
  never duplicated per function.
- Schema changes go in `backend/migrations/` as numbered node-pg-migrate files
  (e.g., `1_init.js`), one migration per change, run via `npm run migrate`.
  **Also update `backend/db/schema.sql` (the one-file full schema) in the same
  change** and re-verify it matches the migrations (diff columns/indexes/
  constraints between a DB built from each) — see `backend/db/README.md`.
- Every query must be scoped by `tenant_id` taken from the authorizer's request
  context — never trust a `tenantId` value from the request body/query string.
- Whenever you add or change code in this folder or a subfolder, update that
  folder's `NOTES.md` in the same change (see `plan/09-agent-workflow-policy.md`
  in the project root's `plan/` folder for the full policy).
- Test with Vitest; integration tests that touch Postgres run against the local
  Docker Compose database (`backend/docker-compose.yml`). A native local Postgres
  instance works equally well as long as it matches the same `DATABASE_URL` —
  Docker Compose isn't mandatory, just the default convenience path.
- SAM function resources: `Metadata` (e.g. `BuildMethod: esbuild`) must be a
  sibling of `Type`/`Properties`, never nested inside `Properties` — this is
  CloudFormation resource schema, not a SAM quirk. `sam build` also requires
  `build_in_source = true` (set in `samconfig.toml`) because this is an npm
  workspaces monorepo with unpublished internal packages (`@classes-hub/shared`).
