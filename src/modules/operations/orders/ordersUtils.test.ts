// Orders ↔ Trip Entry sync — the delivery-count math that drives
// "Shops (5) → (4) → … → (0)" in Delivery Tracking.
//
// The count is DERIVED from persisted rows only:
//   - Order Assignment (POST /api/orders/assignments) projects box-less,
//     weight-0 `[ORDER]` plan rows onto the vehicle trip inside the same
//     transaction (the backend stamps auto_capture_time on every INSERT —
//     that alone must NOT count as "delivered").
//   - Trip Entry Step 4 later rewrites a row with real delivered quantities
//     (weight > 0 and/or selected pickup boxes) — THAT is a capture.
//   - pendingShops = original order shops with no capture yet.

import assert from "node:assert/strict";
import test from "node:test";
import type { ShopDelivery, Trip } from "../../../shared/trip";
import {
  computeOrdersProgress,
  hasOrderRows,
  isCapturedRow,
  isTrackingTrip,
} from "./ordersUtils";
import { ORDER_PLAN_REMARKS, type ShopOrderQuantities } from "./types";

function planRow(shopId: number, over: Partial<ShopDelivery> = {}): ShopDelivery {
  return {
    id: shopId,
    clientKey: `ck-${shopId}`,
    serialNo: shopId,
    boxNo: 0,
    shopId,
    shopName: `Shop ${shopId}`,
    birdTypeId: 0,
    birdType: "",
    birds: 40,
    weight: 0,
    mortality: 0,
    mortKg: 0,
    rate: null,
    amount: 0,
    remarks: ORDER_PLAN_REMARKS,
    deliveryMode: "box",
    selectedBoxIds: [],
    // The backend stamps this on every trip_deliveries INSERT, plan rows included.
    autoCaptureTime: "2026-09-01T04:00:00.000Z",
    ...over,
  } as ShopDelivery;
}

/** A row after Trip Entry Step 4 recorded the actual delivery. */
function deliveredRow(shopId: number): ShopDelivery {
  return planRow(shopId, {
    weight: 60,
    birds: 30,
    selectedBoxIds: [shopId],
    autoCaptureTime: "2026-09-01T09:15:00.000Z",
  });
}

function vehicleTrip(rows: ShopDelivery[], over: Partial<Trip> = {}): Trip {
  return {
    id: 900,
    tripNo: "TR-20260901-500",
    tripDate: "2026-09-01",
    status: "Draft",
    deleted: false,
    vehicleId: 3,
    vehicleNo: "E2E-TRUCK-03",
    farmStepSubmitted: true,
    pickupStepSubmitted: true,
    deliveryStepSubmitted: false,
    deliveries: rows,
    ...over,
  } as unknown as Trip;
}

const orderedQty: ShopOrderQuantities = new Map(
  [1, 2, 3, 4, 5].map((id) => [id, { boxes: 2, birds: 40, weight: 0 }])
);

test("isCapturedRow: a box-less, weight-0 plan row is NOT a delivery even with auto_capture_time", () => {
  assert.equal(isCapturedRow(planRow(1)), false);
});

test("isCapturedRow: a Step 4 row with delivered weight or selected boxes IS a delivery", () => {
  assert.equal(isCapturedRow(planRow(1, { weight: 55 })), true);
  assert.equal(isCapturedRow(planRow(1, { selectedBoxIds: [7] })), true);
  assert.equal(isCapturedRow(deliveredRow(1)), true);
});

test("isTrackingTrip: a vehicle trip carrying [ORDER] rows is tracked before Step 4 is submitted", () => {
  const trip = vehicleTrip([planRow(1), planRow(2)]);
  assert.equal(hasOrderRows(trip), true);
  assert.equal(isTrackingTrip(trip), true);
  // a row with no vehicle is never a tracking trip
  assert.equal(
    isTrackingTrip(vehicleTrip([planRow(1)], { vehicleId: 0, vehicleNo: "" })),
    false
  );
  assert.equal(isTrackingTrip(vehicleTrip([planRow(1)], { deleted: true })), false);
});

test("computeOrdersProgress: 5 assigned shops start at 5 pending / 0 delivered / Assigned", () => {
  const trip = vehicleTrip([1, 2, 3, 4, 5].map((id) => planRow(id)));
  const p = computeOrdersProgress(trip, orderedQty);
  assert.equal(p.totalShops, 5);
  assert.equal(p.deliveredShops, 0);
  assert.equal(p.pendingShops, 5);
  assert.equal(p.totalBoxes, 10); // 5 × 2 ordered boxes (from the container)
  assert.equal(p.status, "Assigned");
});

test("computeOrdersProgress: each Step 4 delivery drops pending 5 → 4 → 3 → 2 → 1 → 0", () => {
  const shopIds = [1, 2, 3, 4, 5];
  const expectedPending = [4, 3, 2, 1, 0];
  for (let delivered = 1; delivered <= 5; delivered += 1) {
    const rows = shopIds.map((id) =>
      id <= delivered ? deliveredRow(id) : planRow(id)
    );
    const p = computeOrdersProgress(vehicleTrip(rows), orderedQty);
    assert.equal(p.deliveredShops, delivered, `delivered after ${delivered}`);
    assert.equal(
      p.pendingShops,
      expectedPending[delivered - 1],
      `pending after ${delivered}`
    );
    // Not lifecycle-Completed → "In Progress" once any shop is delivered.
    assert.equal(p.status, "In Progress");
  }
});

test("computeOrdersProgress: lifecycle-Completed trip reports Completed regardless of captures", () => {
  const rows = [1, 2, 3, 4, 5].map((id) => deliveredRow(id));
  const p = computeOrdersProgress(
    vehicleTrip(rows, { status: "Completed" }),
    orderedQty
  );
  assert.equal(p.pendingShops, 0);
  assert.equal(p.status, "Completed");
});
