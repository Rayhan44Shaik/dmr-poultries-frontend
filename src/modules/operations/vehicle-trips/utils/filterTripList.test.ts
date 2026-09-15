import assert from "node:assert/strict";
import test from "node:test";
import type { Trip } from "../types/trip";
import { filterTripListTrips } from "./filterTripList";

function trip(id: number, overrides: Partial<Trip> = {}): Trip {
  return {
    id,
    tripNo: `TRP-${id}`,
    tripDate: "2026-09-15",
    vehicleId: 1,
    vehicleNo: "AP16AB1001",
    driverId: 10,
    driverName: "Driver",
    supervisorId: 20,
    supervisorName: "Supervisor",
    advanceAmount: null,
    helpers: [],
    sourceFarmId: 30,
    sourceFarm: "Farm",
    birdTypeId: 1,
    birdType: "Broiler",
    startTime: "",
    openingMeter: null,
    startStepSubmitted: true,
    reachedTime: "",
    destMeter: 0,
    pickupTolls: 0,
    farmStepSubmitted: true,
    dcWeight: 0,
    totalBirds: 0,
    boxes: 0,
    avgWeight: 0,
    pickupLoadTime: "",
    pickupStepSubmitted: true,
    boxNo: 0,
    birds: 0,
    weight: 0,
    boxDetails: [],
    deliveries: [],
    deliveryStepSubmitted: true,
    closingMeter: 0,
    endTime: "",
    deliveryTolls: 0,
    mealsTiffin: 0,
    vehicleMaintenance: 0,
    othersRC: 0,
    totalKm: 0,
    totalShops: 0,
    totalWeight: 0,
    totalDeliveredWeight: 0,
    totalBirdsDelivered: 0,
    totalMortality: 0,
    totalMortalityCount: 0,
    totalMortalityWeight: 0,
    weightLoss: 0,
    survivalRate: 0,
    lastShop: "",
    fuel: 0,
    expense: 0,
    remarks: "",
    status: "Completed",
    ...overrides,
  };
}

function delivery(shopId: number, shopName: string) {
  return {
    id: shopId,
    serialNo: 1,
    boxNo: 1,
    shopId,
    shopName,
    birdTypeId: 1,
    birdType: "Broiler",
    birds: 100,
    weight: 200,
    mortality: 0,
    rate: null,
    amount: 0,
    remarks: "",
  };
}

const rows = [
  trip(1, { deliveries: [delivery(101, "First Shop"), delivery(102, "Second Shop")] }),
  trip(2, { tripDate: "2026-09-16", vehicleId: 2, vehicleNo: "TS07UB1222", supervisorId: 21, sourceFarmId: 31, deliveries: [delivery(103, "Third Shop")] }),
  trip(3, { tripDate: "2026-09-17", vehicleId: 2, vehicleNo: "TS08UB1037", supervisorId: 20, sourceFarmId: 30, deliveries: [delivery(104, "Fourth Shop")] }),
];

test("Trip List applies vehicle, supervisor and source-farm filters together", () => {
  assert.deepEqual(
    filterTripListTrips(rows, { vehicleId: 2, supervisorId: 20, farmId: 30 }).map(({ id }) => id),
    [3],
  );
});

test("Trip List date filters use inclusive date-only boundaries", () => {
  assert.deepEqual(
    filterTripListTrips(rows, { fromDate: "2026-09-16", toDate: "2026-09-16" }).map(({ id }) => id),
    [2],
  );
});

test("Trip List applies the selected vehicle filter", () => {
  assert.deepEqual(filterTripListTrips(rows, { vehicleId: 2 }).map(({ id }) => id), [2, 3]);
});

test("Trip List global search matches vehicle plates with or without spaces", () => {
  assert.deepEqual(
    filterTripListTrips(rows, { search: "TS 07 UB 1222" }).map(({ id }) => id),
    [2],
  );
  assert.deepEqual(filterTripListTrips(rows, { search: "ts07ub1222" }).map(({ id }) => id), [2]);
});

test("Trip List shop filter matches every delivery, not only a last shop", () => {
  assert.deepEqual(filterTripListTrips(rows, { shopId: 102 }).map(({ id }) => id), [1]);
  assert.deepEqual(filterTripListTrips(rows, { shopId: 103 }).map(({ id }) => id), [2]);
  assert.deepEqual(filterTripListTrips(rows, { shopId: 999 }).map(({ id }) => id), []);
});

test("Trip List leaves every record visible when no filter is selected", () => {
  assert.deepEqual(filterTripListTrips(rows, {}).map(({ id }) => id), [1, 2, 3]);
});
