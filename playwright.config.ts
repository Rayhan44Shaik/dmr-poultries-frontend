import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const useExistingOrdersEnvironment = process.env.ORDERS_E2E_EXISTING === '1';

/**
 * Two webServers, started in order:
 *   1. the isolated seeded E2E backend harness (PGlite, never a real DB) on :4100
 *   2. the real Vite app in `--mode e2e`, pointed at :4100 via .env.e2e
 *
 * The deterministic trip/orders/lifecycle scenario lives in
 * tests/e2e/trip-workflow.e2e.spec.ts and fails loudly if seed state is missing.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Dedicated E2E port so a developer's own `npm run dev` on :5173 (pointed
    // at a real backend) is never reused for the isolated E2E run.
    baseURL: useExistingOrdersEnvironment ? 'http://127.0.0.1:5174' : 'http://localhost:5199',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'trip-workflow',
      testMatch: /(?:trip-workflow\.e2e|orders-live-workflow)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'legacy-smoke',
      testIgnore: /trip-workflow\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useExistingOrdersEnvironment ? undefined : [
    {
      command: 'node --import tsx tests/e2eHarness.ts',
      cwd: path.resolve(here, '../../backend'),
      url: 'http://127.0.0.1:4100/api/health',
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:4100/api' },
    },
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
});
