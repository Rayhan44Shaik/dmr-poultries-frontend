import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// Isolated browser tests: staff API responses are intercepted in the browser.
// No PostgreSQL, external ERP service or real staff records are involved.
export default defineConfig({
  testDir: '.',
  testMatch: 'duty-planner.spec.ts',
  outputDir: '../../test-results/duty-planner-browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5198',
    viewport: { width: 1440, height: 1000 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    } : {},
  },
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0 --port 5198 --strictPort',
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:5198',
    env: { VITE_API_BASE_URL: '/api' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
