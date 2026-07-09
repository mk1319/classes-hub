# Task List / Build Order

Not yet generated — waiting until the design in the other files is fully detailed
(exact API contracts, screen-by-screen UX, DB column-level detail). Once that's
locked, this file becomes the phased build order handed to Cursor, roughly:

1. DB schema + migrations
2. `auth` feature
3. `tenants` (super-admin) feature + branding config
4. `users` feature (accounts, bulk import)
5. `courses` feature (course/subject/batch/enrollment)
6. `tests` feature (question bank, test builder, attempts, grading)
7. `timetable` feature
8. `notifications` feature
9. `uploads` feature
10. Dashboard screens (per feature, in the same order)
11. Flutter app screens (student-facing, per feature)

This is a placeholder ordering — will be expanded into concrete tasks once the rest
of the plan is finalized.
