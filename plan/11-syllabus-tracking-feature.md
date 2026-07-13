# Syllabus / Chapter Coverage Tracking (V1)

> **Note (single-institute update):** This doc predates the shift to a single-institute-first V1 (no multi-tenancy). References to `tenant_id`, `super_admin`, tenant/whitelabel concepts, or Aurora below describe the deferred future multi-tenant phase — see [`04-future-phases.md`](./04-future-phases.md) — not the current single-institute architecture (see [`01-architecture.md`](./01-architecture.md)).

Lets a teacher log what's been taught in a batch and when — either against a
predefined chapter list, or as free-form entries, teacher's choice per subject.

## How it works

- A subject *may* have a predefined chapter list (e.g. "Ch 1: Kinematics", "Ch 2:
  Thermodynamics"...), created by the teacher or admin. This is optional — a
  teacher can skip it entirely.
- For each batch, the teacher logs coverage entries over time: either "mark this
  predefined chapter as covered, on [date]" or a free-form entry ("Covered
  projectile motion basics", on [date]) when no chapter list exists or the entry
  doesn't map to one cleanly.
- Entries are **standalone by date** — not tied to a specific timetable session, so
  logging still works for extra/makeup classes that aren't on the regular schedule.
- Where a predefined chapter list exists, this naturally gives an "X of Y chapters
  covered" progress view; free-form entries just render as a chronological log.

## Student visibility

Teacher decides, **per batch**, whether students can see the coverage log/progress
(`show_progress_to_students` flag on the batch, teacher-controlled, defaults to
off). When on, students see the same chronological log / progress view for their
batch.

## Data model additions

- `chapters` (id, subject_id, title, order) — optional predefined list per subject
- `chapter_coverage` (id, batch_id, chapter_id NULLABLE, title [used when not
  linked to a predefined chapter], covered_date, notes, created_by)
- `batches.show_progress_to_students` (boolean, default false) — new column on the
  existing `batches` table

## Backend

New feature folder: `syllabus`
- `POST/GET/PATCH/DELETE /subjects/:subjectId/chapters` — optional predefined chapter list
- `POST/GET/PATCH/DELETE /batches/:batchId/coverage` — coverage log entries
- Visibility toggle is a field on the batch, updated via the existing `courses`
  feature's batch update endpoint (`PATCH /batches/:id`)
