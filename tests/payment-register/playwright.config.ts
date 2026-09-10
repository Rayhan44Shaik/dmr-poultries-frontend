import { defineConfig } from '@playwright/test';

// Run against an already-running frontend. API requests are intercepted in tests.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '../../test-results/payment-register',
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: process.env.PAYMENT_TEST_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'Asia/Kolkata',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    } : {},
  },
});
