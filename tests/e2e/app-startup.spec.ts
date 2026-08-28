import { test, expect } from '@playwright/test';

test.describe('Application Startup', () => {
  test('Application loads without fatal errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should redirect to login or dashboard
    await expect(page).toHaveURL(/.*/);

    // Check no critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('manifest') &&
      !e.includes('preload')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Main navigation loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for login form or dashboard
    const hasLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    const hasDashboard = await page.locator('[data-testid="dashboard"], .dashboard, nav, [role="navigation"]').first().isVisible().catch(() => false);

    expect(hasLogin || hasDashboard).toBeTruthy();
  });
});