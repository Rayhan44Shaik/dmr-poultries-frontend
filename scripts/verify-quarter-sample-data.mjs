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
