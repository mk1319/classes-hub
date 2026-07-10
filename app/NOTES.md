# App (Flutter) — Current State

Whitelabeled student app: Riverpod + go_router + Drift, per-tenant flavors.

## Foundation
- `pubspec.yaml`: riverpod, go_router, drift (+sqlite3_flutter_libs,
  path_provider), dio, connectivity_plus, flutter_secure_storage,
  device_info_plus, package_info_plus, uuid, cached_network_image, url_launcher,
  intl. Inter font declared (weights 400/500/600 — must be added to
  `assets/fonts/`, see its README).
- `lib/flavors/flavor.dart`: per-tenant `tenantId`/`appName`/`accentColor`/
  `apiBaseUrl` from `--dart-define`; `appFlavor` set in `main.dart`.
- `lib/core/theme/app_theme.dart`: Slate neutrals + fixed semantics; accent from
  flavor; light + dark; Inter; 48px buttons.
- `lib/core/network`: `ApiClient` (Dio, attaches JWT, 401 → clear token + signal
  logout), `ConnectivityService`.
- `lib/core/cache`: Drift `LocalDb` (`CachedEntities` store + `PendingAnswers`
  queue) and `cacheFirst` (stale-while-revalidate) helper.
- `lib/core/auth`: `TokenStore` (secure storage + JWT decode), `DeviceInfoService`
  (silent device_id/model/os/app-version for the anti-fraud login — plan/15).
- `lib/core/router/app_router.dart`: go_router with auth redirect (401/sign-out
  aware); tabbed shell + `/attempt/:testId` + `/syllabus/:batchId`.
- `lib/core/providers.dart`: Riverpod singletons for all of the above.

## Features (`lib/features/*`, data/domain/presentation)
- **auth**: `AuthRepository` (collect device meta → POST /auth/login → store JWT),
  `AuthController` (bootstrap session, login, forced sign-out on 401), login screen
  (notes "signing in here signs you out elsewhere").
- **timetable**: derives the student's batches from their tests (+ GET /batches/:id
  for names — no dedicated /me/batches endpoint yet, see Known gaps), cache-first
  sessions per batch; screen lists batches → schedule + a syllabus link.
- **tests**: list, `AttemptScreen` (start/resume attempt, render MCQ single/multi/
  text, persist each answer to the Drift queue immediately, submit-all, show result
  when revealed), `TestSyncService` (flush queued answers on reconnect).
- **resources**: cache-first list; opens links / uploaded file URLs via url_launcher.
- **syllabus**: read-only coverage log per batch; 403 (progress hidden by teacher)
  shown as a friendly message.
- **notifications**: cache-first announcements list.
- **home**: `HomeShell` bottom nav (Timetable / Tests / Resources / Updates) +
  persistent `OfflineBanner`; keeps `TestSyncService` alive while signed in.

## Known gaps / follow-ups
- No `/me/batches` backend endpoint; timetable/syllabus derive batches from the
  student's tests. A dedicated endpoint would be cleaner.
- FCM device-token registration is stubbed in `AuthRepository` (endpoint
  `POST /announcements/tokens` is ready) — wire the real FCM token when Firebase
  is configured.

## Verification status
- **Not compiled/analyzed in this environment** — no Flutter/Dart SDK available
  here. Code is written to compile under Flutter 3.22+/Dart 3.4+ once
  `flutter pub get`, `dart run build_runner build` (Drift codegen), and the Inter
  fonts are in place. Architecture, provider wiring, and API contracts are
  aligned with the (fully tested) backend. This is the one piece whose runtime
  couldn't be exercised in this session.
