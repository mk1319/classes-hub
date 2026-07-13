import { defineConfig } from 'vitest/config';

// Tests share the same Postgres tables and reseed in beforeEach — must run
// serially or they race each other's setup.
export default defineConfig({
  test: {
    fileParallelism: false,
    // The remote Postgres connection used for local dev/test (Supabase) has
    // ~400ms-2.5s latency/jitter, well past vitest's 5s default under load.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
