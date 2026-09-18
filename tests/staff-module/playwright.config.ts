import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'staff-module.spec.ts', workers: 1, retries: 0, timeout: 60_000,
  expect: { timeout: 20_000 }, reporter: 'list', outputDir: '../../test-results/staff-module-browser',
  use: { baseURL: 'http://127.0.0.1:5203', viewport: { width: 1440, height: 1000 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:web -- --host 0.0.0.0 --port 5203 --strictPort', cwd: fileURLToPath(new URL('../../', import.meta.url)), url: 'http://127.0.0.1:5203', env: { VITE_API_BASE_URL: '/api' }, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
