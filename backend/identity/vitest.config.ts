import { defineConfig } from 'vitest/config';

// Tests share the same Postgres tables and reseed in beforeEach — must run
// serially or they race each other's setup.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
