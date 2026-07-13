# Architecture

## Single institute

- **One backend deployment, one database.** This version serves a single institute —
  there is no `tenant_id` anywhere in the schema and no per-tenant data isolation to
  enforce. Every table belongs to this one institute implicitly.
- **Login resolves the user by email directly.** Email is unique across `users`. On
  login, the backend looks up the user by email, finds their `role`, and issues a
  JWT carrying `user_id` + `role` (no tenant lookup involved). All subsequent API
  calls are authorized using the JWT claims (verified by a custom Lambda authorizer
  on API Gateway).
- **Dashboard** is a single web app on one domain, used by this institute's
  admins and teachers.
- **Flutter app** is a single build for this institute (own name/icon/branding),
  published as one listing on the Play Store / App Store — no build flavors or
  per-tenant branding config needed yet.

Multi-tenancy/whitelabel (per-tenant data isolation, `tenant_id` columns, a
`tenants` table, a `super_admin` role, per-tenant Flutter build flavors, and tenant
resolution at login) is explicitly deferred — see
[`04-future-phases.md`](./04-future-phases.md). It gets added as a layer on top
once this single-institute version is validated with a real client.

## Tech stack

| Layer | Choice |
|---|---|
| Mobile app | Flutter, Riverpod (state), go_router (nav), Drift (offline cache + write queue) — see [`12-flutter-app-architecture.md`](./12-flutter-app-architecture.md) |
| Dashboard | React + Vite, TanStack Router, TanStack Query |
| Backend runtime | Node.js + TypeScript on AWS Lambda |
| API layer | API Gateway, a small number of grouped feature Lambdas (each handles multiple related routes internally via a lightweight router), custom JWT Lambda authorizer |
| IaC | AWS SAM |
| Database | Plain managed PostgreSQL (e.g. RDS single instance) — no Aurora, no multi-tenant sharding |
| File storage | S3, presigned URLs for uploads (question/solution images now; video/PDF later) |
| Push notifications | Firebase Cloud Messaging |
| Repo structure | Single monorepo: `/app` (Flutter), `/dashboard` (React), `/backend` (SAM + grouped Lambda folders), `/docs` |

## Backend feature folders (V1)

Backend routes are grouped into a small number of Lambdas rather than one per
feature. Built so far: `authorizer` and `identity`. Planned next: `academics` and
`content`.

- `authorizer` — custom JWT Lambda authorizer for API Gateway; verifies the JWT and
  injects `user_id` / `role` into the request context
- `identity` — `POST /auth/login`, `POST /auth/logout`, session issuance/teardown
  (see [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md));
  will also own user account CRUD (teacher/student creation, bulk CSV import)
- `academics` (planned) — Course/Subject/Batch CRUD, teacher assignment, student
  enrollment, timetable, tests (question bank, test builder, attempts, grading,
  results)
- `content` (planned) — resources (metadata + file streaming, see
  [`10-resources-feature.md`](./10-resources-feature.md)), syllabus/chapter
  coverage (see [`11-syllabus-tracking-feature.md`](./11-syllabus-tracking-feature.md)),
  notifications/announcements, upload presigning

This grouping may be refined as `academics` and `content` are built out, but the
principle is: a handful of Lambdas grouped by domain area, not one Lambda per
narrow feature.

## Non-functional notes

- **Authorization** is enforced in application code from the verified JWT's `role`
  claim (`admin | teacher | student`) — e.g. only `admin`/`teacher` can create
  tests, only `admin` can manage user accounts.
- **Scale**: a single institute with 1,000+ students concentrates read/write load on
  batches/tests/enrollments — index accordingly; no per-tenant sharding needed at
  this scale.
- **Security**: bcrypt for password hashing, JWT short-lived + refresh flow, S3
  presigned URLs scoped per resource.
