# timetable — Rules

Per-batch schedule with optional weekly recurrence. One Lambda handling
`/batches/:batchId/sessions[/**]` routes (Express + serverless-http).

- Writes (create/update/delete) require `managesBatch` (admin or assigned
  teacher). Reads require `canViewBatch` (admin/teacher in tenant, or an enrolled
  student) — both from `@classes-hub/shared`. Everything is tenant-scoped.
- Weekly recurrence is **expanded into individual rows at creation time**, sharing
  a `series_id`; `weeklyDates()` is a pure helper (unit-tested). Delete supports
  `?series=true` to remove the whole series.
- This feature owns only `/batches/:id/sessions*`; `courses` owns `/batches/:id`
  itself and `syllabus` owns `/batches/:id/coverage` — see `template.yaml`.
- Update `../NOTES.md` in the same change as any code change here.
