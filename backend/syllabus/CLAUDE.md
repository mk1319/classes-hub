# syllabus — Rules

Optional predefined chapter list per subject + per-batch coverage log. One Lambda
handling `/subjects/:id/chapters*` and `/batches/:id/coverage*`. See
`plan/11-syllabus-tracking-feature.md`.

- Chapter-list writes require managing the subject (admin, or a teacher assigned
  to a batch under it). Coverage writes require managing the batch.
- Coverage entries are **standalone by date** (not tied to a timetable session),
  so makeup/extra classes log fine. An entry links a predefined `chapter_id`
  (title resolved from the chapter) OR carries a free-form `title`.
- Student visibility of coverage is gated by `batches.show_progress_to_students`
  (toggled via the **courses** feature's `PATCH /batches/:id`, not here). Staff
  always see coverage; a student sees it only when enrolled AND the flag is on.
- This feature owns `/subjects/:id/chapters*` and `/batches/:id/coverage*`;
  `courses` owns the batch/subject rows themselves — see `template.yaml`.
- Update `../NOTES.md` in the same change as any code change here.
