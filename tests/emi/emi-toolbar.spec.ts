import { test, expect, type Page } from '@playwright/test';
import { buildSampleEmiVehicles, vehiclesToEmiLoans } from '../../scripts/fixtures/emi-vehicles.mjs';

const today = new Date('2026-09-08T12:00:00+05:30');
const errors = new WeakMap<Page, string[]>();
const requests = new WeakMap<Page, string[]>();
const toolbar = (page: Page) => page.getByRole('region', { name: 'EMI filters and vehicle totals' });
const control = (page: Page) => page.locator('.emi-status__control');
const rows = (page: Page) => page.locator('main tbody tr');

async function chooseStatus(page: Page, label: string) {
  await control(page).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

async function expectInlineTotals(page: Page) {
  // The totals strip keeps all three counters on one horizontal line, in
  // order, regardless of viewport (narrow screens scroll the strip instead).
  // All boxes are read in ONE pass so the tab's entrance pop animation can
  // never skew a sequential measurement.
  const totals = page.locator('[data-emi-toolbar-row] dl > div');
  await expect(totals).toHaveCount(3);
  await expect(async () => {
    const boxes = await totals.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, right: box.right, middle: box.y + box.height / 2 };
    }));
    let right = -Infinity;
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(right);
      expect(Math.abs(box.middle - boxes[0].middle)).toBeLessThan(1);
      right = box.right;
    }
  }).toPass({ timeout: 10_000 });
  await expect(page.locator('[data-emi-toolbar-row] dd')).toHaveText(['12', '3', '9']);
}

test.beforeEach(async ({ page }) => {
  const pageErrors: string[] = [];
  const methods: string[] = [];
  errors.set(page, pageErrors);
  requests.set(page, methods);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /ErrorBoundary|must be used within/.test(message.text())) pageErrors.push(message.text());
  });
  await page.clock.setFixedTime(today);
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    methods.push(route.request().method());
    // The EMI page reads GET /api/fleet/emis (the loans DTO); the fixture is
    // derived from the same 12 sample vehicles so KPIs remain 12/3/9.
    await route.fulfill({ json: new URL(route.request().url()).pathname === '/api/fleet/emis' ? vehiclesToEmiLoans(buildSampleEmiVehicles(today), today) : [] });
  });
  await page.goto('/fleet?tab=emi');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  await expect(rows(page)).toHaveCount(10);
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(requests.get(page)?.every((method) => method === 'GET')).toBe(true);
});

test('Vehicle No shows registrations directly without a sort control', async ({ page }) => {
  const registrations = buildSampleEmiVehicles(today)
    .map((vehicle) => vehicle.vehicleNumber)
    .sort((a, b) => a.localeCompare(b));
  // Column 1 is S.No (the Trip List's leading serial column); registrations
  // live in column 2 with the Trip List's decorative truck glyph — still no
  // sort control on this column.
  const vehicleCells = rows(page).locator('td:nth-child(2)');
  const vehicleHeader = page.getByRole('columnheader', { name: 'Vehicle No', exact: true });
  await expect(vehicleHeader.getByRole('button')).toHaveCount(0);
  await expect(vehicleHeader.locator('svg')).toHaveCount(1);
  await expect(vehicleHeader.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(vehicleCells).toHaveText(registrations.slice(0, 10));
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(vehicleCells).toHaveText(registrations.slice(10));
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();

  const search = toolbar(page).getByRole('textbox', { name: 'Search', exact: true });
  await search.fill('12');
  // Vehicle 12's registration does not contain 12, so its hidden ID must not match.
  await expect(vehicleCells).toHaveText(registrations.filter((registration) => registration.includes('12')));
  await search.fill('ap 16 tc 4101');
  await expect(vehicleCells).toHaveText(['AP 16 TC 4101']);
});

test('Department-style control and all vehicle totals share a single desktop line', async ({ page }) => {
  await expect(toolbar(page).locator('select')).toHaveCount(0);
  await expect(control(page)).toHaveCSS('height', '36px');
  // rounded-xl resolves through the design tokens (--radius-xl = 0.625rem).
  await expect(control(page)).toHaveCSS('border-radius', '10px');
  // The status control now fills its Trip-List grid column instead of a
  // fixed 224px box; it must stay a comfortably wide desktop control.
  expect((await control(page).boundingBox())!.width).toBeGreaterThanOrEqual(200);
  await chooseStatus(page, 'Pending'); // Include the Clear button in the layout check.
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1050 });
    await expectInlineTotals(page);
    expect(await page.locator('[data-emi-toolbar-scroll]').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

test('status selection, search and Clear filter locally and preserve vehicle-level totals', async ({ page }) => {
  const initialGets = requests.get(page)!.length;
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await chooseStatus(page, 'Completed');
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page)).toContainText([/Completed/, /Completed/, /Completed/]);
  await expectInlineTotals(page);
  await control(page).click();
  await expect(page.getByRole('option', { name: 'Completed', exact: true })).toHaveAttribute('aria-selected', 'true');
  // The app-wide MasterDropdown highlights the selected row emerald (the
  // brand treatment), not the old bespoke blue.
  await expect(page.getByRole('option', { name: 'Completed', exact: true })).toHaveClass(/bg-emerald-50/);
  await page.keyboard.press('Escape');

  await toolbar(page).getByRole('textbox', { name: 'Search', exact: true }).fill('TS 09');
  await expect(rows(page)).toHaveCount(1);
  await toolbar(page).getByRole('button', { name: 'Clear vehicle search', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await chooseStatus(page, 'Pending');
  await expect(rows(page)).toHaveCount(9);
  await toolbar(page).getByRole('textbox', { name: 'Search', exact: true }).fill('NO MATCH');
  await expect(page.getByText('No vehicles match the selected filters')).toBeVisible();
  await toolbar(page).getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(rows(page)).toHaveCount(10);
  await expect(control(page)).toHaveText('All statuses');
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
  expect(requests.get(page)!.length).toBe(initialGets);

  const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/fleet/emis');
  await toolbar(page).getByRole('button', { name: 'Refresh', exact: true }).click();
  expect((await response).status()).toBe(200);
  // The refresh receipt now arrives through the global notification host.
  await expect(page.getByRole('status').filter({ hasText: 'EMI data refreshed' })).toBeVisible();
  expect(requests.get(page)!.length).toBe(initialGets + 1);
});

test('the status dropdown supports keyboard selection, Escape and outside clicks', async ({ page }) => {
  const input = page.getByRole('combobox', { name: 'Status', exact: true });
  await input.focus();
  await input.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await input.press('End');
  await input.press('Enter');
  await expect(rows(page)).toHaveCount(3);
  await expect(control(page)).toHaveText('Completed');
  await control(page).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(input).toBeFocused();
  await control(page).click();
  await page.getByRole('heading', { name: 'EMI Schedule', exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(control(page)).toHaveText('Completed');
});

test('small screens keep the totals inline and the dropdown escapes the scrolling toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expectInlineTotals(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('[data-emi-toolbar-scroll]').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await control(page).scrollIntoViewIfNeeded();
  await control(page).click();
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  // The menu is portalled to the body: it opens fully on-screen, below its
  // control, and can never be clipped by the totals' scroll container.
  const menuBox = (await menu.boundingBox())!;
  const controlBox = (await control(page).boundingBox())!;
  expect(menuBox.x).toBeGreaterThanOrEqual(0);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
  expect(menuBox.y).toBeGreaterThanOrEqual(controlBox.y + controlBox.height - 1);
  await page.getByRole('option', { name: 'Completed', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
});

test('Telugu labels, status options and inline totals work without a provider error', async ({ page }) => {
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await page.getByRole('button', { name: 'తెలుగు', exact: true }).click();
  const filters = page.getByRole('region', { name: 'EMI ఫిల్టర్లు మరియు వాహనాల మొత్తం' });
  await expect(filters).toBeVisible();
  await expect(filters.locator('dt')).toHaveText(['మొత్తం వాహనాలు', 'పూర్తయిన EMI వాహనాలు', 'పెండింగ్ EMI వాహనాలు']);
  await chooseStatus(page, 'పెండింగ్');
  await expect(rows(page)).toHaveCount(9);
  const purchaseHeader = page.getByRole('columnheader', { name: 'కొనుగోలు మొత్తం', exact: true });
  await purchaseHeader.getByRole('button').click();
  await expect(purchaseHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(purchaseHeader.getByRole('button')).toHaveAttribute('title', 'కొనుగోలు మొత్తం · ఆరోహణ');
  await expectInlineTotals(page);
  await page.getByRole('button', { name: 'రిఫ్రెష్', exact: true }).click();
  const popup = page.getByRole('status').filter({ hasText: 'EMI డేటా రిఫ్రెష్ చేయబడింది' });
  await expect(popup).toBeVisible();
  await popup.getByRole('button').click();
  // The header control is itself localized while Telugu is active.
  await page.getByRole('button', { name: 'భాష మార్చండి', exact: true }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(control(page)).toHaveText('Pending');
  await expect(toolbar(page)).toBeVisible();
});

// Cell indexes are shifted one right by the leading S.No serial column.
const sortableColumns = [
  { label: 'Purchase Amount', index: 2, value: (text: string) => Number(text.replace(/[₹,\s]/g, '')) },
  { label: 'Total EMI', index: 3, value: (text: string) => Number(text) },
  { label: 'Completed', index: 4, value: (text: string) => Number(text.split('/')[0].trim()) },
  { label: 'Pending', index: 5, value: (text: string) => Number(text) },
  { label: 'EMI Date', index: 6, value: (text: string) => Date.parse(text.replace('Sept', 'Sep')) },
  { label: 'Status', index: 7, value: (text: string) => text === 'Pending' ? 0 : text === 'Completed' ? 1 : NaN },
];

async function readTablePage(page: Page) {
  return rows(page).evaluateAll((elements) => elements.map((row) =>
    Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim() ?? ''),
  ));
}

async function readBothPages(page: Page) {
  const firstPage = await readTablePage(page);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  return [...firstPage, ...await readTablePage(page)];
}

test('every non-vehicle header has a visible sort icon directly beside its name', async ({ page }) => {
  await expect(page.locator('thead button')).toHaveCount(6);
  await expect(page.locator('thead [aria-sort]')).toHaveCount(0);
  for (const column of sortableColumns) {
    const header = page.getByRole('columnheader', { name: column.label, exact: true });
    const button = header.getByRole('button', { name: column.label, exact: true });
    // Each header button now holds a decorative colour glyph before the
    // label and the sort arrow after it — assert the sort arrow explicitly.
    const icon = button.locator('svg.lucide-arrow-up-down');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    const labelBox = (await button.locator('span').boundingBox())!;
    const iconBox = (await icon.boundingBox())!;
    expect(iconBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
    expect(Math.abs(iconBox.y + iconBox.height / 2 - (labelBox.y + labelBox.height / 2))).toBeLessThan(1);
  }
});

test('all non-vehicle columns sort both ways across the full result set and return to page one', async ({ page }) => {
  const initialGets = requests.get(page)!.length;
  const baseline = await readBothPages(page);
  // Key rows by registration (cell 2) and ignore the leading S.No cell: the
  // serial always reads 1..n in display order, whatever the sort.
  const rowKey = (row: string[]) => row[1];
  const rowData = (row: string[]) => row.slice(1);
  const originalRows = new Map(baseline.map((row) => [rowKey(row), rowData(row)]));

  for (const column of sortableColumns) {
    await test.step(column.label, async () => {
      const values = baseline.map((row) => column.value(row[column.index]));
      expect(values.every(Number.isFinite)).toBe(true);
      const directions = column.label === 'Status'
        ? ['ascending', 'descending'] as const
        : ['descending', 'ascending'] as const;
      for (const direction of directions) {
        const header = page.getByRole('columnheader', { name: column.label, exact: true });
        await header.getByRole('button').click();
        await expect(header).toHaveAttribute('aria-sort', direction);
        await expect(page.locator('thead [aria-sort]')).toHaveCount(1);
        await expect(header.getByRole('button')).toHaveClass(/bg-emerald-50/);
        // Headers now carry a decorative colour glyph too; assert on the
        // direction arrow specifically.
        await expect(header.locator(direction === 'ascending' ? 'svg.lucide-arrow-up' : 'svg.lucide-arrow-down')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
        await expect(rows(page)).toHaveCount(10);
        const sortedRows = await readBothPages(page);
        const factor = direction === 'ascending' ? 1 : -1;
        expect(sortedRows.map((row) => column.value(row[column.index])))
          .toEqual([...values].sort((a, b) => (a - b) * factor));
        expect(new Set(sortedRows.map(rowKey)).size).toBe(12);
        for (const row of sortedRows) expect(rowData(row)).toEqual(originalRows.get(rowKey(row)));
        // The serial column always re-counts 1..12 in display order.
        expect(sortedRows.map((row) => row[0])).toEqual(sortedRows.map((_, i) => String(i + 1)));
      }
    });
  }
  expect(requests.get(page)!.length).toBe(initialGets);
});

test('keyboard sorting preserves status/search filters and vehicle totals', async ({ page }) => {
  const initialGets = requests.get(page)!.length;
  await chooseStatus(page, 'Pending');
  await toolbar(page).getByRole('textbox', { name: 'Search', exact: true }).fill('AP');
  await expect(rows(page)).toHaveCount(7);
  const header = page.getByRole('columnheader', { name: 'Total EMI', exact: true });
  const button = header.getByRole('button');
  await button.focus();
  for (const [key, direction] of [['Enter', 'descending'], ['Space', 'ascending']]) {
    await button.press(key);
    await expect(header).toHaveAttribute('aria-sort', direction);
    const values = (await rows(page).locator('td:nth-child(4)').allTextContents()).map(Number);
    const factor = direction === 'ascending' ? 1 : -1;
    expect(values).toEqual([...values].sort((a, b) => (a - b) * factor));
    await expect(rows(page)).toHaveCount(7);
  }
  await expect(control(page)).toHaveText('Pending');
  await expect(toolbar(page).getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('AP');
  await expectInlineTotals(page);
  expect(requests.get(page)!.length).toBe(initialGets);
});
