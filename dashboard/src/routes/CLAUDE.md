# routes — Rules

File path = URL path (TanStack Router file-based routing). `__root.tsx` is the
shell; `login.tsx` is public; everything under `_authed/` is guarded by the
`_authed.tsx` pathless layout (auth check + app shell).

- Route files stay thin: call the `features/*/api.ts` hooks, delegate rendering.
- Route-local components go in a sibling `-components/` folder (the `-` prefix
  excludes them from route generation). Promote to `src/components/` once a
  second route needs them.
- Never fetch here directly — always via `features/*/api.ts`.
