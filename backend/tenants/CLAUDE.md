# tenants — Rules

Super-admin-only tenant management. Handles all `/tenants/*` routes in one Lambda
(Express + serverless-http, built via `@classes-hub/shared`'s `createFeatureApp`).

- Every business-logic function in `src/tenants.ts` re-checks `role === 'super_admin'`
  (`requireRole(ctx, SUPER_ADMIN)`) — tenant CRUD is never reachable by a tenant's
  own admin. Do not remove these checks.
- The handler (`src/handler.ts`) only wires routes, validates the body with the
  `zod` schema in `src/schema.ts`, and delegates; all data access is in `tenants.ts`.
- Branding lives in the `tenants.branding` jsonb column; PATCH merges (`||`) rather
  than replaces, so partial branding updates don't wipe other keys.
- Update `../NOTES.md` in the same change as any code change here
  (see `plan/09-agent-workflow-policy.md`).
