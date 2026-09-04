// src/modules/operations/orders/splitAssignment.test.ts
// Split-order (partial assignment across vehicles) — the hard balance rule:
//
//   A shop's collected boxes can be SPLIT over two or three vehicles, but
//   the sum over all vehicles can never exceed the collection:
//
//     40 collected → V1 takes 20 → V2 may take at most 20 (never 40).
//     V1 20 + V2 20 = 40 → fully assigned; one more box anywhere is blocked.
//
// The guard reads FRESH persisted data (the sample store here), so a change
// saved on one vehicle is instantly visible to the other.
//
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import {
  resetSampleTrips,
  sampleTrips,
} from "./sampleOrdersData";
import {
  fetchOrdersData,
  findDayOverAssignments,
  saveAssignment,
  saveCollection,
} from "./ordersService";
import { planShareBoxes, assignedBoxesOnTrip } from "./ordersUtils";
import { ORDER_PLAN_REMARKS, type OrderShopRow } from "./types";

const SHOP_ID = 99042;
const ORDER_TRIP_NO = "ORD-SPLIT-01";

let clientKey = 0;

function collectionRow(shopId: number, boxes: number, serialNo = 1): OrderShopRow {
  return {
    id: 0,
    clientKey: `ck-${++clientKey}`,
    serialNo,
    boxNo: boxes,
    shopId,
    shopName: `Split Shop ${shopId}`,
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

function assignedRow(shopId: number, boxes: number): OrderShopRow {
  // The row the assignment editor writes onto a vehicle (assigned share).
  return { ...collectionRow(shopId, boxes), remarks: ORDER_PLAN_REMARKS };
}

function vehicleTrip(id: number, tripNo: string, vehicleNo: string): Trip {
  return createEmptyTrip({
    id,
    tripNo,
    vehicleId: id,
    vehicleNo,
    tripDate: new Date().toISOString().slice(0, 10),
    farmStepSubmitted: true,
    deliveryStepSubmitted: false,
  });
}

/** Fresh scenario: 40 collected boxes on one shop, two empty trucks. */
async function seedSplitScenario() {
  resetSampleTrips();
  const container = await saveCollection(null, ORDER_TRIP_NO, [
    collectionRow(SHOP_ID, 40),
  ]);
  // Ids outside the sample scenario's ranges (9000s / 9100s / 99000+).
  const v1 = vehicleTrip(8101, "TRP-SPLIT-A", "TS07-A");
  const v2 = vehicleTrip(8102, "TRP-SPLIT-B", "TS07-B");
  sampleTrips().push(v1, v2);
  return { day: container.tripDate, v1, v2 };
}

test("split: V1 takes 20 of 40 → the part is persisted, 20 remain", async () => {
  const { day, v1 } = await seedSplitScenario();
  await saveAssignment(v1, [
    { orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_ID, 20)] },
  ]);

  const data = await fetchOrdersData();
  const coll = data.collectionsByDay[day];
  assert.ok(coll, "collection must exist for the day");
  const a = coll.shops.get(SHOP_ID)!;
  assert.ok(a, "shop must have an assignment");
  assert.equal(a.parts.length, 1);
  assert.equal(a.parts[0].tripNo, v1.tripNo);
  assert.equal(a.parts[0].boxes, 20);
  assert.equal(a.assignedBoxesTotal, 20);
  assert.equal(a.boxes, 40, "ordered boxes stay the collection truth");
  assert.equal(coll.assignedBoxes, 20);
  assert.equal(coll.fullyAssigned, false, "a 20/40 split is NOT fully assigned");

  // V2 cannot take 40 — only the 20-box balance.
  const issues = await findDayOverAssignments(
    day,
    [{ shopId: SHOP_ID, shopName: "Split Shop", boxes: 40 }],
    "TRP-SPLIT-B"
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].remaining, 20);
  assert.equal(issues[0].requested, 40);
  assert.equal(issues[0].elsewhere, 20);

  // V2 taking exactly the balance is fine.
  const ok = await findDayOverAssignments(
    day,
    [{ shopId: SHOP_ID, shopName: "Split Shop", boxes: 20 }],
    "TRP-SPLIT-B"
  );
  assert.equal(ok.length, 0);
});

test("split: V1 20 + V2 20 = 40 → fully assigned; one more box is blocked", async () => {
  const { day, v1, v2 } = await seedSplitScenario();
  await saveAssignment(v1, [{ orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_ID, 20)] }]);
  await saveAssignment(v2, [{ orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_ID, 20)] }]);

  const data = await fetchOrdersData();
  const coll = data.collectionsByDay[day];
  const a = coll.shops.get(SHOP_ID)!;
  assert.ok(a);
  assert.equal(a.parts.length, 2, "two vehicles carry the split order");
  assert.deepEqual(
    a.parts.map((p) => [p.tripNo, p.boxes]).sort(),
    [
      ["TRP-SPLIT-A", 20],
      ["TRP-SPLIT-B", 20],
    ].sort()
  );
  assert.equal(a.assignedBoxesTotal, 40);
  assert.equal(coll.fullyAssigned, true, "20 + 20 closes the 40-box order");

  // A THIRD vehicle has no balance left at all — not even one box.
  const blocked = await findDayOverAssignments(
    day,
    [{ shopId: SHOP_ID, shopName: "Split Shop", boxes: 1 }],
    "TRP-SPLIT-C"
  );
  assert.equal(blocked.length, 1, "a third truck has no assignable balance left");
  assert.equal(blocked[0].remaining, 0);

  // The vehicle's OWN rows are excluded from "elsewhere": V1 may re-save its
  // own 20 (a replace, not an add) — but 21 goes over the order.
  const replace = await findDayOverAssignments(
    day,
    [{ shopId: SHOP_ID, shopName: "Split Shop", boxes: 20 }],
    "TRP-SPLIT-A"
  );
  assert.equal(replace.length, 0, "replacing an own share with the same count fits");
  const over = await findDayOverAssignments(
    day,
    [{ shopId: SHOP_ID, shopName: "Split Shop", boxes: 21 }],
    "TRP-SPLIT-A"
  );
  assert.equal(over.length, 1);
  assert.equal(over[0].remaining, 20);
});

test("split: re-saving a vehicle replaces only its own share (V1 20 → 25 leaves V2 15 max)", async () => {
  const { day, v1, v2 } = await seedSplitScenario();
  await saveAssignment(v1, [{ orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_ID, 20)] }]);
  await saveAssignment(v2, [{ orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_ID, 20)] }]);

  // V1 re-saves with 25 — its previous 20 is replaced, not added.
  await saveAssignment(v1, [{ orderTripNo: ORDER_TRIP_NO, rows: [assignedRow(SHOP_ID, 25)] }]);

  const data = await fetchOrdersData();
  const a = data.collectionsByDay[day].shops.get(SHOP_ID)!;
  assert.ok(a);
  assert.equal(a.parts.length, 2);
  const shareOf = (tripNo: string) => a.parts.find((p) => p.tripNo === tripNo)?.boxes;
  assert.equal(shareOf("TRP-SPLIT-A"), 25);
  assert.equal(shareOf("TRP-SPLIT-B"), 20);
  assert.equal(a.assignedBoxesTotal, 45);
  // NOTE: 25 + 20 = 45 > 40 is only possible when it was SAVED before the
  // second vehicle raised its stake; the guard below catches the NEXT save.
  const issues = await findDayOverAssignments(
    day,
    [{ shopId: SHOP_ID, shopName: "Split Shop", boxes: 20 }],
    "TRP-SPLIT-B"
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].remaining, 15);
});

test("planShareBoxes counts the pending share, not deliveries", async () => {
  // A partial DELIVERY (10 of the 20 assigned boxes captured) must not shrink
  // the vehicle's share: the capture is a separate row, the plan row stays.
  const plan: ShopDelivery = {
    id: 1,
    serialNo: 1,
    boxNo: 20,
    shopId: SHOP_ID,
    shopName: "Split Shop",
    birdTypeId: 0,
    birdType: "",
    birds: 200,
    weight: 0,
    mortality: 0,
    mortKg: 0,
    rate: null,
    amount: 0,
    remarks: `${ORDER_PLAN_REMARKS} O:${ORDER_TRIP_NO}`,
  };
  const captured: ShopDelivery = {
    ...plan,
    id: 2,
    serialNo: 2,
    boxNo: 10,
    autoCaptureTime: new Date().toISOString(),
  };
  assert.equal(planShareBoxes([plan, captured]), 20);

  const trip = createEmptyTrip({ id: 9201, deliveries: [plan, captured] });
  assert.equal(
    assignedBoxesOnTrip(trip),
    20,
    "delivered boxes must free the truck's remaining capacity, not double-count"
  );
});
