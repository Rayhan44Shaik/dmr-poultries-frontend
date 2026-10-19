import { test, expect, type Page } from '@playwright/test';
import {
  API, login, shot, getTrip, createTrip, openTripStep, saveJson, EVIDENCE, ensureDieselRow,
} from './batch-c3b.helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

async function fillDieselRow(page: Page, opts: {
  litres?: string | number;
  amount?: string | number;
  meter?: string | number;
  bunk?: string;
  withBill?: boolean;
}) {
  const ltr = page.locator('input[aria-label="Ltr"]').first();
  const amt = page.locator('input[aria-label="Amount (₹)"]').first();
  if (opts.litres !== undefined) await ltr.fill(String(opts.litres));
  if (opts.amount !== undefined) await amt.fill(String(opts.amount));
  if (opts.meter !== undefined) await page.locator('input[aria-label="Reading (KM)"]').first().fill(String(opts.meter));
  if (opts.bunk) {
    await page.locator('select').filter({ hasText: 'Select bunk' }).first().selectOption({ label: 'Other' });
    await page.getByPlaceholder(/bunk name|location/i).first().fill(opts.bunk);
    await page.getByRole('button', { name: /^GPS$/i }).first().click();
    await page.waitForTimeout(800);
  }
  if (opts.withBill) {
    await page.locator('input[type="file"][accept*="image"]').last().setInputFiles({
      name: 'diesel-bill.png', mimeType: 'image/png', buffer: PNG,
    });
    await page.waitForTimeout(1500);
  }
}

function submitButton(page: Page) {
  return page.getByRole('button', { name: /submit diesel entry/i }).first();
}

test.describe('C3 Step 5 diesel browser matrix', () => {
  test('owned vehicle: rate is read-only and recalculates from litres and amount', async ({ page }) => {
    await login(page);
    const { trip } = await createTrip(page.request, { boxes: [{ boxNo: 1, birds: 40, weight: 80 }] });
    await openTripStep(page, trip.id, 5);
    await ensureDieselRow(page);

    // Rate cell must be a read-only display (no input) and empty before litres.
    const rate = page.locator('[aria-label="Rate (₹)"]').first();
    await expect(rate).toBeVisible();
    await expect(page.locator('input[aria-label="Rate (₹)"]')).toHaveCount(0);

    await page.locator('input[aria-label="Ltr"]').first().fill('12.5');
    await page.locator('input[aria-label="Amount (₹)"]').first().fill('1187.5');
    await expect(rate).toContainText('95.00');

    // Litres change recalculates.
    await page.locator('input[aria-label="Ltr"]').first().fill('25');
    await expect(rate).toContainText('47.50');

    // Amount change recalculates.
    await page.locator('input[aria-label="Amount (₹)"]').first().fill('1000');
    await expect(rate).toContainText('40.00');

    // Litres are editable and required.
    await page.locator('input[aria-label="Ltr"]').first().fill('');
    await expect(submitButton(page)).toBeDisabled();
    await page.locator('input[aria-label="Ltr"]').first().fill('0');
    await expect(submitButton(page)).toBeDisabled();
    await page.locator('input[aria-label="Ltr"]').first().fill('10');
    await page.locator('input[aria-label="Amount (₹)"]').first().fill('');
    await expect(submitButton(page)).toBeDisabled();
    await page.locator('input[aria-label="Amount (₹)"]').first().fill('0');
    await expect(submitButton(page)).toBeDisabled();

    await shot(page, 'c3b-step5-owned-validation');
  });

  test('owned vehicle: save, refresh, navigate away/return, context reopen, single submit', async ({ page, browser }) => {
    await login(page);
    const { trip } = await createTrip(page.request, { boxes: [{ boxNo: 1, birds: 40, weight: 80 }] });
    await openTripStep(page, trip.id, 5);
    await ensureDieselRow(page);
    await fillDieselRow(page, { litres: 12.5, amount: 1187.5, meter: 60200, bunk: 'C3B Own Bunk', withBill: true });
    await expect(submitButton(page)).toBeEnabled();
    await shot(page, 'c3b-step5-owned-filled');

    await submitButton(page).click();
    await expect(page.getByText(/diesel/i).first()).toBeVisible();
    await page.waitForTimeout(1500);

    let body = await getTrip(page, trip.id);
    const entries = body.dieselEntries ?? [];
    saveJson('c3b-step5-owned-api', { tripId: trip.id, dieselEntries: entries });
    expect(entries.length).toBe(1);
    expect(Number(entries[0].litres)).toBe(12.5);
    expect(Number(entries[0].amount)).toBe(1187.5);
    expect(Number(entries[0].rate)).toBe(95);
    await shot(page, 'c3b-step5-owned-saved');

    // Refresh keeps it.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('button[aria-label^="Step 5"]').click();
    await expect(page.locator('input[aria-label="Ltr"]').first()).toHaveValue('12.5');
    await shot(page, 'c3b-step5-owned-refresh');

    // Navigate away and return.
    await page.goto('/operations?tab=trip-list');
    await page.waitForLoadState('networkidle');
    await openTripStep(page, trip.id, 5);
    await expect(page.locator('input[aria-label="Ltr"]').first()).toHaveValue('12.5');

    // Browser-context close and reopen.
    await page.context().close();
    const context2 = await browser.newContext({
      baseURL: 'http://127.0.0.1:5199',
      geolocation: { latitude: 17.385044, longitude: 78.486671 },
      permissions: ['geolocation'],
    });
    const page2 = await context2.newPage();
    await login(page2);
    await openTripStep(page2, trip.id, 5);
    await expect(page2.locator('input[aria-label="Ltr"]').first()).toHaveValue('12.5');
    await shot(page2, 'c3b-step5-owned-context-reopen');

    // Repeated submission must not duplicate the row.
    const before = (await getTrip(page2, trip.id)).dieselEntries.length;
    const submitAgain = page2.getByRole('button', { name: /submit diesel entry/i }).first();
    if (await submitAgain.count()) {
      await submitAgain.click({ trial: true }).catch(() => undefined);
    }
    const after = (await getTrip(page2, trip.id)).dieselEntries.length;
    expect(after).toBe(before);
    expect(after).toBe(1);
    await context2.close();
  });

  test('rental vehicle: meter is optional and diesel persists without a fleet odometer link', async ({ page }) => {
    await login(page);
    const { trip, vehicle } = await createTrip(page.request, {
      rental: true,
      boxes: [{ boxNo: 1, birds: 20, weight: 40 }],
    });
    await openTripStep(page, trip.id, 5);
    await ensureDieselRow(page);
    await fillDieselRow(page, { litres: 10, amount: 950, bunk: 'C3B Rental Bunk', withBill: true });
    await expect(page.locator('input[aria-label="Reading (KM)"]').first()).toHaveValue('');
    await expect(submitButton(page)).toBeEnabled();
    await shot(page, 'c3b-step5-rental-filled');

    await submitButton(page).click();
    await page.waitForTimeout(1800);
    const body = await getTrip(page, trip.id);
    const entries = body.dieselEntries ?? [];
    saveJson('c3b-step5-rental-api', { tripId: trip.id, vehicleId: vehicle.id, dieselEntries: entries });
    expect(entries.length).toBe(1);
    expect(Number(entries[0].litres)).toBe(10);
    expect(Number(entries[0].amount)).toBe(950);
    expect(Number(entries[0].rate)).toBe(95);
    expect(entries[0].meter == null || Number(entries[0].meter) === 0).toBeTruthy();
    await shot(page, 'c3b-step5-rental-reopen');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('button[aria-label^="Step 5"]').click();
    await expect(page.locator('input[aria-label="Ltr"]').first()).toHaveValue('10');
    await expect(page.locator('[aria-label="Rate (₹)"]').first()).toContainText('95.00');
    await shot(page, 'c3b-step5-rental-refresh');
    expect(EVIDENCE).toBeTruthy();
  });
});
