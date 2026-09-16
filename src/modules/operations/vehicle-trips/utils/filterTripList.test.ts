import assert from "node:assert/strict";
import test from "node:test";
import type { Trip } from "../types/trip";
import { filterTripListTrips, sortTripListTrips } from "./filterTripList";

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

const rows = [
  trip(1),
  trip(2, { tripDate: "2026-09-16", vehicleId: 2, vehicleNo: "TS07UB1222", supervisorId: 21, sourceFarmId: 31 }),
  trip(3, { tripDate: "2026-09-17", vehicleId: 2, vehicleNo: "TS08UB1037", supervisorId: 20, sourceFarmId: 30 }),
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

test("Trip List Sort By orders each supported column and direction", () => {
  assert.deepEqual(sortTripListTrips(rows, "tripNo", "desc").map(({ id }) => id), [3, 2, 1]);
  assert.deepEqual(sortTripListTrips(rows, "tripDate", "desc").map(({ id }) => id), [3, 2, 1]);
  assert.deepEqual(sortTripListTrips(rows, "vehicleNo", "asc").map(({ id }) => id), [1, 2, 3]);
  assert.deepEqual(sortTripListTrips(rows, "totalBirds", "asc").map(({ id }) => id), [1, 2, 3]);
});

test("Trip List defaults to the newest trip first (oldest falls to the bottom)", () => {
  // No column selected: the register reads latest-first, so the trip that just
  // came in is at the top of page 1 without anyone picking a sort.
  assert.deepEqual(sortTripListTrips(rows, null).map(({ id }) => id), [3, 2, 1]);
  assert.deepEqual(sortTripListTrips(rows, undefined).map(({ id }) => id), [3, 2, 1]);

  // Day wins over trip number, and the number breaks same-day ties.
  const dated = [
    { ...rows[0], id: 10, tripNo: "TRP-20260915-004", tripDate: "2026-09-15" },
    { ...rows[0], id: 11, tripNo: "TRP-20260914-002", tripDate: "2026-09-14" },
    { ...rows[0], id: 12, tripNo: "TRP-20260915-011", tripDate: "2026-09-15" },
  ];
  assert.deepEqual(sortTripListTrips(dated, null).map(({ id }) => id), [12, 10, 11]);
});

test("Trip List leaves every record visible when no filter is selected", () => {
  assert.deepEqual(filterTripListTrips(rows, {}).map(({ id }) => id), [1, 2, 3]);
});
