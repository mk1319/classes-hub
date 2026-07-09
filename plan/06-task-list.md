# Task List / Build Order

The project spans independent subsystems (backend has ~10 distinct features, plus
the dashboard, plus the Flutter app), so it's built as a sequence of phases, each
with its own detailed implementation plan (`plan/implementation/`) written and
executed one at a time — not one giant plan. Each phase produces working, testable
software before the next one starts.

## Phase order

1. **Foundation** — monorepo scaffold, SAM project skeleton, Aurora Postgres schema
   + migrations for core tables (`tenants`, `users`, `sessions`), shared Lambda
   utilities (DB client, JWT verify authorizer), `auth` feature (login, session
   tracking/single-active-session enforcement per [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md))
2. `tenants` feature (super-admin CRUD + branding config)
3. `users` feature (teacher/student CRUD, bulk CSV import, session/device history endpoint)
4. `courses` feature (course/subject/batch CRUD, teacher assignment, enrollment)
5. `tests` feature (question bank, test builder, attempts, grading, results)
6. `timetable` feature
7. `notifications` feature
8. `resources` feature
9. `syllabus` feature (chapter list + coverage log)
10. Dashboard scaffold (Vite + React + TanStack Router/Query + Tailwind + shadcn/ui, theme tokens, auth/login screen, app shell)
11. Dashboard feature screens, same order as the backend phases above (2–9)
12. Flutter app scaffold (Riverpod + go_router + Drift, theme, flavor config, auth/login screen)
13. Flutter app feature screens: timetable, tests, resources, syllabus (read-only), notifications

## Status

Phase 1 is next. Its detailed implementation plan lives in
`plan/implementation/` once written (see [`superpowers:writing-plans`](https://github.com/anthropics/claude-code) process — bite-sized TDD tasks, one plan per phase).
