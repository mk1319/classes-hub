# App (Flutter) — Rules

Whitelabeled student app. Stack: **Riverpod** (state/data), **go_router** (nav),
**Drift** (offline cache + write queue). Students only — tutors/teachers use the
dashboard.

## Conventions
- One folder per backend feature under `lib/features/` (auth, timetable, tests,
  resources, syllabus, notifications), each split `data/` (repositories) /
  `domain/` (models) / `presentation/` (screens + Riverpod providers).
- **No screen calls `ApiClient` directly** — always through that feature's
  repository in `data/`, so cache-first behavior is never accidentally bypassed
  (plan/12 + plan/14). `lib/core/` holds cross-cutting infra only (network,
  cache, theme, router, auth); nothing feature-specific belongs there.
- **Reads are cache-first** (stale-while-revalidate) via `core/cache/cache_first.dart`:
  serve the Drift cache instantly, refresh from the network, update the UI. The
  only write path is test-answer submission, saved to the Drift queue per-question
  and flushed on reconnect by `features/tests/data/sync_service.dart`.
- **Design tokens only** (`core/theme/app_theme.dart`): fixed Slate neutrals +
  semantics across every tenant; the accent is per-tenant from the flavor. Never
  hardcode a color. Bottom nav (not a drawer) for the primary sections; 44px+ tap
  targets; `ListView.builder` for every list; `const` constructors.

## Flavors
Per-tenant config (`tenantId`, `appName`, `accentColor`, `apiBaseUrl`) is baked in
at build time via `--dart-define` and read by `lib/flavors/flavor.dart`, e.g.:

```
flutter run \
  --dart-define=TENANT_ID=12 \
  --dart-define=APP_NAME="Bright Minds" \
  --dart-define=ACCENT_COLOR=2563EB \
  --dart-define=API_BASE_URL=https://api.classeshub.app
```

## Codegen
Drift needs generated code: `dart run build_runner build` (produces
`*.g.dart`, gitignored). The Inter font weights (400/500/600) must be dropped in
`assets/fonts/` before building (see `assets/fonts/README.md`).

Update `NOTES.md` in the same change as any code change here (plan/09).
