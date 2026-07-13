# Dashboard design-system foundation (shadcn + forms + conventions)

## Context

The dashboard currently has exactly one screen (`/login`, from the login slice),
styled with raw inline Tailwind classes and controlled `useState` form fields.
Before building any real feature screens, the project owner wants a shared,
reusable component foundation in place so every future screen is built the same
way — and so styling changes made in one shared place propagate everywhere,
rather than being copy-pasted per screen.

The owner also supplied a `CLAUDE.md` from a different project (Dukandaari V2's
dashboard) as a reference for conventions worth adopting. Several of its rules
were cherry-picked; others conflict with what's already built/planned for
classes-hub and were explicitly declined (see Decisions below). This spec covers
only the foundation — no new feature screens are built here.

## Decisions

Confirmed with the project owner, in order:

1. **Cherry-pick conventions, keep classes-hub's existing structure.** Not a
   wholesale adoption of Dukandaari's layout — classes-hub keeps its
   `features/<name>/api.ts` folders, `_authed` layout, and direct-to-Lambda
   calls as already built (Tasks 1-11 of the login slice).
2. **JWT stays in `localStorage`.** Dukandaari's rule (memory/httpOnly cookie
   only) is not adopted — it would require reworking the already-built and
   tested login flow for no immediate benefit at this stage.
3. **No aggregator/"ops" Lambda.** The dashboard keeps calling `identity` (and
   later `academics`/`content`) directly through the API Gateway/Vite proxy, per
   `plan/01-architecture.md`.
4. **Stay on React 18.3.1 / Tailwind 3.4.10** — the versions already scaffolded
   and working. Not upgrading to React 19/Tailwind v4 to match Dukandaari.

## Conventions adopted (written into `dashboard/CLAUDE.md`)

- **shadcn/ui** for component primitives, generated into `src/components/ui/` as
  editable source (not a black-box npm dependency) — so styling changes in one
  place propagate to every screen using that component.
- **Forms via `getFormDataObject`** (uncontrolled inputs + `FormData` extraction
  on submit) instead of per-field `useState` or a form library like
  react-hook-form. `useState` remains fine for UI-only state (loading flags,
  open/closed, selected IDs). Exception carried over from Dukandaari: complex
  inputs that can't be a plain HTML input (file uploads, map pickers, tag/chip
  selectors) may use `useState`.
- **Component placement rule** (reaffirms what the pre-wipe dashboard/CLAUDE.md
  already said): a component used by exactly one route lives in that route's
  `-components/` folder; the moment a second route needs it, it moves to
  `src/components/`.
- **Filters live in the URL**, not `useState` — `validateSearch` + a zod schema
  on the route, `navigate({ search: ... })` to change a filter, filter changes
  reset pagination to page 1. (No filterable list screens exist yet; this
  documents the convention for when they're built.)
- **Kebab-case filenames** across the dashboard.
- **`/code-review` before every push**, findings addressed (or explicitly noted
  if deferred) before pushing. Separate from — and in addition to — the
  existing "never push without being explicitly asked" rule.
- **Baseline security hygiene** (the parts of Dukandaari's Rule 5 that don't
  conflict with Decisions 2-3 above): never `dangerouslySetInnerHTML`; validate
  and sanitize user input; validate file type/size client-side before upload;
  no secrets hardcoded anywhere (env vars only); don't add a new dependency
  without checking its vulnerability history. The dashboard's existing global
  401 handling (clear token, redirect to `/login`, in `lib/api.ts`) already
  satisfies Dukandaari's "handle 401 globally" rule — no change needed there.

## shadcn/ui setup

- `npx shadcn@latest init`, configured with:
  - Style: **new-york**
  - Base color: **Slate** (matches the neutral palette already used in
    `login.tsx`'s Tailwind classes)
  - CSS variables: **enabled** (theming lives in `globals.css`, not scattered
    utility classes)
- Generates `components.json` and `src/lib/utils.ts` (the `cn()` helper, built
  on `clsx`/`tailwind-merge` — both already installed dependencies).
- Path alias `@/*` → `src/*` is already configured in `tsconfig.json`, so
  shadcn's generated imports (`@/lib/utils`, `@/components/ui/button`) resolve
  with no additional config.
- Add only the primitives the login screen needs right now: `Button`, `Input`,
  `Label`, `Card` (with `CardHeader`/`CardContent`/`CardTitle`). Further
  primitives get added the same way (`npx shadcn@latest add <name>`) as future
  screens need them — no upfront library grab.

## Forms: `getFormDataObject`

Ported near-verbatim from Dukandaari into `dashboard/src/lib/form-utils.ts` —
the implementation is generic (handles nested keys via `a.b.c` names and array
keys via `a[]` names) and reusable as-is, even though the login form itself only
needs flat string fields.

`login.tsx` changes from controlled `useState` fields to uncontrolled inputs
(`name="email"`, `name="password"`), with `handleSubmit` calling
`getFormDataObject(e)` to extract values. `deviceId` is not a visible form
field — it continues to be generated/persisted separately (as it already is)
and merged into the payload before calling `useLogin()`.

## Scope for this round

In scope:
- shadcn init + the four primitives listed above
- `dashboard/src/lib/form-utils.ts`
- Restyle `login.tsx` using the new shadcn components + `getFormDataObject`
  (visually similar to today — a centered card with a form — just componentized
  instead of hand-rolled Tailwind classes)
- Write `dashboard/CLAUDE.md` documenting every convention above
- Verification: `npm run typecheck` and `npm run build` both clean; manual
  check that `/login` still renders and successfully logs in against the
  running backend (`http://localhost:3000`)

Explicitly out of scope:
- Any new feature screens (courses, tests, timetable, resources, syllabus,
  notifications, people/users) — these come later, picked up directly by the
  project owner per their stated plan
- The Flutter app
- Any change to JWT storage, backend architecture, or dependency versions
  (see Decisions above)
