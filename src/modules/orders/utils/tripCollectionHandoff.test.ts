// src/modules/orders/utils/tripCollectionHandoff.test.ts
// Trip Entry Recent identity + Collection Save → Assignment handoff.
// Collection is a day-keyed ORD- container (not a vehicle Recent trip).
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery, type Trip } from "../../../shared/trip";
import { mapApiTripToTrip, uniqueTripsById } from "../../operations/vehicle-trips/services/tripHeaderApiService";
import {
  isOrderContainer,
  isCollectedOrder,
  rowBoxes,
  uniqueShopRows,
} from "./ordersUtils";
import { ORDER_PLAN_REMARKS, type OrderShopRow } from "../types";
import { resetSampleTrips, sampleTrips } from "../services/sampleOrdersData";
import { fetchOrdersData, saveCollection } from "../services/ordersService";

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

function planRow(shopId: number, boxes: number, id = shopId): ShopDelivery {
  return {
    id,
    serialNo: id,
    boxNo: boxes,
    shopId,
    shopName: `Shop ${shopId}`,
    birdTypeId: 0,
    birdType: "",
    birds: boxes * 10,
    weight: 0,
    mortality: 0,
    rate: null,
    amount: 0,
    remarks: ORDER_PLAN_REMARKS,
  };
}

test("uniqueTripsById keeps the first occurrence of each trip.id", () => {
  const a = createEmptyTrip({ id: 11, tripNo: "TRP-A", supervisorName: "A" });
  const dup = createEmptyTrip({ id: 11, tripNo: "TRP-A-DUP", supervisorName: "B" });
  const b = createEmptyTrip({ id: 22, tripNo: "TRP-B", supervisorName: "C" });
  const out = uniqueTripsById([a, dup, b, a]);
  assert.equal(out.length, 2);
  assert.equal(out[0].tripNo, "TRP-A");
  assert.equal(out[0].supervisorName, "A");
  assert.equal(out[1].id, 22);
});

test("Recent identity is trip.id — same supervisor/vehicle/date is not a key", () => {
  const day = "2026-09-06";
  const a = createEmptyTrip({
    id: 101,
    tripNo: "TRP-101",
    tripDate: day,
    vehicleNo: "AP16AB1",
    supervisorName: "Ravi",
  });
  const b = createEmptyTrip({
    id: 202,
    tripNo: "TRP-202",
    tripDate: day,
    vehicleNo: "AP16AB1",
    supervisorName: "Ravi",
  });
  const out = uniqueTripsById([a, b]);
  assert.equal(out.length, 2, "two trips that share supervisor/vehicle/date stay two rows");
  assert.deepEqual(
    out.map((t) => t.id),
    [101, 202]
  );
});

test("uniqueShopRows keeps the first shop and drops duplicates", () => {
  const rows = uniqueShopRows([
    planRow(1, 10, 1),
    planRow(1, 99, 2),
    planRow(2, 5, 3),
    { ...planRow(0, 4, 4), shopId: 0 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].shopId, 1);
  assert.equal(rowBoxes(rows[0]), 10, "first shop row wins");
  assert.equal(rows[1].shopId, 2);
});

test("a saved (unfinished) order container is still a collection — Finish is not required", () => {
  const saved: Trip = createEmptyTrip({
    id: 9001,
    tripNo: "ORD-20260906-01",
    tripDate: "2026-09-06",
    vehicleId: 0,
    vehicleNo: "",
    startStepSubmitted: false,
    deliveries: [planRow(7, 12)],
  });
  assert.equal(isOrderContainer(saved), true);
  assert.equal(isCollectedOrder(saved), false, "Finish Collection was not pressed");
});

test("mapApiTripToTrip keeps the YYYY-MM-DD prefix (no UTC day roll)", () => {
  const mapped = mapApiTripToTrip({
    id: 3,
    tripNo: "TRP-20260906-01",
    tripDate: "2026-09-06T23:30:00.000Z",
    supervisorName: "Ravi",
    vehicleNo: "AP16AB1",
  });
  assert.equal(mapped.tripDate, "2026-09-06");
  assert.equal(mapped.id, 3);
  assert.equal(mapped.tripNo, "TRP-20260906-01");
  assert.equal(mapped.supervisorName, "Ravi");
  assert.equal(mapped.vehicleNo, "AP16AB1");
});

test("Save Collection (no Finish) exposes shops to Assignment for that day", async () => {
  resetSampleTrips();
  const saved = await saveCollection(null, "ORD-HANDOFF-01", [collectionRow(101, 12)]);
  assert.equal(saved.startStepSubmitted, false);
  assert.ok(saved.id > 0);
  const data = await fetchOrdersData();
  const coll = Object.values(data.collectionsByDay).find((c) => c.trip.id === saved.id);
  assert.ok(coll, "saved container must appear in collectionsByDay");
  assert.equal(coll!.finished, false);
  assert.ok(
    coll!.rows.some((r) => r.shopId === 101 && rowBoxes(r) === 12),
    "saved shop/boxes must be on the collection (Assignment reads this)"
  );
});

test("day A and day B collections stay isolated — no merged shops", async () => {
  resetSampleTrips();
  const a = await saveCollection(null, "ORD-DAYA-01", [collectionRow(11, 10)]);
  a.tripDate = "2026-01-01";
  const b = await saveCollection(null, "ORD-DAYB-01", [collectionRow(22, 20)]);
  b.tripDate = "2026-01-02";
  const data = await fetchOrdersData();
  const dayA = data.collectionsByDay["2026-01-01"];
  const dayB = data.collectionsByDay["2026-01-02"];
  assert.ok(dayA);
  assert.ok(dayB);
  assert.equal(dayA.trip.id, a.id);
  assert.equal(dayB.trip.id, b.id);
  assert.ok(dayA.rows.every((r) => r.shopId !== 22), "day B shops must not leak into day A");
  assert.ok(dayB.rows.every((r) => r.shopId !== 11), "day A shops must not leak into day B");
  assert.ok(dayA.rows.some((r) => r.shopId === 11));
  assert.ok(dayB.rows.some((r) => r.shopId === 22));
});

test("duplicate container ids collapse before collectionsByDay is built", async () => {
  resetSampleTrips();
  const trips = sampleTrips();
  const container = trips.find(isOrderContainer);
  assert.ok(container);
  trips.push({ ...container, tripNo: `${container.tripNo}-DUP` });
  const data = await fetchOrdersData();
  const matches = Object.values(data.collectionsByDay).filter((c) => c.trip.id === container.id);
  assert.equal(matches.length, 1);
});
