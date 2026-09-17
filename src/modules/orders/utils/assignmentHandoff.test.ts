// src/modules/orders/utils/assignmentHandoff.test.ts
// Assignment → Tracking → Step 4 submit:
//   - Save Progress does not open Delivery Tracking
//   - Finish Assignment is the tracking gate
//   - duplicate shops collapse on write
//   - Tracking View Submit never sets Trip Entry `status = Completed`
//     and never overwrites `order:` remarks
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import { resetSampleTrips, sampleTrips } from "../services/sampleOrdersData";
import {
  fetchOrdersData,
  finishAssignment,
  saveAssignment,
  saveCollection,
  submitShopDeliveries,
} from "../services/ordersService";
import {
  buildOrdersTrip,
  computeOrdersProgress,
  isTrackingTrip,
  partitionTrackingTrips,
  uniqueShopRows,
} from "./ordersUtils";
import { ORDER_PLAN_REMARKS, type OrderShopRow } from "../types";

const ORDER_TRIP_NO = "ORD-ASSIGN-01";
const SHOP_A = 88001;
const SHOP_B = 88002;

let clientKey = 0;

function collectionRow(shopId: number, boxes: number, serialNo = 1): OrderShopRow {
  return {
    id: 0,
    clientKey: `ck-${++clientKey}`,
    serialNo,
    boxNo: boxes,
    shopId,
    shopName: `Shop ${shopId}`,
    birdTypeId: 0,
    birdType: "",
    birds: boxes * 10,
    weight: 0,
    mortality: 0,
    mortKg: 0,
    rate: null,
    amount: 0,
    remarks: ORDER_PLAN_REMARKS,
    deliveryMode: "box",
    selectedBoxIds: [],
  };
}

function assignedRow(shopId: number, boxes: number, serialNo = 1): OrderShopRow {
  return { ...collectionRow(shopId, boxes, serialNo), remarks: ORDER_PLAN_REMARKS };
}

function vehicleTrip(id: number, tripNo: string): Trip {
  return createEmptyTrip({
    id,
    tripNo,
    vehicleId: id,
    vehicleNo: `TS07-${id}`,
    tripDate: new Date().toISOString().slice(0, 10),
    farmStepSubmitted: true,
    deliveryStepSubmitted: false,
    status: "Pending",
  });
}

async function seedAssignment(): Promise<{ day: string; vehicle: Trip }> {
  resetSampleTrips();
  const container = await saveCollection(null, ORDER_TRIP_NO, [
    collectionRow(SHOP_A, 10, 1),
    collectionRow(SHOP_B, 8, 2),
  ]);
  const vehicle = vehicleTrip(8201, "TRP-ASSIGN-A");
  sampleTrips().push(vehicle);
  return { day: container.tripDate, vehicle };
}

test("uniqueShopRows on assignment writes keeps first shop, drops later duplicates", () => {
  const rows = uniqueShopRows([
    assignedRow(SHOP_A, 10, 1),
    assignedRow(SHOP_A, 99, 2),
    assignedRow(SHOP_B, 8, 3),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].shopId, SHOP_A);
  assert.equal(rows[0].boxNo, 10);
  assert.equal(rows[1].shopId, SHOP_B);
});

test("Save Assignment (no Finish) does not appear in Delivery Tracking", async () => {
  const { vehicle } = await seedAssignment();
  await saveAssignment(vehicle, [
    { orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_A, 10), assignedRow(SHOP_B, 8)] },
  ]);
  const data = await fetchOrdersData();
  const saved = data.eligibleVehicles.find((v) => v.trip.id === vehicle.id);
  assert.ok(saved, "saved (unfinished) assignment stays on the eligible-vehicle list");
  assert.equal(isTrackingTrip(saved!.trip), false);
  assert.equal(
    data.tracking.some((ot) => ot.trip.id === vehicle.id),
    false,
    "Save Progress must never open a tracking row"
  );
});

test("Finish Assignment opens Delivery Tracking as Pending — never Completed", async () => {
  const { vehicle } = await seedAssignment();
  const finished = await finishAssignment(vehicle, [
    { orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_A, 10), assignedRow(SHOP_B, 8)] },
  ]);
  assert.equal(finished.deliveryStepSubmitted, true);
  assert.ok(String(finished.remarks).includes(`order:${ORDER_TRIP_NO}`));
  assert.notEqual(finished.status, "Completed");
  assert.equal(isTrackingTrip(finished), true);

  const data = await fetchOrdersData();
  const ot = data.tracking.find((row) => row.trip.id === vehicle.id);
  assert.ok(ot, "Finish Assignment is the tracking gate");
  const { pending, completed } = partitionTrackingTrips([ot!]);
  assert.equal(pending.length, 1);
  assert.equal(completed.length, 0);
  assert.equal(ot!.progress?.status, "Assigned");
});

test("duplicate shops on Finish Assignment collapse to one row per shop", async () => {
  const { vehicle } = await seedAssignment();
  await finishAssignment(vehicle, [
    {
      orderTripNo: ORDER_TRIP_NO,
      rows: [assignedRow(SHOP_A, 10, 1), assignedRow(SHOP_A, 99, 2), assignedRow(SHOP_B, 8, 3)],
    },
  ]);
  const data = await fetchOrdersData();
  const ot = data.tracking.find((row) => row.trip.id === vehicle.id);
  assert.ok(ot);
  const shops = (ot!.trip.deliveries ?? []).filter((r) => r.shopId === SHOP_A);
  assert.equal(shops.length, 1, "one shop, one assignment row");
  assert.equal(shops[0].boxNo, 10, "first occurrence wins");
});

test("submitShopDeliveries persists captures only — does not complete the trip or drop order: tags", async () => {
  const { vehicle } = await seedAssignment();
  const finished = await finishAssignment(vehicle, [
    { orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_A, 10), assignedRow(SHOP_B, 8)] },
  ]);
  const captured: ShopDelivery[] = (finished.deliveries ?? []).map((row, i) => ({
    ...row,
    autoCaptureTime: `2026-09-06T09:0${i}:00.000Z`,
  }));
  finished.deliveries = captured;

  const submitted = await submitShopDeliveries(finished);
  assert.notEqual(submitted.status, "Completed", "Trip Entry Step 5 owns Completed");
  assert.ok(
    String(submitted.remarks).includes(`order:${ORDER_TRIP_NO}`),
    "order: remarks must survive Tracking View Submit"
  );
  assert.equal(submitted.deliveryStepSubmitted, true);

  const progress = computeOrdersProgress(submitted);
  assert.equal(progress.deliveryState, "complete");
  assert.notEqual(progress.status, "Completed");

  const { pending, completed } = partitionTrackingTrips([buildOrdersTrip(submitted)]);
  assert.equal(pending.length, 1);
  assert.equal(completed.length, 0);
});
