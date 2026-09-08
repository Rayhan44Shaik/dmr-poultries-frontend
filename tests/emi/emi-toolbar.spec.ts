import { test, expect, type Page } from '@playwright/test';
import { buildSampleEmiVehicles } from '../../scripts/fixtures/emi-vehicles.mjs';

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
  const status = await control(page).boundingBox();
  expect(status).not.toBeNull();
  const totals = page.locator('[data-emi-toolbar-row] dl > div');
  await expect(totals).toHaveCount(3);
  let right = status!.x + status!.width;
  for (const item of await totals.all()) {
    const box = (await item.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(right);
    expect(Math.abs(box.y + box.height / 2 - (status!.y + status!.height / 2))).toBeLessThan(1);
    right = box.x + box.width;
  }
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
    await route.fulfill({ json: new URL(route.request().url()).pathname === '/api/masters/vehicles' ? buildSampleEmiVehicles(today) : [] });
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
  const vehicleCells = rows(page).locator('td:first-child');
  const vehicleHeader = page.getByRole('columnheader', { name: 'Vehicle No', exact: true });
  await expect(vehicleHeader.getByRole('button')).toHaveCount(0);
  await expect(vehicleHeader.locator('svg')).toHaveCount(0);
  await expect(vehicleCells).toHaveText(registrations.slice(0, 10));
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(vehicleCells).toHaveText(registrations.slice(10));
  await page.getByRole('button', { name: 'Previous', exact: true }).click();

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
  await expect(control(page)).toHaveCSS('border-radius', '12px');
  expect((await control(page).boundingBox())!.width).toBe(224);
  await chooseStatus(page, 'Pending'); // Include the Clear button in the layout check.
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1050 });
    await expectInlineTotals(page);
    expect(await page.locator('[data-emi-toolbar-scroll]').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

test('status selection, search and Clear filter locally and preserve vehicle-level totals', async ({ page }) => {
  const initialGets = requests.get(page)!.length;
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await chooseStatus(page, 'Completed');
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page)).toContainText([/Completed/, /Completed/, /Completed/]);
  await expectInlineTotals(page);
  await control(page).click();
  await expect(page.getByRole('option', { name: 'Completed', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('option', { name: 'Completed', exact: true })).toHaveCSS('background-color', 'rgb(239, 246, 255)');
  await page.keyboard.press('Escape');

  await toolbar(page).getByRole('textbox', { name: 'Search', exact: true }).fill('TS 09');
  await expect(rows(page)).toHaveCount(1);
  await toolbar(page).getByRole('button', { name: 'Clear vehicle search', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await chooseStatus(page, 'Pending');
  await expect(rows(page)).toHaveCount(9);
  await toolbar(page).getByRole('textbox', { name: 'Search', exact: true }).fill('NO MATCH');
  await expect(page.getByText('No vehicles match the selected filters')).toBeVisible();
  await toolbar(page).getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(rows(page)).toHaveCount(10);
  await expect(control(page)).toHaveText('All statuses');
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  expect(requests.get(page)!.length).toBe(initialGets);

  const response = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/masters/vehicles');
  await toolbar(page).getByRole('button', { name: 'Refresh', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('status', { name: 'Refresh notification', exact: true })).toContainText('EMI data refreshed');
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
  const menuBox = (await menu.boundingBox())!;
  const toolbarBox = (await toolbar(page).boundingBox())!;
  expect(menuBox.x).toBeGreaterThanOrEqual(0);
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
  expect(menuBox.y + menuBox.height).toBeGreaterThan(toolbarBox.y + toolbarBox.height);
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
  const popup = page.getByRole('status', { name: 'రిఫ్రెష్ నోటిఫికేషన్', exact: true });
  await expect(popup).toContainText('EMI డేటా రిఫ్రెష్ చేయబడింది');
  await popup.getByRole('button').click();
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(control(page)).toHaveText('Pending');
  await expect(toolbar(page)).toBeVisible();
});

const sortableColumns = [
  { label: 'Purchase Amount', index: 1, value: (text: string) => Number(text.replace(/[₹,\s]/g, '')) },
  { label: 'Total EMI', index: 2, value: (text: string) => Number(text) },
  { label: 'Completed', index: 3, value: (text: string) => Number(text.split('/')[0].trim()) },
  { label: 'Pending', index: 4, value: (text: string) => Number(text) },
  { label: 'EMI Date', index: 5, value: (text: string) => Date.parse(text.replace('Sept', 'Sep')) },
  { label: 'Status', index: 6, value: (text: string) => text === 'Pending' ? 0 : text === 'Completed' ? 1 : NaN },
];

async function readTablePage(page: Page) {
  return rows(page).evaluateAll((elements) => elements.map((row) =>
    Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim() ?? ''),
  ));
}

async function readBothPages(page: Page) {
  const firstPage = await readTablePage(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  return [...firstPage, ...await readTablePage(page)];
}

test('every non-vehicle header has a visible sort icon directly beside its name', async ({ page }) => {
  await expect(page.locator('thead button')).toHaveCount(6);
  await expect(page.locator('thead [aria-sort]')).toHaveCount(0);
  for (const column of sortableColumns) {
    const header = page.getByRole('columnheader', { name: column.label, exact: true });
    const button = header.getByRole('button', { name: column.label, exact: true });
    const icon = button.locator('svg');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveClass(/lucide-arrow-up-down/);
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
  const originalRows = new Map(baseline.map((row) => [row[0], row]));

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
        await expect(header.locator('svg')).toHaveClass(direction === 'ascending' ? /(?:^|\s)lucide-arrow-up(?:\s|$)/ : /(?:^|\s)lucide-arrow-down(?:\s|$)/);
        await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
        await expect(rows(page)).toHaveCount(10);
        const sortedRows = await readBothPages(page);
        const factor = direction === 'ascending' ? 1 : -1;
        expect(sortedRows.map((row) => column.value(row[column.index])))
          .toEqual([...values].sort((a, b) => (a - b) * factor));
        expect(new Set(sortedRows.map((row) => row[0])).size).toBe(12);
        for (const row of sortedRows) expect(row).toEqual(originalRows.get(row[0]));
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
    const values = (await rows(page).locator('td:nth-child(3)').allTextContents()).map(Number);
    const factor = direction === 'ascending' ? 1 : -1;
    expect(values).toEqual([...values].sort((a, b) => (a - b) * factor));
    await expect(rows(page)).toHaveCount(7);
  }
  await expect(control(page)).toHaveText('Pending');
  await expect(toolbar(page).getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('AP');
  await expectInlineTotals(page);
  expect(requests.get(page)!.length).toBe(initialGets);
});
