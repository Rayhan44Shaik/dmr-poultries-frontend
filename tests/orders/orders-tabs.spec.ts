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

test('collection keeps one action only — Save Progress — and the deadline speaks for itself', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  await expect(panel.locator('table')).toBeVisible();

  // No Cancel, no manual Finish: a day is filed by its own window, not by a
  // button, so the only commit control on the screen is Save Progress.
  await expect(panel.getByRole('button', { name: /finish collection/i })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /^cancel$/i })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /save progress/i })).toBeVisible();
  // And the screen says when it will submit itself: "Auto-submits DD/MM 12:00 AM".
  await expect(panel.getByText(/auto-submits \d{2}\/\d{2}/).first()).toBeVisible();
});

test('collection columns are collection-only, and every header carries its icon', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const head = page.locator('#orders-panel-collection thead th');
  await expect(head).toHaveCount(8);
  const labels = (await head.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
  expect(labels).toEqual([
    'S.No',
    'Shop Name',
    'City',
    'No. of Birds',
    'No. of Boxes',
    'Weight',
    'Status',
    'Action',
  ]);
  // One glyph per column, in the same 14px size the Trip List headers use.
  await expect(page.locator('#orders-panel-collection thead th svg')).toHaveCount(8);
});

test('the day total is a cumulative line below the table, not a header KPI', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const panel = page.locator('#orders-panel-collection');
  const cumulative = panel.getByText(/^Orders taken in \d+ shops$/);
  await expect(cumulative).toBeVisible();
  const total = await cumulative.boundingBox();
  const table = await panel.locator('table').first().boundingBox();
  expect(total && table && total.y > table.y + table.height - 8).toBe(true);
  // The old header summary ("N shops · N boxes · N birds") is gone from here —
  // that wording now belongs to the Assignment page only.
  await expect(panel.getByText(/\d+ shops · \d+ boxes/)).toHaveCount(0);
});

test('filters sit in the Trip List order: day and city above sort, search and reset', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  const card = page.getByRole('region', { name: 'Order Collection filters' });
  const field = (name: string) => card.getByText(name, { exact: true }).first();
  const box = async (name: string) => await field(name).boundingBox();
  const [date, city, sort, search] = await Promise.all([
    box('Date'),
    box('City'),
    box('Sort'),
    box('Search'),
  ]);
  expect(date && city && sort && search).toBeTruthy();
  // Row 1 — the two fields that decide which day and which area.
  expect(Math.abs(date!.y - city!.y) <= 2).toBe(true);
  // Row 2 — sort then search, left to right, below row 1.
  expect(sort!.y > date!.y).toBe(true);
  expect(Math.abs(sort!.y - search!.y) <= 2).toBe(true);
  expect(sort!.x < search!.x).toBe(true);
  // Reset + Refresh close that second row, right-aligned and baseline-matched.
  const actions = card.getByRole('button', { name: 'Reset', exact: true });
  const reset = await actions.boundingBox();
  const refresh = await card.getByRole('button', { name: /Refresh/i }).boundingBox();
  expect(reset && refresh).toBeTruthy();
  expect(Math.abs(refresh!.y - reset!.y) <= 2).toBe(true);
  expect(refresh!.x > reset!.x).toBe(true);
  expect(Math.abs(reset!.y + reset!.height - (search!.y + search!.height)) <= 6).toBe(true);
});

test('the header breadcrumb names the module and the page', async ({ page }) => {
  await page.goto(`${ORDERS}/collection`);
  // Operations › Orders › Collection — the group is its own crumb, so a short
  // row name ("Collection") is never ambiguous.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Collection');
  const crumbs = page.locator('header').first().getByRole('link');
  await expect(crumbs.filter({ hasText: 'Operations' }).first()).toBeVisible();
  await expect(crumbs.filter({ hasText: /^Orders$/ }).first()).toHaveAttribute(
    'href',
    new RegExp(`${ORDERS}/collection$`)
  );
});

test('the sidebar names the rows Collection / Assignment / Delivery', async ({ page }) => {
  await page.goto('/dashboard');
  const names = await page
    .locator(`a[href^="${ORDERS}/"]`)
    .evaluateAll((links) => [...new Set(links.map((link) => link.textContent!.trim()))]);
  expect(names).toEqual(['Collection', 'Assignment', 'Delivery']);
});
