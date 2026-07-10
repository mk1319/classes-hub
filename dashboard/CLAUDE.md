# Dashboard — Rules

Stack: Vite + React + TypeScript + TanStack Router (file-based) + TanStack Query
+ Tailwind + shadcn-style UI primitives. Used by super-admins, tutors/admins, and
teachers (students use the Flutter app only).

## Hard rules

- **Never call `fetch` or the API client directly from a component or route.**
  All data access goes through `features/<name>/api.ts` (TanStack Query hooks) +
  `features/<name>/types.ts`, one folder per backend feature. The only place
  `lib/api.ts` is imported is inside `features/*/api.ts`.
- **Route files stay thin**: wire the query/mutation hooks and delegate rendering
  to route-local (`-components/`) or shared (`src/components/`) components.
- **Route-local vs shared**: a component lives in a route's `-components/` folder
  while exactly one route uses it; the moment a second route needs it, move it to
  `src/components/`.
- **Design tokens only** — colors come from the CSS variables in
  `styles/globals.css` ("Slate & Amber", `plan/08-design-guidelines.md`); never
  hardcode a hex. Amber (`primary`) is a highlight, not a large fill. Dark mode is
  class-strategy and token-driven (`components/layout/theme.tsx`).
- The shared **DataTable** (`components/DataTable.tsx`) is the one data-dense list
  pattern (sticky header, sort, filter, pagination, empty/loading) — reuse it for
  every roster/list rather than hand-rolling tables.

## Auth

`lib/auth.ts` stores/decodes the JWT (client-side, for UI only — the backend
re-verifies every call). A 401 (e.g. session deactivated elsewhere) clears the
token and bounces to `/login` (`lib/api.ts`). The `/_authed` pathless layout
route guards every authed screen and renders the app shell.

## Docs

Update this folder tree's `NOTES.md` in the same change as any code change here
(`plan/09-agent-workflow-policy.md`).
