import { test, expect } from '@playwright/test';

/** The Orders module owns one route per page, all under Operations. */
const ORDERS = '/operations/orders';
const PAGES = [`${ORDERS}/collection`, `${ORDERS}/assignment`, `${ORDERS}/delivery-tracking`] as const;

/** The sidebar is the switcher — there is deliberately no in-page tab strip. */
async function openViaSidebar(page: import('@playwright/test').Page, href: string) {
  await page.locator(`a[href="${href}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}$`));
}

test('each Orders page is its own URL, reachable by reload and by browser back', async ({ page }) => {
  await page.goto(PAGES[0]);
  await expect(page.locator('#orders-panel-collection table')).toBeVisible();

  await openViaSidebar(page, PAGES[1]);
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();

  await openViaSidebar(page, PAGES[2]);
  await expect(page.locator('#orders-panel-tracking')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${ORDERS}/assignment$`));
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();

  // A reload lands on the same page, not on the first one.
  await page.reload();
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
  await expect(page.locator(`a[href="${ORDERS}/assignment"]`).first()).toHaveClass(/font-semibold/);
});

test('no in-page switcher: three sibling routes, and only the sidebar moves between them', async ({ page }) => {
  for (const href of PAGES) {
    await page.goto(href);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.locator('.orders-tab-rail')).toHaveCount(0);
  }
  // Each URL mounts its own page and names it.
  await page.goto(`${ORDERS}/collection`);
  await expect(page.getByRole('heading', { name: 'Order Collection', exact: true }).first()).toBeVisible();
  await page.goto(`${ORDERS}/assignment`);
  await expect(page.getByRole('heading', { name: 'Order Assignment', exact: true }).first()).toBeVisible();
});

test('sidebar rows under Operations address the Orders pages directly', async ({ page }) => {
  await page.goto('/dashboard');
  for (const href of PAGES) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
  await openViaSidebar(page, `${ORDERS}/assignment`);
  await expect(page.locator('#orders-panel-assignment')).toBeVisible();
});

test('collection search and pagination survive page switches; filtering precedes pagination', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.locator('table')).toBeVisible();
  const search = panel.getByRole('textbox', { name: /search/i });
  await search.fill('no-such-shop-xyz');
  await expect(panel.locator('tbody input[type="number"]')).toHaveCount(0);
  await openViaSidebar(page, `${ORDERS}/delivery-tracking`);
  await openViaSidebar(page, `${ORDERS}/collection`);
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
  await openViaSidebar(page, `${ORDERS}/delivery-tracking`);
  await expect(page.locator('#orders-panel-tracking')).toBeVisible();
  await openViaSidebar(page, `${ORDERS}/collection`);
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
    await expect(page.locator(`a[href="${ORDERS}/assignment"]`).first()).toBeVisible();
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

test('each page stands on its own on a phone-width viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const byRoute: Record<string, string> = {
    [`${ORDERS}/collection`]: 'collection',
    [`${ORDERS}/assignment`]: 'assignment',
    [`${ORDERS}/delivery-tracking`]: 'tracking',
  };
  for (const [href, panel] of Object.entries(byRoute)) {
    await page.goto(href);
    await expect(page.locator(`#orders-panel-${panel}`).getByRole('table').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('collection has a separate filter card and named table header', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.getByRole('region', { name: 'Order Collection filters', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Order Collection', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Refresh/i })).toBeVisible();
});
