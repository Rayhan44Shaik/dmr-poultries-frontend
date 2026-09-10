import { test, expect, type Page } from '@playwright/test';
import { createDemoPayments } from '../../src/modules/accounts/utils/paymentRegisterDemo';

const reference = new Date('2026-09-10T12:00:00+05:30');
const records = createDemoPayments(reference).map((p, index) => ({ ...p, id: index + 1, status: 'Approved' as const, createdAt: reference.toISOString() }));
const register = (page: Page) => page.getByRole('region', { name: 'Payment records' });
const rows = (page: Page) => register(page).locator('tbody tr');

async function setup(page: Page, empty = false) {
  const state = { reads: 0, writes: 0, failReads: false, failWrites: false, holdReads: false, release: () => {}, payload: {} as Record<string, unknown> };
  await page.clock.setFixedTime(reference);
  await page.addInitScript(() => localStorage.setItem('dmr_auth_user', JSON.stringify({ id: 'payment-qa', name: 'Payment QA', role: 'Admin' })));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/accounts/payments')) return route.fulfill({ json: [] });
    if (route.request().method() === 'GET') {
      state.reads++;
      if (state.holdReads) await new Promise<void>(resolve => { state.release = resolve; });
      return route.fulfill(state.failReads ? { status: 500, json: { message: 'Read unavailable' } } : { json: empty ? [] : records });
    }
    state.writes++;
    state.payload = route.request().postDataJSON() ?? {};
    // Hold briefly to exercise simultaneous Enter/click and busy-state guards.
    await new Promise(resolve => setTimeout(resolve, 150));
    return route.fulfill(state.failWrites ? { status: 400, json: { message: 'Sample save failure' } } : { json: { ...records[0], ...state.payload } });
  });
  await page.goto('/accounts?tab=paid-payments');
  await expect(page.getByRole('heading', { name: 'Payment Register', exact: true })).toBeVisible();
  // Development starts with isolated sample data; these lifecycle tests use fixtures.
  const realPayments = page.getByRole('button', { name: 'Back to real payments' });
  if (await realPayments.isVisible()) await realPayments.click();
  await expect(register(page)).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('group', { name: 'Payment status' }).getByRole('button', { name: 'Approved', exact: true }).click();
  return state;
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('demo is isolated, read-only, numbered and searchable within the three views', async ({ page }) => {
  const state = await setup(page);
  const reads = state.reads;
  const statuses = page.getByRole('group', { name: 'Payment status' });
  await page.getByRole('button', { name: 'Preview sample data' }).click();
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Payment', exact: true })).toBeDisabled();
  await expect(register(page).getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await expect(register(page).getByRole('button', { name: /^Delete / })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByLabel('From Date', { exact: true })).toHaveValue('07/09/2026');
  await expect(page.getByLabel('To Date', { exact: true })).toHaveValue('13/09/2026');
  await statuses.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'Search payments' }).fill('Fuel');
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await choose(page, 'Payment Mode', 'NEFT');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect(state.reads).toBe(reads);
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(rows(page)).toHaveCount(4);
  await statuses.getByRole('button', { name: 'Approved', exact: true }).click();
  await page.getByRole('button', { name: 'View Pay-07092026-001' }).click();
  const dialog = page.getByRole('dialog', { name: 'Payment Details' });
  await expect(dialog.getByText('Sample payment · Read-only preview. Not a real transaction.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View Pay-07092026-001' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to real payments' }).click();
  await expect(page.getByRole('button', { name: 'New Payment', exact: true })).toBeEnabled();
});

test('refresh retains rows, page and filters; repeated refresh makes one request', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Next page' }).click();
  state.holdReads = true;
  const before = state.reads;
  await page.getByRole('button', { name: 'Refresh', exact: true }).dblclick();
  await expect(register(page)).toHaveAttribute('aria-busy', 'true');
  await expect(rows(page)).toHaveCount(8);
  expect(state.reads).toBe(before + 1);
  state.holdReads = false;
  state.release();
  await expect(register(page)).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  state.failReads = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText(/Previously loaded records are still shown/)).toBeVisible();
  await expect(rows(page)).toHaveCount(8);
});

test('new payment uses nested Escape, trapped focus, validation and one failed submission', async ({ page }) => {
  const state = await setup(page);
  state.failWrites = true;
  await page.getByRole('button', { name: 'New Payment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Payment', exact: true });
  await expect(dialog.getByRole('button', { name: 'Create Payment' })).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'Payment Type', exact: false }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Payment Date', { exact: false }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Payment Type', exact: false }).click();
  await page.getByRole('option', { name: 'Fuel Payment', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Payment Mode', exact: false }).click();
  await page.getByRole('option', { name: 'Cash', exact: true }).click();
  await dialog.getByLabel('Paid To', { exact: false }).fill('QA Vendor');
  await dialog.getByLabel('Amount (₹)', { exact: false }).fill('1234.50');
  await expect(dialog.getByLabel('Amount (₹)', { exact: false })).toHaveValue('1,234.50');
  await dialog.getByRole('button', { name: 'Create Payment' }).dblclick();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.payload.amount).toBe(1234.5);
  await expect(dialog.getByLabel('Paid To', { exact: false })).toHaveValue('QA Vendor');
  await dialog.getByRole('button', { name: 'Create Payment' }).focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New Payment', exact: true })).toBeFocused();
});

test('edit preserves values on failure, locks submission, and keeps existing payload fields', async ({ page }) => {
  const state = await setup(page);
  state.failWrites = true;
  await page.getByRole('button', { name: 'Edit Pay-07092026-001' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Payment' });
  await expect(dialog.getByLabel('Paid To', { exact: false })).toHaveValue('Sample Green Valley Farm');
  await dialog.getByLabel('Paid To', { exact: false }).fill('Updated QA Vendor');
  await dialog.getByRole('button', { name: 'Update Payment' }).dblclick();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.payload.status).toBe('Approved');
  expect(state.payload.category).toBe('Farmer Payment');
  await expect(dialog.getByLabel('Paid To', { exact: false })).toHaveValue('Updated QA Vendor');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('empty register, unmatched search and unavailable data remain distinct', async ({ page }) => {
  const state = await setup(page, true);
  await expect(page.getByText('No payments recorded yet')).toBeVisible();
  await page.getByRole('button', { name: 'Preview sample data' }).click();
  await page.getByRole('searchbox', { name: 'Search payments' }).fill('unmatched-reference');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No payments found', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to real payments' }).click();
  state.failReads = true;
  await expect(register(page)).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Records unavailable', { exact: true })).toBeVisible();
});

test('dropdown search and keyboard, date validity, responsive table and dialogs', async ({ page }) => {
  await setup(page);
  const type = page.getByRole('combobox', { name: 'Payment Type', exact: true });
  await type.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('searchbox', { name: /search/i }).last().fill('fuel');
  // The shared dropdown keeps its clear option first. Move past it.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(type).toContainText('Fuel Payment');
  const from = page.getByLabel('From Date', { exact: true });
  await from.fill('31/09/2026');
  await from.press('Tab');
  await expect(from).not.toHaveValue('31/09/2026');
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'New Payment', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New Payment', exact: true });
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('successful create and edit notify once, refresh once and close their dialogs', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'New Payment', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'New Payment', exact: true });
  await create.getByRole('combobox', { name: 'Payment Type', exact: false }).click();
  await page.getByRole('option', { name: 'Fuel Payment', exact: true }).click();
  await create.getByRole('combobox', { name: 'Payment Mode', exact: false }).click();
  await page.getByRole('option', { name: 'Cash', exact: true }).click();
  await create.getByLabel('Paid To', { exact: false }).fill('Created QA Vendor');
  await create.getByLabel('Amount (₹)', { exact: false }).fill('500');
  const reads = state.reads;
  await create.getByRole('button', { name: 'Create Payment' }).click();
  await expect(create).toHaveCount(0);
  await expect(page.getByText('Payment saved successfully', { exact: true })).toHaveCount(1);
  expect(state.writes).toBe(1);
  expect(state.reads).toBe(reads + 1);
  await page.getByRole('button', { name: 'Edit Pay-07092026-001' }).click();
  await page.getByRole('dialog', { name: 'Edit Payment' }).getByRole('button', { name: 'Update Payment' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit Payment' })).toHaveCount(0);
  expect(state.writes).toBe(2);
});

test('delete countdown traps focus, Escape cancels without writing, expiry deletes once', async ({ page }) => {
  const state = await setup(page);
  const remove = page.getByRole('button', { name: 'Delete Pay-07092026-001' });
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Payment deletion pending' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel deletion' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel deletion' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toBe(0);
  await expect(remove).toBeFocused();
  await remove.click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
  expect(state.writes).toBe(1);
  await expect(page.getByText('Payment deleted successfully', { exact: true })).toHaveCount(1);
});


test('three maintenance-style segments sit beside Payment and retain Search-applied filters', async ({ page }) => {
  const state = await setup(page);
  const filters = page.getByRole('region', { name: 'Payment filters' });
  await expect(filters.locator('label')).toHaveCount(2);
  await expect(filters.locator('label')).toHaveClass([/sr-only/, /sr-only/]);
  await expect(page.getByText('Track outgoing payments and their transaction details.')).toHaveCount(0);
  const heading = register(page).getByRole('heading', { name: 'Payment', exact: true });
  const statuses = page.getByRole('group', { name: 'Payment status' });
  await expect(statuses.getByRole('button')).toHaveText(['Pending', 'Approved', 'Deleted']);
  const headingBox = (await heading.boundingBox())!;
  const toggleBox = (await statuses.boundingBox())!;
  expect(toggleBox.x).toBeGreaterThan(headingBox.x + headingBox.width + 16);
  expect(Math.abs(toggleBox.y + toggleBox.height / 2 - headingBox.y - headingBox.height / 2)).toBeLessThan(4);
  const reads = state.reads;
  await page.getByRole('searchbox', { name: 'Search payments' }).fill('Sample');
  await choose(page, 'Payment Type', 'Fuel Payment');
  await choose(page, 'Payment Mode', 'Bank Transfer');
  await expect(rows(page)).toHaveCount(10);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await statuses.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect(page.getByText('No payments found', { exact: true })).toBeVisible();
  await expect(statuses.getByRole('button', { name: 'Pending', exact: true })).toHaveClass(/bg-orange-100/);
  await statuses.getByRole('button', { name: 'Deleted', exact: true }).click();
  await expect(statuses.getByRole('button', { name: 'Deleted', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(statuses.getByRole('button', { name: 'Deleted', exact: true })).toHaveClass(/bg-rose-100/);
  await expect(page.getByText('Deleted payments are unavailable', { exact: true })).toBeVisible();
  await expect(register(page).locator('tbody')).toHaveCount(0);
  await statuses.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(statuses.getByRole('button', { name: 'Approved', exact: true })).toHaveClass(/bg-emerald-100/);
  expect(state.reads).toBe(reads);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(statuses.getByRole('button', { name: 'Pending', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Preview sample data' }).click();
  await expect(rows(page)).toHaveCount(4);
  await statuses.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(rows(page)).toHaveCount(5); // Paid/Cancelled samples are not reclassified.
  await page.getByRole('searchbox', { name: 'Search payments' }).fill('no-match');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(rows(page)).toHaveCount(5);
});
