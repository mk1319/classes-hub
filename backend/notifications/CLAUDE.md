# notifications — Rules

Announcements + FCM push. One Lambda handling `/announcements*` routes.

- Scopes: `tenant` (admin-only), `course` (admin-only), `batch` (managing teacher
  or admin). `scopeId` is required for course/batch, forbidden for tenant.
- On create: record the row (`sent_at = now()`), resolve recipients from the
  scope (`recipientTokens`), and fan out via `sendPush` (`src/fcm.ts`). FCM is a
  **no-op unless `FCM_SERVER_KEY` is set** — the response reports `pushTargeted`
  (how many tokens) / `pushDelivered`. Swap the legacy FCM call for HTTP v1 +
  service account when credentials are provisioned.
- `listAnnouncements` filters per role: staff see the tenant's; a student sees
  tenant-wide + their enrolled courses/batches only.
- Device tokens are registered by the app at login via `POST /announcements/tokens`.
- Update `../NOTES.md` in the same change as any code change here.
