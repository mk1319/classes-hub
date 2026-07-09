# Architecture

## Multi-tenancy & Whitelabel

- **Shared backend, isolated data.** One backend deployment (Lambda + Aurora Postgres
  Serverless v2) serves every tutor ("tenant"). Every tenant-scoped table carries a
  `tenant_id` column; every query is scoped by it.
- **Tenant resolution at login is via email, not subdomain.** Email is **globally
  unique across the entire platform** (not just per-tenant). On login, the backend
  looks up the user by email, finds their `tenant_id` + `role`, and issues a JWT
  carrying `user_id`, `tenant_id`, `role`. All subsequent API calls are scoped using
  the JWT claims (verified by a custom Lambda authorizer on API Gateway).
- **Dashboard** is a single web app on one domain, used by every tenant's
  admins/teachers — no per-tenant subdomains needed.
- **Flutter app is whitelabeled per tutor via build flavors.** Each tutor gets their
  own app build (name, icon, splash screen, color theme) with their `tenant_id` baked
  in at build time, published as their own listing on the Play Store / App Store.
- **Super-admin panel** (a restricted section of the dashboard, accessible only to
  Mukesh's account) creates a new tenant record, configures its branding
  (name/logo/colors), and generates the per-tenant Flutter flavor config. Ships in
  V1 — onboarding a single tutor is impossible without it.

## Tech stack

| Layer | Choice |
|---|---|
| Mobile app | Flutter, per-tenant build flavors, Riverpod (state), go_router (nav), Drift (offline cache + write queue) — see [`12-flutter-app-architecture.md`](./12-flutter-app-architecture.md) |
| Dashboard | React + Vite, TanStack Router, TanStack Query |
| Backend runtime | Node.js + TypeScript on AWS Lambda |
| API layer | API Gateway, one Lambda per feature folder (handles all of that feature's routes internally via a lightweight router), custom JWT Lambda authorizer |
| IaC | AWS SAM |
| Database | Aurora Serverless v2 (PostgreSQL), multi-tenant via `tenant_id` on every tenant-scoped table |
| File storage | S3, presigned URLs for uploads (question/solution images now; video/PDF later) |
| Push notifications | Firebase Cloud Messaging |
| Repo structure | Single monorepo: `/app` (Flutter), `/dashboard` (React), `/backend` (SAM + per-feature Lambda folders), `/docs` |

## Backend feature folders (V1)

Each is one Lambda function handling all of its own routes:

- `auth` — login, JWT issuance
- `tenants` — super-admin tenant CRUD + branding config (restricted to super-admin role)
- `users` — teacher/student account CRUD, bulk CSV import
- `courses` — Course/Subject/Batch CRUD, teacher assignment, student enrollment
- `tests` — question bank CRUD, test builder, test attempts, grading, results
- `timetable` — batch schedule CRUD, recurring session generation
- `notifications` — announcement CRUD, push dispatch via FCM
- `uploads` — S3 presigned URL generation for image uploads (test/question images)
- `resources` — resource metadata CRUD + file streaming (see [`10-resources-feature.md`](./10-resources-feature.md)); stores uploaded files as Postgres `bytea`, not S3
- `syllabus` — chapter list + coverage log per batch (see [`11-syllabus-tracking-feature.md`](./11-syllabus-tracking-feature.md))

## Non-functional notes

- **Tenant isolation** is enforced in application code: every query includes
  `tenant_id` from the verified JWT — no cross-tenant data should ever be reachable
  through an API call.
- **Scale**: Aurora Serverless v2 auto-scales per tenant load; a single tenant with
  1,000+ students concentrates read/write load on batches/tests/enrollments — index
  `tenant_id` + foreign keys accordingly.
- **Security**: bcrypt for password hashing, JWT short-lived + refresh flow, S3
  presigned URLs scoped to tenant-prefixed keys.
