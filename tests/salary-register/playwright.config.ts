import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'salary-register.spec.ts', fullyParallel: false,
  workers: 1, retries: 0, timeout: 60_000, expect: { timeout: 15_000 }, reporter: 'list',
  outputDir: '../../test-results/salary-register-browser',
  use: { baseURL: 'http://127.0.0.1:5204', viewport: { width: 1440, height: 1000 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:web -- --host 0.0.0.0 --port 5204 --strictPort', cwd: fileURLToPath(new URL('../../', import.meta.url)), url: 'http://127.0.0.1:5204', env: { VITE_API_BASE_URL: '/api' }, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
