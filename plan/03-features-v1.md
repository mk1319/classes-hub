# V1 Feature Scope — Detailed Behavior

## Tenant onboarding
Super-admin creates tenant, sets branding/flavor config.

## Accounts
Admin/tutor creates teacher & student accounts — single entry + bulk CSV import.
No self-registration in V1.

## Academic structure
CRUD for Course/Program → Subject → Batch; assign teachers to batches; enroll
students per subject/batch. See [`02-domain-model.md`](./02-domain-model.md).

## Auth
Email + password login, custom JWT (no Cognito, no OTP). Email is globally unique
across the whole platform, used to resolve tenant + role at login.

## Tests & Assignments

- **Question bank**: questions are created once and are reusable across multiple
  tests (teacher picks from bank or creates new when building a test).
- **Question types (V1):**
  - MCQ — single correct answer (auto-graded)
  - MCQ — multiple correct answers (auto-graded)
  - Short/long text answer (manually graded by teacher)
  - Match-the-column (auto or manually graded; solution may include an image, since
    matching problems are often easier to show than describe)
  - Odd-man-out (auto-graded)
- **Per-test configuration (set by teacher at creation time):**
  - Negative marking on/off (and value) — configurable per test, not global
  - Result reveal on/off — whether students see their marks + full solution
    immediately after submission (solutions can include an uploaded image)
- **Grading flow**: auto-graded question types are scored instantly on submission;
  manually-graded types (text answers) queue for teacher review before the student's
  final result is available (if result reveal is enabled for that test).

## Timetable
Per-batch schedule/calendar, recurring sessions.

## Notifications
Push (FCM) + in-app announcements.

## Resources
Study materials (PDF, document, image, video) attached at subject-level (all
batches) or batch-level (specific batch only). Teachers add for their own
subjects/batches, tutor/admin for anything. Added via direct upload (stored as
Postgres `bytea`, not S3) or a pasted external link (e.g. Google Drive) — links are
the preferred path for large files, especially video, to keep storage cost down.
Full detail: [`10-resources-feature.md`](./10-resources-feature.md).

## Syllabus / Chapter Coverage Tracking
Teacher logs what's been taught in a batch and when — against an optional
predefined chapter list, or as free-form entries, teacher's choice. Standalone by
date (not tied to a timetable session, so makeup/extra classes still work).
Student visibility is a per-batch toggle the teacher controls (default off). Full
detail: [`11-syllabus-tracking-feature.md`](./11-syllabus-tracking-feature.md).

## Account Security / Anti-fraud
Every login is logged as a session (device metadata, no biometrics involved); only
one active session per student, so a second device logging in as that student
immediately signs the real student out elsewhere. Tutor/admin can view a student's
login/device history. Full detail: [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md).
