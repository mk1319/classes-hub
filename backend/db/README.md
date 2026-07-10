# Database setup

Two files, one job: stand up the full Postgres schema for Classes Hub.

## Files

- **`schema.sql`** — the complete schema in one file: every table, index, and
  constraint, grouped and commented by feature. Verified byte-identical to
  running all of `backend/migrations/1..8` (same columns, indexes, and named
  constraints). Use this to create a database from scratch in one shot.
- **`seed.sql`** — optional demo data: a super-admin, one demo tenant, an
  admin/teacher/student, and a course → subject → batch (teacher assigned,
  student enrolled). Every demo account's password is `password123`. Idempotent
  on email, so re-running is safe. Dev/testing only.

## Quick start

```bash
createdb classeshub                       # or your managed Postgres
export DATABASE_URL=postgres://classeshub:classeshub@localhost:5432/classeshub

psql "$DATABASE_URL" -f backend/db/schema.sql     # full schema
psql "$DATABASE_URL" -f backend/db/seed.sql       # optional demo data
```

Demo logins after seeding (password `password123`):

| Role        | Email              |
|-------------|--------------------|
| Super-admin | `super@demo.com`   |
| Tutor/admin | `admin@demo.com`   |
| Teacher     | `teacher@demo.com` |
| Student     | `student@demo.com` |

## schema.sql vs. migrations — which do I use?

- **`schema.sql`** — fastest path for a fresh/dev/test/CI database. No
  bookkeeping table.
- **migrations** (`npm run migrate -- up -m migrations`) — for real environments
  where you want ordered, reversible changes and a recorded migration history
  (`pgmigrations` table).

Pick one per database. Don't run migrations on a DB created from `schema.sql`
(node-pg-migrate would try to re-create the same tables). When you add a new
migration, **also update `schema.sql` in the same change** and re-verify it
matches (create a scratch DB from each and diff `information_schema.columns`,
`pg_indexes`, and `pg_constraint`).
