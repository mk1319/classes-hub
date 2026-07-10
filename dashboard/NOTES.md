# Dashboard — Current State

Vite + React + TS + TanStack Router (file-based) + TanStack Query + Tailwind.

## Foundation
- Config: `vite.config.ts` (React + TanStackRouterVite plugin + `@` alias),
  `tailwind.config.js` (token colors mapped to CSS vars, `darkMode: 'class'`,
  Inter font), `postcss.config.js`, `tsconfig.json`. `styles/globals.css` defines
  the "Slate & Amber" tokens (`plan/08-design-guidelines.md`) with a full dark
  variant — dark mode is purely token-driven.
- `lib/`: `api.ts` (single API client — attaches JWT, unwraps JSON, clears token
  + redirects to /login on 401), `auth.ts` (JWT store/decode + role helpers),
  `query.ts` (QueryClient), `utils.ts` (`cn`).
- Build script is `vite build` (the router plugin generates `routeTree.gen.ts`;
  `tsc --noEmit` under `typecheck` requires that generated file to exist first).

## Shared components
- `components/ui/*`: shadcn-style primitives — `Button` (amber primary/outline/
  ghost/destructive), `Input`/`Label`/`Select`, `Card*`, `Badge`.
- `components/DataTable.tsx`: THE data-dense list pattern — sticky header, column
  sort, global filter, client pagination, skeleton/empty states. Reused by every
  list screen.
- `components/ScopePicker.tsx`: cascading course→subject→batch selector reused by
  tests/timetable/resources/syllabus.
- `components/layout/AppShell.tsx`: sidebar (role-filtered nav) + topbar (theme
  toggle, sign out) + `PageHeader`. `layout/theme.tsx`: class-strategy dark mode.

## Feature data layers (`features/*`, mirror backend 1:1)
auth (useLogin), tenants, users (incl. sessions history + bulk CSV import),
courses (courses/subjects/batches/teachers/enrollments/batch update),
tests (questions + tests), timetable, notifications, resources (upload as base64
or link), syllabus (chapters + coverage). Each is `api.ts` (+`types.ts`); no JSX.

## Routes (`routes/`)
- `login.tsx` (public), `_authed.tsx` (guard + shell), and under `_authed/`:
  `index` (overview), `tenants` (super-admin CRUD + branding/accent),
  `students` (People: list, filter by role, create, bulk CSV import) +
  `students.$studentId` (login/device history table), `courses` (list/create) +
  `courses.$courseId` (subjects → batches → progress toggle + teacher assignment
  + enrollment), `tests` (question bank + test builder), `timetable` (per-batch
  sessions + weekly recurrence), `notifications` (announcement composer + list),
  `resources` (subject/batch materials, upload or link), `syllabus` (chapters +
  coverage log).

## Verification
- `npm run build` (Vite) succeeds; `npm run typecheck` (tsc) clean after a build
  has generated `routeTree.gen.ts`. Not yet exercised against a live backend in
  this environment (no running API here) — screens are wired to the real
  endpoints via `features/*/api.ts` and typecheck against the backend's response
  shapes.
