import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globals: true,
    // The cds CLI sets this itself when a tsconfig.json is present. Tests boot the server
    // in-process, so they have to set it: without it cds only looks for .js service
    // implementations and silently serves the entities without our custom handlers.
    env: { CDS_TYPESCRIPT: 'true' },
    // Each test file boots its own CAP server on an in-memory SQLite database;
    // run files sequentially in separate processes to keep them isolated.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
