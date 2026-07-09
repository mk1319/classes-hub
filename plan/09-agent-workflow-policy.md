# Agent Workflow Policy — Docs, Design Checks, Testing

This is the operating policy for whichever agent builds this project (Cursor). It
gets copied into the root `CLAUDE.md` of each piece (`/app`, `/dashboard`,
`/backend`) once scaffolded, and every subfolder's own `CLAUDE.md` should reference
it rather than repeating it.

## Rule 1 — Docs are updated in the same change, never after

Whenever code, a component, a route, an API endpoint, or a design decision is added
or changed in a folder, the agent updates that folder's `NOTES.md` **in the same
change** — not as a follow-up. A change isn't done until its folder's `NOTES.md`
reflects it.

**Two docs per folder, different jobs:**

- **`CLAUDE.md`** — the *rules* for this folder: conventions, structure, what
  belongs here vs. elsewhere (e.g. [`07-dashboard-architecture.md`](./07-dashboard-architecture.md)
  is the source for these). Rarely changes.
- **`NOTES.md`** — the *current state* of this folder: what's actually implemented
  here right now — list of components/routes/endpoints, key decisions made, any
  deliberate deviation from the guidelines and why. Updated every time the folder's
  code changes. This is what lets anyone (human or agent) open a folder cold and
  know exactly what's in it without re-reading every file — the running record of
  "what do we actually have in this project."

## Rule 2 — Verify UI against the design guidelines before calling it done

After building or changing any UI, check the result against
[`08-design-guidelines.md`](./08-design-guidelines.md) (colors, type, spacing, dark
mode) before marking the task complete. Any deviation must be a deliberate,
called-out choice recorded in that folder's `NOTES.md` — not an oversight.

## Rule 3 — Test the feature before calling it done

After adding or changing a feature (frontend or backend), exercise it end-to-end
(run it, hit the endpoint, use the screen) — not just type-check/lint — before
claiming it's complete.

## Why

The goal is that at any point, opening this repo — even months later, even having
forgotten the details — gives an accurate, current picture of exactly what exists
and why, without archaeology through commit history.
