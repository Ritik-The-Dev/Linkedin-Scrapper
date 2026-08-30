import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The mock API's artificial latency exists to make loading states visible
    // during development; in tests it would only slow the suite down.
    env: { VITE_MOCK_LATENCY: '0' },
  },
});
