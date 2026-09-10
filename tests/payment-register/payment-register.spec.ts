import { test, expect, type Page } from '@playwright/test';
import type { Payment } from '../../src/modules/accounts/types/payment.types';
import { createDemoPayments } from '../../src/modules/accounts/utils/paymentRegisterDemo';

const reference = new Date('2026-09-10T12:00:00+05:30');
const records: (Omit<Payment, 'id'> & { id: number })[] = createDemoPayments(reference).map((p, index) => ({ ...p, id: index + 1, status: 'Approved' as const, createdAt: reference.toISOString() }));
const register = (page: Page) => page.getByRole('region', { name: 'Payment records' });
const rows = (page: Page) => register(page).locator('tbody tr');
const paymentRow = (page: Page, number: string) => register(page).getByRole('row', { name: `Payment ${number}`, exact: true });

async function setup(page: Page, empty = false, initialStatus: Payment['status'] = 'Approved') {
  const state = { records: records.map(record => ({ ...record, status: initialStatus })), reads: 0, writes: 0, failReads: false, failWrites: false, holdReads: false, release: () => {}, payload: {} as Record<string, unknown> };
  await page.clock.setFixedTime(reference);
  await page.addInitScript(() => localStorage.setItem('dmr_auth_user', JSON.stringify({ id: 'payment-qa', name: 'Payment QA', role: 'Admin' })));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/accounts/payments')) return route.fulfill({ json: [] });
    if (route.request().method() === 'GET') {
      state.reads++;
      if (state.holdReads) await new Promise<void>(resolve => { state.release = resolve; });
      return route.fulfill(state.failReads ? { status: 500, json: { message: 'Read unavailable' } } : { json: empty ? [] : state.records });
    }
    state.writes++;
    state.payload = route.request().postDataJSON() ?? {};
    // Hold briefly to exercise simultaneous Enter/click and busy-state guards.
    await new Promise(resolve => setTimeout(resolve, 150));
    if (state.failWrites) return route.fulfill({ status: 400, json: { message: 'Sample save failure' } });
    const id = Number(new URL(route.request().url()).pathname.split('/').pop());
    if (route.request().method() === 'DELETE') {
      state.records = state.records.filter(record => record.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    if (route.request().method() === 'PUT') {
      const current = state.records.find(record => record.id === id)!;
      const saved = { ...current, ...state.payload };
      state.records = state.records.map(record => record.id === id ? saved : record);
      return route.fulfill({ json: saved });
    }
    const saved = { ...records[0], ...state.payload, id: 100, paymentNo: 'Pay-10092026-100' };
    state.records = [...state.records, saved];
    return route.fulfill({ json: saved });
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
  await paymentRow(page, 'Pay-07092026-001').click();
  await page.getByRole('button', { name: 'Edit selected payment' }).click();
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
  await paymentRow(page, 'Pay-07092026-001').click();
  await page.getByRole('button', { name: 'Edit selected payment' }).click();
  await page.getByRole('dialog', { name: 'Edit Payment' }).getByRole('button', { name: 'Update Payment' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit Payment' })).toHaveCount(0);
  expect(state.writes).toBe(2);
});

test('delete countdown traps focus, Escape cancels without writing, expiry deletes once', async ({ page }) => {
  const state = await setup(page);
  await paymentRow(page, 'Pay-07092026-001').click();
  const remove = page.getByRole('button', { name: 'Delete selected payment' });
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


test('Pending display, single row selection, top actions, outside deselection and keyboard selection', async ({ page }) => {
  const state = await setup(page, false, 'Draft');
  const statuses = page.getByRole('group', { name: 'Payment status' });
  await statuses.getByRole('button', { name: 'Pending', exact: true }).click();
  await expect(register(page).getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(rows(page).first().getByText('Pending', { exact: true })).toBeVisible();
  const actions = page.getByRole('group', { name: 'Selected payment actions' });
  await expect(actions).toHaveCount(0);
  await expect(register(page).getByRole('checkbox')).toHaveCount(0);
  // Remarks is deliberately not a register column: the table stays scannable and
  // the note remains available in the payment details sheet.
  await expect(register(page).getByRole('columnheader')).toHaveCount(9);
  await expect(register(page).getByRole('columnheader', { name: 'Remarks', exact: true })).toHaveCount(0);
  await rows(page).first().getByText('Sample Green Valley Farm', { exact: true }).click();
  const first = paymentRow(page, 'Pay-07092026-001');
  const second = paymentRow(page, 'Pay-07092026-002');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(rows(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(actions.getByRole('button')).toHaveText(['Edit', 'Approve', 'Delete']);
  expect((await actions.boundingBox())!.y).toBeLessThan((await rows(page).first().boundingBox())!.y);
  await second.click();
  await expect(first).toHaveAttribute('aria-selected', 'false');
  await expect(second).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('searchbox', { name: 'Search payments' }).click();
  await expect(second).toHaveAttribute('aria-selected', 'false');
  await expect(actions).toHaveCount(0);
  await first.click();
  await expect(actions).toBeVisible();
  await first.click();
  await expect(actions).toHaveCount(0);
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(actions).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-selected', 'false');
  await first.click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(actions).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(first).toHaveAttribute('aria-selected', 'false');
  expect(state.writes).toBe(0);
});

test('approval confirms once through the existing update API and moves the payment to Approved', async ({ page }) => {
  const state = await setup(page, false, 'Draft');
  const statuses = page.getByRole('group', { name: 'Payment status' });
  await statuses.getByRole('button', { name: 'Pending', exact: true }).click();
  await paymentRow(page, 'Pay-07092026-001').click();
  await page.getByRole('button', { name: 'Approve selected payment' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Approve Payment', exact: true });
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  expect(state.writes).toBe(0);
  await page.getByRole('button', { name: 'Approve selected payment' }).click();
  await confirmation.getByRole('button', { name: 'Approve Payment', exact: true }).dblclick();
  await expect(confirmation).toHaveCount(0);
  expect(state.writes).toBe(1);
  expect(state.payload).toEqual({ status: 'Approved' });
  await expect(page.getByText('Payment approved successfully', { exact: true })).toHaveCount(1);
  await expect(register(page).getByText('Pay-07092026-001', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Selected payment actions' })).toHaveCount(0);
  await statuses.getByRole('button', { name: 'Approved', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await paymentRow(page, 'Pay-07092026-001').click();
  await expect(page.getByRole('button', { name: 'Approve selected payment' })).toBeDisabled();
});

test('failed approval preserves the pending record and selection, and can be retried', async ({ page }) => {
  const state = await setup(page, false, 'Draft');
  state.failWrites = true;
  await page.getByRole('group', { name: 'Payment status' }).getByRole('button', { name: 'Pending', exact: true }).click();
  await paymentRow(page, 'Pay-07092026-001').click();
  await page.getByRole('button', { name: 'Approve selected payment' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Approve Payment', exact: true });
  await confirmation.getByRole('button', { name: 'Approve Payment', exact: true }).click();
  await expect(confirmation.getByRole('alert')).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.records[0].status).toBe('Draft');
  await expect(paymentRow(page, 'Pay-07092026-001')).toHaveAttribute('aria-selected', 'true');
  state.failWrites = false;
  await confirmation.getByRole('button', { name: 'Approve Payment', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect(state.writes).toBe(2);
  expect(state.records[0].status).toBe('Approved');
});

test('sample and older payments cannot be approved, and Pending is shown in details and edit options', async ({ page }) => {
  const state = await setup(page, false, 'Draft');
  const statuses = page.getByRole('group', { name: 'Payment status' });
  await statuses.getByRole('button', { name: 'Pending', exact: true }).click();
  await paymentRow(page, 'Pay-07092026-001').click();
  await page.getByRole('button', { name: 'Edit selected payment' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Payment' });
  await expect(edit.getByRole('combobox', { name: 'Status', exact: true })).toContainText('Pending');
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'View Pay-07092026-001' }).click();
  const details = page.getByRole('dialog', { name: 'Payment Details' });
  await expect(details.getByText('Pending', { exact: true })).toBeVisible();
  await expect(details.getByText('Draft', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  state.records[0].createdAt = '2026-08-01T10:00:00+05:30';
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(register(page)).toHaveAttribute('aria-busy', 'false');
  await paymentRow(page, 'Pay-07092026-001').click();
  await expect(page.getByRole('button', { name: 'Approve selected payment' })).toBeDisabled();
  await page.getByRole('button', { name: 'Preview sample data' }).click();
  await rows(page).first().click();
  const actions = page.getByRole('group', { name: 'Selected payment actions' });
  for (const label of ['Edit selected payment', 'Approve selected payment', 'Delete selected payment']) {
    await expect(actions.getByRole('button', { name: label })).toBeDisabled();
  }
  expect(state.writes).toBe(0);
});
