/**
 * Deleted-register regression: a soft-deleted manual bill must survive the
 * base (pre-tab) filter so the Deleted quick tab can show it. The base call
 * passes includeDeleted: true; the active tabs still exclude deleted rows.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { filterFuelExpenses } from "./filterFuelExpenses";
import type { FuelExpense } from "../types/fuelExpense";

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

const deletedBill = bill({ id: "del-1", billNo: "FUEL-DEL", status: "Deleted", deleted: true });
const activeBill = bill({ id: "act-1", billNo: "FUEL-ACT" });

test("base filter with includeDeleted keeps the deleted bill for the tab layer", () => {
  const base = filterFuelExpenses([activeBill, deletedBill], { includeDeleted: true });
  assert.equal(base.length, 2);
  const deletedTab = filterFuelExpenses(base, { quickTab: "DELETED" });
  assert.deepEqual(deletedTab.map((b) => b.id), ["del-1"]);
});

test("base filter without includeDeleted still hides deleted bills (old behavior)", () => {
  const base = filterFuelExpenses([activeBill, deletedBill], {});
  assert.deepEqual(base.map((b) => b.id), ["act-1"]);
});

test("active tabs exclude deleted rows even when the base kept them", () => {
  const base = filterFuelExpenses([activeBill, deletedBill], { includeDeleted: true });
  assert.deepEqual(filterFuelExpenses(base, { quickTab: "ALL" }).map((b) => b.id), ["act-1"]);
  assert.deepEqual(filterFuelExpenses(base, { quickTab: "PENDING" }).map((b) => b.id), ["act-1"]);
});

test("pending tab follows the workflow status, not mere timestamp presence", () => {
  const approved = bill({ id: "ap-1", billNo: "FUEL-AP", status: "Approved" });
  const base = filterFuelExpenses([activeBill, approved], { includeDeleted: true });
  assert.deepEqual(filterFuelExpenses(base, { quickTab: "PENDING" }).map((b) => b.id), ["act-1"]);
  assert.deepEqual(filterFuelExpenses(base, { quickTab: "APPROVED" }).map((b) => b.id), ["ap-1"]);
});
