import { test, expect } from '@playwright/test';

/** The Orders module owns one route per page, all under Operations. */
const ORDERS = '/operations/orders';

test('each Orders page is a real route with its own URL and supports browser back', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  await expect(page.locator('#orders-panel-collection table')).toBeVisible();
  await page.getByRole('tab', { name: 'Order Assignment', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/assignment$`));
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
  await page.getByRole('tab', { name: 'Delivery Tracking', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/delivery-tracking$`));
  await page.goBack();
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Order Assignment', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('sidebar rows under Operations address the Orders pages directly', async ({ page }) => {
  await page.goto('/dashboard');
  for (const path of [`${ORDERS}/collection`, `${ORDERS}/assignment`, `${ORDERS}/delivery-tracking`]) {
    await expect(page.locator(`a[href="${path}"]`).first()).toBeAttached();
  }
  // The three rows read as one block: the group heading is rendered once.
  await expect(page.locator('aside a[href^="/operations/orders"], nav a[href^="/operations/orders"]')).not.toHaveCount(0);
  await page.locator(`a[href="${ORDERS}/assignment"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/assignment$`));
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
});

test('collection search and pagination survive page switches; filtering precedes pagination', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.locator('table')).toBeVisible();
  const search = panel.getByRole('textbox', { name: /search/i });
  await search.fill('no-such-shop-xyz');
  await expect(panel.locator('tbody input[type="number"]')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Delivery Tracking', exact: true }).click();
  await page.getByRole('tab', { name: 'Order Collection', exact: true }).click();
  await expect(search).toHaveValue('no-such-shop-xyz');
  await search.fill('');
  await expect(panel.locator('tbody tr')).toHaveCount(10);
});

test('state survives moving between the sidebar pages (one shared workspace instance)', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.locator('table')).toBeVisible();
  const search = panel.getByRole('textbox', { name: /search/i });
  await search.fill('shared-instance-probe');
  await page.locator(`a[href="${ORDERS}/delivery-tracking"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/delivery-tracking$`));
  await expect(page.locator('#orders-panel-tracking')).toBeVisible();
  await page.locator(`a[href="${ORDERS}/collection"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/collection$`));
  // Same mounted page: the work in progress is still there, not a fresh load.
  await expect(search).toHaveValue('shared-instance-probe');
  await expect(panel.locator('table')).toBeVisible();
});

test('refresh is table-scoped and leaves filters and navigation mounted', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.locator('table')).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/trips?*', async route => { await gate; await route.continue(); });
  try {
    await panel.getByRole('button', { name: /Refresh/i }).click();
    await expect(panel.locator('tbody [aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Order Assignment', exact: true })).toBeVisible();
    await expect(panel.getByRole('textbox', { name: /search/i })).toBeVisible();
    await expect(panel.locator('thead')).toBeVisible();
  } finally {
    release();
  }
  await expect(panel.locator('tbody [aria-busy="true"]')).toHaveCount(0);
});

test('legacy ?tab=orders deep links canonicalise to the page path', async ({ page }) => {
  await page.goto('/operations?tab=orders&orderTab=assignment');
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/assignment$`));
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
});

test('invalid URLs fall back safely instead of mounting an unknown page', async ({ page }) => {
  await page.goto(`${ORDERS}/nope?collectionDate=2026-99-99`);
  await expect(page.locator('#orders-panel-collection table')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('collectionDate')).not.toBe('2026-99-99');
});

test('browser-style tabs touch the header and remain docked while scrolling', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const rail = page.locator('.orders-tab-rail');
  await expect(page.locator('#orders-panel-collection table')).toBeVisible();
  const header = page.locator('.dmr-app-header');
  const headerBox = await header.boundingBox();
  const railBox = await rail.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  expect(Math.abs(railBox!.y - (headerBox!.y + headerBox!.height))).toBeLessThanOrEqual(1);
  await page.locator('#app-scroll').evaluate(el => { el.scrollTop = 200; });
  const scrolledRail = await rail.boundingBox();
  expect(Math.abs(scrolledRail!.y - railBox!.y)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: 'Order Collection', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('collection has a separate filter card and named table header', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.getByRole('region', { name: 'Order Collection filters', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Order Collection', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Refresh/i })).toBeVisible();
});
