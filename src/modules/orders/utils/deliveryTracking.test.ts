// src/modules/orders/utils/deliveryTracking.test.ts
// Delivery Tracking rules:
//   - table membership comes from Trip Entry `status`, never from 100% delivery
//   - deliveredShops counts FULLY delivered shops only
//   - deliveryState is independent of trip lifecycle
//   - missing `[ORDER]` assignment list still shows (assignmentIncomplete)
//   - no tracking row before Finish Assignment
//   - the `order:` tag (not `deliveryStepSubmitted`) is the tracking gate, so
//     a finished assignment tracks while Trip Entry Step 4 stays open
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import {
  buildDeliveryReportSummary,
  buildOrdersTrip,
  buildShopBreakdown,
  computeOrdersProgress,
  deliveryProgressPct,
  isEligibleVehicleTrip,
  isTrackingTrip,
  pageRange,
  partitionTrackingTrips,
  rowsInSequence,
  shopCollectedBoxes,
  shopDeliveryStatusI18nKey,
  trackingSearchHaystack,
} from "./ordersUtils";
import { orderRowRemarks } from "../types";
import { ordersTranslate } from "../i18n/ordersI18n";

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
  // Save Progress persists the `[ORDER]` rows but never writes the `order:`
  // tag, so a half-finished assignment must not open a tracking row.
  const unsaved = tripOf({
    deliveryStepSubmitted: false,
    remarks: "",
    deliveries: [plan(1, 10)],
  });
  assert.equal(isTrackingTrip(unsaved), false);
  assert.equal(isTrackingTrip({ ...unsaved, deliveries: [] }), false);
});

test("isTrackingTrip tracks a finished assignment while Step 4 is still open", () => {
  // Finish Assignment writes the `order:` tag and does NOT submit Trip Entry
  // Step 4 — the tracking row must open anyway, as "Assigned".
  const assigned = tripOf({
    deliveryStepSubmitted: false,
    deliveries: [plan(1, 10)],
  });
  assert.equal(isTrackingTrip(assigned), true);
  assert.equal(computeOrdersProgress(assigned).status, "Assigned");

  // The same trip is locked out of a SECOND assignment.
  assert.equal(
    isEligibleVehicleTrip({ ...assigned, farmStepSubmitted: true, vehicleId: 7 }),
    false,
    "a finished assignment must not leave the vehicle re-assignable"
  );
  // ...while a Step 2-done vehicle with no assignment stays assignable.
  assert.equal(
    isEligibleVehicleTrip(
      tripOf({
        deliveryStepSubmitted: false,
        farmStepSubmitted: true,
        vehicleId: 7,
        remarks: "",
        deliveries: [],
      })
    ),
    true
  );
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

test("search haystack includes trip, vehicle, supervisor, mobile, driver, shop no, name, village", () => {
  const ot = buildOrdersTrip(
    tripOf({
      tripNo: "TRP-20260904-01",
      vehicleNo: "AP16AB1234",
      supervisorName: "Ravi Kumar",
      driverName: "Suresh",
      deliveries: [plan(7, 4)],
    })
  );
  const hay = trackingSearchHaystack(ot, {
    supervisorMobile: "9000000001",
    shopNumberOf: () => "SHP-007",
    villageOf: () => "Vijayawada",
  });
  assert.ok(hay.includes("trp-20260904-01"));
  assert.ok(hay.includes("ap16ab1234"));
  assert.ok(hay.includes("ravi kumar"));
  assert.ok(hay.includes("9000000001"));
  assert.ok(hay.includes("suresh"));
  assert.ok(hay.includes("shp-007"));
  assert.ok(hay.includes("shop 7"));
  assert.ok(hay.includes("vijayawada"));
});

test("View/PDF shop breakdown keeps assignment sequence and shows undelivered shops", () => {
  const rows = [
    plan(3, 8, { serialNo: 3, shopName: "C Shop" }),
    plan(1, 10, { serialNo: 1, shopName: "A Shop" }),
    plan(2, 12, { serialNo: 2, shopName: "B Shop" }),
    captured(1, 10),
    captured(2, 5),
  ];
  const shops = buildShopBreakdown(rows, new Set([1, 2, 3]), () => "Vijayawada");
  assert.deepEqual(
    shops.map((s) => s.shopId),
    [1, 2, 3],
    "assignment serialNo order, never delivery-time order"
  );
  assert.equal(shops[0].status, "delivered");
  assert.equal(shops[1].status, "part_delivered");
  assert.equal(shops[2].status, "not_delivered");
  assert.equal(shops[2].collectedBoxes, 8);
  assert.equal(shops[2].assignedBoxes, 8);
  assert.equal(shops[2].pendingBoxes, 8);
  assert.equal(shops[1].pendingBoxes, 7);
  assert.equal(shopCollectedBoxes(shops[0]), 10);
});

test("assignmentIncomplete shows Step 4 captures only — no invented shops", () => {
  const lost = tripOf({
    deliveries: [captured(1, 4)].map((r) => ({ ...r, remarks: "" })),
  });
  const ot = buildOrdersTrip(lost);
  assert.equal(ot.assignmentIncomplete, true);
  const shops = buildShopBreakdown(rowsInSequence(lost), ot.originalShopIds, () => "");
  assert.equal(shops.length, 1);
  assert.equal(shops[0].shopId, 1);
  assert.equal(shops[0].deliveredBoxes, 4);
});

test("View and PDF share the same collected/delivered/pending summary", () => {
  const rows = [
    plan(1, 21),
    captured(1, 15),
    plan(2, 10),
    captured(2, 10),
    plan(3, 8),
  ];
  const trip = tripOf({ deliveries: rows });
  const ot = buildOrdersTrip(trip);
  const shops = buildShopBreakdown(rowsInSequence(trip), ot.originalShopIds, () => "V");
  const summary = buildDeliveryReportSummary(ot.progress, shops);
  assert.equal(summary.totalShops, 3);
  assert.equal(summary.deliveredShops, 1);
  assert.equal(summary.partDeliveredShops, 1);
  assert.equal(summary.pendingShops, 1);
  assert.equal(summary.collectedBoxes, 39);
  assert.equal(summary.assignedBoxes, 39);
  assert.equal(summary.deliveredBoxes, 25);
  assert.equal(summary.pendingBoxes, 14);
  assert.equal(summary.deliveredBirds, 250);
});

test("shop status labels are Pending / Part Delivered / Delivered", () => {
  assert.equal(shopDeliveryStatusI18nKey("not_delivered"), "orders.status_pending");
  assert.equal(shopDeliveryStatusI18nKey("part_delivered"), "orders.status_part_delivered");
  assert.equal(shopDeliveryStatusI18nKey("delivered"), "orders.status_delivered");
  assert.equal(shopDeliveryStatusI18nKey("delivered_with_diff"), "orders.status_delivered");
  assert.equal(
    ordersTranslate("orders.assignment_details_unavailable"),
    "Assignment details unavailable"
  );
  assert.equal(ordersTranslate("orders.pdf_report_title"), "DELIVERY REPORT");
});
