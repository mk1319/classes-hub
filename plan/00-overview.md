# Overview

## What we're building

An LMS product built first for a single institute: one coaching institute/tutor
running multiple courses/standards, subjects, and batches, with 1,000+ students.
The product has three parts:

1. **Flutter app** — a single build for this institute (own name/icon/branding),
   used by students.
2. **React + Vite dashboard** — TanStack Router + TanStack Query, used by the
   institute's admins and teachers.
3. **Backend** — AWS Lambda, grouped into a small number of feature Lambdas (each
   handling all routes for its group internally), APIs split feature-wise.

This is deliberately **not** a multi-tenant/whitelabel platform in V1. The plan is
to build, ship, and validate this single-institute version with a real client
first, and only then layer multi-tenancy/whitelabel on top — see
[`04-future-phases.md`](./04-future-phases.md).

The end goal of this planning phase is a complete, detailed spec + task breakdown
handed to Cursor to build the project from scratch.

## Roles

- **Admin** — owns the institute; manages courses, staff, students, tests, timetable.
- **Teacher** — manages their assigned batches: content, tests, timetable for those batches.
- **Student** — enrolls in subjects/batches, views timetable, takes tests, sees results, receives announcements.
- **Parent** — deferred to a future phase (not in V1).

## Platform mapping

| Role | Platform |
|---|---|
| Admin | Dashboard |
| Teacher | Dashboard |
| Student | Flutter app only |
