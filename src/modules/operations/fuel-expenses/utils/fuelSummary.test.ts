/**
 * Fuel Expenses page improvements: focused unit coverage.
 *
 * - Total Distance comes only from the backend-saved trip distance
 *   (travelDistance), deduplicated per trip — never a manual entry.
 * - Mileage is Total Distance ÷ Total Fuel Litres; zero litres shows "—"
 *   (null), never NaN/Infinity.
 * - Active filters change KPI/footer totals (composed with the real
 *   filterFuelExpenses helper, mirroring the page pipeline).
 * - Add / edit / delete row sets update table, KPI, distance and mileage.
 * - Multi-load bills expose the Trip List Load 1 / Load 2 breakdown;
 *   single-load bills render the plain label with no tooltip.
 * - Toolbar order is Add Fuel Bill → Reset → Refresh → PDF → Excel, and
 *   PDF/Excel stay disabled only when no filtered records exist.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FUEL_TOOLBAR_ORDER } from "./fuelSummary.ts";
import { filterFuelExpenses } from "./filterFuelExpenses.ts";
import {
  fuelTripLabel,
  fuelTripLoads,
  hasFuelLoadBreakdown,
  summarizeFuelBills,
} from "./fuelSummary.ts";
import type { FuelExpense } from "../types/fuelExpense.ts";

function bill(overrides: Partial<FuelExpense> = {}): FuelExpense {
  return {
    id: "b1",
    billNo: "FUEL-1",
    date: "2026-11-01",
    sourceType: "MANUAL",
    vehicleId: 1,
    vehicleNo: "TS09AB1234",
    driverId: 2,
    driverName: "Driver",
    meterReading: 1000,
    amount: 1000,
    rate: 100,
    litres: 10,
    petrolBunk: "Bunk",
    status: "Pending",
    createdDate: "2026-11-01",
    createdBy: "tester",
    ...overrides,
  };
}

const tripBill = (tripId: number, travelDistance: number | null, litres = 20): FuelExpense =>
  bill({
    id: `trip-${tripId}`,
    billNo: `TRP-1-F00${tripId}`,
    sourceType: "TRIP",
    tripId,
    tripNo: "TRP-1",
    status: "Approved",
    travelDistance,
    litres,
    amount: litres * 100,
  });

// ── Total Distance from the saved trip distance ─────────────────────────────

test("total distance sums the saved per-trip distance once per trip", () => {
  const rows = [
    tripBill(101, 250, 20),
    tripBill(101, 250, 30), // second bill on the same trip: distance counted once
    tripBill(102, 100, 10),
    bill({ id: "manual-1", litres: 5, amount: 500 }), // manual: no distance
  ];
  const summary = summarizeFuelBills(rows);
  assert.equal(summary.totalDistance, 350);
  assert.equal(summary.totalLitres, 65);
});

test("total distance is null when no trip distance is saved", () => {
  const summary = summarizeFuelBills([bill({ id: "m1" }), bill({ id: "m2" })]);
  assert.equal(summary.totalDistance, null);
  assert.equal(summary.avgMileage, null);
});

// ── Mileage ─────────────────────────────────────────────────────────────────

test("mileage is total distance ÷ total fuel litres", () => {
  const summary = summarizeFuelBills([tripBill(101, 250, 20), tripBill(102, 100, 10)]);
  assert.equal(summary.totalLitres, 30);
  assert.equal(summary.avgMileage, Number((350 / 30).toFixed(2)));
});

test("zero litres never produces an invalid mileage figure", () => {
  const summary = summarizeFuelBills([tripBill(101, 250, 0)]);
  assert.equal(summary.totalLitres, 0);
  assert.equal(summary.avgMileage, null);
  assert.equal(summarizeFuelBills([]).avgMileage, null);
});

// ── Filters change KPI/footer totals ────────────────────────────────────────

test("vehicle and date filters change the totals, not just the page", () => {
  const rows = [
    tripBill(101, 250, 20),
    { ...tripBill(102, 100, 10), vehicleNo: "OTHER01", date: "2026-10-01" },
  ];
  const all = summarizeFuelBills(filterFuelExpenses(rows, { includeDeleted: true }));
  assert.equal(all.totalDistance, 350);
  const byVehicle = summarizeFuelBills(
    filterFuelExpenses(rows, { vehicleNo: "TS09AB1234", includeDeleted: true }),
  );
  assert.equal(byVehicle.totalDistance, 250);
  assert.equal(byVehicle.avgMileage, Number((250 / 20).toFixed(2)));
  const byDate = summarizeFuelBills(
    filterFuelExpenses(rows, { fromDate: "2026-11-01", toDate: "2026-11-30", includeDeleted: true }),
  );
  assert.equal(byDate.totalDistance, 250);
});

// ── Add / edit / delete update table, KPIs, distance and mileage ────────────

test("adding a bill grows litres, amount, distance and mileage together", () => {
  const before = summarizeFuelBills([tripBill(101, 250, 20)]);
  const after = summarizeFuelBills([tripBill(101, 250, 20), tripBill(102, 100, 10)]);
  assert.equal(after.totalLitres, before.totalLitres + 10);
  assert.equal(after.totalDistance, (before.totalDistance ?? 0) + 100);
  assert.notEqual(after.avgMileage, before.avgMileage);
});

test("editing litres re-derives mileage from the same distance", () => {
  const edited = [{ ...tripBill(101, 250, 20), litres: 50, amount: 5000 }];
  const summary = summarizeFuelBills(edited);
  assert.equal(summary.totalDistance, 250);
  assert.equal(summary.avgMileage, 5);
});

test("deleting the last bill of a trip drops its distance and mileage", () => {
  const rows = [tripBill(101, 250, 20), tripBill(102, 100, 10)];
  const afterDelete = summarizeFuelBills(rows.filter((row) => row.id !== "trip-102"));
  assert.equal(afterDelete.totalDistance, 250);
  assert.equal(afterDelete.avgMileage, Number((250 / 20).toFixed(2)));
  assert.equal(summarizeFuelBills([]).totalDistance, null);
});

// ── Load / Load 2 display ───────────────────────────────────────────────────

test("multi-load bill exposes the Load 1 / Load 2 breakdown with DC context", () => {
  const multi = bill({
    sourceType: "TRIP",
    tripId: 7,
    tripNo: "TRP-7",
    tripFuelEntryIndex: 2,
    tripLoadCount: 2,
    tripLoads: [
      { load: 1, farmName: "Farm A", dcWeight: 800, birds: 400 },
      { load: 2, farmName: "Farm B", dcWeight: 600, birds: 300 },
    ],
  });
  assert.equal(hasFuelLoadBreakdown(multi), true);
  assert.deepEqual(
    fuelTripLoads(multi).map((load) => [load.load, load.farmName, load.dcWeight]),
    [[1, "Farm A", 800], [2, "Farm B", 600]],
  );
  assert.equal(fuelTripLabel(multi), "TRP-7");
});

test("single-load and manual bills render the plain label with no tooltip", () => {
  const single = bill({
    sourceType: "TRIP",
    tripId: 8,
    tripNo: "TRP-8",
    tripLoadCount: 1,
    tripLoads: [{ load: 1, farmName: "Farm A", dcWeight: 800, birds: 400 }],
  });
  assert.equal(hasFuelLoadBreakdown(single), false);
  assert.equal(fuelTripLabel(single), "TRP-8");
  const manual = bill({ tripNo: null });
  assert.equal(hasFuelLoadBreakdown(manual), false);
  assert.equal(fuelTripLabel(manual), "—");
});

// ── Button order ────────────────────────────────────────────────────────────

test("toolbar order is Add Fuel Bill, Reset, Refresh, PDF, Excel", () => {
  assert.deepEqual([...FUEL_TOOLBAR_ORDER], ["add", "reset", "refresh", "pdf", "excel"]);
});

test("toolbar source order is Add Fuel Bill → Reset → Refresh → PDF → Excel", () => {
  const source = readFileSync(new URL("../components/FuelFilters.tsx", import.meta.url), "utf8");
  const markers = [
    "1. Add Fuel Bill",
    "2. Reset Filters",
    "3. Refresh",
    "4. PDF",
    "5. Excel",
  ];
  const positions = markers.map((marker) => source.indexOf(marker));
  for (const [marker, position] of markers.map((marker, index) => [marker, positions[index]] as const)) {
    assert.ok(position !== -1, `${marker} toolbar block exists`);
  }
  const ordered = [...positions].sort((left, right) => left - right);
  assert.deepEqual(positions, ordered, "toolbar blocks are ordered Add → Reset → Refresh → PDF → Excel");
});

test("PDF/Excel stay disabled only when no filtered records exist", () => {
  const source = readFileSync(new URL("../components/FuelFilters.tsx", import.meta.url), "utf8");
  const recordGated = source.match(/disabled=\{!\(canExport \?\? hasFilters\)\}/g) ?? [];
  assert.ok(recordGated.length >= 2, "PDF and Excel disable on missing filtered records");
  assert.ok(!source.includes("disabled={!hasFilters}"), "exports are not gated on filters alone");
});
