# Flutter App Design Guidelines

> **Note (single-institute update):** This doc predates the shift to a single-institute-first V1 (no multi-tenancy). References to `tenant_id`, `super_admin`, tenant/whitelabel concepts, or Aurora below describe the deferred future multi-tenant phase — see [`04-future-phases.md`](./04-future-phases.md) — not the current single-institute architecture (see [`01-architecture.md`](./01-architecture.md)).

Goal: clean and readable, same as the dashboard, but with one key difference —
this app is whitelabeled per tenant, so the **accent color is per-tenant
configurable**, while structure/typography/spacing stay from one shared design
system across every tenant's build.

## Typography
- **Inter**, same as the dashboard, for a consistent brand feel across both
  surfaces. Bundled as an app asset (compiled into the binary) — this does **not**
  cost anything at runtime over the network, so it doesn't conflict with the
  low-network goal. Only ship the weights actually used (400/500/600) to keep app
  size down.

## Color
- **Neutrals are fixed** across every tenant build: same ink/muted/background
  scale as the dashboard (`#0F172A` / `#64748B` / `#F8FAFC`, with a dark-mode
  variant).
- **Accent color is per-tenant**, set in that tenant's flavor config at build time
  (falls back to the dashboard's amber `#D97706` if a tenant hasn't set one).
  Semantic colors (success `#16A34A`, warning `#CA8A04`, destructive `#DC2626`)
  stay fixed across all tenants — these carry meaning (paid/pending/error) and
  shouldn't be reinterpreted per brand.
- All tokens defined once in `core/theme/app_theme.dart`, with the accent swapped
  per flavor — screens never hardcode a color.

## Spacing & layout
- Same principle as the dashboard: consistent spacing scale, generous whitespace,
  avoid clutter. Mobile-specific: comfortable tap targets (min 44x44), bottom
  navigation for the primary sections (Timetable, Tests, Resources, Notifications),
  not a hamburger drawer — keeps core actions one tap away.

## Dark mode
- Supported from V1, same token-driven approach as the dashboard.
