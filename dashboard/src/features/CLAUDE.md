# features — Rules

The shared data layer, one folder per backend feature (auth, tenants, users,
courses, tests, timetable, notifications, resources, syllabus) mirroring the
backend's Lambda folders 1:1.

- `api.ts` holds the TanStack Query hooks (`useXQuery`/`useXMutation`) built on
  `lib/api.ts`; `types.ts` holds the TS types for that feature's payloads.
- Pure data layer — **no JSX** here. Components/routes import these hooks; nothing
  else calls `lib/api.ts`.
