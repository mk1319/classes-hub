# Account Security / Anti-Fraud (V1)

Problem: a student's account credentials get used by someone else (e.g. another
student logging in as them to take a test on their behalf). Two V1 layers, both
built on one underlying idea: **track every login as a session, and only allow one
active session per student.**

Note: "device fingerprint" here is **not** biometric (no Face/Touch ID, no PIN) —
it's metadata the app collects automatically and silently at login (a unique
installation ID + device model + OS version). Zero user interaction, works
identically on every phone regardless of its unlock method.

## How it works

- **Every login creates a session record**: `user_id`, `device_id` (a UUID
  generated once per app install, stored in secure local storage), device model,
  OS version, app version, IP address, timestamp.
- **Only one active session per student.** A new login immediately deactivates the
  student's previous session. The next API call from the old device gets rejected
  (401), forcing that device back to the login screen. In practice: if student B
  logs in as student A on their own phone, student A's app gets logged out almost
  immediately — a fast, hard-to-miss signal, and a real deterrent since sharing
  credentials can't happen silently anymore.
- **Tutor/Admin gets visibility**: a login/device history view on each student's
  profile in the dashboard — every session ever created, which device, when.
  Lets a tutor spot patterns (e.g. a device that's never been used by this student
  before, right before a test) even before a student complains.

## Data model

One table covers both the enforcement and the audit trail:

- `sessions` (id, tenant_id, user_id, device_id, device_model, os_version,
  app_version, ip_address, created_at, is_active)
  - Login: insert a new row, set all of that user's other rows to `is_active = false`.
  - Every authenticated request: the JWT carries a `session_id` claim; the
    authorizer checks that session's `is_active` before allowing the request
    through.

## Backend

- `auth` feature: login creates the session row (deactivating prior ones) and
  issues a JWT with `session_id` in its claims; authorizer checks `is_active` on
  every request.
- `users` feature: `GET /users/:id/sessions` — login/device history for a student,
  tutor/admin only.

## Deliberate trade-off

Logging in on a new device always kills the old session — even for a student
legitimately switching from phone to tablet. This is intentional: it's exactly the
friction that makes silent account sharing impossible. Worth telling students this
upfront (e.g. a one-line notice: "logging in here will sign you out elsewhere").

## Future layers (not built now — see [`04-future-phases.md`](./04-future-phases.md))

- Lock a specific test attempt to the device it was started on (stops a mid-test
  device swap without restricting normal multi-device use day-to-day).
- In-test proctoring (periodic selfie/face-match, app-backgrounding detection) —
  stronger deterrent, meaningfully more complex (camera permissions, privacy/
  storage handling, review workflow); worth revisiting only if the layers above
  prove insufficient in practice.
