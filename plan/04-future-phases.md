# Future Phases (deferred, explicitly out of V1 scope)

- **Multi-tenancy / Whitelabel** — turn this single-institute product into a
  whitelabel platform sold to multiple tutors/coaching institutes, once the
  single-institute version is validated with a real client. Deferred work
  includes:
  - Reintroduce a `tenants` table (id, name, branding config, flavor config).
  - Reintroduce `tenant_id` columns across every tenant-scoped table (`users`,
    `courses`, `questions`, `announcements`, `resources`, `sessions`, etc. — see
    [`02-domain-model.md`](./02-domain-model.md) for the current, tenant-free
    shape of each), and scope every query by it.
  - Add a `super_admin` role (distinct from `admin`) that onboards new tenant
    records and configures their branding (name/logo/colors) — a restricted
    section of the dashboard, accessible only to the platform operator.
  - Change email uniqueness from global-within-institute to global-across-platform,
    and change login/tenant resolution: on login, look up the user by email,
    resolve their `tenant_id` + `role`, and issue a JWT carrying `user_id`,
    `tenant_id`, `role` (today's JWT carries only `user_id` + `role`).
  - Update the custom Lambda authorizer to inject `tenant_id` into the request
    context alongside `role` / `user_id`, and enforce tenant isolation in
    application code (every query scoped by `tenant_id` from the verified JWT).
  - Reintroduce per-tenant Flutter build flavors: each tutor gets their own app
    build (name, icon, splash screen, color theme) with their `tenant_id` baked in
    at build time, published as its own listing on the Play Store / App Store.
  - Reintroduce a `tenants` feature/Lambda (or fold into an existing grouped
    Lambda) exposing tenant CRUD + branding config, restricted to `super_admin`.
  - Revisit the database choice for multi-tenant scale (e.g. Aurora Serverless v2)
    if a single managed Postgres instance is no longer sufficient.
- **Attendance tracking**
- **Fee management & online payment collection**
- **Live classes** (video provider integration)
- **Recorded content / video library** — simple file/link-based materials now ship
  in V1 as the [Resources feature](./10-resources-feature.md); what's still
  deferred here is actual video hosting/streaming/transcoding infrastructure and
  watch-progress tracking.
- **Parent role & access**
- **Self-registration / join-code onboarding flow**
- **Test-attempt device lock** — lock a specific test attempt to the device it was started on
- **In-test proctoring** — periodic selfie/face-match, app-backgrounding detection during a test (see [`15-account-security-anti-fraud.md`](./15-account-security-anti-fraud.md))

Each of these gets its own detailed design pass when we get to it — noted here so
they aren't forgotten and aren't accidentally built into V1.
