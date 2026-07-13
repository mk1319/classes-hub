# Whitelabel Tutor LMS — Plan Folder

> **Note (single-institute update):** This doc predates the shift to a single-institute-first V1 (no multi-tenancy). References to `tenant_id`, `super_admin`, tenant/whitelabel concepts, or Aurora below describe the deferred future multi-tenant phase — see [`04-future-phases.md`](./04-future-phases.md) — not the current single-institute architecture (see [`01-architecture.md`](./01-architecture.md)).

This folder is the living record of everything we discuss and decide about the
project, before it gets handed to Cursor to build. Each file covers one area and
gets updated in place as we add detail — nothing here is final until we say so.

## Files

- [`00-overview.md`](./00-overview.md) — what we're building, who it's for, roles
- [`01-architecture.md`](./01-architecture.md) — multi-tenancy, whitelabel model, tech stack, repo layout
- [`02-domain-model.md`](./02-domain-model.md) — academic structure (course/subject/batch) + core DB tables
- [`03-features-v1.md`](./03-features-v1.md) — detailed V1 feature behavior (accounts, tests, timetable, notifications)
- [`04-future-phases.md`](./04-future-phases.md) — deferred features (attendance, fees, live classes, content, parents)
- [`05-backend-api.md`](./05-backend-api.md) — backend feature folders, endpoints, request/response shapes (to be filled in)
- [`06-task-list.md`](./06-task-list.md) — phased build order / task breakdown for Cursor (to be filled in once design is locked)
- [`07-dashboard-architecture.md`](./07-dashboard-architecture.md) — dashboard folder structure, routing/data-layer conventions, per-folder CLAUDE.md plan
- [`08-design-guidelines.md`](./08-design-guidelines.md) — dashboard visual design: typography, color, spacing, dark mode
- [`09-agent-workflow-policy.md`](./09-agent-workflow-policy.md) — docs-stay-current rule, design-guideline verification, feature testing, before any change counts as done
- [`10-resources-feature.md`](./10-resources-feature.md) — study materials (PDF/doc/image/video) per subject/batch, upload-to-Postgres or link-out
- [`11-syllabus-tracking-feature.md`](./11-syllabus-tracking-feature.md) — chapter/lecture coverage tracking per batch, optional predefined chapter list, teacher-controlled student visibility
- [`12-flutter-app-architecture.md`](./12-flutter-app-architecture.md) — Flutter folder structure, Riverpod/go_router/Drift conventions, per-folder CLAUDE.md plan
- [`13-flutter-design-guidelines.md`](./13-flutter-design-guidelines.md) — Flutter visual design: typography, per-tenant accent color, spacing, dark mode
- [`14-flutter-offline-performance.md`](./14-flutter-offline-performance.md) — cache-first reads, queued test-answer writes, downloadable resources, performance guidelines
- [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md) — login/device session tracking, single-active-session enforcement to deter account sharing during tests

## Status

Design is agreed at a high level (see files above). Still to be added: exact API
contracts, dashboard/app screen-by-screen UX, DB column-level detail, and the final
task list.
