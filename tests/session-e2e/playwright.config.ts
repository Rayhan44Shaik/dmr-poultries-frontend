import { defineConfig, devices } from '@playwright/test';

/**
 * Session-security E2E (no PGlite harness): runs against the live dev stack
 * (Vite :5173 → API :4000 → local PostgreSQL) with a dedicated probe account
 * (`e2e-probe-owner`, removed after the run). Nothing here touches business
 * data — only auth/session endpoints.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
});
