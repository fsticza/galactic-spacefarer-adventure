import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // Each test file boots its own CAP server on an in-memory SQLite database;
    // run files sequentially in separate processes to keep them isolated.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
