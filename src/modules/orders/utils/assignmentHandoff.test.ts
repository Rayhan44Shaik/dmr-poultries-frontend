import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyTrip, type ShopDelivery } from "../../../shared/trip";
import { buildOrdersData } from "../services/ordersService";
import { orderRowRemarks } from "../types";
import { computeOrdersProgress, isTrackingTrip, partitionTrackingTrips, uniqueShopRows } from "./ordersUtils";
import { orderAssignedShops } from "../../operations/vehicle-trips/components/Step_4/remainingBoxes";

const ORDER = "ORD-ASSIGN-01";
const DAY = "2026-09-06";
const row = (shopId: number, boxes: number, captured = false): ShopDelivery => ({
  id: shopId + (captured ? 1000 : 0), serialNo: shopId, boxNo: boxes, shopId,
  shopName: `Shop ${shopId}`, birdTypeId: 0, birdType: "", birds: boxes * 10,
  weight: 0, mortality: 0, mortKg: 0, rate: null, amount: 0,
  remarks: orderRowRemarks(ORDER),
  ...(captured ? { autoCaptureTime: "2026-09-06T09:00:00.000Z" } : {}),
});
const collection = createEmptyTrip({ id: 9001, tripNo: ORDER, tripDate: DAY, remarks: "[ORDER_COLLECTION]", deliveries: [row(101, 10), row(102, 8)] });
const vehicle = (finished: boolean, deliveries = [row(101, 10), row(102, 8)]) => createEmptyTrip({
  id: 8201, tripNo: "TRP-ASSIGN-A", tripDate: DAY, vehicleId: 12, vehicleNo: "TS07-A",
  farmStepSubmitted: true, deliveryStepSubmitted: false, remarks: finished ? `order:${ORDER}` : "", deliveries,
});

test("duplicate assignment shops collapse deterministically", () => {
  assert.deepEqual(uniqueShopRows([row(101, 10), row(101, 99), row(102, 8)]).map((r) => [r.shopId, r.boxNo]), [[101, 10], [102, 8]]);
});

test("saved assignment remains eligible and does not leak into tracking", () => {
  const data = buildOrdersData([collection, vehicle(false)]);
  assert.ok(data.eligibleVehicles.some((v) => v.trip.id === 8201));
  assert.equal(data.tracking.length, 0);
});

test("finished assignment opens tracking without completing Trip Entry", () => {
  const trip = vehicle(true);
  const data = buildOrdersData([collection, trip]);
  assert.equal(trip.deliveryStepSubmitted, false);
  assert.equal(isTrackingTrip(trip), true);
  assert.equal(data.eligibleVehicles.length, 0);
  assert.equal(data.tracking[0].progress?.status, "Assigned");
  const groups = partitionTrackingTrips(data.tracking);
  assert.equal(groups.pending.length, 1);
  assert.equal(groups.completed.length, 0);
});

test("Step 4 offers only persisted assigned shops", () => {
  const trip = vehicle(true, [row(101, 10)]);
  const offered = orderAssignedShops([{ id: 101 }, { id: 102 }, { id: 999 }], trip.deliveries ?? []);
  assert.deepEqual(offered.map((shop) => shop.id), [101]);
});

test("captured rows complete Orders progress but not the trip lifecycle", () => {
  const trip = vehicle(true, [row(101, 10), row(102, 8), row(101, 10, true), row(102, 8, true)]);
  const quantities = new Map([[101, { boxes: 10, birds: 100, weight: 0 }], [102, { boxes: 8, birds: 80, weight: 0 }]]);
  assert.equal(computeOrdersProgress(trip, quantities).deliveryState, "complete");
  assert.notEqual(trip.status, "Completed");
});
