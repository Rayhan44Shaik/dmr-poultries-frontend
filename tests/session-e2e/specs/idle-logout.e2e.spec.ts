/**
 * Wall-clock idle logout in a real browser (see playwright.config.ts).
 *
 * Signs in and then performs ZERO interaction for 11.5 minutes. The only
 * timer that may fire is the guard's own 1 s read-only tick. Expected: the
 * session expires server-side at 10 minutes of genuine inactivity and the UI
 * lands on the sign-in screen with the idle notice. Run in isolation (no
 * other pages/tabs open — sibling activity would legitimately extend the
 * session via the cross-tab bus). Probe account: e2e-probe-owner.
 */
import { expect, test } from '@playwright/test';

const USERNAME = 'e2e-probe-owner';
const PASSWORD = 'E2E-Probe-Pass-123!';

test.setTimeout(15 * 60 * 1000);

test('fully idle browser is signed out after the 10-minute deadline', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#login-username').fill(USERNAME);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 20_000 });

  // Genuine inactivity: no mouse, keyboard, touch, or form events from here.
  await page.waitForTimeout(11.5 * 60 * 1000);

  await expect(page.locator('#login-username')).toHaveCount(1, { timeout: 60_000 });
  const reason = await page.evaluate(() => {
    try {
      return sessionStorage.getItem('dmr:signout-reason');
    } catch {
      return null;
    }
  });
  expect(reason).toBe('idle');
  await context.close();
});
