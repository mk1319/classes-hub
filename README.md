# Classes Hub

Whitelabel LMS for tutors/coaching institutes — a Flutter student app, a React
dashboard, and a feature-folder AWS Lambda backend, multi-tenant over a single
Aurora Postgres.

## Repo layout

- [`backend/`](./backend) — AWS SAM + one Lambda per feature folder (Node.js +
  TypeScript, Express + serverless-http), Postgres via node-pg-migrate, a custom
  JWT authorizer enforcing single-active-session. Features: `auth`, `tenants`,
  `users`, `courses`, `tests`, `timetable`, `notifications`, `uploads`,
  `resources`, `syllabus`. See [`backend/NOTES.md`](./backend/NOTES.md).
- [`dashboard/`](./dashboard) — Vite + React + TanStack Router/Query + Tailwind,
  for super-admins/tutors/teachers. See [`dashboard/NOTES.md`](./dashboard/NOTES.md).
- [`app/`](./app) — Flutter (Riverpod + go_router + Drift), per-tenant build
  flavors, for students. See [`app/NOTES.md`](./app/NOTES.md).
- [`plan/`](./plan/README.md) — the design/spec docs this project is built from.

## Status (V1)

- **Backend** — all 10 features implemented and integration-tested against
  Postgres (72 tests). `npm test` in `backend/` (needs `DATABASE_URL` +
  `JWT_SECRET`). Migrations: `npm run migrate -- up -m migrations`.
- **Dashboard** — all feature screens; builds + typechecks; verified end-to-end
  against a live local backend in a browser (`npm run build` / `npm run dev` in
  `dashboard/`).
- **App** — full architecture + all student screens (timetable, tests with
  offline answer queue, resources, syllabus, notifications). Requires a Flutter
  SDK to build (`flutter pub get && dart run build_runner build`); not compiled
  in the environment it was scaffolded in.

## Conventions

Every folder carries a `CLAUDE.md` (the rules) and a `NOTES.md` (current state),
kept current in the same change as the code — see
[`plan/09-agent-workflow-policy.md`](./plan/09-agent-workflow-policy.md).
