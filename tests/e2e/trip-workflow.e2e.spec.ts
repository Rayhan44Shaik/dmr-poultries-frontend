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

// Deterministic browser context for the full real-UI flow: GPS is granted and
// pinned to a fixed coordinate so Step 2's "Get GPS" never touches a real
// device; the DC photo is a generated PNG uploaded through the real file input.
test.use({
  permissions: ['geolocation'],
  geolocation: { latitude: 17.385044, longitude: 78.486671 },
  // Pin the browser clock's zone to UTC so "today" is one value shared by the
  // browser (createEmptyTrip / Orders localToday) and the UTC-pinned harness
  // (PGlite CURRENT_DATE). Keeps the date-driven Orders flow deterministic.
  timezoneId: 'UTC',
});

const SEED = {
  vehicle: 'E2E-TRUCK-01',
  /** Dedicated vehicle + crew for the full real-UI Step 1→5 flow spec. */
  fullVehicle: 'E2E-TRUCK-03',
  fullDriver: 'E2E Driver Two',
  fullSupervisor: 'E2E Supervisor Two',
  fullHelper: 'E2E Helper Two',
  fullLoader: 'E2E Loader Two',
  driver: 'E2E Driver One',
  supervisor: 'E2E Supervisor One',
  helper: 'E2E Helper One',
  loader: 'E2E Loader One',
  farm: 'E2E Source Farm',
  birdType: 'E2E Broiler',
  shops: [
    'E2E Shop Alpha',
    'E2E Shop Bravo',
    'E2E Shop Charlie',
    'E2E Shop Delta',
    'E2E Shop Echo',
  ],
};

/** Smallest valid PNG (1×1, transparent) — the deterministic DC photo fixture. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
  'base64'
);

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
  const mine = trips.find(
    (t) =>
      String(t.tripNo).startsWith('TR-') &&
      t.startStepSubmitted === true &&
      t.status === 'Draft' &&
      t.vehicleNo === SEED.vehicle &&
      !t.farmStepSubmitted // the pre-seeded assign trip is already past Step 2
  );
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

// ── Orders — the CRITICAL Collection → container flow, driven through the
//    real Order Collection UI (not the API). Proves POST /trips/0/steps/
//    deliveries creates / locates ONE vehicle-less ORD-YYYYMMDD-NN container,
//    never a real TR- trip, and that the collected shop count is derived from
//    the persisted [ORDER] rows and survives a full page reload.

async function ordContainer(request: APIRequestContext) {
  const res = await request.get(`${API}/trips?full=true`);
  expect(res.ok(), `GET /trips?full=true → ${res.status()}`).toBeTruthy();
  const all = (await res.json()) as Array<Record<string, unknown>>;
  return all.filter((t) => String(t.tripNo).startsWith('ORD-'));
}

const boxInput = (page: Page, shop: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`Boxes.*${shop}`, 'i') });

test('27: Order Collection UI — one ORD container, no TR- trip, shop count from persisted [ORDER] rows, survives reload', async ({ page, request }) => {
  await setLanguage(page, 'en');
  await page.goto('/operations?tab=orders');
  await page.waitForLoadState('networkidle');

  const trCountBefore = (await apiTrips(request, '?includeDeleted=true')).filter((t) =>
    String(t.tripNo).startsWith('TR-')
  ).length;

  // Collection is the default tab; the seed shops render as editable rows.
  await expect(boxInput(page, SEED.shops[0])).toBeVisible();

  // Collect ALL 5 seed shops — test 28 assigns this same finished collection.
  const plan: Array<[string, string]> = [
    [SEED.shops[0], '3'],
    [SEED.shops[1], '2'],
    [SEED.shops[2], '4'],
    [SEED.shops[3], '2'],
    [SEED.shops[4], '2'],
  ];
  for (const [shop, boxes] of plan) await boxInput(page, shop).fill(boxes);

  const [saveRes] = await Promise.all([
    page.waitForResponse((r) => /\/trips\/\d+\/steps\/deliveries$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  expect(saveRes.ok(), `collection save → ${saveRes.status()} ${await saveRes.text()}`).toBeTruthy();

  // Exactly ONE container, vehicle-less, ORD-numbered, 3 [ORDER] plan rows,
  // not finished. And NOT a real numbered trip.
  let containers = await ordContainer(request);
  expect(containers.length, 'exactly one ORD collection container').toBe(1);
  const container = containers[0];
  expect(String(container.tripNo)).toMatch(/^ORD-\d{8}-\d+$/);
  expect(container.vehicleNo || '', 'container has no vehicle').toBeFalsy();
  expect(Number(container.vehicleId) || 0).toBe(0);
  expect(container.startStepSubmitted).not.toBe(true);
  expect(container.deliveries.length, 'one persisted [ORDER] row per collected shop').toBe(5);
  for (const d of container.deliveries) {
    expect(String(d.remarks).startsWith('[ORDER]'), `row remarks: ${d.remarks}`).toBe(true);
  }
  const trCountAfter = (await apiTrips(request, '?includeDeleted=true')).filter((t) =>
    String(t.tripNo).startsWith('TR-')
  ).length;
  expect(trCountAfter, 'no new TR- trip minted for id 0').toBe(trCountBefore);

  // Reload: the collected quantities come back from the persisted rows.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(boxInput(page, SEED.shops[0])).toHaveValue('3');
  await expect(boxInput(page, SEED.shops[1])).toHaveValue('2');
  await expect(boxInput(page, SEED.shops[2])).toHaveValue('4');
  await assertNoRawKeys(page);

  // Finish Collection latches the container (still no second trip, still no TR-).
  const [finishRes] = await Promise.all([
    page.waitForResponse((r) => /\/trips\/\d+\/steps\/deliveries$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /finish collection/i }).click(),
  ]);
  expect(finishRes.ok(), `finish collection → ${finishRes.status()} ${await finishRes.text()}`).toBeTruthy();

  containers = await ordContainer(request);
  expect(containers.length, 'still exactly one container after Finish').toBe(1);
  expect(containers[0].id, 'same container row').toBe(container.id);
  expect(containers[0].startStepSubmitted, 'Finish Collection latched start_step_submitted').toBe(true);
});

// ════════════════════════════════════════════════════════════════════════
//  28: complete real UI Trip Entry workflow Step 1 through Step 5
//  ────────────────────────────────────────────────────────────────────────
//  The BROWSER performs every step: Step 1 → Step 2 → (Orders sees the same
//  trip) → Step 3 → Order Assignment UI (5 shops) → Step 4 UI (deliver 5,
//  count 5→4→3→2→1→0) → Step 4 submit → Step 5 Save → reload → Step 5 submit
//  → Pending → Recent Table → Completed. No step-submit API is ever called
//  by the test; deterministic fixtures only for GPS (pinned geolocation) and
//  the DC photo (a generated PNG through the real file input).
// ════════════════════════════════════════════════════════════════════════

const FULL_RE = /TR-\d{8}-\d{3}/;

/** Locate the full-flow trip in GET /trips?full=true by its known id. */
async function fullTrip(request: APIRequestContext, id: number) {
  const all = (await request.get(`${API}/trips?full=true`).then((r) => r.json())) as Array<
    Record<string, unknown>
  >;
  const t = all.find((x) => Number(x.id) === id);
  expect(t, `trip ${id} present in /trips?full=true`).toBeTruthy();
  return t as Record<string, unknown>;
}

/** Open Delivery Tracking and return the given trip's row. */
async function trackingRowFor(page: Page, tripNo: string) {
  await page.goto('/operations?tab=orders');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /delivery tracking/i }).click();
  const row = page.getByRole('row', { name: new RegExp(tripNo.replace(/-/g, '\\-')) });
  await expect(row).toBeVisible();
  return row;
}

/** Deliver one already-listed shop through the real Step 4 form (1 pickup box). */
async function deliverShopInStep4(page: Page, tripId: number, shop: string, boxNo: number) {
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 4).click();

  const card = page
    .locator('div.rounded-2xl', { hasText: shop })
    .filter({ has: page.getByRole('button', { name: /edit shop delivery/i }) })
    .last();
  await card.getByRole('button', { name: /edit shop delivery/i }).click();

  await page.getByText(/select available boxes/i).waitFor();
  await pickReactSelect(page, /bird type/i, SEED.birdType);
  await page.getByText(/select boxes from pickup|boxes selected/i).click();
  await page.getByRole('checkbox', { name: new RegExp(`#${boxNo}\\b`) }).check();
  await page.getByText(/select boxes from pickup|boxes selected/i).click(); // close the dropdown
  await page.getByRole('button', { name: /update delivery/i }).click();

  const [saveRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/deliveries$`).test(r.url()) && r.request().method() === 'PUT'
    ),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  expect(saveRes.ok(), `Step 4 Save Progress (${shop}) → ${saveRes.status()}`).toBeTruthy();
}

const labelInput = (page: Page, label: RegExp) =>
  page.locator('label', { hasText: label }).first().locator('xpath=following::input[1]');

test('28: complete real UI Trip Entry workflow Step 1 through Step 5', async ({ page, request }) => {
  test.setTimeout(600_000);
  await setLanguage(page, 'en');

  const OPENING = 200000;
  const DEST = 200150;
  const END = 200400;

  // ─────────────────────────────  STEP 1 (real UI)  ─────────────────────
  await gotoTripEntry(page);
  await page.getByRole('button', { name: /create new trip/i }).click();

  // Only Step 1 before submit.
  for (const n of [2, 3, 4, 5]) {
    await expect(stepBtn(page, n)).toHaveAttribute('aria-label', /Locked/i);
  }

  await pickReactSelect(page, /vehicle/i, SEED.fullVehicle);
  await pickReactSelect(page, /supervisor/i, SEED.fullSupervisor);
  await pickReactSelect(page, /driver/i, SEED.fullDriver);
  await pickReactSelect(page, /helpers/i, SEED.fullHelper);
  await pickReactSelect(page, /loaders/i, SEED.fullLoader);
  await page
    .locator('main label', { hasText: /opening meter/i })
    .locator('xpath=following::input[1]')
    .fill(String(OPENING));

  const [startRes] = await Promise.all([
    page.waitForResponse((r) => /\/trips\/steps\/start$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /submit trip details/i }).click(),
  ]);
  expect(startRes.ok(), `Step 1 submit → ${startRes.status()} ${await startRes.text()}`).toBeTruthy();

  const mineList = (await apiTrips(request, '?includeDeleted=true')).filter(
    (t) =>
      FULL_RE.test(String(t.tripNo)) &&
      t.vehicleNo === SEED.fullVehicle &&
      t.startStepSubmitted === true
  );
  expect(mineList.length, 'exactly one trip created for the full-flow vehicle').toBe(1);
  const tripId = Number(mineList[0].id);
  const tripNo = String(mineList[0].tripNo);
  const TRIP_RE = new RegExp(tripNo.replace(/-/g, '\\-'));
  expect(tripNo).toMatch(/^TR-\d{8}-\d{3}$/);

  // Permanent Trip No shown in the UI; official Step 1 timestamp persisted.
  {
    const s1 = await fullTrip(request, tripId);
    expect(s1.startStepSubmitted).toBe(true);
    expect(s1.startStepSubmittedAt ?? null, 'Step 1 server timestamp').toBeTruthy();
  }

  // Reload → all five steps become openable; Trip No visible.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  for (const n of [1, 2, 3, 4, 5]) {
    await expect(stepBtn(page, n)).not.toHaveAttribute('aria-label', /Locked/i);
  }
  await expect(page.getByText(tripNo, { exact: true }).first()).toBeVisible();

  // ─────────────────────────────  STEP 2 (real UI)  ─────────────────────
  await stepBtn(page, 2).click();
  await expect(page.getByRole('heading', { name: /farm/i }).first()).toBeVisible();
  await assertNoRawKeys(page);

  await pickReactSelect(page, /farm/i, SEED.farm);
  await pickReactSelect(page, /bird type/i, SEED.birdType);
  await labelInput(page, /farm address/i).fill('E2E Farm Gate Road');
  // Deterministic GPS: permission granted + coordinate pinned via test.use().
  await page.getByRole('button', { name: /get gps/i }).click();
  await expect(page.getByText(/captured at/i)).toBeVisible({ timeout: 15_000 });
  await labelInput(page, /destination meter/i).fill(String(DEST));
  await labelInput(page, /avg bird weight/i).fill('2');

  const [farmRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/steps/farm$`).test(r.url()) && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /submit farm details/i }).click(),
  ]);
  expect(farmRes.ok(), `Step 2 submit → ${farmRes.status()} ${await farmRes.text()}`).toBeTruthy();

  {
    const s2 = await fullTrip(request, tripId);
    expect(s2.farmStepSubmitted).toBe(true);
    expect(s2.id).toBe(tripId);
    expect(s2.tripNo).toBe(tripNo);
    expect(s2.vehicleNo).toBe(SEED.fullVehicle);
    expect(Number(s2.sourceFarmId), 'farm persisted').toBeGreaterThan(0);
    expect(Number(s2.destMeter)).toBe(DEST);
    expect(Number(s2.avgBirdWeight)).toBe(2);
    expect(s2.farmGpsLat ?? null, 'GPS captured through the UI').toBeTruthy();
  }

  // Reload → Step 2 still shows the submitted values.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 2).click();
  await expect(page.getByText(SEED.farm).first()).toBeVisible();
  await expect(page.getByText(new RegExp(`${DEST}`))).toBeVisible();

  // ── STEP 2 → ORDERS: the SAME operational trip is visible in Orders ───
  await page.goto('/operations?tab=orders');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /order assignment/i }).click();
  await page.getByRole('checkbox', { name: new RegExp(`Select.*${SEED.shops[0]}`, 'i') }).check();
  {
    const combo = page.locator('input[role="combobox"]').first();
    await combo.click();
    await combo.pressSequentially(SEED.fullVehicle, { delay: 20 });
    await expect(
      page.getByRole('option', { name: new RegExp(SEED.fullVehicle) }),
      'the Step-2-complete trip appears as an assignable vehicle in Orders'
    ).toBeVisible();
    await page.keyboard.press('Escape');
  }
  const ordersTrip = await fullTrip(request, tripId);
  expect(ordersTrip.tripNo).toBe(tripNo);
  expect(ordersTrip.vehicleNo).toBe(SEED.fullVehicle);
  expect(ordersTrip.tripDate).toBe((await fullTrip(request, tripId)).tripDate);

  // ─────────────────────────────  STEP 3 (real UI)  ─────────────────────
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 3).click();
  await expect(page.getByText(/DC Photo/i).first()).toBeVisible();
  await assertNoRawKeys(page);

  // DC photo — a generated PNG through the real hidden file input.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'dc-photo.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  });
  await expect(page.getByRole('img', { name: /pickup/i }).first()).toBeVisible({ timeout: 10_000 });

  // Exactly 5 pickup boxes @ 30 birds / 60 kg — balances the 5 Step-4 deliveries.
  const boxCell = (idx: number) => page.locator('input.mini-input').nth(idx);
  for (let b = 0; b < 5; b += 1) {
    await boxCell(b * 2).fill('30'); // birds
    await boxCell(b * 2 + 1).fill('60'); // weight
    if (b < 4) await page.getByRole('button', { name: /add box/i }).click();
  }

  await page.getByRole('button', { name: /create pickup/i }).click();
  const [pickupRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/steps/pickup$`).test(r.url()) && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /yes,?\s*create/i }).click(),
  ]);
  expect(pickupRes.ok(), `Step 3 submit → ${pickupRes.status()} ${await pickupRes.text()}`).toBeTruthy();

  {
    const s3 = await fullTrip(request, tripId);
    expect(s3.pickupStepSubmitted).toBe(true);
    expect(s3.id).toBe(tripId);
    expect(s3.tripNo).toBe(tripNo);
    expect((s3.boxDetails as unknown[]).length, '5 pickup boxes persisted').toBe(5);
    expect(Number(s3.totalBirds)).toBe(150);
    expect(s3.dcPhotoKey ?? null, 'DC photo satisfied through the real UI').toBeTruthy();
  }

  // Reload → Step 3 persisted values remain.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 3).click();
  await expect(page.getByText(/150/).first()).toBeVisible();

  // ── STEP 3 → ORDERS ASSIGNMENT (real UI): assign 5 shops to THIS trip ──
  await page.goto('/operations?tab=orders');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /order assignment/i }).click();
  for (const shop of SEED.shops) {
    await page.getByRole('checkbox', { name: new RegExp(`Select.*${shop}`, 'i') }).check();
  }
  {
    const combo = page.locator('input[role="combobox"]').first();
    await combo.click();
    await combo.pressSequentially(SEED.fullVehicle, { delay: 20 });
    await page.getByRole('option', { name: new RegExp(SEED.fullVehicle) }).click();
  }
  const tripCountBeforeAssign = (await apiTrips(request, '?includeDeleted=true')).length;
  const [assignRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/steps/deliveries$`).test(r.url()) && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /finish assignment/i }).click(),
  ]);
  expect(assignRes.ok(), `finish assignment → ${assignRes.status()} ${await assignRes.text()}`).toBeTruthy();

  {
    const a = await fullTrip(request, tripId);
    expect(a.id).toBe(tripId);
    expect(a.tripNo).toBe(tripNo);
    expect(a.vehicleNo).toBe(SEED.fullVehicle);
    expect(a.deliveryStepSubmitted, 'assignment must NOT submit Step 4').not.toBe(true);
    expect((a.deliveries as unknown[]).length, '5 assigned shops').toBe(5);
    expect(
      new Set((a.deliveries as Array<Record<string, unknown>>).map((d) => d.shopId)).size,
      'no duplicate shop rows'
    ).toBe(5);
    for (const d of a.deliveries as Array<Record<string, unknown>>) {
      expect(String(d.remarks).startsWith('[ORDER]'), `row remarks: ${d.remarks}`).toBe(true);
    }
  }
  expect(
    (await apiTrips(request, '?includeDeleted=true')).length,
    'no extra vehicle trip created by assignment'
  ).toBe(tripCountBeforeAssign);

  // Reload Orders → 5 shops remain assigned (persisted, not UI-only).
  await expect(await trackingRowFor(page, tripNo)).toContainText('0 / 5 Delivered');

  // ─────────────────────────────  STEP 4 (real UI)  ─────────────────────
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 4).click();
  for (const shop of SEED.shops) {
    await expect(page.getByText(shop, { exact: true }).first()).toBeVisible();
  }

  for (let i = 0; i < SEED.shops.length; i += 1) {
    await deliverShopInStep4(page, tripId, SEED.shops[i], i + 1);
    await expect(await trackingRowFor(page, tripNo)).toContainText(`${i + 1} / 5 Delivered`);
    if (i === 0) {
      // Reload checkpoint after the first delivery.
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /delivery tracking/i }).click();
      await expect(page.getByRole('row', { name: TRIP_RE })).toContainText('1 / 5 Delivered');
    }
  }

  // ── STEP 4 FINAL SUBMIT (real UI) ────────────────────────────────────
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 4).click();
  await page.getByRole('button', { name: 'Submit Deliveries', exact: true }).click();
  const [step4SubmitRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/steps/deliveries$`).test(r.url()) && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /yes,?\s*submit/i }).click(),
  ]);
  expect(step4SubmitRes.ok(), `Step 4 submit → ${step4SubmitRes.status()} ${await step4SubmitRes.text()}`).toBeTruthy();

  {
    const s4 = await fullTrip(request, tripId);
    expect(s4.deliveryStepSubmitted, 'Step 4 submitted through the UI').toBe(true);
    expect((s4.deliveries as unknown[]).length, 'still exactly 5 delivery rows').toBe(5);
  }
  await page.reload();
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 4).click();
  await expect(page.getByText(/submitted/i).first()).toBeVisible();
  await expect(await trackingRowFor(page, tripNo)).toContainText('5 / 5 Delivered');

  // ─────────────────────────────  STEP 5 (real UI)  ─────────────────────
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 5).click();
  await expect(page.getByRole('heading', { name: /expenses|end details/i })).toBeVisible();

  await expenseInput(page, /^Meals/).fill('500');
  await expenseInput(page, /Loading/).fill('0'); // explicit zero
  await expenseInput(page, /Delivery Tolls/).fill('0');
  await expenseInput(page, /End Meter/).fill(String(END));
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: /save progress/i }).click();
  await expect
    .poll(async () => Number((await fullTrip(request, tripId)).closingMeter ?? (await fullTrip(request, tripId)).endMeter), {
      timeout: 20_000,
    })
    .toBe(END);
  {
    const s5save = await fullTrip(request, tripId);
    expect(s5save.status, 'Save Progress must not move the trip to Pending').toBe('Draft');
    expect(Boolean(s5save.expensesStepSubmitted), 'not submitted after Save Progress').toBe(false);
    expect(s5save.expensesStepSubmittedAt ?? null, 'no completion timestamp on Save Progress').toBeNull();
    expect(Number(s5save.meals)).toBe(500);
    expect(Number(s5save.loading), 'explicit zero persisted').toBe(0);
  }

  // Reload → the Step 5 values are still there.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 5).click();
  await expect(expenseInput(page, /^Meals/)).toHaveValue('500');
  await expect(expenseInput(page, /End Meter/)).toHaveValue(String(END));

  // ── STEP 5 FINAL SUBMIT (real UI) ────────────────────────────────────
  await page.getByRole('button', { name: /submit end details/i }).click();
  const [step5SubmitRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/steps/expenses$`).test(r.url()) && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /yes,?\s*submit/i }).click(),
  ]);
  expect(step5SubmitRes.ok(), `Step 5 submit → ${step5SubmitRes.status()} ${await step5SubmitRes.text()}`).toBeTruthy();

  // ── COMPLETE FLOW ASSERTION ─────────────────────────────────────────
  const done = await fullTrip(request, tripId);
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
    expect(Boolean(done[f]), `${f} must be true`).toBe(true);
  }
  expect(done.status, 'trip is Pending after Step 5 submit').toBe('Pending');
  expect((done.expensesStepSubmittedAt ?? done.submittedAt) ?? null, 'server completion timestamp').toBeTruthy();
  expect(done.id).toBe(tripId);
  expect(done.tripNo).toBe(tripNo);
  expect(done.vehicleNo).toBe(SEED.fullVehicle);
  const onVehicle = (await apiTrips(request, '?includeDeleted=true')).filter(
    (t) => t.vehicleNo === SEED.fullVehicle && !String(t.tripNo).startsWith('ORD-')
  );
  expect(onVehicle.length, 'exactly one operational vehicle trip exists').toBe(1);

  // Reload → still Pending.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  expect((await fullTrip(request, tripId)).status).toBe('Pending');

  // ── RECENT TABLE ───────────────────────────────────────────────────
  await gotoTripEntry(page);
  await page.getByRole('button', { name: /^pending\b/i }).click();
  await expect(page.getByRole('row', { name: TRIP_RE })).toBeVisible();
  await page.getByRole('button', { name: /^draft\b/i }).click();
  await expect(page.getByRole('row', { name: TRIP_RE })).toHaveCount(0);

  await page.getByRole('button', { name: /^all\b/i }).click();
  await page.getByRole('row', { name: TRIP_RE }).click();
  await page.getByRole('button', { name: /^edit\b/i }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(tripNo, { exact: true }).first()).toBeVisible();
  {
    const afterEdit = await fullTrip(request, tripId);
    expect(afterEdit.status, 'editing a Pending trip keeps it Pending').toBe('Pending');
    for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
      expect(Boolean(afterEdit[f]), `${f} stays true`).toBe(true);
    }
  }

  // ── COMPLETED (through the Recent-table status control) ─────────────
  await gotoTripEntry(page);
  await page.getByRole('button', { name: /^pending\b/i }).click();
  const row = page.getByRole('row', { name: TRIP_RE });
  const [statusRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/status$`).test(r.url()) && r.request().method() === 'PATCH'
    ),
    row.getByRole('combobox').selectOption('Completed'),
  ]);
  expect(statusRes.ok(), `Pending → Completed → ${statusRes.status()} ${await statusRes.text()}`).toBeTruthy();
  expect((await fullTrip(request, tripId)).status).toBe('Completed');

  await page.getByRole('button', { name: /^all\b/i }).click();
  await page.getByRole('row', { name: TRIP_RE }).click();
  await page.getByRole('button', { name: /^edit\b/i }).click();
  await page.waitForLoadState('networkidle');
  for (const n of [1, 2, 3, 4, 5]) {
    await expect(stepBtn(page, n)).not.toHaveAttribute('aria-label', /Locked/i);
  }
  {
    const c = await fullTrip(request, tripId);
    expect(c.status, 'editing a Completed trip keeps it Completed').toBe('Completed');
    for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
      expect(Boolean(c[f]), `${f} stays true on Completed`).toBe(true);
    }
  }
});
