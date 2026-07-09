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

_Column types, constraints, and indexes still need to be nailed down — see status in
README._
