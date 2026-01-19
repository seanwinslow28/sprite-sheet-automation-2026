import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run backend tests from root - UI has its own vitest config
    include: ['test/**/*.test.ts'],
    exclude: ['ui/**/*', 'node_modules/**/*'],
    // Node environment for backend tests
    environment: 'node',
  },
});
