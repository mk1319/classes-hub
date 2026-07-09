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
