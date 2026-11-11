import { defineConfig, devices } from '@playwright/test';
// TEMPORARY E2E-5B runner (deleted after the evidence runs): same
// trip-workflow project as the root playwright.config.ts but WITHOUT
// webServer — the isolated harness (:4100) + Vite (:5199) are managed
// externally under portable Node 24 and must not be respawned.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'trip-workflow',
      testMatch: /(?:trip-workflow\.e2e|orders-live-workflow|batch-c2-step4-persistence)\.spec\.ts/,
    },
  ],
  outputDir:
    '../../outputs/batch-e2e5b-search-dropdown/20261111-163423/results/pw-artifacts',
});
