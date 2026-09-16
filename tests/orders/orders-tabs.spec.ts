import { test, expect } from '@playwright/test';

test('each tab has a valid direct URL and supports browser back', async ({ page }) => {
  await page.goto('/operations?tab=orders&orderTab=collection');
  await expect(page.locator('#orders-panel-collection table')).toBeVisible();
  await page.getByRole('tab', { name: 'Order Assignment', exact: true }).click();
  await expect(page).toHaveURL(/orderTab=assignment/);
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
  await page.getByRole('tab', { name: 'Delivery Tracking', exact: true }).click();
  await expect(page).toHaveURL(/orderTab=tracking/);
  await page.goBack();
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Order Assignment', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('collection search and pagination survive tab switches; filtering precedes pagination', async ({ page }) => {
  await page.goto('/operations?tab=orders&orderTab=collection');
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

test('refresh is table-scoped and leaves filters and navigation mounted', async ({ page }) => {
  await page.goto('/operations?tab=orders&orderTab=collection');
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

test('invalid URLs fall back safely instead of mounting an unknown tab', async ({ page }) => {
  await page.goto('/operations?tab=orders&orderTab=invalid&collectionDate=2026-99-99');
  await expect(page.locator('#orders-panel-collection table')).toBeVisible();
  await expect(page).toHaveURL(/orderTab=collection/);
  expect(new URL(page.url()).searchParams.get('collectionDate')).not.toBe('2026-99-99');
});

test('browser-style tabs touch the header and remain docked while scrolling', async ({ page }) => {
  await page.goto('/operations?tab=orders&orderTab=collection');
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
  await page.goto('/operations?tab=orders&orderTab=collection');
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.getByRole('region', { name: 'Order Collection filters', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Order Collection', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Refresh/i })).toBeVisible();
});
