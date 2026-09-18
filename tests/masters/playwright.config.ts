import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.MASTERS_TEST_BASE_URL;

// Every API request is intercepted. No real master records or database writes.
export default defineConfig({
  testDir: '.',
  testMatch: 'masters.spec.ts',
  outputDir: '../../test-results/masters-browser',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:5196',
    viewport: { width: 1440, height: 1000 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
        }
      : {},
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --host 0.0.0.0 --port 5196 --strictPort',
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        url: 'http://127.0.0.1:5196',
        env: { VITE_API_BASE_URL: '/api' },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
