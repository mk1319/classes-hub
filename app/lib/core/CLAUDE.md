# core — Rules

Cross-cutting infrastructure only — nothing feature-specific:
- `network/` — `ApiClient` (Dio + JWT + 401→logout), `ConnectivityService`.
- `cache/` — Drift `LocalDb` (cached entities + pending-answer queue) and the
  `cacheFirst` helper.
- `theme/` — design tokens; per-flavor accent override.
- `router/` — go_router config + auth redirect.
- `auth/` — token store + silent device metadata for the anti-fraud login.
- `providers.dart` — the Riverpod singletons wiring the above.
