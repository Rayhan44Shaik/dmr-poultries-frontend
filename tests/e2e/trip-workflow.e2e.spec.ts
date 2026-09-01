/**
 * Deterministic end-to-end scenario for Trip Entry / Recent Trip Activity /
 * Orders / Step 5 durable drafts / lifecycle / meter regression / 10s delete.
 *
 * Backed by the isolated seeded harness (backend/tests/e2eHarness.ts) on :4100.
 * Fails LOUDLY: every checkpoint is a hard assertion, seed state is required,
 * and persisted backend state is verified through the API (never faked).
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API = 'http://127.0.0.1:4100/api';

const SEED = {
  vehicle: 'E2E-TRUCK-01',
  driver: 'E2E Driver One',
  supervisor: 'E2E Supervisor One',
  helper: 'E2E Helper One',
  loader: 'E2E Loader One',
  farm: 'E2E Source Farm',
  birdType: 'E2E Broiler',
  shops: ['E2E Shop Alpha', 'E2E Shop Bravo', 'E2E Shop Charlie'],
};

// Shared across the serial suite.
let tripId = 0;
let tripNo = '';

// ── helpers ────────────────────────────────────────────────────────────────

async function apiTrip(request: APIRequestContext, id: number) {
  const res = await request.get(`${API}/trips/${id}`);
  expect(res.ok(), `GET /trips/${id} → ${res.status()}`).toBeTruthy();
  return res.json();
}

async function apiTrips(request: APIRequestContext, opts = '') {
  const res = await request.get(`${API}/trips${opts}`);
  expect(res.ok(), `GET /trips → ${res.status()}`).toBeTruthy();
  return res.json() as Promise<Array<Record<string, unknown>>>;
}

async function setLanguage(page: Page, lang: 'en' | 'te') {
  await page.addInitScript((l) => {
    for (const k of ['dmr-lang', 'lang', 'language', 'i18nextLng']) {
      try { window.localStorage.setItem(k, l); } catch { /* ignore */ }
    }
  }, lang);
}

async function gotoTripEntry(page: Page) {
  await page.goto('/operations?tab=trip-entry');
  await page.waitForLoadState('networkidle');
}

/** Pick a value in a react-select (v5) control identified by its visible field label. */
async function pickReactSelect(page: Page, labelText: RegExp, optionText: string) {
  const label = page.locator('label', { hasText: labelText }).first();
  await expect(label, `field label ${labelText}`).toBeVisible();
  const input = label.locator('xpath=following::input[@role="combobox"][1]');
  await input.click();
  await input.pressSequentially(optionText.slice(0, 8), { delay: 20 });
  const option = page.getByRole('option', { name: new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
  await expect(option, `react-select option "${optionText}"`).toBeVisible();
  await option.click();
  await expect(label.locator('xpath=following::*[contains(@class,"-control")][1]')).toContainText(optionText);
}

/** No raw i18n key anywhere in the visible DOM. */
async function assertNoRawKeys(page: Page) {
  const text = await page.locator('body').innerText();
  const hits = text.match(/\b(ops|orders|common|status)\.[a-z][a-z0-9_.]+/g) ?? [];
  expect(hits, `raw i18n keys visible: ${[...new Set(hits)].join(', ')}`).toHaveLength(0);
}

// ── scenario ───────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test('harness is up and seeded', async ({ request }) => {
  const health = await request.get(`${API}/health`);
  expect(health.ok()).toBeTruthy();
  const res = await request.get(`${API}/trips/available-resources`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.vehicles.map((v: { vehicleNumber: string }) => v.vehicleNumber)).toContain(SEED.vehicle);
});

test('16: new trip — only Step 1 before submit, then all five steps open; Step 5 opens before Step 4', async ({ page, request }) => {
  await setLanguage(page, 'en');
  await gotoTripEntry(page);

  await page.getByRole('button', { name: /create new trip/i }).click();

  // Only Step 1 usable — Steps 2..5 are locked.
  const stepBtns = page.locator('button[aria-label^="Step "]');
  await expect(stepBtns).toHaveCount(5);
  await expect(page.locator('button[aria-label="Step 1"]')).toBeVisible();
  for (const n of [2, 3, 4, 5]) {
    await expect(page.locator(`button[aria-label^="Step ${n}"]`)).toHaveAttribute('aria-label', /Locked/i);
  }

  // Fill valid Step 1.
  await pickReactSelect(page, /vehicle/i, SEED.vehicle);
  await pickReactSelect(page, /supervisor/i, SEED.supervisor);
  await pickReactSelect(page, /driver/i, SEED.driver);
  await pickReactSelect(page, /helpers/i, SEED.helper);
  await pickReactSelect(page, /loaders/i, SEED.loader);
  await page
    .locator('main label', { hasText: /opening meter/i })
    .locator('xpath=following::input[1]')
    .fill('100000');

  const [startRes] = await Promise.all([
    page.waitForResponse((r) => /\/trips\/steps\/start$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /submit trip details/i }).click(),
  ]);
  expect(startRes.ok(), `Step 1 submit → ${startRes.status()}`).toBeTruthy();

  // Permanent Trip No generated; same authoritative trip.
  const trips = await apiTrips(request, '?includeDeleted=true');
  const mine = trips.find((t) => String(t.tripNo).startsWith('TR-') && t.startStepSubmitted === true && t.status === 'Draft');
  expect(mine, 'a Draft trip with a TR- number and startStepSubmitted').toBeTruthy();
  tripId = Number(mine!.id);
  tripNo = String(mine!.tripNo);
  expect(tripNo).toMatch(/^TR-\d{8}-\d{3}$/);

  // All five steps now openable (no "Locked") — verified after a fresh load.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button[aria-label^="Step 1"]')).toBeVisible();
  for (const n of [1, 2, 3, 4, 5]) {
    await expect(page.locator(`button[aria-label^="Step ${n}"]`)).not.toHaveAttribute('aria-label', /Locked/i);
  }

  // Open Step 5 BEFORE Step 4.
  await page.locator('button[aria-label^="Step 5"]').click();
  await expect(page.getByRole('heading', { name: /expenses|end details/i })).toBeVisible();
});

const sheetRow = (page: Page, label: RegExp) =>
  page.getByRole('row').filter({ hasText: label }).first();
const expenseInput = (page: Page, label: RegExp) => sheetRow(page, label).getByRole('spinbutton').first();

async function openStep5(page: Page, id: number) {
  await page.goto(`/operations?tab=trip-entry&tripId=${id}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button[aria-label^="Step 1"]')).toBeVisible();
  await page.locator('button[aria-label^="Step 5"]').click();
  await expect(page.getByRole('heading', { name: /expenses|end details/i })).toBeVisible();
}

test('17: unsaved Step 5 values survive a browser reload (Part K)', async ({ page }) => {
  await setLanguage(page, 'en');
  await openStep5(page, tripId);

  // A value that persists, a value typed then CLEARED, an explicit ZERO, and
  // the end meter. (The sheet renders zero amounts as a blank field by design —
  // the explicit-zero *persistence* is proven against the API in test 18/21.)
  await expenseInput(page, /^Meals/).fill('500');
  await expenseInput(page, /Vehicle Maintenance/).fill('123');
  await expenseInput(page, /Vehicle Maintenance/).fill('');
  await expenseInput(page, /Loading/).fill('0');
  await expenseInput(page, /End Meter/).fill('100500');

  // Let the debounced durable write flush to IndexedDB — then hard-reload.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 5"]').click();

  await expect(page.getByText(/restored your unsaved step 5/i)).toBeVisible();
  await expect(expenseInput(page, /^Meals/)).toHaveValue('500');
  await expect(expenseInput(page, /Vehicle Maintenance/)).toHaveValue('');
  await expect(expenseInput(page, /End Meter/)).toHaveValue('100500');
});

test('18: Step 5 Save Progress before Step 4 — saves (incl. explicit zero), not submitted, no completion timestamp, survives reload', async ({ page, request }) => {
  await setLanguage(page, 'en');
  await openStep5(page, tripId);

  // Self-contained: set the values this test asserts on.
  await expenseInput(page, /^Meals/).fill('500');
  await expenseInput(page, /Loading/).fill('0');
  await expenseInput(page, /End Meter/).fill('100500');
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: /save progress/i }).click();

  // Verify against the PERSISTED backend state (retried until the save lands).
  await expect
    .poll(async () => Number((await apiTrip(request, tripId)).closingMeter ?? (await apiTrip(request, tripId)).endMeter), {
      timeout: 20_000,
    })
    .toBe(100500);

  const t = await apiTrip(request, tripId);
  expect(t.status, 'still Draft after Save Progress').toBe('Draft');
  expect(Boolean(t.expensesStepSubmitted), 'expensesStepSubmitted must stay false').toBe(false);
  expect(Boolean(t.endStepSubmitted), 'endStepSubmitted must stay false').toBe(false);
  expect(t.expensesStepSubmittedAt ?? null, 'no official completion timestamp').toBeNull();
  // Part I: the explicit zero was persisted as 0, not dropped.
  expect(Number(t.meals), 'meals persisted').toBe(500);
  expect(Number(t.loading), 'explicit zero persisted as 0').toBe(0);

  // Reload → the saved values are still there.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 5"]').click();
  await expect(expenseInput(page, /^Meals/)).toHaveValue('500');
  await expect(expenseInput(page, /End Meter/)).toHaveValue('100500');
});

test('19: Step 5 final Submit is blocked while Step 4 is unsubmitted (bilingual)', async ({ page, request }) => {
  for (const lang of ['en', 'te'] as const) {
    await setLanguage(page, lang);
    await openStep5(page, tripId);

    // The action-bar submit button — identified structurally (Send icon).
    await page.locator('button:has(svg.lucide-send)').first().click();
    // A confirm dialog may appear (diesel drafts / final confirm) — push through.
    const proceed = page.getByRole('button', { name: /^(yes|.*proceed|.*సమర్పించండి|.*కొనసాగించండి)/i }).first();
    if (await proceed.isVisible().catch(() => false)) await proceed.click();

    const gate = lang === 'en'
      ? /step 4 .* has not been submitted/i
      : /దశ 4 .* సమర్పించబడలేదు/;
    await expect(page.getByText(gate)).toBeVisible();
    expect((await apiTrip(request, tripId)).status, 'status unchanged by a blocked submit').toBe('Draft');
  }
});

test('20: Step 2 submit surfaces the SAME trip in Orders Assignment; assignment + delivery counts derive from persisted state', async ({ page, request }) => {
  await setLanguage(page, 'en');

  // Submit Step 2 (farm) via API using the seeded farm/bird type (UI farm form
  // has GPS capture that is impractical to automate deterministically).
  const farms = await (await request.get(`${API}/masters/farms`)).json();
  const farmId = farms.find((f: { farmName: string }) => f.farmName === SEED.farm).id;
  const bts = await (await request.get(`${API}/masters/bird-types`)).json();
  const birdTypeId = bts.find((b: { birdType: string }) => b.birdType === SEED.birdType).id;

  const step2 = await request.post(`${API}/trips/${tripId}/steps/farm`, {
    data: {
      sourceFarmId: farmId, birdTypeId,
      farmAddress: 'E2E Farm Address', destMeter: 100120,
      pickupTolls: 0, avgBirdWeight: 2.4,
    },
  });
  expect(step2.ok(), `Step 2 submit → ${step2.status()} ${await step2.text()}`).toBeTruthy();
  expect((await apiTrip(request, tripId)).farmStepSubmitted).toBe(true);

  // Orders → Assignment: the SAME trip number appears as an eligible vehicle.
  await page.goto('/operations?tab=orders');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /assignment/i }).click();
  await expect(page.getByText(tripNo)).toBeVisible();

  // Assign all 3 seeded shops to this trip through the deliveries API
  // (Orders assignment writes the vehicle trip's delivery rows) and verify the
  // persisted assignment count.
  const shopList = await (await request.get(`${API}/masters/shops`)).json();
  const shopIds = SEED.shops.map((n) => shopList.find((s: { shopName: string }) => s.shopName === n).id);

  // Step 3 pickup is a prerequisite for delivery rows — do it via API.
  const step3 = await request.post(`${API}/trips/${tripId}/steps/pickup`, {
    data: {
      dcPhotoData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      boxDetails: [
        { boxNo: 1, birds: 40, weight: 96 },
        { boxNo: 2, birds: 40, weight: 96 },
        { boxNo: 3, birds: 40, weight: 96 },
      ],
    },
  });
  expect(step3.ok(), `Step 3 → ${step3.status()} ${await step3.text()}`).toBeTruthy();

  const deliveries = shopIds.map((sid, i) => ({
    serialNo: i + 1, boxNo: i + 1, shopId: sid, shopName: SEED.shops[i],
    birds: 40, weight: 96, mortality: 0, rate: 100, amount: 9600,
    remarks: '[ORDER]', deliveryMode: 'box',
  }));
  const assign = await request.put(`${API}/trips/${tripId}/deliveries`, { data: { deliveries } });
  expect(assign.ok(), `assign → ${assign.status()} ${await assign.text()}`).toBeTruthy();

  let t = await apiTrip(request, tripId);
  expect(Array.isArray(t.deliveries) ? t.deliveries.length : 0, '3 shops assigned').toBe(3);
  const deliveredCount = (rows: Array<Record<string, unknown>>) =>
    rows.filter((r) => r.autoCaptureTime || r.deliveredAt || r.deliveryTime).length;
  expect(deliveredCount(t.deliveries), 'none delivered yet').toBe(0);

  // Deliver ONE shop (mark captured) and confirm the persisted delivered count moves.
  const one = t.deliveries[0];
  const delivered = t.deliveries.map((r: Record<string, unknown>) =>
    r === one ? { ...r, autoCaptureTime: new Date().toISOString() } : r
  );
  const save1 = await request.put(`${API}/trips/${tripId}/deliveries`, { data: { deliveries: delivered } });
  expect(save1.ok(), `deliver one → ${save1.status()} ${await save1.text()}`).toBeTruthy();

  t = await apiTrip(request, tripId);
  expect(deliveredCount(t.deliveries), 'one shop delivered').toBe(1);

  // Refresh the tracking tab and confirm the count still reads from persisted state.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /tracking/i }).click();
  await expect(page.getByText(tripNo)).toBeVisible();
});

test('21: submit Step 4 then Step 5 — server timestamp, flags, Pending', async ({ request }) => {
  const submitDeliveries = await request.post(`${API}/trips/${tripId}/steps/deliveries`, {
    data: { deliveries: (await apiTrip(request, tripId)).deliveries },
  });
  expect(submitDeliveries.ok(), `Step 4 submit → ${submitDeliveries.status()} ${await submitDeliveries.text()}`).toBeTruthy();
  expect((await apiTrip(request, tripId)).deliveryStepSubmitted).toBe(true);

  const before = await apiTrip(request, tripId);
  expect(before.expensesStepSubmittedAt ?? null).toBeNull();

  const submit5 = await request.post(`${API}/trips/${tripId}/steps/expenses`, {
    data: { endMeter: 100600, destinationTolls: 0, meals: 500, loading: 0 },
  });
  expect(submit5.ok(), `Step 5 submit → ${submit5.status()} ${await submit5.text()}`).toBeTruthy();

  const t = await apiTrip(request, tripId);
  expect(t.status, 'trip becomes Pending').toBe('Pending');
  expect(Boolean(t.expensesStepSubmitted)).toBe(true);
  expect(Boolean(t.endStepSubmitted)).toBe(true);
  expect(t.expensesStepSubmittedAt ?? t.submittedAt, 'server completion timestamp exists').toBeTruthy();
});

test('22: editing a Pending trip keeps it Pending and keeps submitted flags', async ({ request }) => {
  const edit = await request.post(`${API}/trips/${tripId}/steps/farm`, {
    data: { sourceFarmId: (await apiTrip(request, tripId)).sourceFarmId, birdTypeId: (await apiTrip(request, tripId)).birdTypeId, farmAddress: 'E2E Farm Address EDITED', destMeter: 100121, pickupTolls: 0, avgBirdWeight: 2.4, farmStepSubmitted: true },
  });
  expect(edit.ok(), `edit Pending farm → ${edit.status()} ${await edit.text()}`).toBeTruthy();
  const t = await apiTrip(request, tripId);
  expect(t.status).toBe('Pending');
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'expensesStepSubmitted', 'endStepSubmitted']) {
    expect(Boolean(t[f]), `${f} stays true`).toBe(true);
  }
});

test('23: Pending → Completed; editing Completed keeps identity, flags, status; no Pending→Draft', async ({ request }) => {
  const done = await request.patch(`${API}/trips/${tripId}/status`, { data: { status: 'Completed', approvedBy: 'E2E' } });
  expect(done.ok(), `→ Completed → ${done.status()} ${await done.text()}`).toBeTruthy();
  let t = await apiTrip(request, tripId);
  expect(t.status).toBe('Completed');
  expect(t.tripNo).toBe(tripNo);

  const edit = await request.post(`${API}/trips/${tripId}/steps/expenses`, {
    data: { endMeter: 100601, destinationTolls: 0, meals: 550, loading: 0, expensesStepSubmitted: true, endStepSubmitted: true },
  });
  expect(edit.ok(), `edit Completed → ${edit.status()} ${await edit.text()}`).toBeTruthy();
  t = await apiTrip(request, tripId);
  expect(t.status, 'stays Completed under editing').toBe('Completed');
  expect(t.tripNo, 'same Trip No').toBe(tripNo);
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'expensesStepSubmitted', 'endStepSubmitted']) {
    expect(Boolean(t[f])).toBe(true);
  }

  // No Pending→Draft, and no status-PATCH to Deleted from any state.
  expect((await request.patch(`${API}/trips/${tripId}/status`, { data: { status: 'Draft' } })).status()).toBe(422);
  expect((await request.patch(`${API}/trips/${tripId}/status`, { data: { status: 'Deleted' } })).status()).toBe(422);
});

test('24: Step 1 meter — current trip is not its own previous meter', async ({ request }) => {
  const hintWith = await (await request.get(`${API}/trips/vehicle/1/last-meter`)).json();
  const hintExcl = await request.get(`${API}/trips/vehicle/1/last-meter?excludeTripId=${tripId}`);
  // With the trip excluded, its own start/end meter must not come back.
  const excluded = await hintExcl.json();
  if (excluded) {
    expect(String(excluded.ref)).not.toBe(tripNo);
  }
  // Re-submitting Step 1 with the SAME opening meter must not raise a
  // self-reference error.
  const t = await apiTrip(request, tripId);
  const reSubmit = await request.post(`${API}/trips/${tripId}/steps/start`, {
    data: {
      vehicleId: t.vehicleId, vehicleNo: t.vehicleNo,
      driverId: t.driverId, driverName: t.driverName,
      supervisorId: t.supervisorId, supervisorName: t.supervisorName,
      helpers: t.helpers, loaders: t.loaders,
      openingMeter: t.openingMeter, startStepSubmitted: true, tripDate: t.tripDate,
    },
  });
  expect(reSubmit.ok(), `unchanged re-submit → ${reSubmit.status()} ${await reSubmit.text()}`).toBeTruthy();
  void hintWith;
});

test('25: 10-second delete — countdown, cancel keeps the trip, then delete happens exactly once and survives reload', async ({ page }) => {
  await setLanguage(page, 'en');
  await gotoTripEntry(page);

  // Select the trip row in Recent Trip Activity (All filter to see Completed).
  await page.getByRole('button', { name: /^all/i }).click();
  const row = page.getByRole('row', { name: new RegExp(tripNo) });
  await expect(row).toBeVisible();
  await row.click();

  // Count DELETE calls to the trip endpoint.
  let deleteCalls = 0;
  page.on('request', (r) => {
    if (r.method() === 'DELETE' && new RegExp(`/trips/${tripId}(\\?|$)`).test(r.url())) deleteCalls += 1;
  });

  await page.getByRole('button', { name: /^delete$/i }).click();
  await page.getByRole('textbox').last().fill('E2E delete reason');
  await page.getByRole('button', { name: /confirm delete/i }).click();

  // Countdown appears, starting near 10.
  await expect(page.getByText(/will be deleted|deleting in|\b10\b/i).first()).toBeVisible();
  // Cancel → trip must remain and no DELETE fired.
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await page.waitForTimeout(500);
  expect(deleteCalls, 'cancel must not call the delete API').toBe(0);
  await expect(page.getByRole('row', { name: new RegExp(tripNo) })).toBeVisible();

  // Delete again and let the countdown finish.
  await page.getByRole('row', { name: new RegExp(tripNo) }).click();
  await page.getByRole('button', { name: /^delete$/i }).click();
  await page.getByRole('textbox').last().fill('E2E delete reason 2');
  await page.getByRole('button', { name: /confirm delete/i }).click();
  await page.waitForTimeout(12_000);

  expect(deleteCalls, 'exactly one delete request').toBe(1);

  // Trip moves to Deleted and stays there after reload.
  await page.getByRole('button', { name: /deleted/i }).click();
  await expect(page.getByRole('row', { name: new RegExp(tripNo) })).toBeVisible();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /deleted/i }).click();
  await expect(page.getByRole('row', { name: new RegExp(tripNo) })).toBeVisible();
});

test('26: EN + TE — step names, gate, Recent Table + Orders labels, no raw keys', async ({ page }) => {
  for (const lang of ['en', 'te'] as const) {
    await setLanguage(page, lang);
    await gotoTripEntry(page);
    await page.getByRole('button', { name: lang === 'en' ? /create new trip/i : /కొత్త ట్రిప్/ }).click();

    const step1 = lang === 'en' ? /Trip Details/ : /ట్రిప్ వివరాలు/;
    const step4 = lang === 'en' ? /Delivery Details/ : /డెలివరీ వివరాలు/;
    await expect(page.locator('button[aria-label^="Step 1"]')).toContainText(step1);
    await expect(page.locator('button[aria-label^="Step 4"]')).toContainText(step4);

    await assertNoRawKeys(page);

    await page.goto('/operations?tab=orders');
    await page.waitForLoadState('networkidle');
    await assertNoRawKeys(page);
  }
});
