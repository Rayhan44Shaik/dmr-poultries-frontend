import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: /batch-c3-journeys\.spec\.ts/, fullyParallel: false, workers: 1,
  reporter: [['list']], timeout: 180_000,
  use: { baseURL: 'http://127.0.0.1:5199', trace: 'on', screenshot: 'on', video: 'off', ...devices['Desktop Chrome'] },
});
