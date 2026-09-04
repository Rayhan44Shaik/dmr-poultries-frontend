// src/modules/operations/orders/shopDelivery.test.ts
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
import { orderRowRemarks } from "./types";

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
