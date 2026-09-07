import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { TEST_LEAVES, TEST_TODAY, testLeave, testWeek } from './fixtures';

const pageErrors = new WeakMap<Page, string[]>();
const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download Excel', exact: true });
const matrix = (page: Page) => page.getByRole('table', { name: 'Duty Planner date matrix' });
const reportPanel = (page: Page) => page.getByRole('region', { name: 'Duty Planner Excel report' });

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
  await expect(reportPanel(page)).toContainText('30 Dec 2025 – 03 Jan 2026');
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
  await expect(reportPanel(page)).toContainText('No employees match');
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
  await expect(reportPanel(page)).toContainText('Could not load the full report.');
  await expect(matrix(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close notification' }).click();
  fail = false;
  await page.getByRole('button', { name: 'Retry report' }).click();
  await expect(matrix(page)).toBeVisible();
  await expect(reportPanel(page)).toContainText('01 Oct 2026 – 31 Oct 2026');
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
  await expect(reportPanel(page)).toContainText('01 Nov 2026 – 30 Nov 2026');
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
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});
