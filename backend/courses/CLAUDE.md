# courses — Rules

Academic-structure CRUD (Course → Subject → Batch), teacher assignment, and
student enrollment. One Lambda handling `/courses/*`, `/subjects/:id/batches`,
and `/batches/:id/*` routes (Express + serverless-http via `@classes-hub/shared`).

- All data access is in `src/courses.ts`, tenant-scoped from the JWT. Mutations
  are admin-only (`requireAdmin`); reads are any authenticated tenant member.
- One deliberate exception: an **assigned teacher** may PATCH *only*
  `showProgressToStudents` on their own batch — any other batch field, or an
  unassigned teacher, gets 403. This is the syllabus-visibility toggle from
  `plan/11-syllabus-tracking-feature.md`. Keep this narrow.
- `assertTenantUser` enforces role when assigning: only a `teacher` can be added
  to `batch_teachers`, only a `student` can be enrolled (else 400 `WRONG_ROLE`).
- Join tables (`batch_teachers`, `enrollments`) use `ON CONFLICT DO NOTHING` so
  re-assigning/re-enrolling is idempotent (204).
- This feature owns the `/batches/:id` GET/PATCH/DELETE and `/subjects/:id/batches`
  routes; `timetable` and `syllabus` own other `/batches/:id/*` and
  `/subjects/:id/*` sub-resources — see `template.yaml` for the split.
- Update `../NOTES.md` in the same change as any code change here.
