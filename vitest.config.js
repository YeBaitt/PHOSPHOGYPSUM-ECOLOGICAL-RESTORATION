import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 650,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
});
