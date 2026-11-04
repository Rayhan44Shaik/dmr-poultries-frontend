import { defineConfig, devices } from '@playwright/test';

/** Batch C2: expects manually started PGlite harness :4100 + Vite :5199.
 * Vite origin configurable via E2E_WEB_URL (committed default: 5199). */
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5199';
export default defineConfig({
  testDir: '.',
  testMatch: /batch-c2-step4-persistence\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 300_000,
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
});
