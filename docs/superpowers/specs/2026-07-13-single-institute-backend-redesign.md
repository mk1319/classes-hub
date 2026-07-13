# Single-institute backend redesign + login slice

## Context

The V1 implementation (multi-tenant, one Lambda per feature, Aurora Postgres) was
built and worked (72 backend tests passing, all dashboard screens wired, full
Flutter app), but was scrapped: too complicated for what's actually needed right
now. The product will be delivered to **one classes/institute first**. Once that's
validated with a real user, whitelabel/multi-tenancy becomes a layer added on top
of this same backend and dashboard — not a rewrite.

All prior backend/dashboard/app code was removed (commit `bfb74e6`, recoverable
via `git checkout dbcaff2 -- backend dashboard app`). `plan/` docs are being
rewritten in place to describe this single-institute architecture as the current
target, with multi-tenancy/whitelabel moved into `plan/04-future-phases.md`.

This spec covers the target backend architecture, and scopes the **first slice to
build: login only**. Feature Lambdas (academics, content) and their tables are
designed here but not built yet — they're future slices, picked up one at a time.
The dashboard's feature screens are explicitly out of scope for this round; the
user is taking those over directly after the login slice lands.

## Target architecture (whole backend, for reference)

No `tenant_id` anywhere. Single Postgres database, single institute.

| Layer | Choice |
|---|---|
| Backend runtime | Node.js + TypeScript on AWS Lambda |
| API layer | API Gateway + custom JWT authorizer Lambda + 3 feature Lambdas |
| IaC | AWS SAM |
| Database | Plain managed Postgres (RDS, or Supabase as used for local dev) — no Aurora |
| File storage | S3 presigned URLs (question/solution images); resources as Postgres `bytea` |
| Push | Firebase Cloud Messaging |
| Dashboard | Vite + React + TanStack Router/Query + Tailwind (unchanged stack) |

**4 Lambdas total:**
1. **authorizer** — JWT verify + active-session check
2. **identity** — auth (login/logout), users (teacher/student CRUD + bulk import), courses/subjects/batches (hierarchy, teacher assignment, enrollment)
3. **academics** — questions, tests (builder/attempts/grading), timetable, syllabus (chapters + coverage)
4. **content** — resources, uploads (S3 presign), notifications (announcements + FCM tokens)

**Roles:** `admin | teacher | student` (no `super_admin` — nothing to super-administer with one institute; reintroduced when whitelabel lands).

**Full data model (target, for reference — only `users`/`sessions` built in this slice):**

```
courses (id, name, type)
subjects (id, course_id, name)
batches (id, subject_id, name, schedule_info, show_progress_to_students)
batch_teachers (batch_id, user_id)
enrollments (batch_id, student_id)

users (id, role[admin|teacher|student], email, password_hash, name, created_at)
sessions (id, user_id, device_id, device_model, os_version, app_version, ip_address, is_active, created_at)

questions (id, subject_id, type, body, options, answer_key, solution, solution_image_url, created_by)
tests (id, batch_id, title, negative_marking, negative_marking_value, reveal_results, created_by)
test_questions (test_id, question_id, position, marks)
test_attempts (id, test_id, student_id, status, score, started_at, submitted_at)
attempt_answers (id, attempt_id, question_id, answer, marks_awarded, is_correct, graded_by)

timetable_sessions (id, batch_id, title, session_date, start_time, end_time, recurrence, series_id)

chapters (id, subject_id, title, position)
chapter_coverage (id, batch_id, chapter_id, title, covered_date, notes, created_by)

resources (id, subject_id, batch_id, type, title, storage_type, link_url, is_downloadable, created_by)
resource_files (id, resource_id, filename, mime_type, file_size, file_data)

announcements (id, scope[course|batch|institute], scope_id, title, body, created_by, sent_at)
device_tokens (id, user_id, token, created_at)
```

## This slice: login only

### Backend

- **Migrations** (node-pg-migrate, against the now-empty Supabase Postgres):
  1. `users` table
  2. `sessions` table, including the partial unique index enforcing single-active-session
     (`UNIQUE (user_id) WHERE is_active`), same mechanism as before
- **`packages/shared`**: `getPool()`, JWT sign/verify (`SessionClaims { userId, role, sessionId }`
  — no `tenantId`), `AuthContext` extraction middleware, `requireRole()` guard, `HttpError`/`sendError` helpers
- **`authorizer` Lambda**: verifies JWT, checks the session row is still `is_active`, throws
  `Unauthorized` uniformly for bad/expired token vs. deactivated session (no distinction leaked)
- **`identity` Lambda**: only two routes for this slice —
  - `POST /auth/login` — body `{ email, password, deviceId, deviceModel?, osVersion?, appVersion?, ipAddress? }`,
    validated with zod. Looks up user by email, bcrypt-verifies password, transactionally
    deactivates any prior active session + inserts a new one (closing the same race condition
    the old implementation fixed), signs and returns `{ token }`. `401` on bad credentials,
    `400` on invalid body.
  - `POST /auth/logout` — authenticated; deactivates the caller's current session (from the
    JWT's `sessionId`).
- **Seed script** (`backend/scripts/seed.cjs`): one demo user per role — `admin@classeshub.test`,
  `teacher@classeshub.test`, `student@classeshub.test` — all password `password123`.
- **Local dev**: same pattern as before — `npm run migrate`, `npm run seed`, `npm run dev`
  (`dev-server.cjs` mounting `identity` behind an authorizer shim, on `http://localhost:3000`)
  against the existing Supabase Postgres connection.
- **Testing**: Vitest integration tests against real Postgres, same conventions as before
  (login success/failure/concurrent-session cases, authorizer bad/expired/deactivated-session cases).

### Dashboard

- `lib/api.ts` — API client (JWT header injection, 401 handling), same shape as before, pointed
  at `/api/v1` via the existing Vite proxy (`vite.config.ts` → `http://localhost:3000`)
- `lib/auth.ts` — token storage (localStorage) + JWT decode for UI (role, name if included in
  claims or fetched)
- `routes/login.tsx` — email/password form, calls `POST /auth/login`, stores token, redirects
  into the authed shell
- `routes/_authed.tsx` — pathless layout guard: redirects to `/login` when no valid token;
  renders a minimal authed shell
- `routes/_authed/index.tsx` — bare landing page showing "Logged in as `{email}` (`{role}`)"
  and a logout button calling `POST /auth/logout` — proof the loop works end-to-end; no other
  feature screens are built in this slice

### Explicitly out of scope for this slice

- Any `identity` routes beyond login/logout (users/courses/batches CRUD) — later slice
- `academics` and `content` Lambdas and their tables — later slices
- Any dashboard screen beyond login + the bare landing page — the user is picking up dashboard
  feature work directly after this lands
- The Flutter app

## Testing / verification

- Backend: `npm test` (Vitest) covers login success, wrong password, unknown email,
  concurrent-login race (single active session survives), authorizer accept/reject cases.
- Manual end-to-end: run migrations + seed, start `dev-server.cjs`, log in via the dashboard
  at `http://localhost:5173` as each of the three seeded users, confirm the landing page shows
  the right email/role, confirm logout invalidates the session (a second API call with the same
  token gets `401`).
