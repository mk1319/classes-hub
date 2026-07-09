# Overview

## What we're building

A whitelabel LMS product sold to individual tutors/coaching institutes. Each tutor
("tenant") runs multiple courses/standards, subjects, and batches, with 1,000+
students. The product has three parts:

1. **Flutter app** — whitelabeled per tutor (own name/icon/branding, own app store
   listing), used by students.
2. **React + Vite dashboard** — TanStack Router + TanStack Query, used by tutors/admins
   and teachers.
3. **Backend** — AWS Lambda, one folder per feature (each folder is a deployable
   Lambda handling all routes for that feature), APIs split feature-wise.

The end goal of this planning phase is a complete, detailed spec + task breakdown
handed to Cursor to build the project from scratch.

## Roles

- **Super-admin** (Mukesh) — onboards new tutor tenants, sets their branding.
- **Tutor/Admin** — owns an institute; manages courses, staff, students, tests, timetable.
- **Teacher/Staff** — manages their assigned batches: content, tests, timetable for those batches.
- **Student** — enrolls in subjects/batches, views timetable, takes tests, sees results, receives announcements.
- **Parent** — deferred to a future phase (not in V1).

## Platform mapping

| Role | Platform |
|---|---|
| Super-admin | Dashboard (restricted section) |
| Tutor/Admin | Dashboard |
| Teacher/Staff | Dashboard |
| Student | Flutter app only |
