# Academic Domain Model & Core Data Model

## Academic structure

Generalized to support both school-style "standards" and professional courses (e.g.
B.Com, CA) uniformly:

```
Course/Program  (e.g. "Class 10", "B.Com", "CA Foundation")
  └── Subject     (e.g. "Physics", "Accounts")
        └── Batch   (e.g. "Physics — Morning Batch A", with its own schedule)
```

- Students enroll **per subject/batch**, not blanket-enrolled to a whole course/standard
  — one student may take only 1–2 subjects while another takes all subjects in the
  same course.
- Teachers are assigned to one or more batches.
- This same structure must flex between a school-grade course (many shared subjects)
  and a professional course (fewer, more specialized subjects) without special-casing.

## Core data model (high-level, to be refined)

- `tenants` (id, name, branding config, flavor config)
- `users` (id, tenant_id, role, email [globally unique], password_hash, name)
- `courses` (id, tenant_id, name, type)
- `subjects` (id, course_id, name)
- `batches` (id, subject_id, name, schedule info)
- `batch_teachers` (batch_id, user_id)
- `enrollments` (student_id, batch_id)
- `questions` (id, tenant_id, subject_id, type, body, options/answer-key, solution, solution_image)
- `tests` (id, batch_id, title, negative_marking_config, result_reveal_config)
- `test_questions` (test_id, question_id, order, marks)
- `test_attempts` (id, test_id, student_id, status, score)
- `attempt_answers` (attempt_id, question_id, answer, marks_awarded, graded_by)
- `timetable_sessions` (id, batch_id, day/date, start_time, end_time, recurrence)
- `announcements` (id, tenant_id, scope [batch/course/tenant-wide], body, sent_at)
- `resources` (id, tenant_id, subject_id NULLABLE, batch_id NULLABLE, type [pdf/document/image/video], title, storage_type [upload/link], link_url NULLABLE, is_downloadable [default true, upload-only], created_by)
- `resource_files` (id, resource_id, filename, mime_type, file_size, file_data `bytea`) — see [`10-resources-feature.md`](./10-resources-feature.md)
- `chapters` (id, subject_id, title, order) — optional predefined syllabus per subject
- `chapter_coverage` (id, batch_id, chapter_id NULLABLE, title, covered_date, notes, created_by)
- `batches.show_progress_to_students` (boolean, default false) — new column on `batches` — see [`11-syllabus-tracking-feature.md`](./11-syllabus-tracking-feature.md)
- `sessions` (id, tenant_id, user_id, device_id, device_model, os_version, app_version, ip_address, created_at, is_active) — login/device history + single-active-session enforcement, see [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md)

_Column types, constraints, and indexes still need to be nailed down — see status in
README._
