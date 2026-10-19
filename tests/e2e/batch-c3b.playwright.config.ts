import { defineConfig, devices } from '@playwright/test';

/**
 * Batch C3 coverage: expects the isolated PGlite harness on :4100 and Vite on
 * :5199 (VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:4100). Evidence is written
 * under C3_EVIDENCE_DIR (defaults to the provisional C3 tree).
 */
export default defineConfig({
  testDir: '.',
  testMatch: /batch-c3b-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 240_000,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    geolocation: { latitude: 17.385044, longitude: 78.486671 },
    permissions: ['geolocation'],
    ...devices['Desktop Chrome'],
  },
});
