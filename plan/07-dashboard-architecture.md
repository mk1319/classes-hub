# Dashboard Architecture & Conventions

Stack: Vite + React + TypeScript + TanStack Router (file-based routing) + TanStack
Query + Tailwind CSS + shadcn/ui.

## Folder structure

```
dashboard/src/
├── routes/                     # TanStack Router file-based routes (folder/file = URL path)
│   ├── __root.tsx
│   ├── login.tsx
│   ├── students/
│   │   ├── index.tsx           # /students
│   │   ├── $studentId.tsx      # /students/:id
│   │   └── -components/        # route-local components ("-" prefix excludes from route generation)
│   ├── courses/
│   │   ├── index.tsx
│   │   ├── $courseId/
│   │   │   ├── index.tsx
│   │   │   └── -components/
│   │   └── -components/
│   └── tests/  ... (same pattern per route)
├── components/                  # SHARED UI components (used by 2+ routes)
│   ├── ui/                      # shadcn/ui primitives (button, input, dialog, table...)
│   └── layout/                  # sidebar, topbar, page shell
├── features/                    # shared DATA layer — mirrors the backend's feature folders
│   ├── auth/    { api.ts, types.ts }
│   ├── tenants/ { api.ts, types.ts }
│   ├── users/   { api.ts, types.ts }
│   ├── courses/ { api.ts, types.ts }
│   ├── tests/   { api.ts, types.ts }
│   ├── timetable/     { api.ts, types.ts }
│   ├── notifications/ { api.ts, types.ts }
│   └── uploads/ { api.ts, types.ts }
├── lib/                          # api client, query client config, utils (cn(), auth/token helpers)
└── styles/globals.css            # Tailwind + CSS variables for light/dark theme
```

## Core rules

- **Route-local vs shared component rule**: a component lives in that route's
  `-components/` folder only as long as exactly one route uses it. The moment a
  second route needs it, move it to `src/components/`.
- **Data-fetching is never route-local.** All TanStack Query hooks (`useXQuery`,
  `useXMutation`) and their TS types live in `features/<name>/api.ts` /
  `features/<name>/types.ts` — one folder per backend feature, mirroring the
  backend's `auth`/`tenants`/`users`/`courses`/`tests`/`timetable`/`notifications`/`uploads`
  Lambda folders 1:1. Components and routes import from here; nothing calls
  `fetch`/the API client directly.
- Route files stay thin: wire up the loader/query, delegate rendering to
  route-local or shared components.

## CLAUDE.md per folder

- **`dashboard/CLAUDE.md`** (root) — states the stack, naming conventions, and the
  hard rule: never fetch directly in a component, always via `features/*/api.ts`.
- **`routes/CLAUDE.md`** — file path = URL path; route files stay thin; route-local
  components go in `-components/`; promote to `src/components/` once shared by a
  second route.
- **`components/CLAUDE.md`** — only truly shared, presentational components
  (props-in, no data-fetching); `ui/` holds shadcn primitives only.
- **`features/CLAUDE.md`** — pure data layer (query hooks + types), no JSX, one
  folder per backend feature.

These CLAUDE.md files get created for real when the dashboard project is scaffolded
by Cursor — this doc is the source spec for what each should say.
