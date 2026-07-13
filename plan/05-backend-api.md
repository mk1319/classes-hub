# Backend API — Feature Folders & Endpoints

Routes are grouped into a small number of Lambdas (see the Lambda grouping in
[`01-architecture.md`](./01-architecture.md): `authorizer`, `identity`,
`academics`, `content`), each handling multiple related routes internally (via a
lightweight router), behind API Gateway with a custom JWT authorizer that injects
`role` / `user_id` into the request context. There is no tenant scoping — this API
serves a single institute.

Endpoint-level detail (request/response shapes, validation rules) still needs to be
filled in per folder below.

## `identity` (auth)
- `POST /auth/login` — email + password → JWT (creates a session row, deactivates the user's prior sessions — see [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md))
- `POST /auth/logout`
- _(refresh flow TBD)_

## `identity` (users)
- `POST /users` — create teacher/student
- `POST /users/bulk-import` — CSV import
- `GET /users` — list (filter by role)
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `GET /users/:id/sessions` — login/device history, admin only

## `academics` (courses)
- Course CRUD: `POST/GET/PATCH/DELETE /courses`
- Subject CRUD: `POST/GET/PATCH/DELETE /courses/:courseId/subjects`
- Batch CRUD: `POST/GET/PATCH/DELETE /subjects/:subjectId/batches`
- Teacher assignment: `POST /batches/:batchId/teachers`
- Student enrollment: `POST /batches/:batchId/enrollments`

## `academics` (tests)
- Question bank: `POST/GET/PATCH/DELETE /questions`
- Test builder: `POST/GET/PATCH/DELETE /tests`
- Attempts: `POST /tests/:testId/attempts` (start), `PATCH /attempts/:id` (submit answers)
- Grading: `PATCH /attempts/:id/grade` (manual grading of text answers)
- Results: `GET /attempts/:id/result`

## `academics` (timetable)
- `POST/GET/PATCH/DELETE /batches/:batchId/sessions`

## `content` (notifications)
- `POST /announcements` — create + trigger push
- `GET /announcements`

## `content` (uploads)
- `POST /uploads/presign` — get S3 presigned URL for an image upload (test/question images)

## `content` (resources)
- `POST /resources` — create (upload file as multipart, or provide `link_url`)
- `GET /resources?subjectId=&batchId=` — list, scoped to what the caller can see
- `GET /resources/:id`
- `GET /resources/:id/file` — stream the uploaded file (`bytea`) with correct content-type; not used for link-type resources
- `PATCH /resources/:id`
- `DELETE /resources/:id`

## `content` (syllabus)
- `POST/GET/PATCH/DELETE /subjects/:subjectId/chapters` — optional predefined chapter list
- `POST/GET/PATCH/DELETE /batches/:batchId/coverage` — coverage log entries
- Visibility toggle (`show_progress_to_students`) is updated via the existing
  `academics` group's `PATCH /batches/:id`, not a separate endpoint here
