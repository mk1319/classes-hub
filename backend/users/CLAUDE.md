# users — Rules

Tenant-scoped teacher/student account management. Handles all `/users/*` routes
in one Lambda (Express + serverless-http via `@classes-hub/shared`).

- Every logic fn in `src/users.ts` is admin-only (`requireAdmin` → tutor/admin)
  and tenant-scoped: queries always filter by the caller's `tenant_id` from the
  JWT. An admin can only ever create the roles `teacher`/`student` — never
  another admin or a super-admin.
- Passwords are bcrypt-hashed on write; `password_hash` is never in a response
  (see the `USER_COLS` allowlist). Emails are stored lowercased; the DB's global
  unique index on `email` surfaces as a `400 EMAIL_TAKEN`.
- Bulk import parses raw CSV (`email,name,role,password` header) and is partial:
  bad rows are reported per-row, valid rows still import.
- `GET /users/:id/sessions` is the login/device history (anti-fraud, see
  `plan/15-account-security-anti-fraud.md`) — admin-only, tenant-scoped.
- Route order: `/users/bulk-import` and `/users/:id/sessions` are registered
  before `/users/:id` so the specific paths win.
- Update `../NOTES.md` in the same change as any code change here.
