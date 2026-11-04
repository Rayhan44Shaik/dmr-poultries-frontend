/**
 * Farm Payment display-row contract (Accounts → Farm Payment only).
 *
 * The table, filters, pagination, totals and PDF/Excel exports all operate on
 * payable display rows flattened from one parent Farm Payment per trip:
 * single-load/legacy trips keep their canonical trip number, multi-load
 * trips render one `-L{load}` row per submitted load with that load's own
 * figures. The parent record (what Account Analysis charges) is never
 * duplicated.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  displayTripNo,
  flattenFarmPaymentsForTable,
  mapFarmPayments,
  toFarmPaymentExportRows,
} from "../services/farmPaymentApiService";
import type { TripFarmPayment } from "../types/farmPayment.types";

function parent(overrides: Partial<TripFarmPayment> = {}): TripFarmPayment {
  return {
    id: 90001,
    tripId: 90001,
    tripNo: "TR-20261101-009",
    tripDate: "2026-11-01",
    farmName: "Farm A",
    amount: 0,
    paidAmount: 0,
    balance: 0,
    status: "Pending",
    loads: [],
    ...overrides,
  } as TripFarmPayment;
}

function load(overrides: Record<string, unknown> = {}) {
  return {
    legId: 1,
    load: 1,
    farmName: "Farm A",
    birdType: "Broiler",
    totalBirds: 40,
    dcWeight: 80,
    rate: 90,
    amount: 7200,
    ...overrides,
  };
}

test("a legacy trip with no legs is one direct row without a suffix", () => {
  const rows = flattenFarmPaymentsForTable(mapFarmPayments([parent({ loads: [] })]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayTripNo, "TR-20261101-009");
  assert.equal(rows[0].key, "trip:90001");
});

test("one submitted load is one direct row without -L1", () => {
  const rows = flattenFarmPaymentsForTable(
    mapFarmPayments([parent({ loads: [load({ legId: 41 })] })])
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayTripNo, "TR-20261101-009");
  assert.equal(rows[0].farm, "Farm A");
});

test("two submitted loads render -L1 and -L2 with their own farms and weights", () => {
  const rows = flattenFarmPaymentsForTable(
    mapFarmPayments([
      parent({
        loads: [
          load({ legId: 41, load: 1, farmName: "Farm A", totalBirds: 40, dcWeight: 80 }),
          load({ legId: 42, load: 2, farmName: "Farm B", birdType: "Country Chicken", totalBirds: 60, dcWeight: 120, rate: 100, amount: 12000 }),
        ],
      }),
    ])
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].displayTripNo, "TR-20261101-009-L1");
  assert.equal(rows[1].displayTripNo, "TR-20261101-009-L2");
  // Farm filtering is per load: only the Farm B row matches.
  assert.deepEqual(rows.filter((row) => row.farm === "Farm B").map((row) => row.displayTripNo), [
    "TR-20261101-009-L2",
  ]);
  // Search finds the suffixed number; both rows open the canonical trip.
  assert.ok(rows[1].displayTripNo.toLowerCase().includes("l2"));
  assert.equal(rows[0].tripNo, "TR-20261101-009");
  assert.equal(rows[1].tripNo, "TR-20261101-009");
});

test("three and four loads use the matching suffix", () => {
  const loads = [1, 2, 3, 4].map((n) =>
    load({ legId: 50 + n, load: n, farmName: `Farm ${n}` })
  );
  const rows = flattenFarmPaymentsForTable(mapFarmPayments([parent({ loads })]));
  assert.deepEqual(
    rows.map((row) => row.displayTripNo),
    ["TR-20261101-009-L1", "TR-20261101-009-L2", "TR-20261101-009-L3", "TR-20261101-009-L4"]
  );
  assert.equal(displayTripNo("TR-20261101-009", 4, 3), "TR-20261101-009-L3");
});

test("exports contain separate load rows and sum exactly once", () => {
  const rows = flattenFarmPaymentsForTable(
    mapFarmPayments([
      parent({
        tripId: 90002,
        loads: [
          load({ legId: 61, load: 1, totalBirds: 40, dcWeight: 80, rate: 90, amount: 7200 }),
          load({ legId: 62, load: 2, farmName: "Farm B", totalBirds: 60, dcWeight: 120, rate: 100, amount: 12000 }),
        ],
      }),
    ])
  );
  const exported = toFarmPaymentExportRows(rows);
  assert.deepEqual(exported.map((row) => row.tripNo), ["TR-20261101-009-L1", "TR-20261101-009-L2"]);
  assert.deepEqual(exported.map((row) => row.farm), ["Farm A", "Farm B"]);
  assert.deepEqual(exported.map((row) => row.totalAmount), [7200, 12000]);
  const total = exported.reduce((sum, row) => sum + row.totalAmount, 0);
  assert.equal(total, 19200);
  // No aggregate parent row is exported alongside the loads.
  assert.equal(exported.length, 2);
});
