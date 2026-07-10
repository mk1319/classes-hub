import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one real Postgres database and reset it in
    // beforeEach; keep files sequential so their setup hooks don't race.
    fileParallelism: false,
  },
});
