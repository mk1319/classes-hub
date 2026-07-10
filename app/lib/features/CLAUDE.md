# features — Rules

One folder per backend feature (auth, timetable, tests, resources, syllabus,
notifications), each split into:

- `data/` — the repository: cache-first reads (Drift → serve → refresh from
  `ApiClient`) and the test-answer write queue. **The only place `ApiClient` is
  used.**
- `domain/` — plain models (fromJson).
- `presentation/` — screens + Riverpod providers/notifiers.

Hard rule: no screen calls `ApiClient` directly — always via the feature's
repository, so cache-first behavior is never bypassed.
