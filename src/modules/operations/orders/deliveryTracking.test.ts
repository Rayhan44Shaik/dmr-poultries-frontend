// src/modules/operations/orders/deliveryTracking.test.ts
// Delivery Tracking rules:
//   - table membership comes from Trip Entry `status`, never from 100% delivery
//   - deliveredShops counts FULLY delivered shops only
//   - deliveryState is independent of trip lifecycle
//   - missing `[ORDER]` assignment list still shows (assignmentIncomplete)
//   - no tracking row before Finish Assignment
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import {
  buildOrdersTrip,
  computeOrdersProgress,
  deliveryProgressPct,
  isTrackingTrip,
  pageRange,
  partitionTrackingTrips,
  trackingSearchHaystack,
} from "./ordersUtils";
import { orderRowRemarks } from "./types";

const ORDER = "ORD-20260904-01";

function plan(shopId: number, boxes: number, extra: Partial<ShopDelivery> = {}): ShopDelivery {
  return {
    id: shopId,
    serialNo: shopId,
    boxNo: boxes,
    shopId,
    shopName: `Shop ${shopId}`,
    birdTypeId: 0,
    birdType: "",
    birds: boxes * 10,
    weight: boxes * 15,
    mortality: 0,
    rate: null,
    amount: 0,
    remarks: orderRowRemarks(ORDER),
    ...extra,
  };
}

function captured(shopId: number, boxes: number, at = "2026-09-04T09:00:00.000Z"): ShopDelivery {
  return plan(shopId, boxes, { id: shopId + 1000, serialNo: shopId + 100, autoCaptureTime: at });
}

function tripOf(over: Partial<Trip>): Trip {
  return createEmptyTrip({
    id: 9101,
    tripNo: "TRP-20260904-01",
    tripDate: "2026-09-04",
    status: "Pending",
    deliveryStepSubmitted: true,
    remarks: `order:${ORDER}`,
    ...over,
  });
}

test("isTrackingTrip requires Finish Assignment — no premature rows", () => {
  const unsaved = tripOf({
    deliveryStepSubmitted: false,
    deliveries: [plan(1, 10)],
  });
  assert.equal(isTrackingTrip(unsaved), false);
});

test("isTrackingTrip keeps a trip whose [ORDER] rows were lost if order: tag remains", () => {
  const lost = tripOf({
    deliveryStepSubmitted: true,
    remarks: `order:${ORDER}`,
    deliveries: [captured(1, 4, "2026-09-04T10:00:00.000Z")].map((r) => ({ ...r, remarks: "" })),
  });
  assert.equal(isTrackingTrip(lost), true);
  const ot = buildOrdersTrip(lost);
  assert.equal(ot.assignmentIncomplete, true);
});

test("100% shop delivery does NOT move the trip to COMPLETED — Trip Entry status does", () => {
  const rows = [plan(1, 10), captured(1, 10), plan(2, 8), captured(2, 8)];
  const open = tripOf({ status: "Pending", deliveries: rows });
  const progress = computeOrdersProgress(open);
  assert.equal(progress.deliveredShops, 2);
  assert.equal(progress.deliveryState, "complete");
  assert.equal(progress.status, "In Progress", "lifecycle still open");
  const ot = buildOrdersTrip(open);
  const { pending, completed } = partitionTrackingTrips([ot]);
  assert.equal(pending.length, 1);
  assert.equal(completed.length, 0);
});

test("Trip Entry Completed places the trip in COMPLETED even when only 4/6 shops are in", () => {
  const rows = [
    plan(1, 10),
    captured(1, 10),
    plan(2, 10),
    captured(2, 10),
    plan(3, 10),
    captured(3, 10),
    plan(4, 10),
    captured(4, 10),
    plan(5, 10),
    plan(6, 10),
  ];
  const closed = tripOf({ status: "Completed", deliveries: rows });
  const progress = computeOrdersProgress(closed);
  assert.equal(progress.deliveredShops, 4);
  assert.equal(progress.pendingShops, 2);
  assert.equal(progress.deliveryState, "in_progress");
  assert.equal(progress.status, "Completed");
  const { pending, completed } = partitionTrackingTrips([buildOrdersTrip(closed)]);
  assert.equal(pending.length, 0);
  assert.equal(completed.length, 1);
});

test("deliveredShops counts fully-in shops only — a 15/21 partial is not Delivered", () => {
  const rows = [plan(1, 21), captured(1, 15), plan(2, 10), captured(2, 10)];
  const progress = computeOrdersProgress(tripOf({ deliveries: rows }));
  assert.equal(progress.deliveredShops, 1, "only shop 2 is fully delivered");
  assert.equal(progress.partDeliveredShops, 1);
  assert.equal(progress.pendingShops, 0);
  assert.equal(progress.pendingBoxes, 6);
  assert.equal(progress.deliveryState, "partial");
  assert.equal(deliveryProgressPct(progress), 50);
});

test("partitionTrackingTrips never duplicates a trip across tables", () => {
  const a = buildOrdersTrip(tripOf({ id: 1, status: "Pending", deliveries: [plan(1, 5)] }));
  const b = buildOrdersTrip(tripOf({ id: 2, status: "Completed", deliveries: [plan(1, 5)] }));
  const { pending, completed } = partitionTrackingTrips([a, a, b, b]);
  assert.equal(pending.length, 1);
  assert.equal(completed.length, 1);
  assert.equal(pending[0].trip.id, 1);
  assert.equal(completed[0].trip.id, 2);
});

test("search haystack includes shop number and supervisor mobile", () => {
  const ot = buildOrdersTrip(
    tripOf({
      supervisorName: "Ravi Kumar",
      deliveries: [plan(7, 4)],
    })
  );
  const hay = trackingSearchHaystack(ot, {
    supervisorMobile: "9000000001",
    shopNumberOf: () => "SHP-007",
    villageOf: () => "Vijayawada",
  });
  assert.ok(hay.includes("shp-007"));
  assert.ok(hay.includes("9000000001"));
  assert.ok(hay.includes("vijayawada"));
});

test("pageRange is 1-based and empty-safe", () => {
  assert.deepEqual(pageRange(0, 1, 10), { from: 0, to: 0 });
  assert.deepEqual(pageRange(25, 1, 10), { from: 1, to: 10 });
  assert.deepEqual(pageRange(25, 3, 10), { from: 21, to: 25 });
});
