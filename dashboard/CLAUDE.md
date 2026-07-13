# Dashboard (React) — Rules

Stack: Vite + React 18 + TypeScript + TanStack Router (file-based) + TanStack
Query + Tailwind CSS v3 + shadcn/ui. Used by admin/teacher accounts (students
use the Flutter app only — see `app/CLAUDE.md`).

## Components

- **shadcn/ui primitives** live in `src/components/ui/` as editable source
  (generated once, then owned by this repo — not a black-box dependency).
  Change a primitive's styling there and every screen using it updates.
  Add new primitives the same way, following the style already set up in
  `components.json` (new-york, Slate base color, CSS variables).
- **Placement rule**: a component used by exactly one route lives in that
  route's `-components/` folder; the moment a second route needs it, move it
  to `src/components/`.
- **Never call `fetch` or the API client directly from a component or route.**
  All data access goes through `features/<name>/api.ts` (TanStack Query hooks)
  + `features/<name>/types.ts`, one folder per backend feature.

## Forms

- Use `getFormDataObject` (`src/lib/form-utils.ts`) — uncontrolled inputs with
  `name` attributes, values extracted from `FormData` on submit. Do NOT create
  per-field `useState` for form fields, and do not introduce a form library
  (react-hook-form etc.).
- `useState` is fine for UI-only state: loading flags, open/closed, selected
  IDs, a debounced search-input value before it hits a URL param.
- Exception: complex inputs that can't be a plain HTML input (file uploads,
  map pickers, tag/chip selectors) may use `useState`.

## Filters

- Filters (search, status, page, date range, etc.) live in the URL via a
  route's `validateSearch` (zod schema) — never in `useState`. Changing a
  filter navigates with updated search params and resets `page` to `1`.

## Auth

`lib/auth.ts` stores the JWT in `localStorage` and decodes it client-side for
UI purposes only — the backend re-verifies every call via the authorizer
Lambda. A 401 clears the token and redirects to `/login` (`lib/api.ts`). The
`/_authed` pathless layout guards every authed screen via `beforeLoad`.

## Naming

Kebab-case filenames throughout (e.g. `login-form.tsx`, not `LoginForm.tsx`).
PascalCase for component/function names inside files, as usual for React.

## Process

- Never run `git commit` or `git push` without the user explicitly asking for
  it in that message — permission from an earlier message doesn't carry
  forward.
- Run `/code-review` and address its findings before pushing any dashboard
  change (in addition to the push rule above, not a replacement for it).
- No new dependency without checking its vulnerability/maintenance history
  first.

## Security

- Never `dangerouslySetInnerHTML`. Validate/sanitize all user input.
- File uploads: validate type and size client-side before uploading.
- No secrets/tokens hardcoded anywhere — env vars only (`VITE_*`, read via
  `import.meta.env`).

## Docs

Update this file in the same change as any change to these conventions.
