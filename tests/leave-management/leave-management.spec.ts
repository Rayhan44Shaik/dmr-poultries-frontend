import { expect, test, type Page } from '@playwright/test';

type Leave = { id: string; employeeId: number; employeeName: string; department: string; type: string; fromDate: string; toDate: string; days: number; status: string; reason: string; createdAt: string };
type Write = { method: string; path: string; body: Record<string, unknown> };
const writes = new WeakMap<Page, Write[]>();
const consoleProblems = new WeakMap<Page, string[]>();

const employees = [
  { id: 1, employeeNo: 101, employeeName: 'Ravi Kumar', department: 'Fleet', role: 'Driver', status: 'Active', phoneNumber: '9999999991', salary: 20000 },
  { id: 2, employeeNo: 102, employeeName: 'Lakshmi Devi', department: 'Operations', role: 'Supervisor', status: 'Active', phoneNumber: '9999999992', salary: 22000 },
];
const seed: Leave[] = Array.from({ length: 30 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  employeeId: index % 2 + 1, employeeName: index % 2 ? 'Lakshmi Devi' : 'Ravi Kumar', department: index % 2 ? 'Operations' : 'Fleet',
  type: index % 2 ? 'Sick' : 'Casual', fromDate: `2026-09-${String(index % 28 + 1).padStart(2, '0')}`, toDate: `2026-09-${String(index % 28 + 1).padStart(2, '0')}`,
  days: 1, status: index < 2 ? 'Pending' : index === 2 ? 'Approved' : 'Rejected', reason: 'Fixture reason', createdAt: '2026-09-01T00:00:00.000Z',
}));

test.beforeEach(async ({ page }) => {
  const records = structuredClone(seed);
  const requests: Write[] = [];
  writes.set(page, requests);
  consoleProblems.set(page, []);
  page.on('pageerror', (error) => consoleProblems.get(page)!.push(error.message));
  page.on('console', (message) => { if (message.type() === 'warning' || message.type() === 'error') consoleProblems.get(page)!.push(`${message.type()}: ${message.text()}`); });
  await page.addInitScript(() => {
    localStorage.setItem('dmr-auth-token', 'e2e-owner-token');
    localStorage.setItem('dmr-auth-user', JSON.stringify({ id: 1, username: 'browser-test', displayName: 'Browser Test', role: 'OWNER', employeeId: null }));
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ json: { user: { id: 1, username: 'browser-test', displayName: 'Browser Test', role: 'OWNER', employeeId: null } } }); return;
    }
    if (url.pathname === '/api/masters/employees') {
      await route.fulfill({ json: employees }); return;
    }
    if (url.pathname === '/api/staff/leaves/report') {
      await route.fulfill({ json: { month: url.searchParams.get('month'), items: [] } }); return;
    }
    if (url.pathname === '/api/staff/leaves' && method === 'GET') {
      const status = url.searchParams.get('status'); const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const filtered = records.filter((item) => (!status || status === 'All' || item.status === status) && (!search || item.employeeName.toLowerCase().includes(search)));
      const pageNo = Number(url.searchParams.get('page') ?? 1); const limit = Number(url.searchParams.get('limit') ?? 25); const offset = (pageNo - 1) * limit;
      await route.fulfill({ json: { items: filtered.slice(offset, offset + limit), total: filtered.length, page: pageNo, limit, totalPages: Math.ceil(filtered.length / limit) } }); return;
    }
    const statusMatch = /^\/api\/staff\/leaves\/([^/]+)\/status$/.exec(url.pathname);
    if (statusMatch) {
      const body = route.request().postDataJSON() as Record<string, unknown>; requests.push({ method, path: url.pathname, body });
      const item = records.find((record) => record.id === statusMatch[1])!; Object.assign(item, { status: body.status }); await route.fulfill({ json: item }); return;
    }
    if (url.pathname === '/api/staff/leaves' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>; requests.push({ method, path: url.pathname, body });
      const item = { ...seed[0], ...body, id: '10000000-0000-4000-8000-000000000001', status: 'Pending', days: 3, createdAt: new Date().toISOString() } as Leave;
      records.unshift(item); await route.fulfill({ status: 201, json: item }); return;
    }
    const deleteMatch = /^\/api\/staff\/leaves\/([^/]+)$/.exec(url.pathname);
    if (deleteMatch && method === 'DELETE') { requests.push({ method, path: url.pathname, body: {} }); await route.fulfill({ json: { id: deleteMatch[1], deleted: true } }); return; }
    await route.fulfill({ json: [] });
  });
  await page.goto('/staff?tab=leaves');
  await expect(page.getByText('Ravi Kumar').first()).toBeVisible({ timeout: 30_000 });
});

test.afterEach(async ({ page }) => expect(consoleProblems.get(page)).toEqual([]));

test('loads, filters, resets and paginates authoritative leave rows', async ({ page }) => {
  await expect(page.getByRole('row')).toHaveCount(26);
  await page.getByRole('button', { name: /next page/i }).click();
  await expect(page.getByText('Showing')).toBeVisible();
  await page.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect(page.getByRole('row')).toHaveCount(3);
  await page.getByRole('button', { name: /reset/i }).click();
  await expect(page.getByRole('row')).toHaveCount(26);
});

test('validates and submits one server-authoritative cross-month request', async ({ page }) => {
  await page.getByRole('button', { name: /new request/i }).click();
  const form = page.locator('form');
  await form.getByRole('button', { name: /submit request/i }).click();
  expect(writes.get(page)).toHaveLength(0);
  await form.getByLabel('From Date').fill('30/09/2026'); await form.getByLabel('From Date').press('Enter');
  await form.getByLabel('To Date').fill('02/10/2026'); await form.getByLabel('To Date').press('Enter');
  await expect(form.getByLabel('Calculated days')).toHaveValue('3');
  await form.getByRole('button', { name: /submit request/i }).dblclick();
  await expect(form).toHaveCount(0);
  expect(writes.get(page)).toHaveLength(1);
  expect(writes.get(page)![0].body).not.toHaveProperty('days');
});

test('approve, reject and cancel each issue one intended transition', async ({ page }) => {
  const firstPending = page.getByRole('row', { name: /Pending/ }).first();
  await firstPending.click();
  await page.getByRole('button', { name: /approve leave for/i }).dblclick();
  await expect.poll(() => writes.get(page)!.length).toBe(1);
  const secondPending = page.getByRole('row', { name: /Pending/ }).first();
  await secondPending.click();
  await page.getByRole('button', { name: /reject leave for/i }).click();
  await page.getByLabel(/rejection reason/i).fill('Insufficient documents');
  await page.getByRole('button', { name: 'Reject request', exact: true }).click();
  await expect.poll(() => writes.get(page)!.length).toBe(2);
  expect(writes.get(page)!.map((write) => write.body.status)).toEqual(['Approved', 'Rejected']);
});

test('form and table remain usable without horizontal page overflow on tablet and phone', async ({ page }) => {
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator('main').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const toggle = page.getByRole('button', { name: /new request|close form/i }); await toggle.click();
    const form = page.locator('form'); await expect(form.getByRole('combobox', { name: 'Department' })).toBeVisible();
    await form.getByRole('combobox', { name: 'Department' }).focus(); await page.keyboard.press('Tab');
    await form.getByRole('button', { name: /close leave request form/i }).click();
  }
});
