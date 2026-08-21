// src/modules/order/tripIntegration.test.ts
// -----------------------------------------------------------------------------
// Trip Entry → Orders integration tests.
//
// Verifies that the Order module derives its vehicles/pickup/schedule from the
// EXISTING Trip Entry data (tripService), never fabricating its own vehicle or
// pickup data. Pure mapping functions are tested directly; getActiveTrips is
// exercised against an in-memory localStorage shim.
//
// Run with:  npx tsx --test src/modules/order/tripIntegration.test.ts
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createEmptyTrip } from "../../shared/trip";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import {
  tripToRouteVehicle,
  tripToPickupSource,
  getActiveTrips,
  summarizeActiveTrip,
} from "./services/tripIntegrationService";
import { isValidCoordinate } from "./utils/gps";

/* ------------------------------------------------------------------ */
/*  Minimal localStorage shim so tripService can run under node:test.  */
/* ------------------------------------------------------------------ */
function installStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = shim;
  return store;
}

const store = installStorageShim();

function seedTrip(overrides: Partial<Trip> = {}): Trip {
  return createEmptyTrip({
    id: 1,
    tripNo: "TR-20260821-001",
    tripDate: "2026-08-21",
    vehicleNo: "AP 16 AB 1234",
    driverName: "Ravi",
    supervisorName: "Kumar",
    sourceFarm: "Vuyyuru Farm",
    farmAddress: "Katuru Road, Vuyyuru",
    farmGpsLat: 16.3639,
    farmGpsLon: 80.8444,
    farmGpsAccuracy: 8,
    farmGpsTime: "2026-08-21T03:30:00Z",
    startTime: "09:00",
    reachedTime: "09:10",
    pickupLoadTime: "09:15",
    totalBirds: 5000,
    boxes: 50,
    vehicleBoxCapacity: 200,
    status: "Pending",
    farmStepSubmitted: true,
    pickupStepSubmitted: true,
    deliveries: [],
    ...overrides,
  });
}

function writeTrips(trips: Trip[]) {
  store.set("vehicleTrips", JSON.stringify(trips));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe("trip → route vehicle mapping", () => {
  it("derives pickup source from Trip Entry Step 2", () => {
    const trip = seedTrip();
    const pickup = tripToPickupSource(trip);
    assert.equal(pickup.source, "Trip Entry Step 2");
    assert.equal(pickup.farmName, "Vuyyuru Farm");
    assert.equal(pickup.tripNo, "TR-20260821-001");
    assert.ok(isValidCoordinate(pickup.gps));
    assert.equal(pickup.gps?.latitude, 16.3639);
    assert.equal(pickup.gps?.longitude, 80.8444);
  });

  it("maps a trip into a RouteVehicle with real vehicle/driver/supervisor/schedule", () => {
    const v = tripToRouteVehicle(seedTrip());
    assert.equal(v.vehicleNo, "AP 16 AB 1234");
    assert.equal(v.driverName, "Ravi");
    assert.equal(v.supervisorName, "Kumar");
    assert.equal(v.pickup.farmName, "Vuyyuru Farm");
    assert.equal(v.schedule.departureTime, "09:15"); // from pickupLoadTime
    assert.equal(v.tripNo, "TR-20260821-001");
    assert.equal(v.tripId, 1);
    assert.equal(v.available, true);
  });

  it("carries the trip's assigned-shop count from Trip Entry deliveries", () => {
    const trip = seedTrip({
      deliveries: [
        { id: 1, boxNo: 1, shopId: 1, shopName: "Shop A", birdTypeId: 1, birdType: "Broiler", birds: 100, weight: 200, mortality: 0, rate: null, amount: 0, remarks: "" },
        { id: 2, boxNo: 2, shopId: 2, shopName: "Shop B", birdTypeId: 1, birdType: "Broiler", birds: 100, weight: 200, mortality: 0, rate: null, amount: 0, remarks: "" },
      ],
    });
    const v = tripToRouteVehicle(trip);
    assert.equal(v.assignedOrderCount, 2);
    assert.deepEqual(v.existingStopCities, ["Shop A", "Shop B"]);
  });

  it("resolves departure from pickupLoadTime → reachedTime → startTime", () => {
    assert.equal(tripToRouteVehicle(seedTrip({ pickupLoadTime: "09:15" })).schedule.departureTime, "09:15");
    assert.equal(tripToRouteVehicle(seedTrip({ pickupLoadTime: "", reachedTime: "09:10" })).schedule.departureTime, "09:10");
    assert.equal(tripToRouteVehicle(seedTrip({ pickupLoadTime: "", reachedTime: "", startTime: "09:00" })).schedule.departureTime, "09:00");
  });

  it("handles a full timestamp departure string", () => {
    const trip = seedTrip({ pickupLoadTime: "2026-08-21T09:30:00.000Z" });
    // normalizes to a valid HH:mm (exact local value depends on TZ, but must parse).
    const v = tripToRouteVehicle(trip);
    assert.match(v.schedule.departureTime, /^\d{2}:\d{2}$/);
  });

  it("marks GPS Unavailable when farm GPS is missing", () => {
    const trip = seedTrip({ farmGpsLat: null, farmGpsLon: null });
    const v = tripToRouteVehicle(trip);
    assert.equal(v.currentGps, null);
    assert.equal(v.pickup.gps, null);
  });
});

describe("getActiveTrips", () => {
  before(() => {
    writeTrips([
      seedTrip({ id: 1, status: "Pending", farmStepSubmitted: true }),
      seedTrip({ id: 2, status: "Pending", farmStepSubmitted: false }), // not yet Step 2
      seedTrip({ id: 3, status: "Completed", farmStepSubmitted: true }),
      seedTrip({ id: 4, status: "Draft", farmStepSubmitted: true }),
    ]);
  });

  it("returns only in-progress trips that have completed Step 2 (farm/pickup)", () => {
    const active = getActiveTrips();
    assert.deepEqual(active.map((t) => t.id), [1]);
  });
});

describe("summarizeActiveTrip", () => {
  it("computes assigned-shop count and remaining capacity from the same dataset", () => {
    const trip = seedTrip({ totalBirds: 5000, boxes: 50, vehicleBoxCapacity: 200, deliveries: [{ id: 1, boxNo: 1, shopId: 1, shopName: "Shop A", birdTypeId: 1, birdType: "Broiler", birds: 100, weight: 200, mortality: 0, rate: null, amount: 0, remarks: "" }] });
    // Order module has 3 additional assigned orders for this vehicle.
    const summary = summarizeActiveTrip(trip, (vehicleNo) => (vehicleNo === "AP 16 AB 1234" ? 3 : 0));
    assert.equal(summary.tripDeliveries, 1);
    assert.equal(summary.orderAssignments, 3);
    assert.equal(summary.totalAssignedShops, 4);
    assert.equal(summary.remainingBoxes, 150); // 200 - 50
    // birdCapacity unknown (no vehicle master in test) → null
    assert.equal(summary.remainingBirds, null);
  });
});
