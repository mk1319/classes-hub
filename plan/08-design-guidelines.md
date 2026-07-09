# Dashboard Design Guidelines

Goal: clean, readable, minimal SaaS look — this is an internal tool for tutors/admins/teachers, not the whitelabeled product (only the Flutter app is whitelabeled per tenant; see [`01-architecture.md`](./01-architecture.md)), so one consistent design system covers every tenant.

## Typography
- Font: **Inter** (self-hosted), matches shadcn/ui defaults, excellent readability at small sizes.
- Base size 14–16px, generous line-height.
- Restrained weight usage: 400 (body), 500 (emphasis/labels), 600 (headings) only —
  avoid a wide weight range, it reads as noisy.

## Color — "Slate & Amber"

A deliberate palette, not the generic blue-accent SaaS default: cool neutral
structure with a single warm accent used sparingly, so it stays legible for long
data-heavy sessions while still feeling distinctive.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0F172A` | primary text |
| `muted` | `#64748B` | secondary text, borders |
| `bg` | `#F8FAFC` | app background |
| `primary` (amber-600) | `#D97706` | primary actions, focus rings, active states — used sparingly, never as a large fill |
| `success` | `#16A34A` | positive states (e.g. paid, submitted, present) |
| `warning` | `#CA8A04` | due/pending states |
| `destructive` | `#DC2626` | delete/error states |

All tokens are defined as CSS variables (shadcn/ui's theming approach), with a
dark-mode variant for each (inverted neutrals, same accent hues adjusted for
contrast) — so dark mode falls out of the token set, no per-component overrides.

Rule of thumb: `primary` (amber) is a highlight, not a background — reserve it for
buttons, active nav items, and focus states. Large surfaces stay neutral so the
accent keeps its weight.

## Spacing & density
- Consistent Tailwind spacing scale throughout; generous whitespace over dense
  clutter.
- This app manages rosters of 1,000+ students per tenant — data-dense screens
  (student lists, batch rosters, test results) are the most-used surfaces, so get the
  shared **data-table pattern** right early: sticky header, column sort, filters,
  pagination, good empty/loading states. Build it once as a shared component in
  `components/` and reuse everywhere a list of students/batches/tests appears.

## Dark mode
- Supported from V1 (light + dark), toggled via a class strategy in Tailwind config,
  driven by the same CSS variables as the color system above.
