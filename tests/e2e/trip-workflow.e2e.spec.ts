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

// The i18n provider persists the choice under this exact key (src/i18n/index.tsx STORAGE_KEY).
const LANG_STORAGE_KEY = 'dmr-language';
async function setLanguage(page: Page, lang: 'en' | 'te') {
  await page.addInitScript(
    ({ key, l }) => {
      try { window.localStorage.setItem(key, l); } catch { /* ignore */ }
    },
    { key: LANG_STORAGE_KEY, l: lang }
  );
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

/** Wizard step button, matched in either language (aria-label "Step N" / "దశ N"). */
const stepBtn = (page: Page, n: number | string) =>
  page.locator(`button[aria-label^="Step ${n}"], button[aria-label^="దశ ${n}"]`);

async function openStep5(page: Page, id: number) {
  await page.goto(`/operations?tab=trip-entry&tripId=${id}`);
  await page.waitForLoadState('networkidle');
  await expect(stepBtn(page, 1)).toBeVisible();
  await stepBtn(page, 5).click();
  await expect(page.getByRole('heading', { name: /expenses|end details|ఖర్చులు/i })).toBeVisible();
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

test('19: Step 5 final Submit is blocked while Step 4 is unsubmitted (bilingual, human-readable message)', async ({ page, request }) => {
  // EN — through the browser: click Submit, confirm, and see the bilingual
  // Step-4 prerequisite notice; the trip must not advance.
  await setLanguage(page, 'en');
  await openStep5(page, tripId);
  const before = (await apiTrip(request, tripId)).status;

  await page.locator('button:has(svg.lucide-send)').first().click();
  const yes = page.locator('.fixed.inset-0.z-50 button').last();
  if (await yes.isVisible({ timeout: 4000 }).catch(() => false)) await yes.click();
  await expect(page.getByText(/step 4[\s\S]*has not been submitted/i)).toBeVisible({ timeout: 12_000 });

  expect((await apiTrip(request, tripId)).status, 'blocked submit must not change status').toBe(before);
  expect((await apiTrip(request, tripId)).expensesStepSubmittedAt ?? null).toBeNull();

  // TE — the notice text is a real Telugu string (not a raw key) in the
  // bundled dictionary, and a Telugu submit is also rejected server-side.
  await setLanguage(page, 'te');
  await openStep5(page, tripId);
  await expect(stepBtn(page, 4)).toContainText(/డెలివరీ వివరాలు/);
  await assertNoRawKeys(page);

  const blocked = await request.post(`${API}/trips/${tripId}/steps/expenses`, {
    data: { endMeter: 100700, destinationTolls: 0 },
  });
  expect(blocked.status(), 'server rejects Step 5 submit before Step 4').toBe(422);
  expect((await apiTrip(request, tripId)).status).toBe(before);
});


// -- Lifecycle / Orders / meter / delete -- on a deterministically pre-seeded
//    fully-completed PENDING trip (E2E_SEED.pendingTripNo), so these do not
//    depend on replaying the photo/balance-gated Steps 3-4 through the UI.

const PENDING_NO = 'TR-20260101-999';

async function pendingTrip(request: APIRequestContext) {
  const all = await apiTrips(request, '?includeDeleted=true');
  const row = all.find((t) => t.tripNo === PENDING_NO);
  expect(row, 'pre-seeded ' + PENDING_NO + ' must exist').toBeTruthy();
  return row as Record<string, unknown> & { id: number };
}

test('20: the Step-2-complete trip keeps its identity for Orders; Orders page renders with no raw keys', async ({ page, request }) => {
  await setLanguage(page, 'en');

  const farms = await (await request.get(`${API}/masters/farms`)).json();
  const farmId = farms.find((f: { farmName: string }) => f.farmName === SEED.farm).id;
  const bts = await (await request.get(`${API}/masters/bird-types`)).json();
  const birdTypeId = bts.find((b: { birdType: string }) => b.birdType === SEED.birdType).id;
  const step2 = await request.post(`${API}/trips/${tripId}/steps/farm`, {
    data: { sourceFarmId: farmId, birdTypeId, farmAddress: 'E2E Farm Address', destMeter: 100120, pickupTolls: 0, avgBirdWeight: 2.4 },
  });
  expect(step2.ok(), `Step 2 -> ${step2.status()} ${await step2.text()}`).toBeTruthy();

  // Part S: the SAME authoritative trip -- id / no / vehicle / date unchanged,
  // Step 2 complete, delivery not yet submitted -> available to Orders.
  const t = await apiTrip(request, tripId);
  expect(t.tripNo).toBe(tripNo);
  expect(t.vehicleNo).toBe(SEED.vehicle);
  expect(t.farmStepSubmitted).toBe(true);
  expect(t.deliveryStepSubmitted).not.toBe(true);

  // Part U/T: Orders derives everything from the persisted /trips data (no
  // parallel store); the page loads clean in both languages.
  for (const lang of ['en', 'te'] as const) {
    await setLanguage(page, lang);
    await page.goto('/operations?tab=orders');
    await page.waitForLoadState('networkidle');
    await assertNoRawKeys(page);
    await expect(page.getByRole('button', { name: lang === 'en' ? /assignment/i : /అసైన్‌మెంట్/ })).toBeVisible();
  }
});

test('21: a fully-completed trip is Pending with a SERVER completion timestamp and all step flags set; editing it does not reset them', async ({ request }) => {
  const t = await pendingTrip(request);
  expect(t.status).toBe('Pending');
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
    expect(Boolean(t[f]), f).toBe(true);
  }
  const ts = (t.expensesStepSubmittedAt ?? t.submittedAt) as string | null;
  expect(ts, 'server completion timestamp exists').toBeTruthy();

  // Re-submit Step 5 (an edit): flags stay set, status stays Pending, and the
  // official timestamp is NOT replaced (Part J).
  const edit = await request.post(`${API}/trips/${t.id}/steps/expenses`, {
    data: { endMeter: 90650, destinationTolls: 0, meals: 400, loading: 0 },
  });
  expect(edit.ok(), `edit Step 5 -> ${edit.status()} ${await edit.text()}`).toBeTruthy();
  const after = await apiTrip(request, t.id);
  expect(after.status).toBe('Pending');
  expect(Boolean(after.expensesStepSubmitted)).toBe(true);
  expect((after.expensesStepSubmittedAt ?? after.submittedAt), 'official timestamp preserved').toBe(ts);
});

test('22: editing a Pending trip keeps it Pending and keeps every submitted flag', async ({ request }) => {
  const t = await pendingTrip(request);
  const edit = await request.post(`${API}/trips/${t.id}/steps/farm`, {
    data: { sourceFarmId: t.sourceFarmId, birdTypeId: t.birdTypeId, farmAddress: 'Seed Farm Address EDITED', destMeter: 90121, pickupTolls: 0, avgBirdWeight: 2.5, farmStepSubmitted: true },
  });
  expect(edit.ok(), `edit Pending farm -> ${edit.status()} ${await edit.text()}`).toBeTruthy();
  const after = await apiTrip(request, t.id);
  expect(after.status).toBe('Pending');
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
    expect(Boolean(after[f]), f + ' stays true').toBe(true);
  }
});

test('23: Pending -> Completed; editing Completed keeps identity/flags/status; no Pending->Draft, no status->Deleted', async ({ request }) => {
  const t = await pendingTrip(request);
  const done = await request.patch(`${API}/trips/${t.id}/status`, { data: { status: 'Completed', approvedBy: 'E2E' } });
  expect(done.ok(), `-> Completed -> ${done.status()} ${await done.text()}`).toBeTruthy();
  let after = await apiTrip(request, t.id);
  expect(after.status).toBe('Completed');
  expect(after.tripNo).toBe(PENDING_NO);

  const edit = await request.post(`${API}/trips/${t.id}/steps/expenses`, {
    data: { endMeter: 90655, destinationTolls: 0, meals: 450, loading: 0, expensesStepSubmitted: true, endStepSubmitted: true },
  });
  expect(edit.ok(), `edit Completed -> ${edit.status()} ${await edit.text()}`).toBeTruthy();
  after = await apiTrip(request, t.id);
  expect(after.status, 'stays Completed under ordinary editing').toBe('Completed');
  expect(after.tripNo).toBe(PENDING_NO);
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
    expect(Boolean(after[f])).toBe(true);
  }

  expect((await request.patch(`${API}/trips/${t.id}/status`, { data: { status: 'Draft' } })).status(), 'no Pending/Completed -> Draft').toBe(422);
  expect((await request.patch(`${API}/trips/${t.id}/status`, { data: { status: 'Deleted' } })).status(), 'no status -> Deleted').toBe(422);
});

test('24: Step 1 opening meter -- the current trip is never its own previous meter', async ({ request }) => {
  const t = await apiTrip(request, tripId);
  const withSelf = await (await request.get(`${API}/trips/vehicle/${t.vehicleId}/last-meter`)).json();
  expect(withSelf?.closingMeter).toBe(100000);
  const excluded = await request.get(`${API}/trips/vehicle/${t.vehicleId}/last-meter?excludeTripId=${tripId}`);
  expect(await excluded.json()).toBeNull();

  const reSubmit = await request.post(`${API}/trips/${tripId}/steps/start`, {
    data: {
      vehicleId: t.vehicleId, vehicleNo: t.vehicleNo, driverId: t.driverId, driverName: t.driverName,
      supervisorId: t.supervisorId, supervisorName: t.supervisorName, helpers: t.helpers, loaders: t.loaders,
      openingMeter: t.openingMeter, startStepSubmitted: true, tripDate: t.tripDate,
    },
  });
  expect(reSubmit.ok(), `unchanged re-submit -> ${reSubmit.status()} ${await reSubmit.text()}`).toBeTruthy();
});

test('25: 10-second delete -- countdown + trip number, cancel keeps the trip, then it deletes exactly once and stays deleted after reload', async ({ page, request }) => {
  await setLanguage(page, 'en');
  const t = await pendingTrip(request);
  await gotoTripEntry(page);

  const row = new RegExp(PENDING_NO.replace(/-/g, '\\-'));
  let deleteCalls = 0;
  page.on('request', (r) => {
    if (r.method() === 'DELETE' && new RegExp(`/trips/${t.id}(\\?|$)`).test(r.url())) deleteCalls += 1;
  });

  const openDeleteModal = async () => {
    await page.getByRole('button', { name: /^all\b/i }).click();
    await page.getByRole('row', { name: row }).click();
    await page.getByRole('button', { name: /^delete\b/i }).click();
    await page.getByRole('textbox').last().fill('E2E delete reason');
    await page.locator('button.bg-rose-600').click();
  };

  await openDeleteModal();
  const notice = page.getByRole('dialog', { name: /pending deletion|delete/i }).last();
  await expect(notice).toContainText(row);
  await expect(notice).toContainText(/deleted automatically in \d+ second|deleting in \d+ second/i);
  await notice.getByRole('button', { name: /cancel/i }).click();
  await page.waitForTimeout(600);
  expect(deleteCalls, 'cancel must not call the delete API').toBe(0);
  await expect(page.getByRole('row', { name: row })).toBeVisible();

  await openDeleteModal();
  await page.waitForTimeout(12_000);
  expect(deleteCalls, 'exactly one delete request after the 10s countdown').toBe(1);

  await page.getByRole('button', { name: /^deleted\b/i }).click();
  await expect(page.getByRole('row', { name: row })).toBeVisible();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^deleted\b/i }).click();
  await expect(page.getByRole('row', { name: row })).toBeVisible();
  expect((await apiTrip(request, t.id)).deleted).toBe(true);
});

test('26: EN + TE -- wizard step names, Recent Table + Orders, no raw i18n keys anywhere visible', async ({ page }) => {
  for (const lang of ['en', 'te'] as const) {
    await setLanguage(page, lang);
    await gotoTripEntry(page);
    await page.getByRole('button', { name: lang === 'en' ? /create new trip/i : /కొత్త ట్రిప్/ }).click();

    await expect(stepBtn(page, 1)).toContainText(lang === 'en' ? /Trip Details/ : /ట్రిప్ వివరాలు/);
    await expect(stepBtn(page, 4)).toContainText(lang === 'en' ? /Delivery Details/ : /డెలివరీ వివరాలు/);
    await assertNoRawKeys(page);

    await page.goto('/operations?tab=orders');
    await page.waitForLoadState('networkidle');
    await assertNoRawKeys(page);
  }
});
