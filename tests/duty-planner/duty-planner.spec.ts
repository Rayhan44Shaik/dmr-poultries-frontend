import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { TEST_EMPLOYEES, TEST_LEAVES, TEST_TODAY, testAssignment, testLeave, testWeek } from './fixtures';
import { getDutyReportWeekStarts } from '../../src/modules/staff/services/dutyReport';
import type { DutyPlannerWeek, UpsertAssignmentInput } from '../../src/modules/staff/services/dutyPlannerService';
import type { LeaveRequest } from '../../src/modules/staff/types/staffDashboard';

interface Backend {
  weeks: Map<string, DutyPlannerWeek>;
  createWeek: (monday: string) => DutyPlannerWeek;
  leaves: LeaveRequest[];
  writes: UpsertAssignmentInput[];
  failWeek?: string;
  failWrites?: boolean;
  offline?: boolean;
  held?: { monday: string; wait: Promise<void>; requested: () => void };
}
const backends = new WeakMap<Page, Backend>();
const pageErrors = new WeakMap<Page, string[]>();
const downloadButton = (page: Page) => page.getByRole('button', { name: 'Download Excel', exact: true });
const filterBar = (page: Page) => page.getByRole('region', { name: 'Duty Planner filters' });
const weekTable = (page: Page) => page.getByRole('table', { name: 'Duty Planner week table' });
const matrix = (page: Page) => page.getByRole('table', { name: 'Duty Planner date matrix' });
const row = (page: Page, name: string) => page.locator('tbody tr').filter({ hasText: name });
const dayCell = (page: Page, name: string, date: string) => row(page, name).locator(`td[data-date="${date}"]`);

function automaticWeek(monday: string): DutyPlannerWeek {
  return testWeek(monday, {
    employees: [...TEST_EMPLOYEES, { ...TEST_EMPLOYEES[2], id: 5, employeeNo: 105, employeeName: 'Collection Staff', role: 'Collector', department: 'Collection' }],
    assignments: testWeek(monday).assignments.filter((assignment) => assignment.employeeId !== 3),
  });
}
async function allRoles(page: Page) {
  await filterBar(page).getByRole('button', { name: 'Filter employee roles' }).click();
  await filterBar(page).getByRole('button', { name: 'All roles', exact: true }).click();
}
async function setCustomRange(page: Page, from: string, to: string) {
  await filterBar(page).getByRole('button', { name: 'Custom range', exact: true }).click();
  await page.getByLabel('To date').fill(to);
  await page.getByLabel('To date').press('Enter');
  await page.getByLabel('From date').fill(from);
  await page.getByLabel('From date').press('Enter');
}
async function downloadWorkbook(page: Page, telugu = false) {
  const button = page.getByRole('button', { name: telugu ? 'ఎక్సెల్ డౌన్‌లోడ్' : 'Download Excel', exact: true });
  await expect(button).toBeEnabled();
  const pending = page.waitForEvent('download');
  await button.click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await download.path())!);
  await page.getByRole('button', { name: 'Close notification' }).click();
  return { workbook, filename: download.suggestedFilename() };
}
async function changeLeaveStatus(page: Page, id: string, status: 'Approved' | 'Rejected') {
  // Exercise the actual leave API service and its cross-screen change event.
  await page.evaluate(async ({ id, status }) => {
    const path = '/src/modules/staff/services/leaveService.ts';
    const service = await import(path);
    await service.updateLeaveStatus(id, status);
  }, { id, status });
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  const backend: Backend = { weeks: new Map(), createWeek: testWeek, leaves: [...TEST_LEAVES], writes: [] };
  backends.set(page, backend);
  await page.clock.setFixedTime(new Date(`${TEST_TODAY}T12:00:00+05:30`));
  await page.addInitScript(() => localStorage.setItem('dmr_auth_user', JSON.stringify({ id: 'duty-test', name: 'Duty Test', role: 'Admin' })));
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe('http://127.0.0.1:5198');
    const getWeek = (monday: string) => {
      if (!backend.weeks.has(monday)) backend.weeks.set(monday, backend.createWeek(monday));
      return backend.weeks.get(monday)!;
    };
    if (url.pathname === '/api/staff/duty-planner' && route.request().method() === 'GET') {
      const monday = url.searchParams.get('weekStart')!;
      if (backend.held?.monday === monday) { backend.held.requested(); await backend.held.wait; }
      if (backend.offline || backend.failWeek === monday) { await route.fulfill({ status: 503, json: { error: 'Test week unavailable' } }); return; }
      await route.fulfill({ json: getWeek(monday) });
    } else if (url.pathname.startsWith('/api/staff/duty-planner/') && ['POST', 'PUT'].includes(route.request().method())) {
      if (backend.failWrites) { await route.fulfill({ status: 503, json: { error: 'Test save unavailable' } }); return; }
      const input = route.request().postDataJSON() as UpsertAssignmentInput;
      backend.writes.push(input);
      const monday = getDutyReportWeekStarts({ fromDate: input.date, toDate: input.date })[0];
      const current = getWeek(monday);
      const employee = current.employees.find((item) => item.id === input.employeeId)!;
      const assignment = { id: `${input.employeeId}-${input.date}`, employeeId: input.employeeId, employeeName: employee.employeeName, role: employee.role, department: employee.department, date: input.date, dutyType: input.dutyType };
      const next = { ...current, assignments: [...current.assignments.filter((item) => item.employeeId !== input.employeeId || item.date !== input.date), assignment] };
      backend.weeks.set(monday, next);
      await route.fulfill({ json: next });
    } else if (url.pathname === '/api/staff/leaves') {
      const items = backend.leaves.filter((leave) => (!url.searchParams.get('status') || leave.status === url.searchParams.get('status')) && (!url.searchParams.get('fromDate') || leave.toDate >= url.searchParams.get('fromDate')!) && (!url.searchParams.get('toDate') || leave.fromDate <= url.searchParams.get('toDate')!));
      await route.fulfill({ json: { items, total: items.length, page: 1, limit: 200, totalPages: 1 } });
    } else if (url.pathname.endsWith('/status') && url.pathname.startsWith('/api/staff/leaves/')) {
      const id = url.pathname.split('/')[4];
      const updated = { ...backend.leaves.find((leave) => leave.id === id)!, status: route.request().postDataJSON().status };
      backend.leaves = backend.leaves.map((leave) => leave.id === id ? updated : leave);
      await route.fulfill({ json: updated });
    } else {
      await route.fulfill({ json: { items: [], total: 0 } });
    }
  });
  await page.goto('/staff?tab=duty-planner');
  await expect(downloadButton(page)).toBeEnabled();
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page) ?? []).toEqual([]); });

test('compact filters use one panel, with a short calendar and Download beside Reset', async ({ page }) => {
  const filters = filterBar(page);
  await expect(filters).toHaveCount(1);
  await expect(filters.getByRole('group', { name: 'Duty Planner actions' }).getByRole('button')).toHaveText(['Reset', 'Download Excel']);
  await expect(page.getByRole('region', { name: 'Duty Planner Excel report' })).toHaveCount(0);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ['Weekly', 'Monthly', 'Custom range']) {
      await filters.getByRole('button', { name: mode, exact: true }).click();
      await expect(downloadButton(page)).toBeEnabled();
      const role = (await filters.getByRole('button', { name: 'Filter employee roles' }).boundingBox())!;
      const search = (await filters.getByRole('searchbox', { name: 'Search employees' }).boundingBox())!;
      const chips = (await filters.getByRole('group', { name: 'Selected role filters' }).boundingBox())!;
      const actions = (await filters.getByRole('group', { name: 'Duty Planner actions' }).boundingBox())!;
      expect(Math.abs(role.y - search.y)).toBeLessThan(2);
      expect(chips.y).toBeGreaterThan(role.y + role.height);
      expect(Math.abs(chips.y - actions.y)).toBeLessThan(2);
      expect((await filters.boundingBox())!.height).toBeLessThanOrEqual(155);
      if (mode !== 'Custom range') expect((await filters.getByRole('group', { name: 'Displayed period' }).boundingBox())!.width).toBeLessThanOrEqual(265);
      else expect(Math.abs((await filters.getByLabel('From date').boundingBox())!.y - role.y)).toBeLessThan(2);
    }
  }
});

test('automatically saves Office and Collection only for non-crew, with Sunday weekly off', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.createWeek = automaticWeek;
  backend.weeks.clear();
  backend.writes = [];
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  await allRoles(page);
  await expect(dayCell(page, 'Anil Accounts', TEST_TODAY)).toHaveText('Office');
  await expect(dayCell(page, 'Collection Staff', TEST_TODAY)).toHaveText('Collection');
  expect(backend.writes.map((entry) => [entry.employeeId, entry.date, entry.dutyType])).toEqual([[3, TEST_TODAY, 'Office'], [5, TEST_TODAY, 'Collection']]);
  await expect(dayCell(page, 'Mohan Helper', TEST_TODAY)).toHaveText('');
  await expect(weekTable(page).locator('td[data-date="2026-09-08"]')).toHaveText(['', '', '', '', '']);
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  expect(backend.writes).toHaveLength(2); // idempotent after reload
  await allRoles(page);
  await setCustomRange(page, '31/08/2026', '07/09/2026');
  await expect(dayCell(page, 'Anil Accounts', '2026-09-06')).toHaveText('Weekly Off');
  await expect(dayCell(page, 'Collection Staff', '2026-09-06')).toHaveText('Weekly Off');
  await expect(dayCell(page, 'Anil Accounts', '2026-09-05')).toHaveText('Office');
  expect(backend.writes.every((entry) => entry.date === TEST_TODAY)).toBeTruthy(); // report reads do not rewrite closed history
});

test('SQL date timestamps stay canonical and do not duplicate existing automatic duties', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.weeks.clear();
  backend.writes = [];
  backend.createWeek = (monday) => {
    const week = automaticWeek(monday);
    const assignments = [...week.assignments, testAssignment(3, monday, 'Office'), { ...testAssignment(3, monday, 'Collection'), id: `collector-${monday}`, employeeId: 5, employeeName: 'Collection Staff', role: 'Collector', department: 'Collection' }];
    return { ...week, weekStart: `${week.weekStart}T00:00:00.000Z`, weekEnd: `${week.weekEnd}T00:00:00.000Z`, days: week.days.map((day) => ({ ...day, date: `${day.date}T00:00:00.000Z` })), assignments: assignments.map((assignment) => ({ ...assignment, date: `${assignment.date}T00:00:00.000Z` })) };
  };
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  await allRoles(page);
  await expect(dayCell(page, 'Anil Accounts', TEST_TODAY)).toHaveText('Office');
  await expect(dayCell(page, 'Collection Staff', TEST_TODAY)).toHaveText('Collection');
  expect(backend.writes).toHaveLength(0);
});

test('approved leave updates the day immediately and overrides an existing duty', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.leaves = [testLeave(1, TEST_TODAY, TEST_TODAY, 'Pending')];
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  await expect(dayCell(page, 'Ravi Kumar', TEST_TODAY)).toHaveText('Duty');
  await changeLeaveStatus(page, backend.leaves[0].id, 'Approved');
  await expect(dayCell(page, 'Ravi Kumar', TEST_TODAY)).toHaveText('Leave');
  await expect(dayCell(page, 'Ravi Kumar', TEST_TODAY).getByRole('button')).toBeDisabled();
  await expect(row(page, 'Ravi Kumar').getByRole('cell').last()).toHaveText('0');
  expect(backend.weeks.get(TEST_TODAY)!.assignments.find((item) => item.employeeId === 1 && item.date === TEST_TODAY)!.dutyType).toBe('Delivery');
  const sheet = (await downloadWorkbook(page)).workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell('E7').value).toBe('Leave');
  expect(sheet.getCell('P7').value).toBe(0);
  expect(sheet.getCell('L7').value).toBe(1);
});

test('pending/rejected leave does not replace automatic duty, but approval does', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.createWeek = automaticWeek;
  backend.weeks.clear();
  backend.leaves = [testLeave(3, TEST_TODAY, TEST_TODAY, 'Pending'), { ...testLeave(3, TEST_TODAY, TEST_TODAY, 'Pending'), id: 'collector-request', employeeId: 5, employeeName: 'Collection Staff' }];
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  await allRoles(page);
  await expect(dayCell(page, 'Anil Accounts', TEST_TODAY)).toHaveText('Office');
  await changeLeaveStatus(page, 'collector-request', 'Rejected');
  await expect(downloadButton(page)).toBeEnabled();
  await expect(dayCell(page, 'Collection Staff', TEST_TODAY)).toHaveText('Collection');
  await changeLeaveStatus(page, backend.leaves[0].id, 'Approved');
  await expect(dayCell(page, 'Anil Accounts', TEST_TODAY)).toHaveText('Leave');
  expect(backend.weeks.get(TEST_TODAY)!.assignments.find((item) => item.employeeId === 3 && item.date === TEST_TODAY)!.dutyType).toBe('Office');
});

test('failed automatic saves stay live, block export and can be retried', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.createWeek = automaticWeek;
  backend.weeks.clear();
  backend.failWrites = true;
  await page.reload();
  await expect(filterBar(page)).toContainText('Automatic duties could not be saved.');
  await expect(downloadButton(page)).toBeDisabled();
  await expect(page.getByText('Sample data', { exact: true })).toHaveCount(0);
  backend.failWrites = false;
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(downloadButton(page)).toBeEnabled();
  expect(backend.writes).toHaveLength(2);
});

test('locked weeks and an unclosed previous week never trigger automatic writes', async ({ page }) => {
  const backend = backends.get(page)!;
  for (const blockedBy of ['current', 'previous']) {
    backend.writes = [];
    backend.weeks.clear();
    backend.createWeek = (monday) => ({ ...automaticWeek(monday), status: blockedBy === 'current' && monday === TEST_TODAY ? 'Closed' : blockedBy === 'previous' && monday < TEST_TODAY ? 'Open' : automaticWeek(monday).status });
    await page.reload();
    await expect(downloadButton(page)).toBeEnabled();
    expect(backend.writes).toHaveLength(0);
    await expect(dayCell(page, 'Ravi Kumar', TEST_TODAY).getByRole('button')).toBeDisabled();
  }
});

test('future cells are empty and dotted in both tables, without totals or explanatory text', async ({ page }) => {
  await expect(dayCell(page, 'Ravi Kumar', '2026-09-08')).toHaveText('');
  await expect(dayCell(page, 'Ravi Kumar', '2026-09-08').getByRole('button')).toBeDisabled();
  expect(await dayCell(page, 'Ravi Kumar', '2026-09-08').getByRole('button').evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe('dotted');
  await filterBar(page).getByRole('button', { name: 'Monthly', exact: true }).click();
  await expect(matrix(page)).toBeVisible();
  await expect(matrix(page).locator('td[data-date="2026-09-08"]')).toHaveText(['', '', '']);
  await expect(page.locator('tfoot')).toHaveCount(0);
  await expect(page.locator('.duty-planner-page')).not.toContainText('Planned');
  await expect(page.locator('.duty-planner-page')).not.toContainText('Grand total');
  await expect(page.locator('.duty-planner-page')).not.toContainText('Duty Count includes');
});

test('monthly Excel matches individual table counts and has no grand totals', async ({ page }) => {
  await filterBar(page).getByRole('button', { name: 'Monthly', exact: true }).click();
  await expect(matrix(page).locator('tbody tr')).toHaveCount(3);
  await expect(row(page, 'Ravi Kumar').getByRole('cell').last()).toHaveText('4');
  await expect(row(page, 'Lakshmi Devi').getByRole('cell').last()).toHaveText('5');
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-09-01-to-2026-09-30.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell(6, sheet.columnCount).value).toBe('Duty Count');
  expect((sheet.getCell('E6').value as Date).toISOString().slice(0, 10)).toBe('2026-09-01');
  expect((sheet.getCell(6, 34).value as Date).toISOString().slice(0, 10)).toBe('2026-09-30');
  expect([7, 8, 9].map((number) => sheet.getCell(number, sheet.columnCount).value)).toEqual([4, 5, 0]);
  expect(sheet.rowCount).toBe(9);
  expect(sheet.getCell('L7').value ?? '').toBe('');
  expect(sheet.getCell('L7').border.bottom?.style).toBe('dotted');
  expect(JSON.stringify(workbook.worksheets.map((tab) => tab.getSheetValues()))).not.toMatch(/GRAND TOTAL|TOTAL DUTY|Planned|Duty Count includes/);
});

test('custom ranges include both boundaries and match the employee search', async ({ page }) => {
  await setCustomRange(page, '30/12/2025', '03/01/2026');
  await filterBar(page).getByRole('searchbox', { name: 'Search employees' }).fill('  rAvI  ');
  await expect(matrix(page).locator('tbody tr')).toHaveCount(1);
  await expect(row(page, 'Ravi Kumar').getByRole('cell').last()).toHaveText('2');
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2025-12-30-to-2026-01-03.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.rowCount).toBe(7);
  expect(sheet.getCell('B7').value).toBe('Ravi Kumar');
  expect((sheet.getCell('I6').value as Date).toISOString().slice(0, 10)).toBe('2026-01-03');
  expect(sheet.getCell('I7').value).toBe('Office Duty');
  expect(sheet.getCell('N7').value).toBe(2);
  expect(workbook.getWorksheet('Daily Details')!.rowCount).toBe(11);
});

test('missing/reversed ranges and empty filters cannot export stale data', async ({ page }) => {
  await filterBar(page).getByRole('button', { name: 'Custom range', exact: true }).click();
  await page.getByLabel('From date').fill('');
  await page.getByLabel('From date').press('Enter');
  await expect(filterBar(page)).toContainText('Select both a from date and a to date.');
  await expect(downloadButton(page)).toBeDisabled();
  await page.getByLabel('From date').fill('08/09/2026');
  await page.getByLabel('From date').press('Enter');
  await expect(filterBar(page)).toContainText('The to date must be on or after the from date.');
  await expect(downloadButton(page)).toBeDisabled();
  await setCustomRange(page, '01/09/2026', '07/09/2026');
  await filterBar(page).getByRole('searchbox', { name: 'Search employees' }).fill('no such employee');
  await expect(downloadButton(page)).toBeDisabled();
  await expect(filterBar(page)).toContainText('No employees match');
  await filterBar(page).getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(downloadButton(page)).toBeEnabled();
});

test('week Excel keeps stored future duties private and counts through today only', async ({ page }) => {
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-09-07-to-2026-09-13.xlsx');
  const sheet = workbook.getWorksheet('Duty Planner')!;
  expect(sheet.columnCount).toBe(16);
  expect(sheet.getCell('E7').value).toBe('Duty');
  expect(sheet.getCell('F7').value ?? '').toBe('');
  expect([7, 8, 9].map((number) => sheet.getCell(number, 16).value)).toEqual([1, 1, 0]);
  expect(backends.get(page)!.weeks.get(TEST_TODAY)!.assignments.find((entry) => entry.employeeId === 1 && entry.date === '2026-09-08')!.dutyType).toBe('Rest');
});

test('Excel uses the active table roster and role filters, not hidden historical staff', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.weeks.clear();
  backend.createWeek = (monday) => {
    const week = testWeek(monday);
    return { ...week, assignments: [...week.assignments, { ...testAssignment(1, monday, 'Delivery'), id: `former-${monday}`, employeeId: 99, employeeName: 'Former Driver' }] };
  };
  await page.reload();
  await expect(downloadButton(page)).toBeEnabled();
  await filterBar(page).getByRole('button', { name: 'Filter employee roles' }).click();
  for (const role of ['Supervisor', 'Helper', 'Loader']) await filterBar(page).getByRole('checkbox', { name: role, exact: true }).uncheck();
  await page.keyboard.press('Escape');
  await expect(weekTable(page).locator('tbody tr')).toHaveCount(1);
  const weekly = (await downloadWorkbook(page)).workbook.getWorksheet('Duty Planner')!;
  expect(weekly.rowCount).toBe(7);
  expect(weekly.getCell('B7').value).toBe('Ravi Kumar');
  await filterBar(page).getByRole('button', { name: 'Monthly', exact: true }).click();
  await expect(matrix(page).locator('tbody tr')).toHaveCount(2);
  const monthly = (await downloadWorkbook(page)).workbook.getWorksheet('Duty Planner')!;
  expect([monthly.getCell('B7').value, monthly.getCell('B8').value]).toEqual(['Ravi Kumar', 'Former Driver']);
  expect(monthly.rowCount).toBe(8);
});

test('download reflects the latest saved editable duty', async ({ page }) => {
  await dayCell(page, 'Ravi Kumar', TEST_TODAY).getByRole('button').click();
  await page.getByRole('dialog', { name: 'Ravi Kumar', exact: true }).getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('button', { name: 'Close notification' }).click();
  await expect(dayCell(page, 'Ravi Kumar', TEST_TODAY)).toHaveText('Leave');
  const sheet = (await downloadWorkbook(page)).workbook.getWorksheet('Duty Planner')!;
  expect(sheet.getCell('E7').value).toBe('Leave');
  expect(sheet.getCell('P7').value).toBe(0);
});

test('a failed range cannot export partial data and Retry loads the right month', async ({ page }) => {
  await filterBar(page).getByRole('button', { name: 'Monthly', exact: true }).click();
  await expect(matrix(page)).toBeVisible();
  const backend = backends.get(page)!;
  backend.failWeek = '2026-10-05';
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(downloadButton(page)).toBeDisabled();
  await expect(filterBar(page)).toContainText('Could not load the full report.');
  await expect(matrix(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close notification' }).click();
  backend.failWeek = undefined;
  await filterBar(page).getByRole('button', { name: 'Retry report', exact: true }).click();
  await expect(matrix(page)).toBeVisible();
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toBe('Duty-Planner-2026-10-01-to-2026-10-31.xlsx');
  expect(workbook.getWorksheet('Duty Planner')!.getCell(7, 40).value).toBe(0);
});

test('a late response cannot overwrite a newly selected month', async ({ page }) => {
  await filterBar(page).getByRole('button', { name: 'Monthly', exact: true }).click();
  await expect(matrix(page)).toBeVisible();
  let release!: () => void;
  let requested!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const heldRequest = new Promise<void>((resolve) => { requested = resolve; });
  backends.get(page)!.held = { monday: '2026-10-05', wait, requested };
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await heldRequest;
  await expect(downloadButton(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(filterBar(page)).toContainText('November 2026');
  await expect(matrix(page)).toBeVisible();
  release();
  expect((await downloadWorkbook(page)).filename).toBe('Duty-Planner-2026-11-01-to-2026-11-30.xlsx');
});

test('sample fallback is labelled and automatic sample staff never write to the API', async ({ page }) => {
  const backend = backends.get(page)!;
  backend.offline = true;
  await page.reload();
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close notification' }).click();
  await allRoles(page);
  await expect(dayCell(page, 'Lakshmi Rao', TEST_TODAY)).toHaveText('Office');
  await expect(dayCell(page, 'Sai Kumar', TEST_TODAY)).toHaveText('Collection');
  const { workbook, filename } = await downloadWorkbook(page);
  expect(filename).toContain('-SAMPLE.xlsx');
  expect(String(workbook.getWorksheet('Duty Planner')!.getCell('A1').value)).toMatch(/^SAMPLE DATA/);
  expect(backend.writes).toHaveLength(0);
});

test('Telugu follows the language switch across filters, table, picker, calendar and Excel', async ({ page }) => {
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await page.getByRole('button', { name: 'తెలుగు', exact: true }).click();
  const filters = page.getByRole('region', { name: 'డ్యూటీ పట్టిక ఫిల్టర్లు' });
  await expect(filters.getByRole('button', { name: 'వారపు', exact: true })).toBeVisible();
  await expect(filters.getByRole('button', { name: 'ఎక్సెల్ డౌన్‌లోడ్', exact: true })).toBeEnabled();
  await expect(page.getByRole('table', { name: 'వారపు డ్యూటీ పట్టిక' })).toContainText('డ్యూటీ రోజులు');
  await dayCell(page, 'Ravi Kumar', TEST_TODAY).getByRole('button').click();
  const picker = page.getByRole('dialog', { name: 'Ravi Kumar', exact: true });
  await expect(picker.getByRole('button', { name: 'సెలవు', exact: true })).toBeVisible();
  await expect(picker.getByRole('button', { name: 'ఆఫీస్', exact: true })).toBeVisible();
  await picker.getByRole('button', { name: 'మూసివేయండి', exact: true }).click();
  await filters.getByRole('button', { name: 'తేదీ పరిధి', exact: true }).click();
  await filters.getByRole('button', { name: 'క్యాలెండర్ తెరవండి', exact: true }).first().click();
  const calendar = page.getByRole('dialog', { name: 'తేదీ ఎంచుకోండి', exact: true });
  await expect(calendar.getByRole('button', { name: 'నేడు', exact: true })).toBeVisible();
  await expect(calendar).toContainText('సెప్టెంబర్');
  await page.keyboard.press('Escape');
  await filters.getByRole('button', { name: 'వారపు', exact: true }).click();
  const sheet = (await downloadWorkbook(page, true)).workbook.getWorksheet('డ్యూటీ పట్టిక')!;
  expect(sheet.getCell('B6').value).toBe('ఉద్యోగి');
  expect(sheet.getCell('P6').value).toBe('డ్యూటీ రోజులు');
  expect(sheet.getCell('C7').value).toBe('డ్రైవర్');
  expect(sheet.getCell('E7').value).toBe('డ్యూటీ');
});

test('calendar popups, compact date text and paired actions fit phone screens in both languages', async ({ page }) => {
  await setCustomRange(page, '01/09/2026', '07/09/2026');
  for (const telugu of [false, true]) {
    if (telugu) {
      await page.getByRole('button', { name: 'Change language', exact: true }).click();
      await page.getByRole('button', { name: 'తెలుగు', exact: true }).click();
    }
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const filters = page.getByRole('region', { name: telugu ? 'డ్యూటీ పట్టిక ఫిల్టర్లు' : 'Duty Planner filters' });
      const reset = (await filters.getByRole('button', { name: telugu ? 'రీసెట్' : 'Reset', exact: true }).boundingBox())!;
      const excel = (await filters.getByRole('button', { name: telugu ? 'ఎక్సెల్ డౌన్‌లోడ్' : 'Download Excel', exact: true }).boundingBox())!;
      expect(Math.abs(reset.y - excel.y)).toBeLessThan(2);
      for (const index of [0, 1]) {
        await filters.getByRole('button', { name: telugu ? 'క్యాలెండర్ తెరవండి' : 'Open calendar', exact: true }).nth(index).click();
        const calendar = page.getByRole('dialog', { name: telugu ? 'తేదీ ఎంచుకోండి' : 'Choose date', exact: true });
        await expect(calendar).toBeVisible();
        const bounds = (await calendar.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
        await page.keyboard.press('Escape');
      }
    }
  }
});
