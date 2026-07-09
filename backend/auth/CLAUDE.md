# auth — Rules

Handles all `/auth/*` routes in one Lambda (Express + serverless-http). Business
logic lives in `src/login.ts` (and future `src/*.ts` files, e.g. refresh) — the
handler only wires routes to that logic and maps errors to HTTP responses. Add new
`/auth/*` endpoints as new files in `src/`, wired into `handler.ts`.
