/**
 * Mapping tests for the quarter SAMPLE manifest → Operations module pages.
 *
 * Context: `QuarterOperationsCounts` used to be *inferred* from the manifest
 * row counts (`counts.trips ?? counts.tripRecords`, `counts.shops ??
 * counts.pendingShops`, `Math.min(counts.trips, 8)`, …). Five of the eight
 * Operations numbers that produced were simply wrong against the pages:
 *
 *   field           guessed (manifest)   the page actually renders
 *   ─────────────   ─────────────────    ─────────────────────────
 *   tripRecords     640 (all trips)      526 (Completed vehicle trips = Trip List rows)
 *   rateEntries      92 (rate days)       79 (trips awaiting rate entry)
 *   pendingShops    200 (all shops)      197 (shops with an outstanding balance)
 *   mortalityTrips  640 (all trips)      526 (completed trips with losses)
 *   orders            8 (hardcoded cap)    8 (real ORD-* container count)
 *
 * The sample server already publishes the exact per-page numbers as
 * `moduleCounts` on GET /operations/dashboard (audited by
 * scripts/verify-quarter-sample-data.mjs), so the fix is to read that block
 * instead of guessing. These tests pin the mapping to the real payloads
 * captured from `npm run dev`, so a future "estimate it from the manifest"
 * edit fails here.
 *
 * No network and no server required — the mappers are pure.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationsSampleCounts,
  getQuarterSampleInfo,
  mapOperationsCounts,
  mapSampleManifest,
  parseSampleQuarter,
} from "./quarterSample";

/** Verbatim GET /api/quarter-summary payload from the quarter sample server. */
const MANIFEST = {
  sample: true,
  quarter: {
    code: "Q3-2026",
    label: "Quarter 3 — Jun to Sep 2026",
    fromDate: "2026-06-18",
    toDate: "2026-09-17",
    months: ["2026-06", "2026-07", "2026-08", "2026-09"],
    today: "2026-09-17",
    rolling: true,
    days: 92,
  },
  generatedAt: "2026-09-17T01:29:29.791Z",
  shops: 200,
  employees: 150,
  farms: 10,
  vehicles: 24,
  trips: 640,
  deliveries: 6905,
  collections: 4773,
  fuelBills: 1194,
  maintenance: 307,
  permits: 120,
  emis: 12,
  payments: 665,
  farmPayments: 526,
  salaries: 600,
  leaves: 356,
  dutyAssignments: 15370,
  marketRates: 92,
};

/**
 * Verbatim `moduleCounts` block of GET /operations/dashboard for the same
 * quarter — each value equals that Operations page's own endpoint total
 * (asserted live by `npm run check:operations-sync`).
 */
const DASHBOARD = {
  totalTrips: 623,
  totalSales: 54233402.42,
  moduleCounts: {
    tripRecords: 526,
    rateEntries: 79,
    shopSales: 6905,
    collections: 4773,
    pendingShops: 197,
    mortalityTrips: 526,
    fuelBills: 1194,
    orders: 8,
  },
  sample: true,
};

test("parseSampleQuarter reads the window, label and business today", () => {
  const quarter = parseSampleQuarter(MANIFEST.quarter);
  assert.ok(quarter);
  assert.equal(quarter.code, "Q3-2026");
  assert.equal(quarter.fromDate, "2026-06-18");
  assert.equal(quarter.toDate, "2026-09-17");
  assert.equal(quarter.today, "2026-09-17");
  assert.equal(quarter.days, 92);
  assert.deepEqual(quarter.months, ["2026-06", "2026-07", "2026-08", "2026-09"]);
});

test("parseSampleQuarter rejects a window it cannot use", () => {
  assert.equal(parseSampleQuarter(null), null);
  assert.equal(parseSampleQuarter({ code: "Q3-2026" }), null);
  assert.equal(parseSampleQuarter({ fromDate: "2026-06-18" }), null);
});

test("mapSampleManifest maps the window and keeps every published count", () => {
  const info = mapSampleManifest(MANIFEST);
  assert.ok(info);
  assert.equal(info.sample, true);
  assert.equal(info.quarter.code, "Q3-2026");
  assert.equal(info.generatedAt, "2026-09-17T01:29:29.791Z");
  // Nothing dropped, nothing invented: the manifest's 17 numeric fields survive.
  assert.equal(Object.keys(info.counts).length, 17);
  assert.equal(info.counts.trips, 640);
  assert.equal(info.counts.deliveries, 6905);
  assert.equal(info.counts.marketRates, 92);
  assert.equal("quarter" in info.counts, false);
  assert.equal("sample" in info.counts, false);
  assert.equal("generatedAt" in info.counts, false);
});

test("mapSampleManifest carries reference counts only — never a guessed page count", () => {
  const info = mapSampleManifest(MANIFEST);
  assert.ok(info);
  assert.deepEqual(info.operationsCounts, {
    shops: 200,
    farms: 10,
    vehicles: 24,
    employees: 150,
  });
  // The manifest cannot answer these, so the manifest mapper must not try.
  const counts = info.operationsCounts as Record<string, unknown>;
  for (const field of ["tripRecords", "rateEntries", "pendingShops", "mortalityTrips", "orders"]) {
    assert.equal(field in counts, false, `${field} must not be inferred from the manifest`);
  }
});

test("mapSampleManifest ignores a payload that is not the sample manifest", () => {
  assert.equal(mapSampleManifest(null), null);
  assert.equal(mapSampleManifest("nope"), null);
  assert.equal(mapSampleManifest({ ...MANIFEST, sample: false }), null);
  assert.equal(mapSampleManifest({ ...MANIFEST, quarter: { code: "Q3-2026" } }), null);
});

test("mapOperationsCounts maps every Operations page from moduleCounts", () => {
  const manifest = mapSampleManifest(MANIFEST);
  assert.ok(manifest);
  const counts = mapOperationsCounts(DASHBOARD, manifest);
  assert.ok(counts);
  assert.equal(counts.tripRecords, 526, "Trip List total");
  assert.equal(counts.rateEntries, 79, "Rates Entry queue");
  assert.equal(counts.shopSales, 6905, "Shop Sales lines");
  assert.equal(counts.collections, 4773, "Collection Entry rows");
  assert.equal(counts.pendingShops, 197, "shops with an outstanding balance");
  assert.equal(counts.mortalityTrips, 526, "Mortality analysis meta.total");
  assert.equal(counts.fuelBills, 1194, "Fuel Expenses meta.total");
  assert.equal(counts.orders, 8, "ORD-* day containers");
  // Reference data rides along from the manifest.
  assert.equal(counts.shops, 200);
  assert.equal(counts.farms, 10);
  assert.equal(counts.vehicles, 24);
  assert.equal(counts.employees, 150);
});

test("mapOperationsCounts never falls back to a manifest sibling count", () => {
  const manifest = mapSampleManifest(MANIFEST);
  assert.ok(manifest);
  const counts = mapOperationsCounts(DASHBOARD, manifest);
  assert.ok(counts);
  // Each of these was wrong before: it borrowed a manifest total instead of
  // reading the server's per-page number.
  assert.notEqual(counts.tripRecords, manifest.counts.trips, "containers are not trips");
  assert.notEqual(counts.rateEntries, manifest.counts.marketRates, "rate days ≠ rate queue");
  assert.notEqual(counts.pendingShops, manifest.counts.shops, "not every shop owes money");
  assert.notEqual(counts.mortalityTrips, manifest.counts.trips, "not every trip loses birds");
});

test("mapOperationsCounts reports missing counts as missing", () => {
  const manifest = mapSampleManifest(MANIFEST);
  assert.ok(manifest);
  // No moduleCounts block at all → no per-page numbers (never a fabricated one).
  assert.equal(mapOperationsCounts({ totalTrips: 1 }, manifest), null);
  assert.equal(mapOperationsCounts(null, manifest), null);

  const partial = mapOperationsCounts({ moduleCounts: { tripRecords: 526 } }, manifest);
  assert.ok(partial);
  assert.equal(partial.tripRecords, 526);
  assert.equal(partial.mortalityTrips, undefined);
  assert.equal(partial.orders, undefined);
  // Junk values are dropped rather than coerced.
  const junk = mapOperationsCounts(
    { moduleCounts: { tripRecords: "526", orders: -1, fuelBills: Number.NaN } },
    manifest
  );
  assert.ok(junk);
  assert.equal(junk.tripRecords, undefined);
  assert.equal(junk.orders, undefined);
  assert.equal(junk.fuelBills, undefined);
});

test("tripRecords + orders never exceed the trip manifest", () => {
  const manifest = mapSampleManifest(MANIFEST);
  assert.ok(manifest);
  const counts = mapOperationsCounts(DASHBOARD, manifest);
  assert.ok(counts);
  // Trip List renders Completed vehicle trips only; Draft / Pending / Deleted
  // audit rows live in the manifest total but on no Operations page table.
  assert.ok(
    (counts.tripRecords ?? 0) + (counts.orders ?? 0) <= manifest.counts.trips,
    "Trip List rows + Orders day containers fit inside the trip manifest"
  );
  assert.equal(counts.tripRecords, counts.mortalityTrips, "Trip List and Mortality read the same completed trips");
});

test("probes stay off outside a dev build", async () => {
  // Plain Node has no import.meta.env.DEV — the same condition a production
  // bundle sees. Neither helper may reach the network or throw.
  assert.equal(await getQuarterSampleInfo(), null);
  assert.equal(await getOperationsSampleCounts(), null);
});
