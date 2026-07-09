# Flutter App Architecture & Conventions

Stack: Flutter, per-tenant build flavors, **Riverpod** (state/data), **go_router**
(navigation), **Drift** (local SQLite cache + offline write queue).

Riverpod mirrors how TanStack Query manages server state on the dashboard —
consistent mental model across both apps. go_router is the closest Flutter
equivalent to TanStack Router. Drift gives typed, relational local queries, which
fits the cache shape better than a plain key-value store (Hive) since cached
entities (timetable sessions, tests, resources, coverage) are genuinely relational.

## Folder structure

```
app/lib/
├── main.dart
├── app.dart                      # MaterialApp + go_router + theme wiring
├── core/                         # cross-cutting infra, no feature-specific logic
│   ├── network/api_client.dart
│   ├── network/connectivity_service.dart
│   ├── cache/local_db.dart       # Drift setup: cached entities + pending-write queue
│   ├── theme/app_theme.dart      # design tokens; per-flavor accent color override
│   └── router/app_router.dart    # go_router config
├── features/                     # one folder per backend feature (mirrors dashboard's features/)
│   ├── auth/        { data/, domain/, presentation/ }
│   ├── timetable/    { data/, domain/, presentation/ }
│   ├── tests/        { data/, domain/, presentation/ }
│   ├── resources/    { data/, domain/, presentation/ }
│   ├── syllabus/     { data/, domain/, presentation/ }
│   └── notifications/{ data/, domain/, presentation/ }
├── shared/                        # widgets used by 2+ features (analogous to dashboard's components/)
│   └── widgets/
└── flavors/                       # per-tenant flavor config: tenant_id, branding, app name/icon refs
```

Each feature is split:
- **`data/`** — repository: cache-first reads (check Drift, serve immediately, refresh
  from `api_client` in the background), queued writes when offline (see
  [`14-flutter-offline-performance.md`](./14-flutter-offline-performance.md))
- **`domain/`** — models
- **`presentation/`** — screens + widgets + Riverpod providers/notifiers

## CLAUDE.md per folder

- **`app/CLAUDE.md`** (root) — stack summary, Riverpod/go_router conventions,
  references the offline policy and design guidelines, and the same docs/testing
  policy as the other pieces ([`09-agent-workflow-policy.md`](./09-agent-workflow-policy.md)).
- **`features/CLAUDE.md`** — one folder per backend feature; data/domain/presentation
  split explained; repository pattern rule: **no screen calls `api_client` directly
  — always through that feature's repository in `data/`**, so cache-first behavior
  is never accidentally bypassed.
- **`core/CLAUDE.md`** — cross-cutting only (network, cache, theme, router); nothing
  feature-specific belongs here.
- **`shared/CLAUDE.md`** — only genuinely shared, presentational widgets (props-in,
  no data-fetching), same rule as the dashboard's `components/`.
