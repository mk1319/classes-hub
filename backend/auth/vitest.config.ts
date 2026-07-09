import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // login.test.ts and handler.test.ts both reset/reseed the shared tenants/
    // users/sessions tables against a single real Postgres database. Running
    // the two files' setup hooks concurrently races (one file's DELETE can
    // fire between another file's INSERT INTO tenants and INSERT INTO users,
    // tripping the tenant_id foreign key) — so this package's test files must
    // run sequentially, not the default one-file-per-worker parallelism.
    fileParallelism: false,
  },
});
