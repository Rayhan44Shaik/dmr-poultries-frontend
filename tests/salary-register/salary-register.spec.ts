import { expect, test, type Page } from '@playwright/test';

type SalaryRow = Record<string, unknown>;
type Write = { method: string; path: string; body: Record<string, unknown> };
const writes = new WeakMap<Page, Write[]>();
const holders = new WeakMap<Page, { records: SalaryRow[] }>();
const pageErrors = new WeakMap<Page, string[]>();

const owner = { id: 1, username: 'salary-test', displayName: 'Salary Test', role: 'OWNER', employeeId: null };
const employees = [
  { id: 11, employeeNo: 11, employeeName: 'Production Staff', department: 'Fleet', role: 'Driver', phoneNumber: '9999999999', email: 'staff@example.test', salary: 20000, status: 'Active' },
];

function pendingRow(): SalaryRow {
  return {
    id: '10000000-0000-4000-8000-000000000001', employeeId: 11, employeeName: 'Production Staff',
    department: 'Fleet', month: '2026-09', basicSalary: 20000, overtime: 500, incentives: 250,
    fuelAllowance: 0, nightAllowance: 0, totalGross: 20750, leaveDeduction: 0, advanceRecovery: 0,
    loanEMI: 0, latePenalty: 0, otherDeductions: 0, totalDeductions: 0, netSalary: 20750,
    status: 'Pending', createdAt: '2026-09-01T00:00:00Z',
  };
}

function paidRow(): SalaryRow {
  return {
    id: '10000000-0000-4000-8000-000000000002', employeeId: 12, employeeName: 'Second Staff',
    department: 'Fleet', month: '2026-09', basicSalary: 18000, overtime: 0, incentives: 0,
    fuelAllowance: 0, nightAllowance: 0, totalGross: 18000, leaveDeduction: 0, advanceRecovery: 0,
    loanEMI: 0, latePenalty: 0, otherDeductions: 0, totalDeductions: 0, netSalary: 18000,
    status: 'Paid', paymentDate: '2026-09-05', paymentRef: 'NEFT-1', createdAt: '2026-09-01T00:00:00Z',
  };
}

test.beforeEach(async ({ page }) => {
  const holder = { records: [pendingRow(), paidRow()] };
  holders.set(page, holder);
  const requests: Write[] = [];
  writes.set(page, requests);
  pageErrors.set(page, []);
  page.on('pageerror', (error) => pageErrors.get(page)!.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('dmr-auth-token', 'e2e-owner-token');
    localStorage.setItem('dmr-auth-user', JSON.stringify({ id: 1, username: 'salary-test', displayName: 'Salary Test', role: 'OWNER', employeeId: null }));
  });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ json: { user: owner } });
      return;
    }
    if (url.pathname === '/api/masters/employees') {
      await route.fulfill({ json: employees });
      return;
    }
    if (url.pathname === '/api/staff/salaries' && method === 'GET') {
      await route.fulfill({ json: holder.records });
      return;
    }
    if (url.pathname === '/api/staff/salaries/generate' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push({ method, path: url.pathname, body });
      if (!holder.records.length) holder.records.push(pendingRow());
      await route.fulfill({ json: { month: body.month, requested: 1, generated: 1, skippedExisting: 0 } });
      return;
    }
    if (url.pathname === '/api/staff/salaries/bulk-status' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push({ method, path: url.pathname, body });
      const ids = (body.ids ?? []) as string[];
      const updated = holder.records
        .filter((record) => ids.includes(record.id as string))
        .map((record) => ({ ...record, status: 'Paid', paymentDate: body.paymentDate, paymentRef: 'NEFT-E2E' }));
      for (const row of updated) {
        const index = holder.records.findIndex((record) => record.id === row.id);
        holder.records[index] = row;
      }
      await route.fulfill({ json: { updated, skipped: [] } });
      return;
    }
    if (url.pathname === '/api/staff/salaries/email' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push({ method, path: url.pathname, body });
      await route.fulfill({ json: { sent: (body.ids as string[]).length, failed: 0 } });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto('/staff?tab=salary-sheet');
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test('renders authoritative register rows with backend totals', async ({ page }) => {
  await expect(page.getByText('Production Staff').first()).toBeVisible();
  await expect(page.getByText(/20,750/).first()).toBeVisible();
  await expect(page.getByText('Second Staff').first()).toBeVisible();
  await expect(page.getByText(/sample|demo/i)).toHaveCount(0);
});

test('empty month generates the register through a confirm', async ({ page }) => {
  holders.get(page)!.records = [];
  await page.reload();
  await expect(page.getByText(/No salary records for/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Generate Register for this Month', exact: true }).click();
  await expect(page.getByText('Generate Salary Register').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  const generate = writes.get(page)!.find((entry) => entry.path === '/api/staff/salaries/generate')!;
  expect(typeof generate.body.month).toBe('string');
  await expect(page.getByText('Production Staff').first()).toBeVisible();
});

test('backend failure shows an error with no sample rows, retry recovers', async ({ page }) => {
  await expect(page.getByText('Production Staff').first()).toBeVisible();
  await page.route((url) => url.pathname === '/api/staff/salaries', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 503, json: { error: 'Test salaries unavailable' } });
    } else {
      await route.fallback();
    }
  });
  await page.getByRole('button', { name: /refresh/i }).first().click();
  await expect(page.getByText(/unavailable|failed|error/i).first()).toBeVisible();
  await expect(page.getByText(/sample|demo/i)).toHaveCount(0);
});

test('review and submit marks the pending record paid and queues payslips', async ({ page }) => {
  await page.getByRole('button', { name: 'Review and Submit', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Production Staff' }).check();
  await page.getByRole('button', { name: /Submit Selected/ }).click();
  await expect
    .poll(() => writes.get(page)!.find((entry) => entry.path === '/api/staff/salaries/email'), { timeout: 15000 })
    .toBeDefined();
  const bulk = writes.get(page)!.find((entry) => entry.path === '/api/staff/salaries/bulk-status')!;
  expect(bulk.body.status).toBe('Paid');
  expect(bulk.body.ids).toEqual(['10000000-0000-4000-8000-000000000001']);
  expect(typeof bulk.body.paymentDate).toBe('string');
  expect(typeof bulk.body.paymentMode).toBe('string');
  const email = writes.get(page)!.find((entry) => entry.path === '/api/staff/salaries/email')!;
  expect(email.body.ids).toEqual(['10000000-0000-4000-8000-000000000001']);
  await expect(page.getByText(/Submitted 1 salary record\(s\) successfully/).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/1 payslip email\(s\) queued/).first()).toBeVisible();
});
