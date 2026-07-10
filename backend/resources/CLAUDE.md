# resources — Rules

Study materials (PDF/document/image/video) attached to exactly one of a subject
or a batch, as an uploaded blob (Postgres `bytea`) or an external link. One
Lambda handling `/resources*` routes. See `plan/10-resources-feature.md`.

- Uploads are stored in `resource_files` (`bytea`), separate from `resources`
  metadata so listing never pulls blobs. Files arrive inline as base64 in the
  create body. Links store only `link_url`; `is_downloadable` is forced false for
  links (only uploads can be cached offline — `plan/14-flutter-offline-performance.md`).
- Scope is enforced by a DB check constraint (`resources_one_scope`) and the zod
  schema: exactly one of `subjectId`/`batchId`.
- Who can add/edit: admin (anything in tenant) or a teacher assigned to the batch
  (batch scope) / to a batch under the subject (subject scope) — `canManageResourceScope`.
- Who can view/stream: staff (tenant), or a student enrolled in the target batch
  or any batch under the target subject — `canViewResource`. `GET /resources/:id/file`
  streams the blob with its stored content-type; 400 for link-type resources.
- Update `../NOTES.md` in the same change as any code change here.
