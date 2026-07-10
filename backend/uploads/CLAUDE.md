# uploads — Rules

S3 presigned-URL generation for test/question image uploads. One Lambda handling
`/uploads/*`. No database.

- Keys are **always tenant-prefixed** (`tenants/<tenantId>/uploads/<uuid>.<ext>`)
  from `buildKey`, so a presigned PUT can never write outside the caller's tenant.
- Only staff (not students) may request an upload URL; only image content types
  are allowed (`isAllowedContentType`).
- The S3 call lives behind an injectable `PresignFn` (`defaultPresign` uses the
  AWS SDK against `UPLOADS_BUCKET`); the handler takes a signer arg so tests run
  without AWS creds. The bucket is provisioned in `template.yaml` (`UploadsBucket`)
  with an `S3CrudPolicy` on this function.
- Resource files (PDF/doc/video) do **not** use this — they go to Postgres `bytea`
  via the `resources` feature (see `plan/10-resources-feature.md`). This is images
  only.
- Update `../NOTES.md` in the same change as any code change here.
