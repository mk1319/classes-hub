-- ============================================================================
-- Classes Hub — demo seed data (dev/testing only)
-- ============================================================================
--
-- Loads a super-admin, one demo tenant, an admin/teacher/student, and a
-- course → subject → batch with the teacher assigned and the student enrolled.
-- Run AFTER schema.sql (or after migrations):
--
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- All demo accounts share the password: password123
-- (bcrypt hash below — DO NOT reuse in production).
--
-- Idempotent on email: re-running won't duplicate users (ON CONFLICT DO NOTHING).
-- ============================================================================

-- bcrypt('password123', 10)
\set pw '\'$2a$10$0T9Zeg5knC6Ie7tigHuHWeCkgfDqUqzwCTEIEJ9cwTavRVo96CPpK\''

-- Super-admin (platform owner) — not scoped to any tenant.
INSERT INTO users (tenant_id, role, email, password_hash, name)
VALUES (NULL, 'super_admin', 'super@demo.com', :pw, 'Platform Super Admin')
ON CONFLICT (email) DO NOTHING;

-- Demo tenant + its people and academic structure, in one data-modifying CTE
-- chain so the generated ids thread through. Guarded so re-runs are no-ops.
WITH new_tenant AS (
  INSERT INTO tenants (name, branding)
  SELECT 'Demo Institute', '{"appName":"Demo","accentColor":"#2563EB"}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE name = 'Demo Institute')
  RETURNING id
), t AS (
  SELECT id FROM new_tenant
  UNION ALL SELECT id FROM tenants WHERE name = 'Demo Institute' LIMIT 1
), admin AS (
  INSERT INTO users (tenant_id, role, email, password_hash, name)
  SELECT (SELECT id FROM t LIMIT 1), 'tutor', 'admin@demo.com',
         '$2a$10$0T9Zeg5knC6Ie7tigHuHWeCkgfDqUqzwCTEIEJ9cwTavRVo96CPpK', 'Demo Admin'
  ON CONFLICT (email) DO NOTHING
  RETURNING id
), teacher AS (
  INSERT INTO users (tenant_id, role, email, password_hash, name)
  SELECT (SELECT id FROM t LIMIT 1), 'teacher', 'teacher@demo.com',
         '$2a$10$0T9Zeg5knC6Ie7tigHuHWeCkgfDqUqzwCTEIEJ9cwTavRVo96CPpK', 'Demo Teacher'
  ON CONFLICT (email) DO NOTHING
  RETURNING id
), student AS (
  INSERT INTO users (tenant_id, role, email, password_hash, name)
  SELECT (SELECT id FROM t LIMIT 1), 'student', 'student@demo.com',
         '$2a$10$0T9Zeg5knC6Ie7tigHuHWeCkgfDqUqzwCTEIEJ9cwTavRVo96CPpK', 'Demo Student'
  ON CONFLICT (email) DO NOTHING
  RETURNING id
), course AS (
  INSERT INTO courses (tenant_id, name, type)
  SELECT (SELECT id FROM t LIMIT 1), 'Class 10', 'school'
  WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'Class 10' AND tenant_id = (SELECT id FROM t LIMIT 1))
  RETURNING id
), subject AS (
  INSERT INTO subjects (tenant_id, course_id, name)
  SELECT (SELECT id FROM t LIMIT 1), (SELECT id FROM course), 'Physics'
  WHERE EXISTS (SELECT 1 FROM course)
  RETURNING id
), batch AS (
  INSERT INTO batches (tenant_id, subject_id, name, schedule_info)
  SELECT (SELECT id FROM t LIMIT 1), (SELECT id FROM subject), 'Morning Batch A', 'Mon/Wed/Fri 7am'
  WHERE EXISTS (SELECT 1 FROM subject)
  RETURNING id
)
INSERT INTO batch_teachers (batch_id, user_id)
SELECT (SELECT id FROM batch), (SELECT id FROM teacher)
WHERE EXISTS (SELECT 1 FROM batch) AND EXISTS (SELECT 1 FROM teacher);

-- Enroll the demo student in the demo batch (separate statement so it also runs
-- when the batch already existed from a prior seed).
INSERT INTO enrollments (batch_id, student_id)
SELECT b.id, u.id
FROM batches b
JOIN users u ON u.email = 'student@demo.com'
WHERE b.name = 'Morning Batch A'
ON CONFLICT DO NOTHING;
