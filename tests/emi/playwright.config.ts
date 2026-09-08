import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.EMI_TEST_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: /emi-(toolbar|resilience)\.spec\.ts/,
  outputDir: '../../test-results/emi-toolbar-browser',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:5197',
    viewport: { width: 1440, height: 1050 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    } : {},
  },
  // API requests are intercepted by the tests; no backend/database is used.
  webServer: externalBaseURL ? undefined : {
    command: 'npm run dev -- --host 0.0.0.0 --port 5197 --strictPort',
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    url: 'http://127.0.0.1:5197',
    env: { VITE_API_BASE_URL: '/api' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
