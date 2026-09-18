import { defineConfig, devices } from '@playwright/test';

// Read-only checks against the running sample preview. Start npm run dev first.
export default defineConfig({
  testDir: '.',
  testMatch: /orders-(tabs|live-workflow)\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.ORDERS_PREVIEW_URL ?? 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
