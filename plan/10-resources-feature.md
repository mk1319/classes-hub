# Resources Feature (V1)

> **Note (single-institute update):** This doc predates the shift to a single-institute-first V1 (no multi-tenancy). References to `tenant_id`, `super_admin`, tenant/whitelabel concepts, or Aurora below describe the deferred future multi-tenant phase — see [`04-future-phases.md`](./04-future-phases.md) — not the current single-institute architecture (see [`01-architecture.md`](./01-architecture.md)).

Study materials students can access per subject/batch — PDFs, documents, images,
and video.

## Scope

A resource attaches to exactly one of:
- **Subject** — visible to every batch under that subject (e.g. a syllabus PDF
  everyone taking Physics needs).
- **Batch** — visible only to that specific batch (e.g. a recording of just that
  batch's Tuesday session).

Students see a resource if they're enrolled in the batch it targets, or enrolled in
any batch under the subject it targets.

## Who can add

- **Teachers** — for subjects/batches they're assigned to.
- **Tutor/Admin** — for anything in the tenant.

## How a resource is added — two input methods

1. **Direct upload** — PDF, document, or image (and video, size permitting). Stored
   as a binary blob (`bytea`) directly in Aurora Postgres — no S3. This keeps
   infra to one service (Postgres) instead of adding S3 as a second storage layer.
2. **External link** — paste a URL (typically Google Drive, but any link works —
   YouTube, Dropbox, etc.). Stored as a plain text field. This is the primary path
   for anything large (especially video), since Postgres storage costs more per GB
   than S3 and bloats the database/backups — pushing big files to a link keeps that
   cost near zero. (Flagged this tradeoff to Mukesh; decision confirmed: uploads go
   to Postgres, no hard size cap enforced — teachers use judgment, guided to prefer
   links for anything large.)

## Data model additions

- `resources` (id, tenant_id, subject_id NULLABLE, batch_id NULLABLE — exactly one
  set, type [pdf/document/image/video], title, storage_type [upload/link],
  link_url NULLABLE, is_downloadable [boolean, default true, only meaningful for
  storage_type=upload — see [`14-flutter-offline-performance.md`](./14-flutter-offline-performance.md)],
  created_by)
- `resource_files` (id, resource_id, filename, mime_type, file_size, file_data
  `bytea`) — kept in a separate table from `resources` so listing/browsing
  resources doesn't have to pull blob data; the blob is only fetched when a
  student actually opens that resource.

## Backend

New feature folder: `resources` — CRUD for resource metadata, plus an endpoint that
streams the file back with the correct content-type for uploaded files (link-type
resources just return the URL, no streaming needed).

## Relationship to the deferred "Recorded content / video library" item

This covers simple file/link-based materials now. What's still deferred to V2 is
anything beyond that — actual video hosting/streaming/transcoding, watch-progress
tracking, etc. For V1, video is just another resource type: either a small upload
or (more likely, given the cost tradeoff above) a link to wherever it's hosted.
