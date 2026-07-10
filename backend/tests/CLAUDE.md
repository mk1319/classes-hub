# tests — Rules

Question bank, test builder, attempts, grading, and results. One Lambda handling
`/questions/*`, `/tests/*`, and `/attempts/*` routes (Express + serverless-http).

- **Grading logic is pure** and lives in `src/grading.ts` (no DB) so the marking
  rules are unit-tested in isolation. DB access + authorization live in
  `src/tests.ts`. Never inline grading rules into the DB layer.
- Question types: `mcq_single`, `mcq_multi`, `text`, `match`, `odd_one_out`.
  `text` (and `match` with no `answer_key`) are manual; the rest auto-grade.
  Negative marking applies only to *attempted* wrong answers, never blanks.
- Authorization: question/test writes = managing teacher or admin; attempt
  start/submit = the enrolled student (owner); grade = managing teacher/admin;
  result = owner (gated by `reveal_results` + fully `graded`) or staff (always).
- `getTest` strips `answer_key`/`solution` for students — they must never receive
  the key while attempting. Full detail is only exposed via `/attempts/:id/result`
  once revealed.
- Attempt lifecycle: `in_progress` → `submitted` (manual pending) → `graded`.
  `startAttempt` resumes an existing in-progress attempt rather than duplicating.
- Update `../NOTES.md` in the same change as any code change here.
