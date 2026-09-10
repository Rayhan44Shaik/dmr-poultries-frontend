import { expect, test, type Page } from '@playwright/test';

const tabs = ['entry', 'history', 'emi', 'permits', 'analytics'] as const;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function assertHealthy(page: Page, tab: typeof tabs[number]) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto(`/fleet?tab=${tab}`, { waitUntil: 'networkidle' });
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
  await expect(page.locator('body')).not.toContainText(/preview data|sample data|demo data/i);
  await expect(page.locator('#root')).toBeVisible();

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
}

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport });
    for (const tab of tabs) {
      test(`${tab} loads from the live backend without runtime or layout errors`, async ({ page }) => {
        await assertHealthy(page, tab);
      });
    }
  });
}

test('keyboard navigation reaches an interactive control on every tab', async ({ page }) => {
  for (const tab of tabs) {
    await page.goto(`/fleet?tab=${tab}`, { waitUntil: 'networkidle' });
    const control = page.locator('button:not([disabled]):visible, a[href]:visible, input:not([disabled]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible').first();
    await expect(control).toBeVisible();
    await control.focus();
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLElement && el !== document.body;
    });
    expect(focused, `${tab} should expose a keyboard-focusable control`).toBeTruthy();
  }
});
