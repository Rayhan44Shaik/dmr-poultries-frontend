import { expect, test } from '@playwright/test';

test('Operations lazy route loads without stale optimized dependencies', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });

  const response = await page.goto('/operations', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/failed to fetch dynamically imported module/i);
  expect(failures).toEqual([]);
});
