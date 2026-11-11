// src/modules/orders/utils/shopDelivery.test.ts
// Shop-level delivery capture (Tab 3): the order is shown per shop, the
// delivery is entered per shop, PARTIAL is allowed and a shop whose order is
// fully in has nothing left to capture (the duplicate guard).
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import {
  buildShopBreakdown,
  buildShopDeliveryRow,
  shopRemainingBoxes,
} from "./ordersUtils";
import { orderRowRemarks } from "../types";

const ORDER = "ORD-20260904-01";

/** The plan row assignment writes onto the vehicle trip (40 boxes / 400 birds). */
function planRow(shopId: number, boxes: number, birds: number): ShopDelivery {
  return {
    id: 1,
    serialNo: 1,
    boxNo: boxes,
    shopId,
    shopName: `Shop ${shopId}`,
    birdTypeId: 0,
    birdType: "",
    birds,
    weight: 0,
    mortality: 0,
    rate: null,
    amount: 0,
    remarks: orderRowRemarks(ORDER),
  };
}

function tripWith(rows: ShopDelivery[]): Trip {
  return createEmptyTrip({ id: 9101, tripNo: "TRP-20260904-01", avgBirdWeight: 1.5, deliveries: rows });
}

const breakdownOf = (trip: Trip) =>
  buildShopBreakdown(
    trip.deliveries ?? [],
    new Set([101]),
    (shopId) => `Village ${shopId}`,
    new Map([[101, { boxes: 40, birds: 400, weight: 600 }]])
  );

test("balance = ordered - delivered, never negative", () => {
  assert.equal(shopRemainingBoxes({ orderedBoxes: 40, deliveredBoxes: 0 }), 40);
  assert.equal(shopRemainingBoxes({ orderedBoxes: 40, deliveredBoxes: 15 }), 25);
  assert.equal(shopRemainingBoxes({ orderedBoxes: 40, deliveredBoxes: 40 }), 0);
  assert.equal(shopRemainingBoxes({ orderedBoxes: 40, deliveredBoxes: 45 }), 0);
});

test("balance follows what the VEHICLE carries, not the shop's whole order", () => {
  // The shop ordered 50 in total; this vehicle was assigned 20 of them.
  assert.equal(shopRemainingBoxes({ orderedBoxes: 50, tripBoxes: 20, deliveredBoxes: 0 }), 20);
  assert.equal(shopRemainingBoxes({ orderedBoxes: 50, tripBoxes: 20, deliveredBoxes: 20 }), 0);
});

test("a capture row carries the plan facts, the entered boxes and a capture time", () => {
  const trip = tripWith([planRow(101, 40, 400)]);
  const row = buildShopDeliveryRow(trip, planRow(101, 40, 400), { shopId: 101, boxes: 15 }, new Date("2026-09-04T09:30:00Z"));
  assert.equal(row.boxNo, 15, "only the entered boxes are captured");
  assert.equal(row.birds, 150, "birds follow the shop's order ratio (400/40 * 15)");
  assert.equal(row.weight, 225, "weight follows the trip average (150 * 1.5)");
  assert.equal(row.autoCaptureTime, "2026-09-04T09:30:00.000Z", "marks the row as an actual delivery");
  assert.deepEqual(row.selectedBoxIds, [], "box count must come from boxNo");
  assert.equal(row.remarks, orderRowRemarks(ORDER), "stays linked to the order");
  assert.equal(row.serialNo, 2, "appended after the plan row");
  assert.equal(row.id, 0, "a new record, not an update of the plan row");
});

test("status walks Not Delivered -> Part Delivered -> Delivered", () => {
  const plan = planRow(101, 40, 400);

  const none = breakdownOf(tripWith([plan]))[0];
  assert.equal(none.status, "not_delivered");
  assert.equal(shopRemainingBoxes(none), 40);
  assert.equal(none.tripBoxes, 40, "the vehicle carries the plan row's boxes");

  const part = breakdownOf(tripWith([plan, buildShopDeliveryRow(tripWith([plan]), plan, { shopId: 101, boxes: 15 })]))[0];
  assert.equal(part.status, "part_delivered", "15 of 40 boxes in = still open");
  assert.equal(part.deliveredBoxes, 15);
  assert.equal(shopRemainingBoxes(part), 25, "the rest is still deliverable");

  const full = buildShopDeliveryRow(tripWith([plan]), plan, { shopId: 101, boxes: 40 });
  const done = breakdownOf(tripWith([plan, full]))[0];
  assert.equal(done.status, "delivered");
  assert.equal(shopRemainingBoxes(done), 0, "nothing left to capture = no duplicate");
});

test("two partial lots add up and close the shop", () => {
  const plan = planRow(101, 40, 400);
  const t1 = tripWith([plan]);
  const lot1 = buildShopDeliveryRow(t1, plan, { shopId: 101, boxes: 15 });
  const t2 = tripWith([plan, lot1]);
  const lot2 = buildShopDeliveryRow(t2, plan, { shopId: 101, boxes: 25 });
  const row = breakdownOf(tripWith([plan, lot1, lot2]))[0];
  assert.equal(row.deliveredBoxes, 40);
  assert.equal(row.deliveredBirds, 400);
  assert.equal(row.status, "delivered");
  assert.equal(shopRemainingBoxes(row), 0);
});

// DELIVERY-REOPEN-1: backend serial normalization can place the captured
// [ORDER] row before the uncaptured plan row after a reload. The uncaptured
// plan row stays the assignment basis; captures count only toward delivered.
function reopenBreakdown(rows: ShopDelivery[]) {
  return buildShopBreakdown(
    rows,
    new Set([101]),
    (shopId) => `Village ${shopId}`,
    new Map([[101, { boxes: 20, birds: 200, weight: 300 }]])
  )[0];
}

function reopenPlan(over: Partial<ShopDelivery> = {}): ShopDelivery {
  return { ...planRow(101, 20, 200), id: 4, serialNo: 2, ...over };
}

function reopenCaptured(boxes: number, over: Partial<ShopDelivery> = {}): ShopDelivery {
  return {
    ...planRow(101, boxes, boxes * 10),
    id: 5,
    serialNo: 1,
    autoCaptureTime: "2026-11-10T12:21:39.618Z",
    ...over,
  };
}

test("captured-first ordering keeps Assigned=20, Delivered=10, Pending=10 (partial)", () => {
  const row = reopenBreakdown([reopenCaptured(10), reopenPlan()]);
  assert.equal(row.assignedBoxes, 20, "plan is the uncaptured 20-box row");
  assert.equal(row.tripBoxes, 20);
  assert.equal(row.deliveredBoxes, 10, "captured row counts only as delivered");
  assert.equal(row.pendingBoxes, 10, "delivery input stays open with max=10");
  assert.equal(row.status, "part_delivered");
  assert.equal(shopRemainingBoxes(row), 10);
});

test("plan-first ordering agrees with captured-first ordering (partial 10/20)", () => {
  const capturedFirst = reopenBreakdown([reopenCaptured(10), reopenPlan()]);
  const planFirst = reopenBreakdown([reopenPlan(), { ...reopenCaptured(10), id: 5, serialNo: 3 }]);
  assert.deepEqual(
    {
      assigned: planFirst.assignedBoxes,
      delivered: planFirst.deliveredBoxes,
      pending: planFirst.pendingBoxes,
      status: planFirst.status,
    },
    {
      assigned: capturedFirst.assignedBoxes,
      delivered: capturedFirst.deliveredBoxes,
      pending: capturedFirst.pendingBoxes,
      status: capturedFirst.status,
    },
    "row order must not change the derivation"
  );
  assert.equal(planFirst.pendingBoxes, 10);
});

test("captured-first fully delivered shows Pending=0 and no further input", () => {
  const row = reopenBreakdown([reopenCaptured(20), reopenPlan()]);
  assert.equal(row.assignedBoxes, 20);
  assert.equal(row.deliveredBoxes, 20);
  assert.equal(row.pendingBoxes, 0, "nothing left to capture");
  assert.equal(row.status, "delivered");
  assert.equal(shopRemainingBoxes(row), 0);
});

test("shop without an uncaptured plan row keeps the captured row as plan", () => {
  const only = reopenBreakdown([reopenCaptured(10)]);
  assert.equal(only.assignedBoxes, 10, "fallback preserves prior behavior");
  assert.equal(only.deliveredBoxes, 10);
  assert.equal(only.pendingBoxes, 0);
});
