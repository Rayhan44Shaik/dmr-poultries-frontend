import { defineConfig, devices } from '@playwright/test';

/** Batch C2: expects manually started PGlite harness :4100 + Vite :5199. */
export default defineConfig({
  testDir: '.',
  testMatch: /batch-c2-step4-persistence\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 300_000,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
});
