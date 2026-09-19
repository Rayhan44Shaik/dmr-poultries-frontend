import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery } from "../../../shared/trip";
import { buildOrdersData } from "../services/ordersService";
import { ORDER_PLAN_REMARKS, orderRowRemarks } from "../types";
import { assignedBoxesOnTrip, planShareBoxes } from "./ordersUtils";

const ORDER = "ORD-SPLIT-01", DAY = "2026-09-06", SHOP = 99042;
const row = (boxes: number, captured = false): ShopDelivery => ({
  id: boxes + (captured ? 100 : 0), serialNo: 1, boxNo: boxes, shopId: SHOP,
  shopName: "Split Shop", birdTypeId: 0, birdType: "", birds: boxes * 10,
  weight: 0, mortality: 0, mortKg: 0, rate: null, amount: 0,
  remarks: orderRowRemarks(ORDER), ...(captured ? { autoCaptureTime: "2026-09-06T09:00:00.000Z" } : {}),
});
const container = createEmptyTrip({
  id: 9002,
  tripNo: ORDER,
  tripDate: DAY,
  remarks: "[ORDER_COLLECTION]",
  deliveries: [{ ...row(40), remarks: ORDER_PLAN_REMARKS }],
});
const truck = (id: number, boxes: number) => createEmptyTrip({ id, tripNo: `TRP-${id}`, tripDate: DAY, vehicleId: id, vehicleNo: `TS-${id}`, farmStepSubmitted: true, deliveries: [row(boxes)] });

test("20 + 20 split is fully assigned with two persisted parts", () => {
  const day = buildOrdersData([container, truck(8101, 20), truck(8102, 20)]).collectionsByDay[DAY];
  assert.equal(day.shops.get(SHOP)?.assignedBoxesTotal, 40);
  assert.equal(day.shops.get(SHOP)?.parts.length, 2);
  assert.equal(day.fullyAssigned, true);
});

test("partial split preserves the collection balance", () => {
  const day = buildOrdersData([container, truck(8101, 20)]).collectionsByDay[DAY];
  assert.equal(day.assignedBoxes, 20);
  assert.equal(day.shops.get(SHOP)?.boxes, 40);
  assert.equal(day.fullyAssigned, false);
});

test("delivery captures never inflate assigned share", () => {
  const plan = row(20), capture = row(10, true);
  assert.equal(planShareBoxes([plan, capture]), 20);
  assert.equal(assignedBoxesOnTrip(createEmptyTrip({ id: 1, deliveries: [plan, capture] })), 20);
});
