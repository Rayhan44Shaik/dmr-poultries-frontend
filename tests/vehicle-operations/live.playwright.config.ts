import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /live\.spec\.ts/,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  timeout: 60_000,
  expect: { timeout: 15_000 },
});
