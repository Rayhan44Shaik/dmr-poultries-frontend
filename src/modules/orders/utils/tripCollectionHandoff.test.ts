import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery } from "../../../shared/trip";
import { uniqueTripsById } from "../../operations/vehicle-trips/services/tripHeaderApiService";
import { buildOrdersData } from "../services/ordersService";
import { ORDER_PLAN_REMARKS } from "../types";
import { isCollectedOrder, isOrderContainer, rowBoxes, uniqueShopRows } from "./ordersUtils";

const row = (shopId: number, boxes: number): ShopDelivery => ({ id: shopId, serialNo: shopId, boxNo: boxes, shopId, shopName: `Shop ${shopId}`, birdTypeId: 0, birdType: "", birds: boxes * 10, weight: 0, mortality: 0, mortKg: 0, rate: null, amount: 0, remarks: ORDER_PLAN_REMARKS });
const container = (id: number, day: string, shopId: number) => createEmptyTrip({ id, tripNo: `ORD-${id}`, tripDate: day, remarks: "[ORDER_COLLECTION]", deliveries: [row(shopId, 12)] });

test("persisted identity deduplicates by positive database id", () => {
  const a = container(11, DAY, 1);
  assert.deepEqual(uniqueTripsById([a, { ...a, tripNo: "duplicate" }, container(22, DAY, 2)]).map((t) => t.id), [11, 22]);
});
const DAY = "2026-09-06";

test("collection classification is independent of Finish Collection", () => {
  const saved = container(9001, DAY, 7);
  assert.equal(isOrderContainer(saved), true);
  assert.equal(isCollectedOrder(saved), false);
});

test("duplicate shops retain the first persisted row", () => {
  assert.deepEqual(uniqueShopRows([row(1, 10), row(1, 99), row(2, 5)]).map((r) => [r.shopId, rowBoxes(r)]), [[1, 10], [2, 5]]);
});

test("saved collection projects to Assignment without sample state", () => {
  const collection = buildOrdersData([container(9001, DAY, 101)]).collectionsByDay[DAY];
  assert.equal(collection.trip.id, 9001);
  assert.equal(collection.finished, false);
  assert.equal(collection.rows[0].shopId, 101);
});

test("operational days never merge shops", () => {
  const data = buildOrdersData([container(9001, "2026-01-01", 11), container(9002, "2026-01-02", 22)]);
  assert.deepEqual(data.collectionsByDay["2026-01-01"].rows.map((r) => r.shopId), [11]);
  assert.deepEqual(data.collectionsByDay["2026-01-02"].rows.map((r) => r.shopId), [22]);
});
