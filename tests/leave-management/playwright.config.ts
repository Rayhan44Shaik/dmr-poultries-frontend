import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'leave-management.spec.ts', fullyParallel: false,
  workers: 1, retries: 0, timeout: 60_000, expect: { timeout: 15_000 }, reporter: 'list',
  outputDir: '../../test-results/leave-management-browser',
  use: { baseURL: 'http://127.0.0.1:5199', viewport: { width: 1440, height: 1000 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 0.0.0.0 --port 5199 --strictPort', cwd: fileURLToPath(new URL('../../', import.meta.url)), url: 'http://127.0.0.1:5199', env: { VITE_API_BASE_URL: '/api' }, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
