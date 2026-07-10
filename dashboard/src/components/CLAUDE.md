# components — Rules

Only genuinely shared, presentational components (props-in, no data-fetching):
`DataTable`, `ScopePicker`, `layout/*`, and `ui/*` (the shadcn-style primitives —
button, input, card, badge). A component belongs here once 2+ routes use it;
until then it lives in that route's `-components/` folder.

No TanStack Query hooks and no API calls in this folder — data comes in via props.
