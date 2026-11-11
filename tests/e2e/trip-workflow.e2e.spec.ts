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

/**
 * E2E-5B: resources selectable through the REAL Step 1 UI. The Step 1
 * dropdowns are fed by GET /trips/available-resources (TripEntryPage), which
 * excludes every vehicle/driver/supervisor on an active Draft trip and every
 * department-Operations crew row — so the legacy SEED One-series crew (all
 * `department: 'Operations'`) never appears and E2E-TRUCK-01 is occupied by
 * the seeded C2 trip. The XX_* dummy staff (migrations 081/082, with real
 * Driver/Supervisor/Helper/Loader departments) plus E2E-RENTAL-01 are the
 * deterministic selectable set for a fresh-trip flow; E2E-TRUCK-03 stays free
 * for the full-flow test 28 below.
 */
const T16 = {
  vehicle: 'E2E-RENTAL-01',
  supervisor: 'XX_Supervisor',
  driver: 'XX_Driver',
  helper: 'XX_Helper',
  loader: 'XX_Loader',
};

/** Vehicle + crew for the full-flow test 28 (free for the whole run: the
 *  test-16 flow occupies E2E-RENTAL-01 and C2 occupies E2E-TRUCK-01). */
const FULL_CREW = {
  vehicle: 'E2E-TRUCK-03',
  supervisor: 'XX_Supervisor_2',
  driver: 'XX_Driver_2',
  helper: 'XX_Helper_2',
  loader: 'XX_Loader_2',
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

// The i18n provider persists the choice under this exact key (src/i18n/translate.ts STORAGE_KEY).
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

// E2E-5A: authenticated browser + API setup for the protected Trip Entry /
// Orders routes. Uses the existing isolated harness owner fixture / session
// pattern (same as batch-c2 / batch-c3 / orders-live-workflow). Route
// protection is NOT bypassed or weakened: the browser performs the real UI
// login, and the API fixture logs in with the same owner credentials.
// The intentional unauthenticated 401 check in 'harness is up and seeded'
// stays unauthenticated.
const OWNER_USERNAME = process.env.E2E_TEST_OWNER_USERNAME ?? 'test-owner-4100';
const OWNER_PASSWORD = 'Test-only-password-123!';

async function loginApi(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { username: OWNER_USERNAME, password: OWNER_PASSWORD },
  });
  expect(login.ok(), `login → ${login.status()}`).toBeTruthy();
}

async function loginBrowser(page: Page) {
  await page.goto('/');
  await page.locator('#login-username').waitFor({ state: 'visible' });
  await page.locator('#login-username').fill(OWNER_USERNAME);
  await page.locator('#login-password').fill(OWNER_PASSWORD);
  await expect(page.locator('#login-password')).toHaveValue(OWNER_PASSWORD);
  const [loginRes] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST'
    ),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  if (!loginRes.ok()) {
    throw new Error(`login HTTP ${loginRes.status()} ${await loginRes.text()}`);
  }
  await expect(page.locator('#login-username')).toHaveCount(0, { timeout: 30_000 });
  // Authenticated shell readiness: the user chip proves the session is live
  // and the protected UI can be driven (no fixed waits).
  await expect(page.getByRole('button', { name: /Test Owner/i }).first()).toBeVisible({ timeout: 30_000 });
}

/** Escape a literal string for embedding in a RegExp. */
function escRe(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * E2E-5B: resolve a dropdown trigger through its STABLE field label (the
 * trigger's own accessible name changes to the picked value, so
 * placeholder-anchored lookups go stale after a pick). Works for the
 * SearchDropdown <button> and the MultiSearchDropdown [role=button].
 */
function dropdownTrigger(scope: Page | Locator, fieldLabel: RegExp) {
  return scope
    .locator('label', { hasText: fieldLabel })
    .first()
    .locator('xpath=following::*[name()="button" or @role="button"][1]');
}

/** E2E-5B: option rows render as `ul > li > button` in the open panel. */
function dropdownOption(page: Page, optionText: string) {
  // Start-anchored with a word boundary so `XX_Helper` never matches
  // `XX_Helper_2`.
  return page
    .locator('div.absolute ul li button', { hasText: new RegExp(`^${escRe(optionText)}\\b`) })
    .first();
}

/**
 * E2E-5B: pick one value in a SearchDropdown (Step 1 vehicle/supervisor/
 * driver, Step 2 farm/bird type): open the trigger, click the option row,
 * assert the trigger keeps the value.
 */
async function pickSearchDropdown(
  page: Page,
  fieldLabel: RegExp,
  optionText: string,
  scope?: Locator
) {
  const trigger = dropdownTrigger(scope ?? page, fieldLabel);
  await expect(trigger, `dropdown trigger ${fieldLabel}`).toBeVisible();
  await trigger.click();
  const option = dropdownOption(page, optionText);
  await expect(option, `dropdown option "${optionText}"`).toBeVisible();
  await option.click();
  await expect(trigger, `dropdown keeps "${optionText}"`).toContainText(optionText);
}

/**
 * E2E-5B: pick values in a MultiSearchDropdown (Step 1 helpers/loaders).
 * Its option rows are plain toggle buttons; the trigger stays open until
 * toggled shut, then shows one chip per picked row.
 */
async function pickMultiSearchDropdown(
  page: Page,
  fieldLabel: RegExp,
  optionTexts: string[],
  scope?: Locator
) {
  const trigger = dropdownTrigger(scope ?? page, fieldLabel);
  await expect(trigger, `multi dropdown trigger ${fieldLabel}`).toBeVisible();
  await trigger.click();
  for (const optionText of optionTexts) {
    const option = dropdownOption(page, optionText);
    await expect(option, `dropdown option "${optionText}"`).toBeVisible();
    await option.click();
  }
  await trigger.click();
  for (const optionText of optionTexts) {
    await expect(trigger, `dropdown keeps "${optionText}"`).toContainText(optionText);
  }
}

/**
 * E2E-5B: pick Step 4 pickup boxes in the Select-boxes MultiSearchDropdown
 * (field label "Select available boxes" in the delivery dialog). The
 * trigger collapses the selection to a "boxes selected" summary, so each
 * picked box is asserted through its `Remove <boxNo>` chip instead.
 */
async function pickPickupBox(page: Page, boxNo: number | string, scope: Locator) {
  const trigger = dropdownTrigger(scope, /select available boxes/i);
  await expect(trigger, 'pickup box multi dropdown').toBeVisible();
  await trigger.click();
  const option = dropdownOption(page, `Box ${boxNo}`);
  await expect(option, `pickup box ${boxNo}`).toBeVisible();
  await option.click();
  await trigger.click();
  await expect(
    page.getByRole('button', { name: new RegExp(`^Remove\\s+0*${escRe(String(boxNo))}$`, 'i') }),
    `pickup box ${boxNo} stays selected`
  ).toBeVisible();
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
  // available-resources requires trip.view: an unauthenticated call is 401.
  const unauth = await request.get(`${API}/trips/available-resources`);
  expect(unauth.status(), 'unauthenticated available-resources → 401').toBe(401);
  // Authenticate with the isolated E2E owner fixture first.
  const login = await request.post(`${API}/auth/login`, {
    data: {
      username: process.env.E2E_TEST_OWNER_USERNAME ?? 'test-owner-4100',
      password: 'Test-only-password-123!',
    },
  });
  expect(login.ok(), `login → ${login.status()}`).toBeTruthy();
  const res = await request.get(`${API}/trips/available-resources`);
  expect(res.status(), 'authenticated available-resources → 200').toBe(200);
  const body = await res.json();
  const vehicleNumbers = body.vehicles.map((v: { vehicleNumber: string }) => v.vehicleNumber);
  // The seeded active C2 trip occupies E2E-TRUCK-01 (Draft + start-step
  // submitted), so the availability rule must exclude exactly that vehicle
  // while still returning the genuinely free seeded resources.
  const trips = await apiTrips(request, '?includeDeleted=true');
  const occupant = trips.find(
    (t) => t.vehicleNo === SEED.vehicle && t.status === 'Draft' && t.startStepSubmitted === true
  );
  expect(occupant, 'seeded active C2 trip occupies E2E-TRUCK-01').toBeTruthy();
  expect(vehicleNumbers, 'occupied E2E-TRUCK-01 is excluded').not.toContain(SEED.vehicle);
  expect(vehicleNumbers, 'free E2E-TRUCK-03 is returned').toContain(SEED.fullVehicle);
  expect(vehicleNumbers, 'free E2E-RENTAL-01 is returned').toContain('E2E-RENTAL-01');
});

test('16: step-enablement dependency — new trip only Step 1; after Step 1 only Steps 2 + 5; Step 3/4 stay locked until their predecessor is submitted', async ({ page, request }) => {
  await loginApi(request);
  await loginBrowser(page);
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

  // Fill valid Step 1 with the E2E-5B selectable set: E2E-RENTAL-01 + XX_*
  // base crew (available-resources excludes the seeded C2 occupant
  // E2E-TRUCK-01 and the department-Operations E2E crew). Rented vehicles
  // render no opening-meter input (readings belong to the rental provider).
  await pickSearchDropdown(page, /vehicle no/i, T16.vehicle);
  await pickSearchDropdown(page, /supervisor/i, T16.supervisor);
  await pickSearchDropdown(page, /driver/i, T16.driver);
  await pickMultiSearchDropdown(page, /helpers/i, [T16.helper]);
  await pickMultiSearchDropdown(page, /loaders/i, [T16.loader]);
  await expect(page.getByText(/rental vehicle/i).first()).toBeVisible();

  // The submit runs through the real confirm dialog (Submit → confirm).
  await page.getByRole('button', { name: /submit trip details/i }).click();
  const [startRes] = await Promise.all([
    page.waitForResponse((r) => /\/trips\/steps\/start$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /yes,?\s*create/i }).click(),
  ]);
  expect(startRes.ok(), `Step 1 submit → ${startRes.status()}`).toBeTruthy();

  // Permanent Trip No generated; same authoritative trip.
  const trips = await apiTrips(request, '?includeDeleted=true');
  const mine = trips.find(
    (t) =>
      String(t.tripNo).startsWith('TR-') &&
      t.startStepSubmitted === true &&
      t.status === 'Draft' &&
      t.vehicleNo === T16.vehicle &&
      !t.farmStepSubmitted // the pre-seeded assign trip is already past Step 2
  );
  expect(mine, 'a Draft trip with a TR- number and startStepSubmitted').toBeTruthy();
  tripId = Number(mine!.id);
  tripNo = String(mine!.tripNo);
  expect(tripNo).toMatch(/^TR-\d{8}-\d{3}$/);

  // After Step 1 (fresh load): Step 2 and Step 5 open; Step 3 and Step 4 stay
  // LOCKED until their immediate predecessor is submitted. Step 5 is the
  // deliberate exception — expenses can be entered mid-trip.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button[aria-label^="Step 1"]')).toBeVisible();
  for (const n of [1, 2, 5]) {
    await expect(page.locator(`button[aria-label^="Step ${n}"]`)).not.toHaveAttribute('aria-label', /Locked/i);
  }
  for (const n of [3, 4]) {
    await expect(page.locator(`button[aria-label^="Step ${n}"]`)).toHaveAttribute('aria-label', /Locked/i);
  }

  // Open Step 5 BEFORE Step 4 (allowed after Step 1).
  await page.locator('button[aria-label^="Step 5"]').click();
  await expect(page.getByRole('heading', { name: /expenses|end details/i })).toBeVisible();

  // A locked step must not open: the Step 3 button stays disabled until
  // Step 2 is submitted, so the Expenses view remains mounted and no
  // Pickup UI appears.
  await expect(page.locator('button[aria-label^="Step 3"]')).toBeDisabled();
  await expect(page.getByRole('heading', { name: /expenses|end details/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /pickup/i })).toHaveCount(0);
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
  await loginBrowser(page);
  await setLanguage(page, 'en');
  await openStep5(page, tripId);

  // A value that persists, a value typed then CLEARED, and an explicit ZERO.
  // (The sheet renders zero amounts as a blank field by design — the
  // explicit-zero *persistence* is proven against the API in test 18/21.)
  // No end meter here: the test-16 trip is rented, so Step 5 renders no
  // meter input (readings belong to the rental provider).
  await expenseInput(page, /^Meals/).fill('500');
  await expenseInput(page, /Vehicle Maintenance/).fill('123');
  await expenseInput(page, /Vehicle Maintenance/).fill('');
  await expenseInput(page, /Loading/).fill('0');

  // Let the debounced durable write flush to IndexedDB — then hard-reload.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-label^="Step 5"]').click();

  await expect(page.getByText(/restored your unsaved step 5/i)).toBeVisible();
  await expect(expenseInput(page, /^Meals/)).toHaveValue('500');
  await expect(expenseInput(page, /Vehicle Maintenance/)).toHaveValue('');
});

test('18: Step 5 Save Progress before Step 4 — saves (incl. explicit zero), not submitted, no completion timestamp, survives reload', async ({ page, request }) => {
  await loginApi(request);
  await loginBrowser(page);
  await setLanguage(page, 'en');
  await openStep5(page, tripId);

  // Self-contained: set the values this test asserts on. (No end meter:
  // the test-16 trip is rented — Step 5 renders no meter input and the
  // save omits it, so the landing proof is the persisted meals value.)
  await expenseInput(page, /^Meals/).fill('500');
  await expenseInput(page, /Loading/).fill('0');
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: /save progress/i }).click();

  // Verify against the PERSISTED backend state (retried until the save lands).
  await expect
    .poll(async () => Number((await apiTrip(request, tripId)).meals ?? -1), {
      timeout: 20_000,
    })
    .toBe(500);

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
});

test('19: Step 5 final Submit is blocked while Step 4 is unsubmitted (bilingual, human-readable message)', async ({ page, request }) => {
  await loginApi(request);
  await loginBrowser(page);
  // EN — through the browser: click Submit, confirm, and see the bilingual
  // Step-4 prerequisite notice; the trip must not advance.
  await setLanguage(page, 'en');
  await openStep5(page, tripId);
  const before = (await apiTrip(request, tripId)).status;

  await page.locator('button:has(svg.lucide-send)').first().click();
  await page.getByRole('button', { name: /yes,?\s*submit/i }).click();
  await expect(page.getByText(/step 4[\s\S]*has not been submitted/i)).toBeVisible({ timeout: 12_000 });

  expect((await apiTrip(request, tripId)).status, 'blocked submit must not change status').toBe(before);
  expect((await apiTrip(request, tripId)).expensesStepSubmittedAt ?? null).toBeNull();

  // TE — the notice text is a real Telugu string (not a raw key) in the
  // bundled dictionary, and a Telugu submit is also rejected server-side.
  await setLanguage(page, 'te');
  await openStep5(page, tripId);
  await expect(stepBtn(page, 4)).toContainText(/డెలివరీలు/);
  await assertNoRawKeys(page);

  const blocked = await request.post(`${API}/trips/${tripId}/steps/expenses`, {
    data: { endMeter: 100700, destinationTolls: 0 },
  });
  expect(blocked.status(), 'server rejects Step 5 submit before Step 4').toBe(422);
  expect((await apiTrip(request, tripId)).status).toBe(before);
});


// -- Lifecycle (tests 21-25) runs on the seeded C2 trip (E2E-TRUCK-01). --
//    The harness seeds no fully-completed Pending trip, so test 21 completes
//    C2 to Pending through the real step APIs (its Step 3 boxes plus the
//    saved delivery rows are already seeded), tests 22/23 exercise it, and
//    test 25 deletes it through the real 10-second UI. C2 belongs to the
//    batch-c2 file that runs earlier in this project, so reusing it here
//    disturbs nothing and occupies no additional vehicle.
let lifecycleTripId = 0;
let lifecycleTripNo = '';

/** The lifecycle trip built in test 21 (identity asserted on every access). */
async function lifecycleTrip(request: APIRequestContext) {
  const t = await apiTrip(request, lifecycleTripId);
  expect(t.tripNo, 'lifecycle trip keeps its number').toBe(lifecycleTripNo);
  return t as unknown as Record<string, unknown> & { id: number };
}

test('20: the Step-2-complete trip keeps its identity for Orders; Orders page renders with no raw keys', async ({ page, request }) => {
  await loginApi(request);
  await loginBrowser(page);
  await setLanguage(page, 'en');

  const farms = await (await request.get(`${API}/masters/farms`)).json();
  const farmId = farms.find((f: { farmName: string }) => f.farmName === SEED.farm).id;
  const bts = await (await request.get(`${API}/masters/bird-types`)).json();
  const birdTypeId = bts.find((b: { birdType: string }) => b.birdType === SEED.birdType).id;    // The farm-submit schema requires the canonical farmBirdTypeId plus a
    // valid GPS fix (Step 2 captures one from the device); the spec-pinned
    // coordinates keep the location deterministic.
    const step2 = await request.post(`${API}/trips/${tripId}/steps/farm`, {
      data: { sourceFarmId: farmId, birdTypeId, farmBirdTypeId: birdTypeId, farmAddress: 'E2E Farm Address', destMeter: 100120, pickupTolls: 0, avgBirdWeight: 2.4, farmGpsLat: 17.385044, farmGpsLon: 78.486671 },
    });
  expect(step2.ok(), `Step 2 -> ${step2.status()} ${await step2.text()}`).toBeTruthy();

  // Part S: the SAME authoritative trip -- id / no / vehicle / date unchanged,
  // Step 2 complete, delivery not yet submitted -> available to Orders.
  const t = await apiTrip(request, tripId);
  expect(t.tripNo).toBe(tripNo);
  expect(t.vehicleNo).toBe(T16.vehicle);
  expect(t.farmStepSubmitted).toBe(true);
  expect(t.deliveryStepSubmitted).not.toBe(true);

  // Part U/T: Orders derives everything from the persisted /trips data (no
  // parallel store); the page loads clean in both languages.
  for (const lang of ['en', 'te'] as const) {
    await setLanguage(page, lang);
    await page.goto('/operations/orders/collection');
    await page.waitForLoadState('networkidle');
    await assertNoRawKeys(page);
    // No in-page switcher: the sidebar carries the three Orders pages, and the
    // URL decides which one is mounted. Both languages must render it cleanly.
    await expect(page.locator('a[href="/operations/orders/assignment"]')).not.toHaveCount(0);
    await expect(page.locator('#orders-panel-collection')).toBeVisible();
  }
});

test('21: a fully-completed trip is Pending with a SERVER completion timestamp and all step flags set; editing it does not reset them', async ({ request }) => {
  await loginApi(request);
  // E2E-5B: complete the seeded C2 trip (E2E-TRUCK-01 — start/farm/pickup
  // submitted, its two C2-A delivery rows already saved) to Pending through
  // the real step APIs: balance its pickup (4 x 40 birds x 80 kg) across
  // four shop deliveries, submit Step 4, then submit Step 5.
  const seeded = await apiTrips(request, '?includeDeleted=true');
  const c2 = seeded.find(
    (x) =>
      x.pickupStepSubmitted === true &&
      x.deliveryStepSubmitted !== true &&
      x.vehicleNo === 'E2E-TRUCK-01'
  );
  expect(c2, 'seeded C2 trip must exist').toBeTruthy();
  lifecycleTripId = Number(c2!.id);
  const shopsDir = (await (await request.get(`${API}/masters/shops`)).json()) as Array<{
    id: number;
    shopName: string;
  }>;
  const birdTypes = (await (await request.get(`${API}/masters/bird-types`)).json()) as Array<{
    id: number;
    birdType: string;
  }>;
  const broiler = birdTypes.find((b) => b.birdType === 'E2E Broiler');
  expect(broiler, 'E2E Broiler must exist').toBeTruthy();
  const shopIdOf = (name: string) => {
    const s = shopsDir.find((x) => x.shopName === name);
    expect(s, `shop ${name} must exist`).toBeTruthy();
    return Number(s!.id);
  };
  const balanced = [
    { shop: 'E2E Shop Alpha', birds: 40, weight: 80, mortality: 0, mortKg: 0, boxes: [1] },
    { shop: 'E2E Shop Bravo', birds: 38, weight: 76, mortality: 2, mortKg: 4, boxes: [2] },
    { shop: 'E2E Shop Charlie', birds: 41, weight: 82, mortality: 0, mortKg: 0, boxes: [3] },
    { shop: 'E2E Shop Delta', birds: 39, weight: 78, mortality: 0, mortKg: 0, boxes: [4] },
  ].map((r) => ({
    shopId: shopIdOf(r.shop),
    shopName: r.shop,
    birdTypeId: Number(broiler!.id),
    birdType: 'E2E Broiler',
    deliveryMode: 'box',
    selectedBoxIds: r.boxes,
    birds: r.birds,
    weight: r.weight,
    mortality: r.mortality,
    mortKg: r.mortKg,
    rate: 100,
    amount: r.birds * 100,
  }));
  const put = await request.put(`${API}/trips/${lifecycleTripId}/deliveries`, {
    data: { deliveries: balanced },
  });
  expect(put.ok(), `balance deliveries → ${put.status()}`).toBeTruthy();
  const saved = await apiTrip(request, lifecycleTripId);
  expect((saved.deliveries as unknown[]).length, '4 balanced delivery rows').toBe(4);
  const sub4 = await request.post(`${API}/trips/${lifecycleTripId}/steps/deliveries`, {
    data: { deliveries: saved.deliveries, mode: 'submit' },
  });
  expect(sub4.ok(), `submit Step 4 → ${sub4.status()}`).toBeTruthy();
  const sub5 = await request.post(`${API}/trips/${lifecycleTripId}/steps/expenses`, {
    data: { endMeter: 50200, closingMeter: 50200, destinationTolls: 0, meals: 400, loading: 0, mode: 'submit', status: 'Pending', endStepSubmitted: true, expensesStepSubmitted: true },
  });
  expect(sub5.ok(), `submit Step 5 → ${sub5.status()}`).toBeTruthy();
  lifecycleTripNo = String((await apiTrip(request, lifecycleTripId)).tripNo);
  const t = await lifecycleTrip(request);
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
  await loginApi(request);
  const t = await lifecycleTrip(request);
  const edit = await request.post(`${API}/trips/${t.id}/steps/farm`, {      data: { sourceFarmId: t.sourceFarmId, birdTypeId: t.birdTypeId, farmBirdTypeId: t.birdTypeId, farmGpsLat: 17.385044, farmGpsLon: 78.486671, farmAddress: 'Seed Farm Address EDITED', destMeter: 90121, pickupTolls: 0, avgBirdWeight: 2.5, farmStepSubmitted: true },
  });
  expect(edit.ok(), `edit Pending farm -> ${edit.status()} ${await edit.text()}`).toBeTruthy();
  const after = await apiTrip(request, t.id);
  expect(after.status).toBe('Pending');
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
    expect(Boolean(after[f]), f + ' stays true').toBe(true);
  }
});

test('23: Pending -> Completed; editing Completed keeps identity/flags/status; no Pending->Draft, no status->Deleted', async ({ request }) => {
  await loginApi(request);
  const t = await lifecycleTrip(request);
  const done = await request.patch(`${API}/trips/${t.id}/status`, { data: { status: 'Completed', approvedBy: 'E2E' } });
  expect(done.ok(), `-> Completed -> ${done.status()} ${await done.text()}`).toBeTruthy();
  let after = await apiTrip(request, t.id);
  expect(after.status).toBe('Completed');
  expect(after.tripNo).toBe(lifecycleTripNo);

  const edit = await request.post(`${API}/trips/${t.id}/steps/expenses`, {
    data: { endMeter: 90655, destinationTolls: 0, meals: 450, loading: 0, expensesStepSubmitted: true, endStepSubmitted: true },
  });
  expect(edit.ok(), `edit Completed -> ${edit.status()} ${await edit.text()}`).toBeTruthy();
  after = await apiTrip(request, t.id);
  expect(after.status, 'stays Completed under ordinary editing').toBe('Completed');
  expect(after.tripNo).toBe(lifecycleTripNo);
  for (const f of ['startStepSubmitted', 'farmStepSubmitted', 'pickupStepSubmitted', 'deliveryStepSubmitted', 'endStepSubmitted', 'expensesStepSubmitted']) {
    expect(Boolean(after[f])).toBe(true);
  }

  expect((await request.patch(`${API}/trips/${t.id}/status`, { data: { status: 'Draft' } })).status(), 'no Pending/Completed -> Draft').toBe(422);
  expect((await request.patch(`${API}/trips/${t.id}/status`, { data: { status: 'Deleted' } })).status(), 'no status -> Deleted').toBe(422);
});

test('24: Step 1 opening meter -- the current trip is never its own previous meter', async ({ request }) => {
  await loginApi(request);
  // E2E-5B: the rented test-16 trip has no opening-meter input in the UI
  // (readings belong to the rental provider), so set the reference reading
  // through the same start-step API the test re-submits below. The last-
  // meter ledger only counts submitted trip readings, so the unsubmitted
  // Step 5 saves from tests 17-19 stay invisible here.
  const t0 = await apiTrip(request, tripId);
  const amend = await request.post(`${API}/trips/${tripId}/steps/start`, {
    data: {
      vehicleId: t0.vehicleId, vehicleNo: t0.vehicleNo, driverId: t0.driverId, driverName: t0.driverName,
      supervisorId: t0.supervisorId, supervisorName: t0.supervisorName, helpers: t0.helpers, loaders: t0.loaders,
      openingMeter: 100000, startStepSubmitted: true, tripDate: t0.tripDate,
    },
  });
  expect(amend.ok(), `set opening meter → ${amend.status()}`).toBeTruthy();
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
  await loginApi(request);
  await loginBrowser(page);
  await setLanguage(page, 'en');
  const t = await lifecycleTrip(request);
  await gotoTripEntry(page);    const row = new RegExp(lifecycleTripNo.replace(/-/g, '\\-'));
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
  await loginBrowser(page);
  for (const lang of ['en', 'te'] as const) {
    await setLanguage(page, lang);
    await gotoTripEntry(page);
    await page.getByRole('button', { name: lang === 'en' ? /create new trip/i : /కొత్త ట్రిప్/ }).click();

    await expect(stepBtn(page, 1)).toContainText(lang === 'en' ? /Trip Details/ : /ట్రిప్ వివరాలు/);
    await expect(stepBtn(page, 4)).toContainText(lang === 'en' ? /Delivery Details/ : /డెలివరీ వివరాలు/);
    await assertNoRawKeys(page);

    await page.goto('/operations/orders/collection');
    await page.waitForLoadState('networkidle');
    await assertNoRawKeys(page);
  }
});

// ── Orders — the CRITICAL Order Collection flow, driven through the real
//    Order Collection UI (not the API). Proves the day's collection
//    container persists ONE row per shop with the entered box counts, that
//    the filed quantities survive a full page reload, and that a passed
//    deadline files the day with no Finish button involved.

/** Yesterday in the pinned UTC timezone (yyyy-mm-dd). E2E-5B: the Orders
 *  collection/assignment flow files YESTERDAY so TODAY stays pristine for
 *  the orders-live-workflow project member (the assignment editor only
 *  edits TODAY, reached by faking the browser clock back one day). */
function yesterdayIso(): string {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

/** E2E-5B: the "No. of Boxes" cell input of a shop's collection-table row. */
const requiredInput = (page: Page, shop: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`No\\. of Boxes — ${escRe(shop)}$`, 'i') });

/** E2E-5B: type a shop's collected box count straight into its table row. */
async function addShopToCollection(page: Page, shop: string, boxes: number) {
  const row = page.getByRole('row', { name: new RegExp(escRe(shop), 'i') }).last();
  await expect(row, `collection row for ${shop}`).toBeVisible();
  await requiredInput(page, shop).fill(String(boxes));
}

/** Collected plan for the day — reused by the assignment spec below. */
const COLLECTION_PLAN: Array<[string, number]> = [
  [SEED.shops[0], 3],
  [SEED.shops[1], 2],
  [SEED.shops[2], 4],
  [SEED.shops[3], 2],
  [SEED.shops[4], 2],
];

test('27: Order Collection UI — one `orders` row per shop, real quantities, survives reload, the deadline files the day', async ({
  page,
  request,
}) => {
  await loginApi(request);
  await loginBrowser(page);
  await setLanguage(page, 'en');
  const day = yesterdayIso();
  await page.goto(`/operations/orders/collection?collectionDate=${day}`);
  await page.waitForLoadState('networkidle');

  // E2E-5B: this spec file runs BEFORE the orders-live-workflow member in
  // the project, and that member asserts TODAY's pool. Collect YESTERDAY so
  // today stays pristine for it; the deadline math is unchanged —
  // yesterday's window already passed, so the first save files the day.
  const nonContainerBefore = (await apiTrips(request, '?includeDeleted=true')).filter(
    (t) => !String(t.remarks ?? '').includes('[ORDER_COLLECTION]')
  ).length;

  for (const [shop, boxes] of COLLECTION_PLAN) {
    await addShopToCollection(page, shop, boxes);
  }

  // Save lands the rows; the day files itself right after (yesterday's
  // deadline already passed, so the auto-submit delay is zero): two POSTs
  // to the same endpoint, the second fired by the page effect with no
  // further click.
  const savePromise = page.waitForResponse(
    (r) => /\/trips\/\d+\/steps\/deliveries$/.test(r.url()) && r.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /save progress/i }).click();
  const saveRes = await savePromise;
  expect(saveRes.ok(), `collection save → ${saveRes.status()}`).toBeTruthy();
  const fileRes = await page.waitForResponse(
    (r) => /\/trips\/\d+\/steps\/deliveries$/.test(r.url()) && r.request().method() === 'POST'
  );
  expect(fileRes.ok(), `auto-file at the passed deadline → ${fileRes.status()}`).toBeTruthy();

  // Exactly one persisted order per shop, with the entered quantity.
  // Exactly one filed collection container for the day, with the entered
  // box counts on the matching shop rows.
  const dayTrips = (await apiTrips(request, '?includeDeleted=true')).filter(
    (t) => t.tripDate === day && String(t.remarks ?? '').includes('[ORDER_COLLECTION]')
  );
  expect(dayTrips.length, 'exactly one collection container for the day').toBe(1);
  const container = dayTrips[0];
  expect(container.startStepSubmitted, 'day filed automatically').toBe(true);
  const collectedRows = (await apiTrip(request, Number(container.id)))
    .deliveries as Array<Record<string, unknown>>;
  expect(collectedRows.length, 'one collected row per shop').toBe(COLLECTION_PLAN.length);
  for (const [shop, boxes] of COLLECTION_PLAN) {
    const prow = collectedRows.find((r) => r.shopName === shop);
    expect(prow, `collected row for ${shop}`).toBeTruthy();
    expect(Number(prow!.boxNo), `box count for ${shop}`).toBe(boxes);
  }
  // Collecting an order never mints a stray vehicle trip: only the day's
  // collection container is added.
  expect(
    (await apiTrips(request, '?includeDeleted=true')).filter(
      (t) => !String(t.remarks ?? '').includes('[ORDER_COLLECTION]')
    ).length,
    'no vehicle trip created by Order Collection'
  ).toBe(nonContainerBefore);

  // Reload: the filed day comes back from the backend read-only, with the
  // entered box counts intact — not from local state.
  await page.reload();
  await page.waitForLoadState('networkidle');
  for (const [shop, boxes] of COLLECTION_PLAN) {
    const shopRow = page.getByRole('row', { name: new RegExp(escRe(shop), 'i') }).last();
    await expect(shopRow, `filed row for ${shop}`).toBeVisible();
    await expect(shopRow.locator('td').nth(4), `filed box count for ${shop}`).toHaveText(
      String(boxes)
    );
  }
  await assertNoRawKeys(page);

  // Nothing latches the day by hand: a passed deadline files it on its own.
  await expect(page.getByRole('button', { name: /finish collection/i })).toHaveCount(0);
});

test('27b: Orders Assignment calendar — opens unclipped, month nav works, does not self-close, and the picked date drives the selected day', async ({ page }) => {
  await loginBrowser(page);
  await setLanguage(page, 'en');
  await page.goto('/operations/orders/assignment');
  await page.waitForLoadState('networkidle');

  const dateInput = page.getByTestId('orders-date-picker').locator('input');
  const todayStr = await dateInput.inputValue(); // DD/MM/YYYY == operational today
  expect(todayStr).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

  // Open the calendar.
  await dateInput.click();
  const dialog = page.getByRole('dialog', { name: /choose date/i });
  await expect(dialog).toBeVisible();

  // NOT clipped: the popup is fully inside the viewport (no overflow:hidden
  // ancestor cutting it off, no off-screen x/y).
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, 'calendar popup has a bounding box').toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);

  // Month navigation works (the Month control's label changes, then returns).
  const monthCtl = dialog.getByRole('button', { name: 'Month', exact: true });
  const m0 = (await monthCtl.innerText()).trim();
  await dialog.getByRole('button', { name: 'Previous month' }).click();
  await expect(monthCtl).not.toHaveText(m0);
  await dialog.getByRole('button', { name: 'Next month' }).click();
  await expect(monthCtl).toHaveText(m0);

  // Year control is present and interactive.
  await expect(dialog.getByRole('button', { name: 'Year', exact: true })).toBeVisible();

  // No immediate-close bug: still open after interacting inside it.
  await expect(dialog).toBeVisible();

  // Escape closes it (outside-interaction close works, not a stuck overlay).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // The picked date drives the selected day: choose a past day inside the
  // 7-day window → the day becomes read-only ("CLOSED"); then back to today.
  const [dd, mm, yyyy] = todayStr.split('/').map(Number);
  const past = new Date(Date.UTC(yyyy, mm - 1, dd - 2));
  const pastStr =
    `${String(past.getUTCDate()).padStart(2, '0')}/` +
    `${String(past.getUTCMonth() + 1).padStart(2, '0')}/` +
    `${past.getUTCFullYear()}`;

  await dateInput.fill(pastStr);
  await dateInput.blur();
  await expect(dateInput).toHaveValue(pastStr);
  await expect(page.getByText(/^CLOSED$/).first()).toBeVisible();

  await dateInput.fill(todayStr);
  await dateInput.blur();
  await expect(dateInput).toHaveValue(todayStr);
  await expect(page.getByText(/^TODAY$/).first()).toBeVisible();
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

/**
 * Open Delivery Tracking, filter it to ONE trip through the real table-level
 * search (server-side), and return that trip's per-shop rows.
 */
async function trackingRowsFor(page: Page, tripNo: string) {
  await page.goto('/operations/orders/delivery-tracking');
  await page.waitForLoadState('networkidle');
  await page.getByRole('textbox', { name: /search trip, vehicle/i }).fill(tripNo);
  await expect(page.getByRole('row').filter({ hasText: tripNo }).first()).toBeVisible();
  return page.getByRole('row').filter({ hasText: tripNo });
}

/** How many of a trip's tracked shops already show a delivery. */
async function trackingDeliveredCount(page: Page, tripNo: string): Promise<number> {
  const rows = await trackingRowsFor(page, tripNo);
  return rows.filter({ hasText: /Delivered/ }).count();
}

/**
 * E2E-5B: capture one already-listed shop through the real Step 4 edit
 * form. The [ORDER] plan row arrives with shop + bird type pre-filled, so
 * only its pickup box is picked (real MultiSearchDropdown), then Update +
 * Save land the PUT /trips/:id/deliveries the test waits on.
 */
async function deliverShopInStep4(page: Page, tripId: number, shop: string, boxNo: number) {
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 4).click();

  const card = page
    .locator('div.rounded-2xl', { hasText: shop })
    .filter({ has: page.getByRole('button', { name: /edit shop delivery/i }) })
    .last();
  await card.getByRole('button', { name: /edit shop delivery/i }).click();
  const dialog = page.getByRole('dialog', { name: /edit shop delivery/i });
  await expect(dialog).toBeVisible();

  await pickPickupBox(page, boxNo, dialog);
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
  await loginApi(request);
  await loginBrowser(page);
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

  // E2E-TRUCK-03 + XX_* second crew stay free for the whole flow (the
  // test-16 flow occupies E2E-RENTAL-01; C2 occupies E2E-TRUCK-01).
  await pickSearchDropdown(page, /vehicle no/i, FULL_CREW.vehicle);
  await pickSearchDropdown(page, /supervisor/i, FULL_CREW.supervisor);
  await pickSearchDropdown(page, /driver/i, FULL_CREW.driver);
  await pickMultiSearchDropdown(page, /helpers/i, [FULL_CREW.helper]);
  await pickMultiSearchDropdown(page, /loaders/i, [FULL_CREW.loader]);
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
      t.vehicleNo === FULL_CREW.vehicle &&
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

  // Reload → after Step 1 only Steps 2 + 5 open; Steps 3 + 4 stay locked;
  // Trip No visible.
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  for (const n of [1, 2, 5]) {
    await expect(stepBtn(page, n)).not.toHaveAttribute('aria-label', /Locked/i);
  }
  for (const n of [3, 4]) {
    await expect(stepBtn(page, n)).toHaveAttribute('aria-label', /Locked/i);
  }
  await expect(page.getByText(tripNo, { exact: true }).first()).toBeVisible();

  // ─────────────────────────────  STEP 2 (real UI)  ─────────────────────
  await stepBtn(page, 2).click();
  await expect(page.getByRole('heading', { name: /farm/i }).first()).toBeVisible();
  await assertNoRawKeys(page);

  await pickSearchDropdown(page, /farm/i, SEED.farm);
  await pickSearchDropdown(page, /bird type/i, SEED.birdType);
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
    expect(s2.vehicleNo).toBe(FULL_CREW.vehicle);
    expect(Number(s2.sourceFarmId), 'farm persisted').toBeGreaterThan(0);
    expect(Number(s2.destMeter)).toBe(DEST);
    expect(Number(s2.avgBirdWeight)).toBe(2);
    expect(s2.farmGpsLat ?? null, 'GPS captured through the UI').toBeTruthy();
  }

  // Reload → Step 2 still shows the submitted values, including Bird Type
  // (persisted frontend → backend farm_bird_type_id → GET → reopen).
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 2).click();
  await expect(page.getByText(SEED.farm).first()).toBeVisible();
  await expect(page.getByText(new RegExp(`${DEST}`))).toBeVisible();
  await expect(page.getByText(SEED.birdType).first()).toBeVisible();
  {
    const s2b = await fullTrip(request, tripId);
    expect(Number(s2b.farmBirdTypeId), 'farm bird type persisted to the trip row').toBeGreaterThan(0);
    expect(String(s2b.farmBirdType)).toBe(SEED.birdType);
  }

  // After Step 2: Step 3 opens, Step 4 stays locked.
  await expect(stepBtn(page, 3)).not.toHaveAttribute('aria-label', /Locked/i);
  await expect(stepBtn(page, 4)).toHaveAttribute('aria-label', /Locked/i);

  // ── STEP 2 → ORDERS: the SAME operational trip is visible in Orders ───
  // The Step-2-complete trip renders as an assignable vehicle card (the
  // card list itself is day-independent; today simply has no collection
  // yet, which the assignment editor below works around with the clock).
  await page.goto('/operations/orders/assignment');
  await page.waitForLoadState('networkidle');
  {
    const card = page
      .getByRole('button', {
        name: new RegExp(`Assign Shops[\\s\\S]*${escRe(FULL_CREW.vehicle)}`, 'i'),
      })
      .first();
    await expect(
      card,
      'the Step-2-complete trip appears as an assignable vehicle in Orders'
    ).toBeVisible();
    await expect(card).toContainText(tripNo);
  }
  const ordersTrip = await fullTrip(request, tripId);
  expect(ordersTrip.tripNo).toBe(tripNo);
  expect(ordersTrip.vehicleNo).toBe(FULL_CREW.vehicle);
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

  // After Step 3: Step 4 opens.
  await expect(stepBtn(page, 4)).not.toHaveAttribute('aria-label', /Locked/i);

  // ── STEP 3 → ORDERS ASSIGNMENT (real UI): assign 5 shops to THIS trip ──
  // Test 27 collects and files YESTERDAY, leaving TODAY pristine for the
  // orders-live-workflow project member — while the assignment editor only
  // edits TODAY. Fake the browser clock back one day so the editor opens
  // yesterday's pool; the trip itself stays today's.
  await page.clock.setFixedTime(Date.now() - 86_400_000);
  await page.goto('/operations/orders/assignment');
  await page.waitForLoadState('networkidle');
  {
    await page
      .getByRole('button', {
        name: new RegExp(`Assign Shops[\\s\\S]*${escRe(FULL_CREW.vehicle)}`, 'i'),
      })
      .first()
      .click();
  }
  // ONE pickup box per shop — well inside every collected order quantity.
  for (const shop of SEED.shops) {
    await page.getByRole('checkbox', { name: `Select — ${shop}`, exact: true }).check();
  }
  for (const shop of SEED.shops) {
    await page
      .getByRole('spinbutton', { name: `Assigned — ${shop}`, exact: true })
      .fill('1');
  }
  const tripCountBeforeAssign = (await apiTrips(request, '?includeDeleted=true')).length;
  const [assignRes] = await Promise.all([
    page.waitForResponse(
      (r) => new RegExp(`/trips/${tripId}/steps/deliveries$`).test(r.url()) && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /finish assignment/i }).click(),
  ]);
  expect(assignRes.ok(), `finish assignment → ${assignRes.status()}`).toBeTruthy();

  // The UI confirms with a toast, not a payload.
  await expect(page.getByText(/now visible in delivery tracking/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.clock.resume();

  // The assignment PROJECTED the plan onto the trip's Step 4 rows (server
  // truth, not UI state): 5 rows, 1 pickup box each, inside the collected
  // quantities, tagged to yesterday's filed container.
  const yDay = yesterdayIso();
  const yContainers = (await apiTrips(request, '?includeDeleted=true')).filter(
    (t) => t.tripDate === yDay && String(t.remarks ?? '').includes('[ORDER_COLLECTION]')
  );
  expect(yContainers.length, 'yesterday’s filed container exists').toBe(1);
  const yesterdayTripNo = String(yContainers[0].tripNo);
  {
    const a = await fullTrip(request, tripId);
    expect(a.id).toBe(tripId);
    expect(a.tripNo).toBe(tripNo);
    expect(a.vehicleNo).toBe(FULL_CREW.vehicle);
    expect(a.deliveryStepSubmitted, 'assignment must NOT submit Step 4').not.toBe(true);
    expect(String(a.remarks ?? '')).toContain(`order:${yesterdayTripNo}`);
    const planRows = (a.deliveries as Array<Record<string, unknown>>).filter((d) =>
      String(d.remarks ?? '').startsWith('[ORDER]')
    );
    expect(planRows.length, '5 assigned shops projected onto Step 4').toBe(5);
    expect(
      new Set(planRows.map((d) => d.shopId)).size,
      'no duplicate shop rows'
    ).toBe(5);
    for (const d of planRows) {
      expect(Number(d.boxNo), `assigned boxes for ${d.shopName}`).toBe(1);
      expect(String(d.deliveryMode), `box mode for ${d.shopName}`).toBe('box');
      expect(String(d.remarks)).toContain(`O:${yesterdayTripNo}`);
      const plan = COLLECTION_PLAN.find(([shop]) => shop === d.shopName);
      expect(plan, `collected plan for ${d.shopName}`).toBeTruthy();
      expect(Number(plan![1]), `assigned boxes fit the collected quantity`).toBeGreaterThanOrEqual(1);
    }
  }
  expect(
    (await apiTrips(request, '?includeDeleted=true')).length,
    'no extra vehicle trip created by assignment'
  ).toBe(tripCountBeforeAssign);

  // Reload Orders → 5 shops remain assigned (persisted, not UI-only).
  expect(await (await trackingRowsFor(page, tripNo)).count(), '5 tracked shops').toBe(5);
  expect(await trackingDeliveredCount(page, tripNo), 'nothing delivered yet').toBe(0);

  // ─────────────────────────────  STEP 4 (real UI)  ─────────────────────
  await page.goto(`/operations?tab=trip-entry&tripId=${tripId}`);
  await page.waitForLoadState('networkidle');
  await stepBtn(page, 4).click();
  for (const shop of SEED.shops) {
    await expect(page.getByText(shop, { exact: true }).first()).toBeVisible();
  }

  for (let i = 0; i < SEED.shops.length; i += 1) {
    await deliverShopInStep4(page, tripId, SEED.shops[i], i + 1);
    expect(
      await trackingDeliveredCount(page, tripNo),
      `Delivery Tracking after ${i + 1} deliveries`
    ).toBe(i + 1);
    if (i === 0) {
      // Reload checkpoint after the first delivery — the count is rebuilt
      // from the backend, never from cached React state.
      await page.reload();
      await page.waitForLoadState('networkidle');
      expect(await trackingDeliveredCount(page, tripNo)).toBe(1);
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
  expect(await trackingDeliveredCount(page, tripNo), 'all 5 shops delivered').toBe(5);

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
  expect(done.vehicleNo).toBe(FULL_CREW.vehicle);
  const onVehicle = (await apiTrips(request, '?includeDeleted=true')).filter(
    (t) => t.vehicleNo === FULL_CREW.vehicle && !String(t.tripNo).startsWith('ORD-')
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
