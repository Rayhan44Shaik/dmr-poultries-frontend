import { defineConfig, devices } from '@playwright/test';
// Vite origin configurable via E2E_WEB_URL (committed default: 5199).
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5199';
export default defineConfig({
  testDir: '.', testMatch: /batch-c3-journeys\.spec\.ts/, fullyParallel: false, workers: 1,
  reporter: [['list']], timeout: 180_000,
  use: { baseURL: WEB_URL, trace: 'on', screenshot: 'on', video: 'off', ...devices['Desktop Chrome'] },
});
