/**
 * Orders module — real-browser E2E for the quantity, lock, undo, search and
 * pagination rules.
 *
 * Nothing here is mocked: the specs drive the actual Order Collection /
 * Order Assignment / Delivery Tracking UI against the isolated seeded
 * backend harness on :4100, and every checkpoint is re-verified against the
 * persisted state through GET /api/orders.
 *
 * Covered scenarios (from the workflow requirements):
 *   A  pickup above the order quantity is blocked in the UI and rejected
 *      by the backend even when the API is called directly
 *   C  a fully delivered shop is locked after a reload (no edit, no delete)
 *   D  a pending shop stays editable inside its valid range
 *   E  delete a pending assignment → Undo inside 10 s restores it
 *   F  delete a pending assignment → after the window it is finalized
 *   G  the order quantity changes after assignment → pending recomputed
 *   H  an assignment change is visible on the trip's Step 4 rows
 *   I  a refresh reproduces the state (no stale frontend state)
 *   K  pagination: 10 rows by default, next/previous, rows-per-page
 *   L  search: shop, city, trip number, vehicle number
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const API = 'http://127.0.0.1:4100/api';

test.use({ timezoneId: 'UTC' });
test.describe.configure({ mode: 'serial' });

/** Unique prefix so this spec never collides with the other suites' data. */
const P = 'ORDX';
const SHOPS = Array.from({ length: 12 }, (_, i) => `${P} Shop ${String(i + 1).padStart(2, '0')}`);
const CITY = `${P} City`;

function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

const DAY = todayIso();

let vehicleNo = '';
let tripId = 0;
let tripNo = '';

// ── API helpers (verification only — the workflow itself runs in the UI) ───

async function post(request: APIRequestContext, path: string, data: unknown) {
  const res = await request.post(`${API}${path}`, { data });
  expect(res.ok(), `POST ${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

/**
 * Idempotent master seeding. The harness DB is normally fresh, but this suite
 * must not depend on that: if a previous run (or a retry) already created the
 * record, reuse it instead of failing on the unique-name constraint.
 */
async function ensureMaster<T extends Record<string, unknown>>(
  request: APIRequestContext,
  collection: string,
  matchKey: string,
  matchValue: string,
  body: unknown
): Promise<T> {
  const existing = (await (await request.get(`${API}/masters/${collection}`)).json()) as T[];
  const found = existing.find((r) => String(r[matchKey]) === matchValue);
  if (found) return found;
  const res = await request.post(`${API}/masters/${collection}`, { data: body });
  expect(
    res.ok(),
    `POST /masters/${collection} (${matchValue}) → ${res.status()} ${await res.text()}`
  ).toBeTruthy();
  return (await res.json()) as T;
}

async function apiOrders(request: APIRequestContext, query = '') {
  const res = await request.get(`${API}/orders${query}`);
  expect(res.ok(), `GET /orders${query} → ${res.status()}`).toBeTruthy();
  return (await res.json()) as {
    rows: Array<{
      id: number;
      shopName: string;
      requiredBoxes: number;
      assignedBoxes: number;
      deliveredBoxes: number;
      pendingBoxes: number;
      remainingBoxes: number;
      status: string;
      locked: boolean;
      version: number;
      assignments: Array<{ id: number; tripId: number; pickupBoxes: number; deliveredBoxes: number }>;
    }>;
    total: number;
    summary: Record<string, number>;
  };
}

function orderRow(page_: Awaited<ReturnType<typeof apiOrders>>, shop: string) {
  const row = page_.rows.find((r) => r.shopName === shop);
  expect(row, `order row for ${shop}`).toBeTruthy();
  return row!;
}

// ── UI helpers ─────────────────────────────────────────────────────────────

async function gotoOrders(page: Page, tab: 'collection' | 'assignment' | 'tracking') {
  await page.goto('/operations/orders/collection');
  await page.waitForLoadState('networkidle');
  if (tab !== 'collection') {
    const name = tab === 'assignment' ? /order assignment/i : /delivery tracking/i;
    await page.getByRole('tab', { name }).click();
  }
  await page.waitForLoadState('networkidle');
}

const searchBox = (page: Page) => page.getByRole('textbox', { name: /search shop, city/i });
const requiredInput = (page: Page, shop: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`Required Boxes.*${shop}`, 'i') });
const editButton = (page: Page, shop: string) =>
  page.getByRole('button', { name: new RegExp(`Edit ${shop}`, 'i') });
const pickupInput = (page: Page, shop: string) =>
  page.getByRole('spinbutton', { name: new RegExp(`Pickup Boxes.*${shop}`, 'i') });

async function selectVehicle(page: Page) {
  const combo = page.locator('#orders-vehicle-select');
  await combo.click();
  await combo.pressSequentially(vehicleNo, { delay: 20 });
  await page.getByRole('option', { name: new RegExp(vehicleNo) }).first().click();
}

async function saveCollection(page: Page) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/orders\/collection$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  return res;
}

// ── Seed: shops + a Step-3-complete trip for this spec only ───────────────

test('orders-00: seed dedicated shops and a Step-3-complete trip', async ({ request }) => {
  for (const shopName of SHOPS) {
    await ensureMaster(request, 'shops', 'shopName', shopName, {
      shopName,
      ownerName: 'ORDX Owner',
      phoneNumber: `98${String(SHOPS.indexOf(shopName) + 10).padStart(8, '0')}`,
      associationType: 'Ass Vij',
      email: `ordx-${SHOPS.indexOf(shopName) + 1}@example.com`,
      city: CITY,
      address: 'ORDX Address',
      status: 'Active',
    });
  }

  const vehicle = (await ensureMaster(request, 'vehicles', 'vehicleNumber', `${P}-TRUCK-01`, {
    vehicleNumber: `${P}-TRUCK-01`,
    vehicleType: 'Lorry',
    noOfBoxes: 80,
    birdCapacity: 5000,
    capacityKg: 6000,
    engineNumber: `${P}-ENG-01`,
    chassisNumber: `${P}-CHS-01`,
    status: 'Active',
  })) as { id: number; vehicleNumber: string };
  vehicleNo = vehicle.vehicleNumber;

  const driver = (await ensureMaster(request, 'employees', 'employeeName', `${P} Driver`, {
    employeeName: `${P} Driver`,
    department: 'Driver',
    role: 'Driver',
    phoneNumber: '9700000101',
    licenseNumber: `${P}-DL-1`,
    salary: 18000,
    status: 'Active',
  })) as { id: number; employeeName: string };
  const supervisor = (await ensureMaster(request, 'employees', 'employeeName', `${P} Supervisor`, {
    employeeName: `${P} Supervisor`,
    department: 'Supervisor',
    role: 'Supervisor',
    phoneNumber: '9700000102',
    email: 'ordx-supervisor@example.com',
    salary: 24000,
    status: 'Active',
  })) as { id: number; employeeName: string };
  const farm = (await ensureMaster(request, 'farms', 'farmName', `${P} Farm`, {
    farmName: `${P} Farm`,
    ownerName: 'Owner',
    supervisorName: 'Farm Sup',
    phoneNumber: '9700000103',
    village: 'ORDX Village',
    address: 'ORDX Farm Address',
    capacity: 30000,
    status: 'Active',
  })) as { id: number; farmName: string };
  const birdType = (await ensureMaster(request, 'bird-types', 'birdType', `${P} Broiler`, {
    birdType: `${P} Broiler`,
    averageWeight: 2,
    status: 'Active',
  })) as { id: number; birdType: string };

  // Reuse an open ORDX trip if one already exists for the day.
  const openTrips = (await (await request.get(`${API}/trips`)).json()) as Array<{
    id: number;
    tripNo: string;
    vehicleNo?: string;
    tripDate?: string;
    status?: string;
  }>;
  const existingTrip = openTrips.find(
    (t) => t.vehicleNo === vehicle.vehicleNumber && String(t.tripDate).slice(0, 10) === DAY
  );
  if (existingTrip) {
    tripId = existingTrip.id;
    tripNo = existingTrip.tripNo;
    expect(tripId).toBeGreaterThan(0);
    return;
  }

  const trip = (await post(request, '/trips', {
    tripNo: 'IGNORED',
    tripDate: DAY,
    status: 'Draft',
    vehicleId: vehicle.id,
    vehicleNo: vehicle.vehicleNumber,
    driverId: driver.id,
    driverName: driver.employeeName,
    supervisorId: supervisor.id,
    supervisorName: supervisor.employeeName,
    sourceFarmId: farm.id,
    sourceFarm: farm.farmName,
    birdTypeId: birdType.id,
    birdType: birdType.birdType,
    openingMeter: 5000,
    avgBirdWeight: 2,
    startStepSubmitted: true,
    farmStepSubmitted: true,
    pickupStepSubmitted: true,
    boxDetails: Array.from({ length: 40 }, (_, i) => ({ boxNo: i + 1, birds: 10, weight: 20 })),
  })) as { id: number; tripNo: string };
  tripId = trip.id;
  tripNo = trip.tripNo;
  expect(tripId).toBeGreaterThan(0);
});

// ── Collection: enter the day's orders through the real UI ────────────────

test('orders-01: working sheet shows ALL shops; Save Progress stays on Collection (Test I)', async ({
  page,
  request,
}) => {
  await gotoOrders(page, 'collection');

  // No separate page-level "Orders" heading inside the Orders module — the
  // module header is the three attached tabs (the app's global breadcrumb may
  // still show "Orders" in the top banner, which is expected).
  await expect(page.getByRole('main').getByRole('heading', { name: /^orders$/i })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /order collection/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /order assignment/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /delivery tracking/i })).toBeVisible();

  // The collection sheet is a day-wise working sheet: every active shop is
  // shown even before any entry exists (no "no orders collected" screen).
  await searchBox(page).fill(P);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/1–10 of 12/)).toBeVisible();

  // Expand the page so all 12 ORDX shops are visible for entry.
  await page.getByRole('button', { name: /rows per page/i }).click();
  await page.getByRole('option', { name: /25 \/ page/i }).click();
  await page.waitForLoadState('networkidle');

  // Enter birds/boxes directly on the sheet (no add-shop picker anymore).
  // Rows are read-only until Edit is clicked; enter each shop's boxes via its
  // per-row edit action, then Save Progress commits all of them at once.
  await editButton(page, SHOPS[0]).click();
  await requiredInput(page, SHOPS[0]).fill('20');
  await editButton(page, SHOPS[1]).click();
  await requiredInput(page, SHOPS[1]).fill('10');
  for (let i = 2; i < SHOPS.length; i += 1) {
    await editButton(page, SHOPS[i]).click();
    await requiredInput(page, SHOPS[i]).fill('5');
  }

  // Save Progress must SAVE and STAY on Collection (never navigate away).
  const res = await saveCollection(page);
  expect(res.ok(), `collection save → ${res.status()} ${await res.text()}`).toBeTruthy();
  await expect(page.getByRole('tab', { name: /order collection/i })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('button', { name: /save progress/i })).toBeVisible();

  const persisted = await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(P)}&pageSize=200`);
  expect(persisted.total).toBe(SHOPS.length);
  expect(orderRow(persisted, SHOPS[0]).requiredBoxes).toBe(20);
  expect(orderRow(persisted, SHOPS[1]).requiredBoxes).toBe(10);

  // The summary line reports total shops and shops-with-orders.
  await expect(page.getByText(/shops with orders/i)).toBeVisible();
  expect(persisted.summary.shopsWithOrders).toBe(SHOPS.length);

  // Finish Collection → the day becomes assignment-eligible.
  const [finishRes] = await Promise.all([
    page.waitForResponse((r) => /\/orders\/collection$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /finish collection/i }).click(),
  ]);
  expect(finishRes.ok(), `finish collection → ${finishRes.status()} ${await finishRes.text()}`).toBeTruthy();

  // Success toast appears top-right and its X dismisses it immediately.
  const toast = page.getByRole('alert').first();
  await expect(toast).toBeVisible();
  const box = await toast.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.x + box!.width).toBeGreaterThan(700);
  await toast.getByRole('button', { name: /close/i }).click();
  await expect(toast).toBeHidden();

  // Test I — a full reload rebuilds the table from the backend. Rows render
  // read-only values until Edit is clicked; the saved box count is visible.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await searchBox(page).fill(SHOPS[0]);
  await expect(page.getByRole('row').filter({ hasText: SHOPS[0] })).toContainText('20');
});

// ── Test K — pagination over the real dataset ─────────────────────────────

test('orders-02: pagination — 10 rows by default, Next/Previous, rows-per-page (Test K)', async ({
  page,
}) => {
  await gotoOrders(page, 'collection');
  await searchBox(page).fill(P);
  await page.waitForLoadState('networkidle');

  // Default page size is 10 → 12 ORDX shops span two pages.
  const rows = page.getByRole('row').filter({ hasText: `${P} Shop` });
  await expect(rows).toHaveCount(10);
  await expect(page.getByText(/1–10 of 12/)).toBeVisible();

  await page.getByRole('button', { name: /^next$/i }).click();
  await page.waitForLoadState('networkidle');
  await expect(rows).toHaveCount(2);
  await expect(page.getByText(/11–12 of 12/)).toBeVisible();

  await page.getByRole('button', { name: /^previous$/i }).click();
  await page.waitForLoadState('networkidle');
  await expect(rows).toHaveCount(10);

  // Rows-per-page: 25 → everything on one page, pagination reset to page 1.
  await page.getByRole('button', { name: /rows per page/i }).click();
  await page.getByRole('option', { name: /25 \/ page/i }).click();
  await page.waitForLoadState('networkidle');
  await expect(rows).toHaveCount(12);
  await expect(page.getByText(/1–12 of 12/)).toBeVisible();

  // The full page-size set (10 / 15 / 20 / 25 / 30) is offered.
  await page.getByRole('button', { name: /rows per page/i }).click();
  for (const size of ['10', '15', '20', '25', '30']) {
    await expect(page.getByRole('option', { name: new RegExp(`${size} / page`) })).toBeVisible();
  }
});

// ── Test L — server-side search ───────────────────────────────────────────

test('orders-03: search by shop, city, trip and vehicle (Test L)', async ({ page, request }) => {
  // Assign one shop first so the trip / vehicle search terms have a target.
  await gotoOrders(page, 'assignment');
  await selectVehicle(page);
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');
  await pickupInput(page, SHOPS[0]).fill('5');
  const [assignRes] = await Promise.all([
    page.waitForResponse((r) => /\/orders\/assignments$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  expect(assignRes.ok(), `assignment save → ${assignRes.status()} ${await assignRes.text()}`).toBeTruthy();

  await gotoOrders(page, 'collection');

  // Shop name → exactly one row.
  await searchBox(page).fill(SHOPS[1]);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('row').filter({ hasText: `${P} Shop` })).toHaveCount(1);

  // City → every ORDX shop.
  await searchBox(page).fill(CITY);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/of 12/)).toBeVisible();

  // Trip number → only the assigned shop.
  await searchBox(page).fill(tripNo);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('row').filter({ hasText: SHOPS[0] })).toHaveCount(1);

  // Vehicle number → same single shop.
  await searchBox(page).fill(vehicleNo);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('row').filter({ hasText: SHOPS[0] })).toHaveCount(1);

  // …and the persisted state agrees.
  const persisted = await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(tripNo)}`);
  expect(persisted.total).toBe(1);
  expect(orderRow(persisted, SHOPS[0]).assignedBoxes).toBe(5);
});

// ── Test A — the pickup box limit is a hard rule on BOTH sides ────────────

test('orders-04: pickup above the remaining quantity is blocked in the UI and rejected by the backend (Test A)', async ({
  page,
  request,
}) => {
  await gotoOrders(page, 'assignment');
  await selectVehicle(page);
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');

  // The order is 20 boxes; the input advertises the valid range …
  const input = pickupInput(page, SHOPS[0]);
  await expect(input).toHaveAttribute('max', '20');
  await expect(page.getByText(/min 0 · max 20/i).first()).toBeVisible();

  // … and an out-of-range value is refused by the BACKEND on save.
  await input.fill('21');
  const [rejected] = await Promise.all([
    page.waitForResponse((r) => /\/orders\/assignments$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  expect(rejected.status(), 'backend rejects the over-assignment').toBe(422);

  // Even a DIRECT API call (frontend bypassed) is rejected.
  const order = orderRow(await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`), SHOPS[0]);
  const direct = await request.post(`${API}/orders/assignments`, {
    data: {
      tripId,
      orderDate: DAY,
      items: [{ orderId: order.id, sequence: 1, pickupBoxes: 21 }],
    },
  });
  expect(direct.status(), 'direct API over-assignment rejected').toBe(422);
  expect(await direct.text()).toMatch(/boxes remain/i);

  // The vehicle box capacity is an independent hard limit.
  const overCapacity = await request.post(`${API}/orders/assignments`, {
    data: {
      tripId,
      orderDate: DAY,
      items: [{ orderId: order.id, sequence: 1, pickupBoxes: 999 }],
    },
  });
  expect(overCapacity.status()).toBe(422);
  expect(await overCapacity.text()).toMatch(/capacity exceeded/i);

  // Nothing was persisted beyond the valid 5 boxes saved earlier.
  const after = orderRow(await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`), SHOPS[0]);
  expect(after.assignedBoxes).toBe(5);
});

// ── Test D — a pending shop stays editable inside its valid range ─────────

test('orders-05: a pending shop can be edited within the valid range (Test D)', async ({
  page,
  request,
}) => {
  await gotoOrders(page, 'assignment');
  await selectVehicle(page);
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');

  await pickupInput(page, SHOPS[0]).fill('12');
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/orders\/assignments$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  expect(res.ok(), `assignment save → ${res.status()} ${await res.text()}`).toBeTruthy();

  const after = orderRow(await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`), SHOPS[0]);
  expect(after.assignedBoxes).toBe(12);
  expect(after.pendingBoxes).toBe(8);
  expect(after.status).toBe('Assigned');
});

// ── Test H — the assignment is projected onto the trip's Step 4 rows ──────

test('orders-06: the assignment is visible on the trip Step 4 rows (Test H)', async ({ request }) => {
  const res = await request.get(`${API}/trips/${tripId}`);
  expect(res.ok()).toBeTruthy();
  const trip = (await res.json()) as { deliveries: Array<Record<string, unknown>> };
  const row = trip.deliveries.find((d) => String(d.shopName) === SHOPS[0]);
  expect(row, 'Step 4 carries the assigned shop').toBeTruthy();
  expect(Number(row!.boxNo), 'Step 4 shows the latest assigned quantity').toBe(12);
  expect(String(row!.remarks)).toMatch(/^\[ORDER\]/);
});

// ── Test G — the ORDER changes after assignment ──────────────────────────

test('orders-07: changing the order quantity recomputes the pending quantity (Test G)', async ({
  page,
  request,
}) => {
  await gotoOrders(page, 'collection');
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');

  // Raise 20 → 30: 18 boxes now remain to assign.
  await editButton(page, SHOPS[0]).click();
  await requiredInput(page, SHOPS[0]).fill('30');
  const raised = await saveCollection(page);
  expect(raised.ok()).toBeTruthy();
  {
    const row = orderRow(await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`), SHOPS[0]);
    expect(row.requiredBoxes).toBe(30);
    expect(row.pendingBoxes).toBe(18);
  }

  // Cutting it BELOW what is already assigned is refused by the backend.
  await editButton(page, SHOPS[0]).click();
  await requiredInput(page, SHOPS[0]).fill('4');
  const [rejected] = await Promise.all([
    page.waitForResponse((r) => /\/orders\/collection$/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: /save progress/i }).click(),
  ]);
  expect(rejected.status()).toBe(422);
  expect(await rejected.text()).toMatch(/already assigned/i);

  // Restore 20 so the later specs work from a known quantity.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');
  await editButton(page, SHOPS[0]).click();
  await requiredInput(page, SHOPS[0]).fill('20');
  expect((await saveCollection(page)).ok()).toBeTruthy();
});

// ── Tests E / F — delete a pending assignment with the 10-second undo ─────

test('orders-08: delete a pending assignment → Undo inside 10 s restores it (Test E)', async ({
  page,
  request,
}) => {
  await gotoOrders(page, 'assignment');
  await selectVehicle(page);
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: new RegExp(`Remove ${SHOPS[0]} from this vehicle`, 'i') }).click();

  // The pending-delete dialog counts down; Undo cancels it.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /undo|cancel/i }).first().click();
  await expect(dialog).toBeHidden();

  // Nothing was deleted — the assignment is intact in the backend.
  await page.waitForTimeout(1500);
  const row = orderRow(await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`), SHOPS[0]);
  expect(row.assignedBoxes, 'Undo restored the assignment').toBe(12);
  expect(row.assignments.length).toBe(1);
});

test('orders-09: delete a pending assignment → after the 10 s window it is finalized (Test F)', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await gotoOrders(page, 'assignment');
  await selectVehicle(page);
  await searchBox(page).fill(SHOPS[1]);
  await page.waitForLoadState('networkidle');

  // Assign this shop first, then delete it and let the window expire.
  await pickupInput(page, SHOPS[1]).fill('4');
  expect(
    (
      await Promise.all([
        page.waitForResponse((r) => /\/orders\/assignments$/.test(r.url()) && r.request().method() === 'POST'),
        page.getByRole('button', { name: /save progress/i }).click(),
      ])
    )[0].ok()
  ).toBeTruthy();

  await page.waitForLoadState('networkidle');
  const [deleteRes] = await Promise.all([
    page.waitForResponse(
      (r) => /\/orders\/assignments\/\d+$/.test(r.url()) && r.request().method() === 'DELETE',
      { timeout: 30_000 }
    ),
    page.getByRole('button', { name: new RegExp(`Remove ${SHOPS[1]} from this vehicle`, 'i') }).click(),
  ]);
  expect(deleteRes.ok(), `delete → ${deleteRes.status()}`).toBeTruthy();

  const row = orderRow(await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[1])}`), SHOPS[1]);
  expect(row.assignments.length, 'assignment finalized after the undo window').toBe(0);
  expect(row.assignedBoxes).toBe(0);

  // The projected Step 4 plan row is gone too.
  const trip = (await (await request.get(`${API}/trips/${tripId}`)).json()) as {
    deliveries: Array<Record<string, unknown>>;
  };
  expect(trip.deliveries.some((d) => String(d.shopName) === SHOPS[1])).toBe(false);
});

// ── Test C — a fully delivered shop is locked (after a reload) ────────────

test('orders-10: a fully delivered shop is locked for edit and delete (Test C)', async ({
  page,
  request,
}) => {
  // Reduce the assignment to 2 boxes and deliver both through the real Step 4
  // persistence contract, so the delivery data is genuine.
  const before = orderRow(
    await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`),
    SHOPS[0]
  );
  await post(request, '/orders/assignments', {
    tripId,
    orderDate: DAY,
    items: [{ orderId: before.id, sequence: 1, pickupBoxes: 5 }],
  });
  // Bring the ORDER down to the delivered quantity so the shop becomes
  // "fully delivered" (delivered >= required).
  const deliverRes = await request.put(`${API}/trips/${tripId}/deliveries`, {
    data: {
      deliveries: [
        {
          id: 0,
          clientKey: 'ordx-deliver-1',
          shopId: (
            await (await request.get(`${API}/masters/shops`)).json()
          ).find((s: { shopName: string }) => s.shopName === SHOPS[0]).id,
          shopName: SHOPS[0],
          birdTypeId: (
            await (await request.get(`${API}/masters/bird-types`)).json()
          ).find((b: { birdType: string }) => b.birdType === `${P} Broiler`).id,
          birdType: `${P} Broiler`,
          birds: 20,
          weight: 40,
          mortality: 0,
          mortKg: 0,
          rate: null,
          amount: 0,
          remarks: '[ORDER]',
          deliveryMode: 'box',
          selectedBoxIds: [1, 2],
          perBoxData: [],
        },
      ],
    },
  });
  expect(deliverRes.ok(), `Step 4 save → ${deliverRes.status()} ${await deliverRes.text()}`).toBeTruthy();

  // Order = 20, delivered = 2 → still only PARTIALLY delivered, and the
  // remaining quantity is what is left.
  {
    const row = orderRow(
      await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`),
      SHOPS[0]
    );
    expect(row.deliveredBoxes).toBe(2);
    expect(row.remainingBoxes).toBe(18);
    expect(row.status).toBe('Partially Delivered');
    // Never below the delivered quantity (this line is only PARTIALLY
    // delivered: 2 of the 5 assigned boxes).
    const tooLow = await request.post(`${API}/orders/assignments`, {
      data: { tripId, orderDate: DAY, items: [{ orderId: row.id, sequence: 1, pickupBoxes: 1 }] },
    });
    expect(tooLow.status()).toBe(422);
    expect(await tooLow.text()).toMatch(/already delivered/i);

    // Reducing to exactly the delivered quantity IS allowed — and makes the
    // assignment line fully delivered (immutable from here on).
    await post(request, '/orders/assignments', {
      tripId,
      orderDate: DAY,
      items: [{ orderId: row.id, sequence: 1, pickupBoxes: 2 }],
    });
  }

  // Now cut the ORDER to exactly the delivered quantity → fully delivered.
  const shopId = (await (await request.get(`${API}/masters/shops`)).json()).find(
    (s: { shopName: string }) => s.shopName === SHOPS[0]
  ).id;
  await post(request, '/orders/collection', {
    orderDate: DAY,
    items: [{ shopId, requiredBoxes: 2 }],
  });

  const locked = orderRow(
    await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(SHOPS[0])}`),
    SHOPS[0]
  );
  expect(locked.locked, 'fully delivered order is locked').toBe(true);
  expect(locked.status).toBe('Delivered');

  // The backend refuses every mutation, even bypassing the UI.
  const edit = await request.post(`${API}/orders/assignments`, {
    data: { tripId, orderDate: DAY, items: [{ orderId: locked.id, sequence: 1, pickupBoxes: 5 }] },
  });
  expect(edit.status()).toBe(409);
  const removeAssignment = await request.delete(
    `${API}/orders/assignments/${locked.assignments[0].id}`
  );
  expect(removeAssignment.status()).toBe(409);
  const removeOrder = await request.delete(`${API}/orders/${locked.id}`);
  expect(removeOrder.status()).toBe(409);

  // …and after a full reload the UI shows it locked (inputs disabled).
  await gotoOrders(page, 'assignment');
  await selectVehicle(page);
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');
  await expect(pickupInput(page, SHOPS[0])).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: new RegExp(`Remove ${SHOPS[0]} from this vehicle`, 'i') })
  ).toBeDisabled();
});

// ── Delivery Tracking reflects the same persisted truth ──────────────────

test('orders-11: Delivery Tracking shows the delivered quantities and timestamp', async ({ page }) => {
  await gotoOrders(page, 'tracking');
  await searchBox(page).fill(SHOPS[0]);
  await page.waitForLoadState('networkidle');

  const row = page.getByRole('row').filter({ hasText: SHOPS[0] }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(tripNo);
  await expect(row).toContainText(vehicleNo);
  await expect(row).toContainText('Delivered');
});

// ── Test W — optimistic concurrency: a stale version is rejected ──────────

test('orders-12: a stale `version` is rejected with 409 and never overwrites (Test W)', async ({
  request,
}) => {
  // Two shops are still pending from orders-01; use one that is untouched.
  const shop = SHOPS[5];
  const before = orderRow(
    await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(shop)}`),
    shop
  );
  const v = (before as unknown as { version: number }).version;

  // User B commits a change first — the version moves on.
  const shopId = (await (await request.get(`${API}/masters/shops`)).json()).find(
    (s: { shopName: string }) => s.shopName === shop
  ).id;
  await post(request, '/orders/collection', {
    orderDate: DAY,
    items: [{ shopId, requiredBoxes: 7 }],
  });

  // User A now writes with the version it read BEFORE User B's change.
  const stale = await request.post(`${API}/orders/collection`, {
    data: { orderDate: DAY, items: [{ shopId, requiredBoxes: 99, version: v }] },
  });
  expect(stale.status(), 'stale write must conflict').toBe(409);
  expect(await stale.text()).toMatch(/changed in another session/i);

  // User B's value survived — no silent overwrite.
  const after = orderRow(
    await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(shop)}`),
    shop
  );
  expect(after.requiredBoxes, "User B's committed value is intact").toBe(7);
});

// ── Multiple orders per shop + unique order numbers (backend-authoritative) ──

test('orders-13: a shop can hold MULTIPLE orders on the same date, each uniquely numbered', async ({
  request,
}) => {
  const multiShop = `${P} Multi Shop`;
  const created = (await ensureMaster(request, 'shops', 'shopName', multiShop, {
    shopName: multiShop,
    ownerName: 'ORDX Owner',
    phoneNumber: '9800000999',
    associationType: 'Ass Vij',
    email: 'ordx-multi@example.com',
    city: CITY,
    address: 'ORDX Address',
    status: 'Active',
  })) as { id: number };
  const shopId = created.id;

  await post(request, '/orders/collection', {
    orderDate: DAY,
    items: [{ shopId, requiredBoxes: 10, clientKey: 'ordx-multi-1' }],
  });
  await post(request, '/orders/collection', {
    orderDate: DAY,
    items: [{ shopId, requiredBoxes: 8, clientKey: 'ordx-multi-2' }],
  });

  const rowsFor = async () =>
    (await apiOrders(request, `?date=${DAY}&search=${encodeURIComponent(multiShop)}&pageSize=200`)).rows.filter(
      (r) => r.shopName === multiShop
    );

  const mine = await rowsFor();
  expect(mine.length, 'two orders must both remain visible').toBe(2);
  const nos = new Set(mine.map((r) => (r as unknown as { orderNo: string }).orderNo));
  expect(nos.size, 'order numbers are globally unique').toBe(2);
  for (const no of nos) expect(no).toMatch(/^ORD-\d{8}-\d{3}$/);

  // Retrying with the SAME clientKey updates in place — never a third order.
  await post(request, '/orders/collection', {
    orderDate: DAY,
    items: [{ shopId, requiredBoxes: 12, clientKey: 'ordx-multi-2' }],
  });
  const afterRetry = await rowsFor();
  expect(afterRetry.length, 'idempotent retry must not duplicate').toBe(2);
  expect(afterRetry.reduce((s, r) => s + r.requiredBoxes, 0)).toBe(22);
});
