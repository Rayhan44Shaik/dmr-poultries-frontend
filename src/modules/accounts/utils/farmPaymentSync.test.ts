/**
 * Farm Payment sync tests: which trips surface, and how fresh rows merge.
 *
 * Guards the "completed trip appears immediately with its details" contract:
 * the eligibility rule matches the backend (Completed + not deleted + pickup
 * submitted — the same gate as /operations/trip-list and /accounts/farm-
 * payments), and a background refresh adds newly completed trips without
 * wiping rows the user already edited.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import type { FarmPayment, TripFarmPayment } from "../types/farmPayment.types";
import { farmPaymentRowDetails, isFarmPaymentTrip, mergeFarmPaymentRows } from "./farmPaymentSync";

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 1,
    status: "Completed",
    deleted: false,
    pickupStepSubmitted: true,
    ...overrides,
  } as Trip;
}

function ledgerRow(overrides: Partial<TripFarmPayment> = {}): TripFarmPayment {
  return {
    id: 1,
    tripId: 1,
    status: "Pending",
    amount: 0,
    paidAmount: 0,
    balance: 0,
    ...overrides,
  } as TripFarmPayment;
}

const buildRow = (t: Trip, apiRow?: TripFarmPayment): Partial<FarmPayment> => ({
  tripId: String(t.id),
  totalBirds: apiRow?.totalBirds ?? t.totalBirds ?? 0,
  paymentStatus: "Unpaid",
});

test("isFarmPaymentTrip matches the backend completed rule", () => {
  assert.equal(isFarmPaymentTrip(trip()), true);
  assert.equal(isFarmPaymentTrip(trip({ status: "Pending" })), false);
  assert.equal(isFarmPaymentTrip(trip({ status: "Draft" })), false);
  assert.equal(isFarmPaymentTrip(trip({ deleted: true })), false);
  assert.equal(isFarmPaymentTrip(trip({ pickupStepSubmitted: false })), false);
});

test("mergeFarmPaymentRows adds newly completed trips immediately", () => {
  const prev = {};
  const trips = [trip({ id: 7 })];
  const ledger = new Map([["7", ledgerRow({ tripId: 7, totalBirds: 100 })]]);
  const next = mergeFarmPaymentRows(prev, trips, ledger, new Set(), buildRow);
  assert.deepEqual(Object.keys(next), ["7"]);
  assert.equal(next["7"].tripId, "7");
  assert.equal(next["7"].totalBirds, 100);
});

test("mergeFarmPaymentRows never wipes a row edited since the last load", () => {
  const prev = { "7": { tripId: "7", totalBirds: 100, ratePerKg: 95, paymentStatus: "Unpaid" as const } };
  const trips = [trip({ id: 7 })];
  // The ledger now carries a different figure (e.g. reloaded after a save
  // elsewhere) — the dirty row keeps exactly what the user typed.
  const ledger = new Map([["7", ledgerRow({ tripId: 7, totalBirds: 120 })]]);
  const next = mergeFarmPaymentRows(prev, trips, ledger, new Set(["7"]), buildRow);
  assert.equal(next["7"].ratePerKg, 95);
  assert.equal(next["7"].totalBirds, 100);
});

test("farmPaymentRowDetails prefers the ledger's pickup figures", () => {
  // 40 birds lifted, 2 lost in transit: the row shows the farm's 40/80,
  // exactly what the ledger (and Account Analysis) charge.
  const details = farmPaymentRowDetails(
    { totalBirds: 38, dcWeight: 76 } as Trip,
    ledgerRow({ totalBirds: 40, dcWeight: 80 }),
  );
  assert.equal(details.totalBirds, 40);
  assert.equal(details.dcWeight, 80);
});

test("farmPaymentRowDetails falls back to the trip without a ledger row", () => {
  const details = farmPaymentRowDetails({ totalBirds: 38, dcWeight: 76 } as Trip);
  assert.equal(details.totalBirds, 38);
  assert.equal(details.dcWeight, 76);
});

test("mergeFarmPaymentRows rebuilds clean rows and drops departed trips", () => {
  const prev = {
    "7": { tripId: "7", totalBirds: 1 },
    "9": { tripId: "9", totalBirds: 2 },
  };
  const trips = [trip({ id: 7 })];
  const ledger = new Map([["7", ledgerRow({ tripId: 7, totalBirds: 100 })]]);
  const next = mergeFarmPaymentRows(prev, trips, ledger, new Set(), buildRow);
  assert.deepEqual(Object.keys(next), ["7"]);
  assert.equal(next["7"].totalBirds, 100);
});
