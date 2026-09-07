import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { TEST_LEAVES, TEST_TODAY, testAssignment, testLeave, testWeek } from './fixtures';

const pageErrors = new WeakMap<Page, string[]>();
const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download Excel', exact: true });
const matrix = (page: Page) => page.getByRole('table', { name: 'Duty Planner date matrix' });
const filterBar = (page: Page) => page.getByRole('region', { name: 'Duty Planner filters' });
const weekTable = (page: Page) => page.getByRole('table', { name: 'Duty Planner week table' });

async function setCustomRange(page: Page, from: string, to: string) {
  await page.getByRole('button', { name: 'Custom range', exact: true }).click();
  // The shared picker accepts DD/MM/YYYY. Set the end first so an older
  // period does not briefly request every week up to the current month.
  await page.getByLabel('To date').fill(to);
  await page.getByLabel('To date').press('Enter');
  await page.getByLabel('From date').fill(from);
  await page.getByLabel('From date').press('Enter');
}

async function downloadWorkbook(page: Page) {
  await expect(downloadButton(page)).toBeEnabled();
  const pendingDownload = page.waitForEvent('download');
  await downloadButton(page).click();
  const download = await pendingDownload;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  await expect(page.getByRole('button', { name: 'Close notification' })).toBeVisible();
  await page.getByRole('button', { name: 'Close notification' }).click();
  return { workbook, filename: download.suggestedFilename() };
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date(`${TEST_TODAY}T12:00:00+05:30`));
  await page.addInitScript(() => {
    localStorage.setItem('dmr_auth_user', JSON.stringify({ id: 'duty-test', name: 'Duty Export Test', role: 'Admin' }));
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    // Browser-facing requests must stay on the Vite origin, not :4000.
    expect(url.origin).toBe('http://127.0.0.1:5198');
    if (url.pathname === '/api/staff/duty-planner') {
      await route.fulfill({ json: testWeek(url.searchParams.get('weekStart')!) });
    } else if (url.pathname === '/api/staff/leaves') {
      await route.fulfill({ json: { items: TEST_LEAVES, total: TEST_LEAVES.length, page: 1, limit: 200, totalPages: 1 } });
    } else {
      await route.fulfill({ json: { items: [], total: 0 } });
    }
  });
  await page.goto('/staff?tab=duty-planner');
  await expect(downloadButton(page)).toBeEnabled();
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test('period, role, search and Excel actions share one filter panel with Download beside Reset', async ({ page }) => {
  const filters = filterBar(page);
  await expect(filters).toHaveCount(1);
  await expect(filters.getByRole('button', { name: 'Week', exact: true })).toBeVisible();
  await expect(filters.getByRole('button', { name: 'Filter employee roles' })).toBeVisible();
  await expect(filters.getByRole('textbox', { name: 'Search employees' })).toBeVisible();
  const actions = filters.getByRole('group', { name: 'Duty Planner actions' });
  await expect(actions.getByRole('button')).toHaveText(['Reset', 'Download Excel']);
  await expect(page.getByRole('region', { name: 'Duty Planner Excel report' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Duty Planner report', exact: true })).toHaveCount(0);
  await expect(page.getByText('Excel: employees in rows, dates across columns, Duty Count last, and grand totals. Includes a Daily Details sheet.')).toHaveCount(0);

  await filters.getByRole('button', { name: 'Custom range', exact: true }).click();
  await expect(filters.getByLabel('From date')).toBeVisible();
  await expect(filters.getByLabel('To date')).toBeVisible();
  await expect(filters.getByRole('button', { name: 'Download Excel', exact: true })).toBeEnabled();
});

test('monthly PDF is replaced by a styled Excel with date columns and matching counts', async ({ page }) => {
  await expect(page.getByRole('button', { name: /PDF/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  const table = matrix(page);
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader')).toHaveCount(36); // employee + 30 dates + 5 counts
  await expect(table.getByRole('columnheader').last()).toHaveText('Duty Count');
  await expect(table.locator('tbody tr')).toHaveCount(3); // default crew-role filter; Accountant omitted
  await expect(table.locator('tbody tr').filter({ hasText: 'Ravi Kumar' }).getByRole('cell').last()).toHaveText('4');
  await expect(table.locator('tbody tr').filter({ hasText: 'Lakshmi Devi' }).getByRole('cell').last()).toHaveText('6');
  await expect(table.locator('tfoot tr').getByRole('cell').last()).toHaveText('10');

  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-09-01-to-2026-09-30.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell(7, sheet.columnCount).value).toBe('Duty Count');
  expect((sheet.getCell('E7').value as Date).toISOString().slice(0, 10)).toBe('2026-09-01');
  expect((sheet.getCell(7, 34).value as Date).toISOString().slice(0, 10)).toBe('2026-09-30');
  expect([8, 9, 10].map((row) => sheet.getCell(row, 2).value)).toEqual(['Ravi Kumar', 'Lakshmi Devi', 'Mohan Helper']);
  expect([8, 9, 10].map((row) => sheet.getCell(row, sheet.columnCount).value)).toEqual([4, 6, 0]);
  expect(sheet.getCell(11, sheet.columnCount).result).toBe(10);
  expect(workbook.getWorksheet('Daily Details')).toBeDefined();
  expect(sheet.views[0].state).toBe('frozen');
});

test('cross-year custom ranges export exactly both boundaries and only matching employees', async ({ page }) => {
  await setCustomRange(page, '30/12/2025', '03/01/2026');
  await expect(matrix(page).getByRole('columnheader')).toHaveCount(11);
  await expect(filterBar(page).getByLabel('From date')).toHaveValue('30/12/2025');
  await expect(filterBar(page).getByLabel('To date')).toHaveValue('03/01/2026');
  await page.getByPlaceholder('Search employee name...').fill('  rAvI  ');
  await expect(matrix(page).locator('tbody tr')).toHaveCount(1);
  await expect(matrix(page).locator('tbody tr').getByRole('cell').last()).toHaveText('2');
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2025-12-30-to-2026-01-03.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.columnCount).toBe(14);
  expect(sheet.getCell('B8').value).toBe('Ravi Kumar');
  expect(sheet.getCell('A9').value).toBe('GRAND TOTAL / DAILY DUTY');
  expect((sheet.getCell('E7').value as Date).toISOString().slice(0, 10)).toBe('2025-12-30');
  expect((sheet.getCell('I7').value as Date).toISOString().slice(0, 10)).toBe('2026-01-03');
  expect(sheet.getCell('I8').value).toBe('Office Duty'); // end boundary is included
  expect(sheet.getCell('N8').value).toBe(2);
  expect(sheet.getCell('N9').result).toBe(2);
  expect(workbook.getWorksheet('Daily Details')!.rowCount).toBe(13); // 5 detail rows + heading + total
});

test('missing/reversed ranges and empty employee filters cannot export stale data', async ({ page }) => {
  await page.getByRole('button', { name: 'Custom range', exact: true }).click();
  await page.getByLabel('From date').fill('');
  await page.getByLabel('From date').press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Select both a from date and a to date.' })).toBeVisible();
  await expect(downloadButton(page)).toBeDisabled();
  await page.getByLabel('From date').fill('08/09/2026');
  await page.getByLabel('From date').press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'The to date must be on or after the from date.' })).toBeVisible();
  await expect(downloadButton(page)).toBeDisabled();
  await setCustomRange(page, '01/09/2026', '07/09/2026');
  await expect(downloadButton(page)).toBeEnabled();
  await page.getByPlaceholder('Search employee name...').fill('no such employee');
  await expect(downloadButton(page)).toBeDisabled();
  await expect(filterBar(page)).toContainText('No employees match');
  await page.getByPlaceholder('Search employee name...').fill('');
  await expect(downloadButton(page)).toBeEnabled();
});

test('week exports use that week, keep planned duties visible and exclude them from the count', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-09-07-to-2026-09-13.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.columnCount).toBe(16);
  expect(sheet.getCell('E8').value).toBe('Duty');
  expect(sheet.getCell('F8').value).toBe('Leave\n(Planned)');
  expect(sheet.getCell('P8').value).toBe(1);
  expect(sheet.getCell('P9').value).toBe(1);
  expect(sheet.getCell('P10').value).toBe(0);
  expect(sheet.getCell('P11').result).toBe(2);
});

test('Excel uses the visible table rows and role filters, not a larger hidden report roster', async ({ page }) => {
  await page.route('**/api/staff/duty-planner?*', async (route) => {
    const monday = new URL(route.request().url()).searchParams.get('weekStart')!;
    const week = testWeek(monday);
    // Historical duties can belong to someone no longer on the editable week
    // roster. They appear in the monthly report, but not in the weekly table.
    week.assignments.push({ ...testAssignment(1, monday, 'Delivery'), id: `former-${monday}`, employeeId: 99, employeeName: 'Former Driver' });
    await route.fulfill({ json: week });
  });
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  const filters = filterBar(page);
  await filters.getByRole('button', { name: 'Filter employee roles' }).click();
  for (const role of ['Supervisor', 'Helper', 'Loader']) {
    await filters.getByRole('checkbox', { name: role, exact: true }).uncheck();
  }
  await filters.getByRole('button', { name: 'Filter employee roles' }).click();
  await expect(weekTable(page).locator('tbody tr')).toHaveCount(1);
  await expect(weekTable(page)).not.toContainText('Former Driver');
  const visibleNames = await weekTable(page).locator('tbody tr td:first-child span:first-child').allTextContents();
  const weekly = (await downloadWorkbook(page)).workbook.getWorksheet('Duty Planner')!;
  expect([weekly.getCell('B8').value]).toEqual(visibleNames);
  expect(weekly.getCell('A9').value).toBe('GRAND TOTAL / DAILY DUTY');
  expect(weekly.getCell('P9').result).toBe(1);

  await filters.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(matrix(page).locator('tbody tr')).toHaveCount(2);
  await expect(matrix(page)).toContainText('Former Driver');
  const monthlyNames = await matrix(page).locator('tbody th[scope="row"] > div:first-child').allTextContents();
  const monthly = (await downloadWorkbook(page)).workbook.getWorksheet('Duty Planner')!;
  expect([monthly.getCell('B8').value, monthly.getCell('B9').value]).toEqual(monthlyNames);
  expect(monthly.getCell('A10').value).toBe('GRAND TOTAL / DAILY DUTY');
  expect(monthly.getCell(10, monthly.columnCount).result).toBe(5);
});

test('Download beside Reset exports the latest saved duty shown in the table', async ({ page }) => {
  await page.route('**/api/staff/duty-planner/*', async (route) => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    const input = route.request().postDataJSON() as { employeeId: number; date: string; dutyType: string };
    const week = testWeek(TEST_TODAY);
    week.assignments = week.assignments.map((assignment) => assignment.employeeId === input.employeeId && assignment.date === input.date
      ? { ...assignment, dutyType: input.dutyType } : assignment);
    await route.fulfill({ json: week });
  });
  const ravi = weekTable(page).locator('tbody tr').filter({ hasText: 'Ravi Kumar' });
  await ravi.getByRole('button', { name: 'Duty', exact: true }).click();
  const picker = page.locator('div.fixed').filter({ has: page.getByText('Select duty for', { exact: true }) });
  await picker.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('button', { name: 'Close notification' }).click();
  await expect(ravi.getByRole('button').first()).toHaveText('Leave');
  const { workbook } = await downloadWorkbook(page);
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell('E8').value).toBe('Leave');
  expect(sheet.getCell('L8').value).toBe(1);
  expect(sheet.getCell('P8').value).toBe(0);
  expect(sheet.getCell('P11').result).toBe(1);
});

test('approved leave in the week grid and in Excel uses the same live records', async ({ page }) => {
  await page.route('**/api/staff/leaves?*', (route) => route.fulfill({
    json: { items: [testLeave(4, TEST_TODAY)], total: 1, page: 1, limit: 200, totalPages: 1 },
  }));
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  await expect(page.getByRole('row').filter({ hasText: 'Mohan Helper' }).getByRole('button', { name: 'Leave', exact: true })).toBeVisible();
  const { workbook } = await downloadWorkbook(page);
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell('E10').value).toBe('Leave');
  expect(sheet.getCell('L10').value).toBe(1);
  expect(sheet.getCell('P10').value).toBe(0);
});

test('a failed range never exports partial data, and retry reloads the requested range', async ({ page }) => {
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(matrix(page)).toBeVisible();
  let fail = true;
  await page.route('**/api/staff/duty-planner?*', async (route) => {
    const monday = new URL(route.request().url()).searchParams.get('weekStart')!;
    if (fail && monday === '2026-10-05') {
      await route.fulfill({ status: 503, json: { error: 'Test week unavailable' } });
    } else {
      await route.fulfill({ json: testWeek(monday) });
    }
  });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(downloadButton(page)).toBeDisabled();
  await expect(filterBar(page)).toContainText('Could not load the full report.');
  await expect(matrix(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close notification' }).click();
  fail = false;
  await page.getByRole('button', { name: 'Retry report' }).click();
  await expect(matrix(page)).toBeVisible();
  await expect(filterBar(page)).toContainText('October 2026');
  await expect(matrix(page).getByRole('columnheader').nth(1)).toContainText('01 Oct 2026');
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-10-01-to-2026-10-31.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell(11, sheet.columnCount).result).toBe(0); // entire month is future
});

test('a late response from a previous month cannot overwrite the newly selected month', async ({ page }) => {
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(matrix(page)).toBeVisible();
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const heldRequest = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/api/staff/duty-planner?*', async (route) => {
    const monday = new URL(route.request().url()).searchParams.get('weekStart')!;
    if (monday === '2026-10-05') { requested(); await gate; }
    await route.fulfill({ json: testWeek(monday) });
  });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await heldRequest;
  await expect(downloadButton(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(filterBar(page)).toContainText('November 2026');
  await expect(matrix(page)).toBeVisible();
  const lateResponse = page.waitForResponse((response) => response.url().includes('weekStart=2026-10-05'));
  release();
  await lateResponse;
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-11-01-to-2026-11-30.xlsx');
  expect((workbook.getWorksheet('Duty Planner')!.getCell('E7').value as Date).toISOString().slice(0, 10)).toBe('2026-11-01');
});

test('sample fallback is clearly labelled in the downloaded Excel', async ({ page }) => {
  await page.route('**/api/staff/duty-planner?*', (route) => route.fulfill({ status: 503, json: { error: 'Backend unavailable for test' } }));
  await page.reload();
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close notification' }).click();
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toContain('-SAMPLE.xlsx');
  expect(String(workbook.getWorksheet('Duty Planner')!.getCell('A1').value)).toMatch(/^SAMPLE DATA/);
  expect(String(workbook.getWorksheet('Duty Planner')!.getCell('A3').value)).toContain('not live staff records');
});

test('custom range controls and Excel action remain usable on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setCustomRange(page, '01/09/2026', '07/09/2026');
  await downloadButton(page).scrollIntoViewIfNeeded();
  await expect(downloadButton(page)).toBeVisible();
  await expect(downloadButton(page)).toBeEnabled();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const actions = filterBar(page).getByRole('group', { name: 'Duty Planner actions' });
    const reset = await actions.getByRole('button', { name: 'Reset', exact: true }).boundingBox();
    const download = await actions.getByRole('button', { name: 'Download Excel', exact: true }).boundingBox();
    expect(reset).not.toBeNull();
    expect(download).not.toBeNull();
    expect(Math.abs(reset!.y - download!.y)).toBeLessThan(2);
    expect(download!.x).toBeGreaterThanOrEqual(reset!.x + reset!.width);
    const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
  }
});
