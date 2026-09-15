// scripts/verify-quarter-sample-data.mjs
// -----------------------------------------------------------------------------
// Self-contained integration audit for the rolling-quarter sample API.
//
// It starts an isolated in-memory API, validates the shapes consumed by the
// Operations screens, then exercises the financial hand-offs that must stay in
// sync across Operations → Masters → Shop Ledger → Dashboard. The process is
// always stopped afterwards, so the developer's preview data is never changed.
//
//   npm run verify:quarter-data
//   SAMPLE_VERIFY_PORT=4302 npm run verify:quarter-data
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const port = Number(process.env.SAMPLE_VERIFY_PORT ?? 4301);
const origin = `http://127.0.0.1:${port}`;
const api = `${origin}/api`;
const timeoutMs = 20_000;

const round = (value) => Math.round(Number(value) * 100) / 100;
const sum = (rows, field) =>
  round(rows.reduce((total, row) => total + Number(row[field] ?? 0), 0));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApi(child) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Sample API exited before becoming ready (code ${child.exitCode}). ${lastError}`);
    }
    try {
      const response = await fetch(`${api}/health`);
      if (response.ok) return;
      lastError = `health returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${origin}/api/health. ${lastError}`);
}

function startServer() {
  const child = spawn(process.execPath, ["scripts/quarter-sample-data.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, MOCK_BACKEND_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  const capture = (chunk) => {
    logs += chunk.toString();
    if (logs.length > 5_000) logs = logs.slice(-5_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return { child, getLogs: () => logs };
}

async function stopServer(child) {
  if (child.exitCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), wait(3_000)]);
  if (child.exitCode == null) child.kill("SIGKILL");
}

async function run() {
  const calls = [];
  async function request(path, options = {}) {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    calls.push(`${options.method ?? "GET"} ${path} → ${response.status}`);
    assert.ok(response.ok, `${options.method ?? "GET"} ${path}: ${response.status} ${text}`);
    return data;
  }

  // Dataset manifest and Operation Dashboard must describe the same quarter.
  const manifest = await request("/quarter-summary");
  assert.equal(manifest.sample, true);
  assert.equal(manifest.shops, 200);
  assert.ok(manifest.trips > 600 && manifest.deliveries > 6_000);

  const dashboard = await request("/operations/dashboard");
  assert.equal(dashboard.sample, true);
  assert.equal(dashboard.quarter.code, manifest.quarter.code);
  assert.ok(dashboard.totalTrips > 600);

  // Shop Sales uses the production API field names. This prevents the common
  // failure where its table receives rows but renders blank birds/weight/date.
  const masters = await request("/masters/shops");
  assert.equal(masters.length, manifest.shops);
  const sales = await request("/operations/shop-sales");
  assert.ok(sales.length > 6_000);
  assert.ok(
    sales.every(
      (sale) =>
        sale.saleDate &&
        Number.isFinite(sale.birds) &&
        Number.isFinite(sale.weight) &&
        typeof sale.remarks === "string" &&
        sale.status === "Approved"
    ),
    "every Shop Sales row must conform to the frontend's API mapper contract",
  );

  // Sale numbers are unique full references. Within each trip S01, S02… is
  // assigned in captured delivery-time order, never from the route array order.
  assert.equal(new Set(sales.map((sale) => sale.saleNo)).size, sales.length);
  const sequencedSale = sales.find((sale) => sale.editable && sale.deliveryTime && sale.maxEditableBirds != null);
  assert.ok(sequencedSale, "expected an editable, delivery-timestamped Shop Sale");
  const tripSales = sales
    .filter((sale) => sale.tripId === sequencedSale.tripId)
    .sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));
  assert.deepEqual(
    tripSales.map((sale, index) => sale.saleNo),
    tripSales.map((_, index) => `${sequencedSale.tripNo}-S${String(index + 1).padStart(2, "0")}`),
    "Shop Sale S-numbers must follow delivery time within the source trip",
  );
  const sequencedTrip = await request(`/trips/${sequencedSale.tripId}`);
  assert.equal(
    sum(sequencedTrip.deliveries, "birds") + sum(sequencedTrip.deliveries, "mortality"),
    sequencedTrip.totalBirds,
    "every sample trip must reconcile pickup birds with delivered birds plus mortality",
  );
  const overLimit = await fetch(`${api}/operations/shop-sales/${sequencedSale.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ birds: sequencedSale.maxEditableBirds + 1 }),
  });
  calls.push(`PUT /operations/shop-sales/${sequencedSale.id} → ${overLimit.status}`);
  assert.equal(overLimit.status, 422, "the API must reject a bird edit above the trip pickup capacity");
  const overLimitBody = await overLimit.json();
  assert.equal(overLimitBody.error, "trip_bird_limit_exceeded");

  // Reducing one shop allocation opens a visible unassigned-birds workflow.
  // It is not enough to show a client warning: the API must make this source
  // trip the only editable one until those birds are assigned again.
  assert.ok(sequencedSale.birds > 0, "expected an allocation that can be reduced");
  const reduced = await request(`/operations/shop-sales/${sequencedSale.id}`, {
    method: "PUT",
    body: JSON.stringify({ birds: sequencedSale.birds - 1 }),
  });
  assert.equal(reduced.unassignedBirds, 1);
  assert.equal(reduced.assignmentComplete, false);
  assert.equal(reduced.assignmentLockTripId, sequencedSale.tripId);
  assert.equal(reduced.assignmentLockTripNo, sequencedSale.tripNo);

  const otherTripRow = sales.find((sale) => sale.editable && sale.tripId !== sequencedSale.tripId);
  assert.ok(otherTripRow, "expected an otherwise editable Shop Sale on another trip");
  const lockedRows = await request("/operations/shop-sales");
  const sameTripRow = lockedRows.find((sale) => sale.tripId === sequencedSale.tripId && sale.id !== sequencedSale.id);
  const lockedOtherTripRow = lockedRows.find((sale) => sale.id === otherTripRow.id);
  assert.ok(sameTripRow?.editable, "the incomplete source trip must remain editable");
  assert.ok(lockedOtherTripRow, "expected the other trip row after lock refresh");
  assert.equal(lockedOtherTripRow.editable, false);
  assert.equal(lockedOtherTripRow.assignmentLockTripId, sequencedSale.tripId);
  assert.equal(lockedOtherTripRow.assignmentLockUnassignedBirds, 1);

  const crossTripBypass = await fetch(`${api}/operations/shop-sales/${otherTripRow.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ weight: otherTripRow.weight }),
  });
  calls.push(`PUT /operations/shop-sales/${otherTripRow.id} → ${crossTripBypass.status}`);
  assert.equal(crossTripBypass.status, 409, "a direct API call must not bypass the reassignment lock");
  const crossTripBody = await crossTripBypass.json();
  assert.equal(crossTripBody.error, "trip_assignment_incomplete");
  assert.equal(crossTripBody.assignmentLockTripId, sequencedSale.tripId);

  const reassigned = await request(`/operations/shop-sales/${sequencedSale.id}`, {
    method: "PUT",
    body: JSON.stringify({ birds: sequencedSale.birds }),
  });
  assert.equal(reassigned.unassignedBirds, 0);
  assert.equal(reassigned.assignmentComplete, true);
  const unlockedRows = await request("/operations/shop-sales");
  const unlockedOtherTripRow = unlockedRows.find((sale) => sale.id === otherTripRow.id);
  assert.equal(unlockedOtherTripRow.editable, true, "other trips unlock after same-trip reassignment");
  const reconciledTrip = await request(`/trips/${sequencedSale.tripId}`);
  assert.equal(
    sum(reconciledTrip.deliveries, "birds") + sum(reconciledTrip.deliveries, "mortality"),
    reconciledTrip.totalBirds,
    "same-trip reassignment must restore the Trip List totals",
  );

  // Pending Collections and Collection Entry read different views over the
  // exact same weekly aggregate. Check all totals and a selected shop.
  const pending = await request(`/operations/collection-entry/pending-summary?date=${manifest.quarter.today}`);
  assert.equal(pending.shops.length, manifest.shops);
  assert.equal(pending.data.length, manifest.shops);
  assert.equal(sum(pending.shops, "weeklySales"), pending.totals.weeklySales);
  assert.equal(sum(pending.shops, "weeklyApprovedCollections"), pending.totals.weeklyApprovedCollections);
  assert.equal(sum(pending.shops, "weeklyPendingCollections"), pending.totals.weeklyPendingCollections);
  assert.equal(sum(pending.shops, "balance"), pending.totals.balance);
  const shop = pending.shops.find((row) => row.weeklySales > 0) ?? pending.shops[0];
  const weekly = await request(
    `/operations/collection-entry/weekly-summary?shopId=${shop.shopId}&date=${manifest.quarter.today}`,
  );
  assert.equal(weekly.shopId, shop.shopId);
  assert.equal(weekly.weeklySales, shop.weeklySales);
  assert.equal(weekly.approvedCollections, shop.weeklyApprovedCollections);
  assert.equal(weekly.balance, shop.balance);

  // Collection lifecycle: Save → Approve → Update → Delete. Each stage must
  // flow through Pending Collections, the ledger and dashboard totals.
  const beforeCollection = await request("/operations/dashboard");
  const saved = await request("/operations/collection-entry", {
    method: "POST",
    body: JSON.stringify({
      collectionDate: manifest.quarter.today,
      shopId: shop.shopId,
      amount: 1234,
      collector: "Ravi Kumar",
      paymentMode: "Cash",
    }),
  });
  assert.equal(saved.status, "Pending Approval");
  assert.equal((await request("/operations/dashboard")).totalCollections, beforeCollection.totalCollections);

  const approved = await request(`/operations/collection-entry/${saved.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "Approved", approvedBy: "Quarter verifier" }),
  });
  assert.equal(approved.currentBalance, round(shop.balance - 1234));
  let afterCollection = await request("/operations/dashboard");
  assert.equal(afterCollection.totalCollections, round(beforeCollection.totalCollections + 1234));
  assert.equal(afterCollection.pendingCollections, round(beforeCollection.pendingCollections - 1234));

  const amended = await request(`/operations/collection-entry/${saved.id}`, {
    method: "PUT",
    body: JSON.stringify({ amount: 1500 }),
  });
  assert.equal(amended.currentBalance, round(shop.balance - 1500));
  afterCollection = await request("/operations/dashboard");
  assert.equal(afterCollection.totalCollections, round(beforeCollection.totalCollections + 1500));
  const ledger = await request(`/operations/shop-ledger?shopId=${shop.shopId}`);
  assert.ok(ledger.data.some((row) => row.referenceId === saved.id && row.credit === 1500));

  await request(`/operations/collection-entry/${saved.id}`, { method: "DELETE" });
  const restoredCollection = await request("/operations/dashboard");
  assert.equal(restoredCollection.totalCollections, beforeCollection.totalCollections);
  assert.equal(restoredCollection.pendingCollections, beforeCollection.pendingCollections);

  // The Pending Collection delete route is separate and is responsible for
  // enforcing its own seven-day rule. A fresh entry must be removable there.
  const pendingOnly = await request("/operations/collection-entry", {
    method: "POST",
    body: JSON.stringify({
      collectionDate: manifest.quarter.today,
      shopId: shop.shopId,
      amount: 250,
      collector: "Ravi Kumar",
      paymentMode: "Cash",
    }),
  });
  await request(`/operations/collection-entry/pending/${pendingOnly.id}`, { method: "DELETE" });

  // A valid Shop Sales correction recomputes amount and rolls directly into
  // Dashboard sales. Restore it so this test remains repeatable if expanded.
  const editable = sales.find((sale) => sale.editable && sale.rate != null && sale.weight > 0);
  assert.ok(editable, "expected an editable, rate-locked Shop Sales row");
  const beforeSaleCorrection = await request("/operations/dashboard");
  const corrected = await request(`/operations/shop-sales/${editable.id}`, {
    method: "PUT",
    body: JSON.stringify({ weight: editable.weight + 1, remarks: "Verified quarter sample correction" }),
  });
  assert.equal(corrected.amount, round((editable.weight + 1) * editable.rate));
  const afterSaleCorrection = await request("/operations/dashboard");
  assert.equal(afterSaleCorrection.totalSales, round(beforeSaleCorrection.totalSales + editable.rate));
  assert.equal(afterSaleCorrection.totalWeight, round(beforeSaleCorrection.totalWeight + 1));
  await request(`/operations/shop-sales/${editable.id}`, {
    method: "PUT",
    body: JSON.stringify({ weight: editable.weight, remarks: editable.remarks }),
  });
  const restoredSaleCorrection = await request("/operations/dashboard");
  assert.equal(restoredSaleCorrection.totalSales, beforeSaleCorrection.totalSales);
  assert.equal(restoredSaleCorrection.totalWeight, beforeSaleCorrection.totalWeight);

  // Rate lock is the Trip → Shop Sales financial hand-off. Its deliveries must
  // become sales exactly once and disappear from the eligible queue.
  const rateQueue = await request("/operations/rate-entry");
  assert.ok(rateQueue.length > 0, "expected at least one rate-entry candidate");
  const rateTrip = await request(`/operations/rate-entry/${rateQueue[0].id}`);
  const beforeRateLock = await request("/operations/dashboard");
  const salesBeforeRateLock = (await request("/operations/shop-sales")).length;
  const farmPaymentsBeforeRateLock = (await request("/accounts/farm-payments")).length;
  const rates = rateTrip.deliveries.map((delivery) => ({ deliveryId: delivery.id, rate: 120 }));
  await request(`/operations/rate-entry/${rateTrip.id}/lock`, {
    method: "POST",
    body: JSON.stringify({ lockedBy: "Quarter verifier", rates }),
  });
  assert.equal(
    (await request("/operations/shop-sales")).length,
    salesBeforeRateLock + rateTrip.deliveries.length,
  );
  assert.equal((await request("/accounts/farm-payments")).length, farmPaymentsBeforeRateLock + 1);
  assert.equal(
    (await request("/operations/dashboard")).totalSales,
    round(beforeRateLock.totalSales + sum(rateTrip.deliveries.map((delivery) => ({ amount: delivery.weight * 120 })), "amount")),
  );
  assert.ok(!(await request("/operations/rate-entry")).some((row) => row.id === rateTrip.id));

  // Fuel approval is the other Operations input in the dashboard expense card.
  const beforeFuel = await request("/operations/dashboard");
  const fuel = await request("/operations/fuel-expenses", {
    method: "POST",
    body: JSON.stringify({
      billDate: manifest.quarter.today,
      sourceType: "MANUAL",
      vehicleId: 1,
      fuelRate: 100,
      liters: 10,
      amount: 1000,
      pumpName: "Quarter Sample Bunk",
    }),
  });
  assert.equal((await request("/operations/dashboard")).fuelExpenses, beforeFuel.fuelExpenses);
  await request(`/operations/fuel-expenses/${fuel.id}/approve`, { method: "POST", body: JSON.stringify({ approvedBy: "Quarter verifier" }) });
  const afterFuel = await request("/operations/dashboard");
  assert.equal(afterFuel.fuelExpenses, round(beforeFuel.fuelExpenses + 1000));
  assert.equal(afterFuel.totalExpenses, round(beforeFuel.totalExpenses + 1000));
  await request(`/operations/fuel-expenses/${fuel.id}`, { method: "DELETE" });
  const restoredFuel = await request("/operations/dashboard");
  assert.equal(restoredFuel.fuelExpenses, beforeFuel.fuelExpenses);
  assert.equal(restoredFuel.totalExpenses, beforeFuel.totalExpenses);

  // ── Fleet → Maintenance History ───────────────────────────────────────────
  // The page drives four distinct queries off one endpoint. Each filter must
  // actually narrow the rows, otherwise every tab renders the same list.
  const allMaintenance = await request("/fleet/maintenance");
  assert.ok(allMaintenance.length > 100);
  assert.ok(
    allMaintenance.every((row) => !row.deleted),
    "the default maintenance list must hide soft-deleted rows",
  );
  const approvedMaintenance = await request("/fleet/maintenance?status=Approved&limit=500");
  assert.ok(approvedMaintenance.length > 0, "the Approved tab sends title-case status and must match");
  assert.ok(approvedMaintenance.every((row) => row.paymentStatus === "approved"));
  const latestApproved = await request("/fleet/maintenance?status=Approved&latestApproved=true&limit=500");
  assert.ok(latestApproved.length > 0 && latestApproved.length < approvedMaintenance.length);
  assert.equal(
    new Set(latestApproved.map((row) => row.vehicleId)).size,
    latestApproved.length,
    "latestApproved must return at most one record per vehicle",
  );
  const maintenanceDetail = await request(`/fleet/maintenance/${allMaintenance[0].id}`);
  assert.equal(maintenanceDetail.id, allMaintenance[0].id);

  // ── Fleet → Documents (permits) ───────────────────────────────────────────
  // Records are addressed by vehicleId + docType, and the viewer streams the
  // scan binary rather than JSON.
  const permits = await request("/fleet/permits");
  const permitWithScan = permits.find((row) => row.hasDocument);
  assert.ok(permitWithScan, "expected at least one permit carrying a scan");
  const permitDetail = await request(`/fleet/permits/${permitWithScan.vehicleId}/${permitWithScan.docType}`);
  assert.equal(permitDetail.id, permitWithScan.id);
  const scan = await fetch(`${api}/fleet/permits/${permitWithScan.vehicleId}/${permitWithScan.docType}/document`);
  assert.ok(scan.ok, "permit scan download must succeed");
  assert.ok(
    (await scan.text()).startsWith("%PDF"),
    "permit scan must stream a real PDF, not a JSON body",
  );
  const renewal = await request(`/fleet/permits/${permitWithScan.vehicleId}/${permitWithScan.docType}`, {
    method: "PUT",
    body: JSON.stringify({ documentNumber: "VERIFY-0001", expiryDate: "2030-01-01" }),
  });
  assert.equal(renewal.documentNumber, "VERIFY-0001");
  assert.equal(
    (await request(`/fleet/permits/${permitWithScan.vehicleId}/${permitWithScan.docType}`)).expiryDate,
    "2030-01-01",
    "a permit renewal must persist for the next read",
  );

  // ── Fleet → EMI ───────────────────────────────────────────────────────────
  const emis = await request("/fleet/emis");
  const emiVehicleId = emis[0].vehicleId;
  const emisForVehicle = await request(`/fleet/emis?vehicleId=${emiVehicleId}`);
  assert.ok(emisForVehicle.length > 0 && emisForVehicle.length < emis.length);
  assert.ok(emisForVehicle.every((row) => row.vehicleId === emiVehicleId));
  assert.ok((await request(`/fleet/emis/${emis[0].id}/schedule`)).length > 0);

  // ── Trip View → per-delivery Email / WhatsApp dispatch ────────────────────
  const dispatchTrip = await request(`/trips/${sequencedSale.tripId}`);
  for (const channel of ["delivery-emails", "delivery-whatsapp"]) {
    const rows = await request(`/trips/${dispatchTrip.id}/${channel}`);
    assert.equal(rows.length, dispatchTrip.deliveries.length, `${channel} must cover every delivery`);
    assert.ok(
      rows.every((row) => ["pending", "sending", "sent", "failed"].includes(row.status)),
      `${channel} rows must carry a status the Trip View can render`,
    );
  }
  const emailRows = await request(`/trips/${dispatchTrip.id}/delivery-emails`);
  const target = emailRows.find((row) => row.status !== "sent") ?? emailRows[0];
  const sendResult = await request(`/trips/${dispatchTrip.id}/deliveries/${target.deliveryId}/email`, {
    method: "POST",
    body: JSON.stringify({ pdfBase64: "", fileName: "verify.pdf" }),
  });
  assert.equal(sendResult.status, "sent");
  const afterSend = (await request(`/trips/${dispatchTrip.id}/delivery-emails`)).find(
    (row) => row.deliveryId === target.deliveryId,
  );
  assert.equal(afterSend.status, "sent", "a sent delivery email must survive the next status reload");
  assert.ok(afterSend.sendCount >= 1 && afterSend.sentAt);

  // ── Per-shop / per-vehicle scoping used across Operations ─────────────────
  const scopedShopId = masters[0].id;
  const shopCollections = await request(`/operations/collection-entry?shopId=${scopedShopId}`);
  assert.ok(shopCollections.length > 0);
  assert.ok(
    shopCollections.every((row) => row.shopId === scopedShopId),
    "collection-entry must honour the shopId filter instead of returning the whole register",
  );
  const scopedVehicleId = (await request("/operations/fuel-expenses")).data[0].vehicleId;
  const vehicleFuel = await request(`/operations/fuel-expenses?vehicleId=${scopedVehicleId}`);
  assert.ok(vehicleFuel.data.length > 0);
  assert.ok(vehicleFuel.data.every((row) => row.vehicleId === scopedVehicleId));

  // ── Collection Entry → Outstanding Summary carry-forward ─────────────────
  // Opening Balance must be the PREVIOUS week's closing balance so the panel
  // reads: opening + weekly sales − weekly approved collections = outstanding.
  const dayMs = 86_400_000;
  const shiftDays = (iso, days) =>
    new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * dayMs).toISOString().slice(0, 10);

  const today = manifest.quarter.today;
  const carryRows = await request(`/operations/collection-entry/weekly-summaries?date=${today}`);
  assert.ok(carryRows.length > 0);
  assert.ok(
    carryRows.every(
      (row) => Number.isFinite(row.openingBalance) && typeof row.previousWeekEnd === "string" && row.previousWeekEnd,
    ),
    "every weekly summary must carry an openingBalance and the previous week's end date",
  );
  for (const row of carryRows) {
    assert.equal(row.previousWeekEnd, shiftDays(row.weekStart, -1), "previousWeekEnd must be the day before weekStart");
    // `balance` is the live all-time balance, so it only equals the week's
    // closing figure for the current week (nothing has happened after it yet).
    if (row.isCurrentWeek) {
      assert.equal(
        round(row.openingBalance + row.weeklySales - row.approvedCollections),
        round(row.balance),
        `shop ${row.shopId}: opening + sales − collections must equal the current outstanding`,
      );
    }
  }

  // Walk consecutive weeks: each week's opening equals the prior week's close.
  const carryShop = carryRows.find((row) => row.openingBalance > 0);
  assert.ok(carryShop, "expected a shop carrying a balance into the current week");
  const currentWeekStart = carryShop.weekStart;
  let priorClose = null;
  for (let back = 4; back >= 0; back -= 1) {
    const probe = shiftDays(currentWeekStart, -7 * back);
    const summary = (await request(`/operations/collection-entry/weekly-summaries?date=${probe}`)).find(
      (row) => row.shopId === carryShop.shopId,
    );
    assert.ok(summary, `expected a weekly summary for shop ${carryShop.shopId} on ${probe}`);
    if (priorClose != null) {
      assert.equal(
        round(summary.openingBalance),
        priorClose,
        `shop ${carryShop.shopId} week ${summary.weekStart}: opening must equal the previous week's closing balance`,
      );
    }
    priorClose = round(summary.openingBalance + summary.weeklySales - summary.approvedCollections);
  }

  // The single-shop endpoint the page actually calls exposes the same fields.
  const oneShop = await request(
    `/operations/collection-entry/weekly-summary?shopId=${carryShop.shopId}&date=${today}`,
  );
  assert.equal(round(oneShop.openingBalance), round(carryShop.openingBalance));
  assert.equal(oneShop.previousWeekEnd, carryShop.previousWeekEnd);

  console.log(`✓ Quarter data sync verified: ${calls.length} API checks passed.`);
  console.log(`  ${manifest.quarter.label} · ${manifest.shops} shops · ${manifest.trips} trips · ${manifest.deliveries} deliveries`);
}

const { child, getLogs } = startServer();
try {
  await waitForApi(child);
  await run();
} catch (error) {
  console.error("Quarter data sync verification failed.");
  console.error(error instanceof Error ? error.stack : error);
  const logs = getLogs();
  if (logs) console.error(`\nSample API log tail:\n${logs}`);
  process.exitCode = 1;
} finally {
  await stopServer(child);
}
