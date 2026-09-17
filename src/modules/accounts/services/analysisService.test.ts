/**
 * Account Analysis expense + net-profit tests.
 *
 * The Analysis used to take its Farm Payment from Payment Register entries
 * typed "Farmer Payment" only — ₹2,66,600 for the sample quarter, against a
 * real trip-linked farm cost of ₹4.39 Cr. These tests pin the corrected rule:
 *
 *   · the farm sector is the trip-linked farm cost of the trips in range;
 *   · register farmer settlements are NOT added on top (that would count every
 *     farmer rupee twice);
 *   · every other sector still comes from the Approved Payment Register;
 *   · net profit = shop sales − total expenses (farm included exactly once).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisService, EMPTY_ANALYSIS, type AnalysisSnapshot } from "./analysisService";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import type { Collection } from "../../operations/collections/types/collection";
import type { Payment } from "../types/payment.types";
import type { TripFarmPayment } from "../types/farmPayment.types";

const trip = (id: number, tripDate: string, rate: number, extra: Record<string, unknown> = {}): Trip =>
  ({
    id,
    tripNo: `TRP-${id}`,
    tripDate,
    status: "Completed",
    deleted: false,
    totalBirds: 100,
    totalWeight: 100,
    totalMortality: 0,
    deliveries: [{ weight: 100, rate }],
    ...extra,
  }) as unknown as Trip;

const farmPayment = (tripId: number, amount: number, paidAmount = 0): TripFarmPayment => ({
  id: tripId,
  tripId,
  tripNo: `TRP-${tripId}`,
  tripDate: "2026-09-01",
  amount,
  paidAmount,
  balance: amount - paidAmount,
  status: paidAmount >= amount ? "Paid" : paidAmount > 0 ? "Partially Paid" : "Pending",
});

const payment = (
  id: number,
  paymentDate: string,
  paymentType: string,
  amount: number,
  status: "Approved" | "Draft" = "Approved"
): Payment => ({ id, paymentNo: `PAY-${id}`, paymentDate, paymentType, amount, status }) as unknown as Payment;

const START = new Date(2026, 8, 1);
const END = new Date(2026, 8, 30, 23, 59, 59);

/** Two completed trips inside the range, one completed trip outside it, one
 * deleted trip inside it — plus a register that contains a farmer settlement,
 * a diesel bill and an unapproved office expense. */
const SNAPSHOT: AnalysisSnapshot = {
  trips: [
    trip(1, "2026-09-01", 50),
    trip(2, "2026-09-10", 60),
    trip(3, "2026-08-01", 70),
    trip(4, "2026-09-05", 80, { deleted: true }),
  ],
  collections: [
    { id: 1, collectionNo: "C-1", collectionDate: "2026-09-02", amount: 4000, status: "Approved" },
    { id: 2, collectionNo: "C-2", collectionDate: "2026-09-03", amount: 500, status: "Pending Approval" },
  ] as unknown as Collection[],
  payments: [
    payment(1, "2026-09-02", "Farmer Payment", 700),
    payment(2, "2026-09-03", "Diesel", 300),
    payment(3, "2026-09-04", "Office Expense", 100, "Draft"),
  ],
  farmPayments: [
    farmPayment(1, 1000),
    farmPayment(2, 2000, 500),
    farmPayment(3, 500),
    farmPayment(4, 999),
  ],
};

const service = createAnalysisService(SNAPSHOT);
const rangeTrips = service.getCompletedTripsByDateRange(START, END);

test("only completed, live trips in the range are analysed", () => {
  assert.deepEqual(
    rangeTrips.map((t) => t.id).sort(),
    [1, 2],
    "the August trip is outside the range and the deleted trip is never analysed"
  );
});

test("the farm sector is the trip-linked farm cost of those trips", () => {
  const expenses = service.computeEffectiveExpenses(rangeTrips, START, END);
  assert.equal(expenses.farm, 3000, "trip 1 (₹1,000) + trip 2 (₹2,000)");
  // The bug this replaces: farm cost plus the register's farmer settlement.
  assert.notEqual(expenses.farm, 3700, "the register's farmer payment must not be added again");
});

test("every other expense sector still comes from the Approved Payment Register", () => {
  const expenses = service.computeEffectiveExpenses(rangeTrips, START, END);
  assert.equal(expenses.fuel, 300, "the approved diesel bill");
  assert.equal(expenses.office, 0, "a Draft payment is not an expense");
  assert.equal(expenses.trip + expenses.salary + expenses.maintenance, 0);
});

test("farm money is attributed to the trips, not to a separate date filter", () => {
  const totals = service.farmTotalsForTrips(rangeTrips);
  assert.equal(totals.trips, 2);
  assert.equal(totals.payable, 3000);
  assert.equal(totals.paid, 500);
  assert.equal(totals.balance, 2500);
  // A trip with no farm payment simply contributes nothing.
  assert.equal(service.farmTotalsForTrips([trip(99, "2026-09-11", 10)]).payable, 0);
});

test("each trip can be asked for its own farm payment", () => {
  assert.equal(service.getFarmPaymentForTrip(1)?.amount, 1000);
  assert.equal(service.getFarmPaymentForTrip("2")?.paidAmount, 500);
  assert.equal(service.getFarmPaymentForTrip(99), undefined);
});

test("net profit = shop sales − farm payment − every other expense", () => {
  const collections = service.getApprovedCollectionsByDateRange(START, END);
  const metrics = service.computeMetrics(rangeTrips, collections);
  const expenses = service.computeEffectiveExpenses(rangeTrips, START, END);
  const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);

  assert.equal(metrics.sales, 11000, "100 kg × ₹50 + 100 kg × ₹60");
  assert.equal(metrics.collection, 4000, "only the approved collection");
  assert.equal(totalExpenses, 3300, "farm 3,000 + fuel 300");
  assert.equal(metrics.sales - totalExpenses, 7700);
});

test("an empty snapshot yields zeroed figures instead of NaN", () => {
  const empty = createAnalysisService(EMPTY_ANALYSIS);
  const expenses = empty.computeEffectiveExpenses([], START, END);
  assert.deepEqual(expenses, { farm: 0, fuel: 0, trip: 0, salary: 0, maintenance: 0, office: 0 });
  assert.equal(empty.farmTotalsForTrips([]).payable, 0);
  const metrics = empty.computeMetrics([], []);
  assert.equal(metrics.sales - Object.values(expenses).reduce((a, b) => a + b, 0), 0);
});
