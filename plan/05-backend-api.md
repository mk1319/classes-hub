# Backend API — Feature Folders & Endpoints

Each feature folder is one Lambda function handling all of its own routes internally
(via a lightweight router), behind API Gateway with a custom JWT authorizer that
injects `tenant_id` / `role` / `user_id` into the request context.

Endpoint-level detail (request/response shapes, validation rules) still needs to be
filled in per folder below.

## `auth`
- `POST /auth/login` — email + password → JWT (creates a session row, deactivates the user's prior sessions — see [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md))
- _(refresh flow TBD)_

## `tenants` (super-admin only)
- `POST /tenants` — create tenant + branding config
- `GET /tenants` — list tenants
- `GET /tenants/:id`
- `PATCH /tenants/:id` — update branding/flavor config

## `users`
- `POST /users` — create teacher/student
- `POST /users/bulk-import` — CSV import
- `GET /users` — list (filter by role)
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `GET /users/:id/sessions` — login/device history, tutor/admin only

## `courses`
- Course CRUD: `POST/GET/PATCH/DELETE /courses`
- Subject CRUD: `POST/GET/PATCH/DELETE /courses/:courseId/subjects`
- Batch CRUD: `POST/GET/PATCH/DELETE /subjects/:subjectId/batches`
- Teacher assignment: `POST /batches/:batchId/teachers`
- Student enrollment: `POST /batches/:batchId/enrollments`

## `tests`
- Question bank: `POST/GET/PATCH/DELETE /questions`
- Test builder: `POST/GET/PATCH/DELETE /tests`
- Attempts: `POST /tests/:testId/attempts` (start), `PATCH /attempts/:id` (submit answers)
- Grading: `PATCH /attempts/:id/grade` (manual grading of text answers)
- Results: `GET /attempts/:id/result`

## `timetable`
- `POST/GET/PATCH/DELETE /batches/:batchId/sessions`

## `notifications`
- `POST /announcements` — create + trigger push
- `GET /announcements`

## `uploads`
- `POST /uploads/presign` — get S3 presigned URL for an image upload (test/question images)

## `resources`
- `POST /resources` — create (upload file as multipart, or provide `link_url`)
- `GET /resources?subjectId=&batchId=` — list, scoped to what the caller can see
- `GET /resources/:id`
- `GET /resources/:id/file` — stream the uploaded file (`bytea`) with correct content-type; not used for link-type resources
- `PATCH /resources/:id`
- `DELETE /resources/:id`

## `syllabus`
- `POST/GET/PATCH/DELETE /subjects/:subjectId/chapters` — optional predefined chapter list
- `POST/GET/PATCH/DELETE /batches/:batchId/coverage` — coverage log entries
- Visibility toggle (`show_progress_to_students`) is updated via the existing
  `courses` feature's `PATCH /batches/:id`, not a separate endpoint here
