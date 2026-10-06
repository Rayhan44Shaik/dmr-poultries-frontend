/**
 * Session-security core flows in a real browser (see playwright.config.ts).
 *
 * Covers: single-request duplicate-login collapse, refresh/new-tab session
 * continuity, cross-tab logout propagation, offline tolerance, and 403/503
 * classification (no false logout). Each test uses an isolated browser
 * context. Probe account: e2e-probe-owner / E2E-Probe-Pass-123!
 */
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const USERNAME = 'e2e-probe-owner';
const PASSWORD = 'E2E-Probe-Pass-123!';

async function signInFresh(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#login-username').fill(USERNAME);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  return { context, page };
}

test('double-click login issues exactly one /auth/login request', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let loginPosts = 0;
  page.on('request', (request) => {
    if (request.url().includes('/auth/login') && request.method() === 'POST') loginPosts += 1;
  });
  await page.goto('/');
  await page.locator('#login-username').fill(USERNAME);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().dblclick();
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(3000);
  expect(loginPosts).toBe(1);
  await context.close();
});

test('refresh and new tab keep the session without re-login', async ({ browser }) => {
  const { context, page } = await signInFresh(browser);
  await page.reload();
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  const tabB = await context.newPage();
  await tabB.goto('/');
  await expect(tabB.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  await context.close();
});

test('logout in tab A signs out tab B', async ({ browser }) => {
  const { context, page: pageA } = await signInFresh(browser);
  const pageB = await context.newPage();
  await pageB.goto('/');
  await expect(pageB.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  await pageA.getByText('E2E Probe', { exact: false }).first().click();
  await pageA.getByRole('button', { name: /sign out|sign-out|logout/i }).click();
  await expect(pageA.locator('#login-username')).toHaveCount(1, { timeout: 20_000 });
  await expect(pageB.locator('#login-username')).toHaveCount(1, { timeout: 20_000 });
  await context.close();
});

test('offline reload does not log the user out', async ({ browser }) => {
  const { context, page } = await signInFresh(browser);
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(3000);
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  await context.setOffline(false);
  await context.close();
});

async function failedApiStaysSignedIn(browser: Browser, status: number) {
  const { context, page } = await signInFresh(browser);
  await page.route('**/api/**', async (route) => {
    if (route.request().url().includes('/auth/')) return route.continue();
    return route.fulfill({ status, body: '{}' });
  });
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });
  await context.close();
}

test('blanket API 403 does not log the user out', async ({ browser }) => {
  await failedApiStaysSignedIn(browser, 403);
});

test('blanket API 503 does not log the user out', async ({ browser }) => {
  await failedApiStaysSignedIn(browser, 503);
});
