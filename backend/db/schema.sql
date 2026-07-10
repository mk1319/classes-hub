-- ============================================================================
-- Classes Hub — complete database schema (V1)
-- ============================================================================
--
-- One-file setup for a fresh database. This is the hand-maintained, documented
-- equivalent of running every migration in backend/migrations/ (1_init ..
-- 8_syllabus) — kept in sync with them by hand. Two ways to stand up the DB:
--
--   A) Migrations (adds a pgmigrations bookkeeping table, supports up/down):
--        npm run migrate -- up -m migrations
--   B) This file (fast, no bookkeeping — good for a throwaway/dev/test DB):
--        createdb classeshub
--        psql "$DATABASE_URL" -f db/schema.sql
--
-- If you use (B) and later want to run migrations, note that node-pg-migrate
-- will try to re-create these tables — don't mix the two on the same database.
--
-- Multi-tenancy: every tenant-scoped table carries tenant_id and every query in
-- the application is scoped by it (plan/01-architecture.md). Email is globally
-- unique across the whole platform (used to resolve tenant + role at login).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Core: tenants, users, sessions  (migration 1_init, 2_sessions_*)
-- ----------------------------------------------------------------------------

-- A tutor/institute. `branding` holds whitelabel + Flutter flavor config
-- (appName, logoUrl, accentColor, flavor) as JSON.
CREATE TABLE tenants (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  branding    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- All human accounts. role ∈ {super_admin, tutor, admin, teacher, student}.
-- super_admin has tenant_id = NULL (not scoped to a tenant). Email is globally
-- unique. Passwords are bcrypt hashes.
CREATE TABLE users (
  id             serial PRIMARY KEY,
  tenant_id      integer REFERENCES tenants ON DELETE CASCADE,
  role           text NOT NULL,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  name           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_tenant_id_index ON users (tenant_id);

-- Login/device history + single-active-session enforcement (plan/15). A login
-- inserts a row and deactivates the user's others; the authorizer checks
-- is_active on every request. The partial unique index guarantees at most one
-- active session per user even under concurrent first-ever logins.
CREATE TABLE sessions (
  id            serial PRIMARY KEY,
  tenant_id     integer REFERENCES tenants ON DELETE CASCADE,
  user_id       integer NOT NULL REFERENCES users ON DELETE CASCADE,
  device_id     text NOT NULL,
  device_model  text,
  os_version    text,
  app_version   text,
  ip_address    text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_index ON sessions (user_id);
CREATE UNIQUE INDEX sessions_one_active_per_user ON sessions (user_id) WHERE is_active;

-- ----------------------------------------------------------------------------
-- Academics: courses → subjects → batches, teachers, enrollment  (migration 3)
-- ----------------------------------------------------------------------------

CREATE TABLE courses (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  name        text NOT NULL,
  type        text,                    -- free-form: "school" | "professional" | ...
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_tenant_id_index ON courses (tenant_id);

CREATE TABLE subjects (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id   integer NOT NULL REFERENCES courses ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subjects_course_id_index ON subjects (course_id);
CREATE INDEX subjects_tenant_id_index ON subjects (tenant_id);

-- schedule_info is a human blurb; structured sessions live in timetable_sessions.
-- show_progress_to_students is the teacher-controlled syllabus visibility toggle.
CREATE TABLE batches (
  id                         serial PRIMARY KEY,
  tenant_id                  integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  subject_id                 integer NOT NULL REFERENCES subjects ON DELETE CASCADE,
  name                       text NOT NULL,
  schedule_info              text,
  show_progress_to_students  boolean NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX batches_subject_id_index ON batches (subject_id);
CREATE INDEX batches_tenant_id_index ON batches (tenant_id);

CREATE TABLE batch_teachers (
  batch_id    integer NOT NULL REFERENCES batches ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, user_id)
);
CREATE INDEX batch_teachers_user_id_index ON batch_teachers (user_id);

CREATE TABLE enrollments (
  batch_id    integer NOT NULL REFERENCES batches ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, student_id)
);
CREATE INDEX enrollments_student_id_index ON enrollments (student_id);

-- ----------------------------------------------------------------------------
-- Tests: question bank, tests, attempts, grading  (migration 4)
-- ----------------------------------------------------------------------------

-- type ∈ {mcq_single, mcq_multi, text, match, odd_one_out}.
--   options    : jsonb array of {id, text}
--   answer_key : shape by type — "id" | ["id",...] | {left:right} | null(text)
CREATE TABLE questions (
  id                  serial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  subject_id          integer REFERENCES subjects ON DELETE SET NULL,
  type                text NOT NULL,
  body                text NOT NULL,
  options             jsonb,
  answer_key          jsonb,
  solution            text,
  solution_image_url  text,
  created_by          integer REFERENCES users ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_tenant_id_index ON questions (tenant_id);
CREATE INDEX questions_subject_id_index ON questions (subject_id);

-- Per-test config: negative marking on/off + value, and result reveal on/off.
CREATE TABLE tests (
  id                      serial PRIMARY KEY,
  tenant_id               integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  batch_id                integer NOT NULL REFERENCES batches ON DELETE CASCADE,
  title                   text NOT NULL,
  negative_marking        boolean NOT NULL DEFAULT false,
  negative_marking_value  numeric NOT NULL DEFAULT 0,
  reveal_results          boolean NOT NULL DEFAULT true,
  created_by              integer REFERENCES users ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tests_tenant_id_index ON tests (tenant_id);
CREATE INDEX tests_batch_id_index ON tests (batch_id);

CREATE TABLE test_questions (
  test_id      integer NOT NULL REFERENCES tests ON DELETE CASCADE,
  question_id  integer NOT NULL REFERENCES questions ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  marks        numeric NOT NULL DEFAULT 1,
  PRIMARY KEY (test_id, question_id)
);

-- status: in_progress → submitted (manual grading pending) → graded.
CREATE TABLE test_attempts (
  id            serial PRIMARY KEY,
  tenant_id     integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  test_id       integer NOT NULL REFERENCES tests ON DELETE CASCADE,
  student_id    integer NOT NULL REFERENCES users ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'in_progress',
  score         numeric,
  started_at    timestamptz NOT NULL DEFAULT now(),
  submitted_at  timestamptz
);
CREATE INDEX test_attempts_test_id_index ON test_attempts (test_id);
CREATE INDEX test_attempts_student_id_index ON test_attempts (student_id);

-- One row per answered question. Auto-graded types fill marks_awarded/is_correct
-- on submit; manual types (text, keyless match) stay NULL until a teacher grades.
CREATE TABLE attempt_answers (
  id             serial PRIMARY KEY,
  attempt_id     integer NOT NULL REFERENCES test_attempts ON DELETE CASCADE,
  question_id    integer NOT NULL REFERENCES questions ON DELETE CASCADE,
  answer         jsonb,
  marks_awarded  numeric,
  is_correct     boolean,
  graded_by      integer REFERENCES users ON DELETE SET NULL,
  CONSTRAINT attempt_answers_unique UNIQUE (attempt_id, question_id)
);
CREATE INDEX attempt_answers_attempt_id_index ON attempt_answers (attempt_id);

-- ----------------------------------------------------------------------------
-- Timetable: per-batch sessions with weekly recurrence  (migration 5)
-- ----------------------------------------------------------------------------

-- recurrence ∈ {none, weekly}. Weekly is expanded into rows at create time that
-- share a series_id, so the series can be listed/deleted together.
CREATE TABLE timetable_sessions (
  id            serial PRIMARY KEY,
  tenant_id     integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  batch_id      integer NOT NULL REFERENCES batches ON DELETE CASCADE,
  title         text,
  session_date  date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  recurrence    text NOT NULL DEFAULT 'none',
  series_id     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX timetable_sessions_batch_id_index ON timetable_sessions (batch_id);
CREATE INDEX timetable_sessions_tenant_id_index ON timetable_sessions (tenant_id);
CREATE INDEX timetable_sessions_session_date_index ON timetable_sessions (session_date);

-- ----------------------------------------------------------------------------
-- Notifications: announcements + FCM device tokens  (migration 6)
-- ----------------------------------------------------------------------------

-- scope ∈ {tenant, course, batch}. scope_id is the course/batch id (NULL for
-- tenant-wide). sent_at is set when the push is dispatched.
CREATE TABLE announcements (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  scope       text NOT NULL,
  scope_id    integer,
  title       text NOT NULL,
  body        text NOT NULL,
  created_by  integer REFERENCES users ON DELETE SET NULL,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX announcements_tenant_id_index ON announcements (tenant_id);

CREATE TABLE device_tokens (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES users ON DELETE CASCADE,
  token       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_token_unique UNIQUE (token)
);
CREATE INDEX device_tokens_user_id_index ON device_tokens (user_id);

-- ----------------------------------------------------------------------------
-- Resources: study materials (bytea upload or external link)  (migration 7)
-- ----------------------------------------------------------------------------

-- Attached to exactly one of a subject or a batch (enforced by the check).
-- type ∈ {pdf, document, image, video}; storage_type ∈ {upload, link}.
-- is_downloadable is meaningful only for uploads (offline caching in the app).
CREATE TABLE resources (
  id               serial PRIMARY KEY,
  tenant_id        integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  subject_id       integer REFERENCES subjects ON DELETE CASCADE,
  batch_id         integer REFERENCES batches ON DELETE CASCADE,
  type             text NOT NULL,
  title            text NOT NULL,
  storage_type     text NOT NULL,
  link_url         text,
  is_downloadable  boolean NOT NULL DEFAULT true,
  created_by       integer REFERENCES users ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_one_scope
    CHECK ((subject_id IS NOT NULL)::int + (batch_id IS NOT NULL)::int = 1)
);
CREATE INDEX resources_tenant_id_index ON resources (tenant_id);
CREATE INDEX resources_subject_id_index ON resources (subject_id);
CREATE INDEX resources_batch_id_index ON resources (batch_id);

-- Blob kept separate so listing resources never pulls file bytes.
CREATE TABLE resource_files (
  id           serial PRIMARY KEY,
  resource_id  integer NOT NULL REFERENCES resources ON DELETE CASCADE,
  filename     text NOT NULL,
  mime_type    text NOT NULL,
  file_size    integer NOT NULL,
  file_data    bytea NOT NULL
);
CREATE INDEX resource_files_resource_id_index ON resource_files (resource_id);

-- ----------------------------------------------------------------------------
-- Syllabus: optional chapter list per subject + coverage log per batch  (mig 8)
-- ----------------------------------------------------------------------------

CREATE TABLE chapters (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  subject_id  integer NOT NULL REFERENCES subjects ON DELETE CASCADE,
  title       text NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chapters_subject_id_index ON chapters (subject_id);
CREATE INDEX chapters_tenant_id_index ON chapters (tenant_id);

-- chapter_id NULL = free-form entry; title used for free-form (or a snapshot).
-- Standalone by date (not tied to a timetable session), so makeup classes log.
CREATE TABLE chapter_coverage (
  id            serial PRIMARY KEY,
  tenant_id     integer NOT NULL REFERENCES tenants ON DELETE CASCADE,
  batch_id      integer NOT NULL REFERENCES batches ON DELETE CASCADE,
  chapter_id    integer REFERENCES chapters ON DELETE SET NULL,
  title         text,
  covered_date  date NOT NULL,
  notes         text,
  created_by    integer REFERENCES users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chapter_coverage_batch_id_index ON chapter_coverage (batch_id);
CREATE INDEX chapter_coverage_tenant_id_index ON chapter_coverage (tenant_id);

COMMIT;
