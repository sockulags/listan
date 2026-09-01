import { defineConfig } from 'vitest/config'

// Unit tests run in a plain Node environment. The store layer talks to
// node:sqlite directly and is exercised against in-memory databases, so no
// Electron runtime is involved and nothing needs mocking.
export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false
  }
})
