/**
 * mapRowToTrip delivery-mode tests.
 *
 * The Rate Entry modal badge reads `delivery.deliveryMode` off the mapped
 * trip. If the mapper drops the field, every weight shop renders as box —
 * exactly the BASHEER-style mislabel. These tests lock the passthrough:
 * weight stays weight, box stays box, and a missing field (older payloads)
 * falls back to box, matching the backend default.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  mapRowToTrip,
  type RateEntryDeliveryDto,
  type RateEntryTripDto,
} from "./rateEntryApiService";

function delivery(overrides: Partial<RateEntryDeliveryDto> = {}): RateEntryDeliveryDto {
  return {
    id: 1,
    serialNo: 1,
    boxNo: 1,
    shopId: 7,
    shopName: "Test Shop",
    subShopName: "",
    load: 1,
    birdTypeId: 3,
    birdType: "Broiler",
    birds: 40,
    weight: 80,
    mortality: 0,
    mortKg: 0,
    rate: null,
    amount: 0,
    remarks: "",
    deliveryMode: "box",
    autoCaptureTime: null,
    marketRate: null,
    ...overrides,
  };
}

function row(deliveries: RateEntryDeliveryDto[]): RateEntryTripDto {
  return {
    id: 9,
    tripNo: "TR-20260922-009",
    tripDate: "2026-09-22",
    status: "Completed",
    vehicleNo: "TS07UB1222",
    driverName: "Driver",
    supervisorName: "Sup",
    sourceFarm: "Farm",
    totalBirds: 40,
    totalWeight: 80,
    totalShops: 1,
    rateLocked: false,
    rateLockedAt: null,
    rateLockedBy: null,
    ratesEntered: 0,
    deliveriesCount: deliveries.length,
    totalAmount: 0,
    deliveries,
  };
}

test("mapRowToTrip keeps weight mode on weight deliveries", () => {
  const trip = mapRowToTrip(
    row([delivery({ id: 1, deliveryMode: "box" }), delivery({ id: 2, deliveryMode: "weight" })]),
    true
  );
  assert.equal(trip.deliveries.length, 2);
  assert.equal(trip.deliveries[0].deliveryMode, "box");
  assert.equal(trip.deliveries[1].deliveryMode, "weight");
});

test("mapRowToTrip defaults a missing mode to box like the backend", () => {
  const dto = delivery();
  delete (dto as Partial<RateEntryDeliveryDto>).deliveryMode;
  const trip = mapRowToTrip(row([dto]), true);
  assert.equal(trip.deliveries[0].deliveryMode, "box");
});
