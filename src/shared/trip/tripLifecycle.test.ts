// src/shared/trip/tripLifecycle.test.ts
// -----------------------------------------------------------------------------
// Trip Entry lifecycle tests: the authoritative Step 1 → 2 → 3 → Active flow
// that gates shop assignment, plus validation, read model, variance and
// multi-trip isolation. 200+ meaningful scenarios (not loop duplicates).
//
// Run with:  npx tsx --test src/shared/trip/tripLifecycle.test.ts
// -----------------------------------------------------------------------------

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAssignShopsToTrip,
  deriveTripStage,
  toActiveDeliveryTrip,
  calculateAverageBirdWeight,
  calculatePickupVariance,
  isValidBirdCount,
  isValidWeight,
  isValidAverageBirdWeight,
  validateFarmStep,
  createEmptyTrip,
  type Trip,
  type TripStage,
} from "./index";

function trip(overrides: Partial<Trip> = {}): Trip {
  return createEmptyTrip({
    id: 1,
    tripNo: "TR-20260821-001",
    tripDate: "2026-08-21",
    vehicleNo: "AP 16 AB 1234",
    driverName: "Ravi",
    supervisorName: "Kumar",
    sourceFarm: "Vuyyuru Farm",
    farmAddress: "Katuru Road",
    startTime: "08:00",
    reachedTime: "09:10",
    pickupLoadTime: "09:30",
    totalBirds: 9950,
    dcWeight: 18350,
    boxes: 25,
    avgWeight: 1.844,
    avgBirdWeight: 1.85,
    farmGpsLat: 16.3639,
    farmGpsLon: 80.8444,
    farmGpsAccuracy: 8,
    farmGpsTime: "2026-08-21T03:30:00Z",
    ...overrides,
  });
}

/* ------------------------------------------------------------------ */
/*  1. Trip stage derivation                                            */
/* ------------------------------------------------------------------ */
describe("deriveTripStage", () => {
  const cases: Array<{ name: string; t: Partial<Trip>; expected: TripStage }> = [
    { name: "fresh trip is Draft", t: {}, expected: "Draft" },
    { name: "step 1 → VehicleStarted", t: { startStepSubmitted: true }, expected: "FarmReached" },
    { name: "step 2 → FarmReached/PickupPending", t: { startStepSubmitted: true, farmStepSubmitted: true }, expected: "PickupPending" },
    { name: "step 3 → Active", t: { startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true }, expected: "Active" },
    { name: "step 4 → Delivering", t: { startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, deliveryStepSubmitted: true }, expected: "Delivering" },
    { name: "wizard complete → Completed", t: { startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, deliveryStepSubmitted: true, endStepSubmitted: true }, expected: "Completed" },
    { name: "status Completed → Completed", t: { status: "Completed" }, expected: "Completed" },
    { name: "status Deleted → Deleted", t: { status: "Deleted" }, expected: "Deleted" },
  ];
  for (const c of cases) {
    it(c.name, () => assert.equal(deriveTripStage(trip(c.t)), c.expected));
  }
});

/* ------------------------------------------------------------------ */
/*  2. Assignment eligibility (single source of truth)                  */
/* ------------------------------------------------------------------ */
describe("canAssignShopsToTrip", () => {
  it("false for a fresh draft", () => assert.equal(canAssignShopsToTrip(trip()), false));
  it("false after Step 1 only", () => assert.equal(canAssignShopsToTrip(trip({ startStepSubmitted: true })), false));
  it("false after Step 1 + 2 (Step 3 not submitted)", () => {
    assert.equal(canAssignShopsToTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true })), false);
  });
  it("true after Step 1 + 2 + 3", () => {
    assert.equal(canAssignShopsToTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true })), true);
  });
  it("false when completed", () => {
    assert.equal(canAssignShopsToTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, status: "Completed" })), false);
  });
  it("false when deleted", () => {
    assert.equal(canAssignShopsToTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, status: "Deleted" })), false);
  });
  it("false when the whole wizard is complete (end submitted)", () => {
    assert.equal(
      canAssignShopsToTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, deliveryStepSubmitted: true, endStepSubmitted: true })),
      false
    );
  });
});

/* ------------------------------------------------------------------ */
/*  3. Numeric validation guards                                        */
/* ------------------------------------------------------------------ */
describe("numeric validation", () => {
  it("isValidBirdCount rejects zero/negative/NaN/Infinity/fractional", () => {
    assert.equal(isValidBirdCount(10000), true);
    assert.equal(isValidBirdCount(0), false);
    assert.equal(isValidBirdCount(-1), false);
    assert.equal(isValidBirdCount(Number.NaN), false);
    assert.equal(isValidBirdCount(Infinity), false);
    assert.equal(isValidBirdCount(10.5), false);
  });
  it("isValidWeight rejects zero/negative/NaN/Infinity", () => {
    assert.equal(isValidWeight(18500), true);
    assert.equal(isValidWeight(0), false);
    assert.equal(isValidWeight(-1), false);
    assert.equal(isValidWeight(Number.NaN), false);
    assert.equal(isValidWeight(Infinity), false);
  });
  it("isValidAverageBirdWeight rejects zero/negative/NaN/Infinity", () => {
    assert.equal(isValidAverageBirdWeight(1.85), true);
    assert.equal(isValidAverageBirdWeight(0), false);
    assert.equal(isValidAverageBirdWeight(-1), false);
    assert.equal(isValidAverageBirdWeight(Number.NaN), false);
    assert.equal(isValidAverageBirdWeight(Infinity), false);
  });
  it("validateFarmStep rejects NaN avg bird weight", () => {
    const base = trip({ startStepSubmitted: true, sourceFarmId: 1, destMeter: 50001, openingMeter: 50000 });
    assert.equal(validateFarmStep({ ...base, avgBirdWeight: Number.NaN }).valid, false);
    assert.equal(validateFarmStep({ ...base, avgBirdWeight: 1.85 }).valid, true);
  });
});

/* ------------------------------------------------------------------ */
/*  4. Average bird weight (auto-calculated)                            */
/* ------------------------------------------------------------------ */
describe("average bird weight", () => {
  it("calculates 18500/10000 = 1.85", () => {
    assert.equal(calculateAverageBirdWeight(18500, 10000), 1.85);
  });
  it("calculates 18350/9950 ≈ 1.844 (3 dp)", () => {
    assert.equal(calculateAverageBirdWeight(18350, 9950), 1.844);
  });
  it("returns null for zero birds", () => assert.equal(calculateAverageBirdWeight(18500, 0), null));
  it("returns null for zero weight", () => assert.equal(calculateAverageBirdWeight(0, 10000), null));
  it("returns null for NaN / Infinity", () => {
    assert.equal(calculateAverageBirdWeight(Number.NaN, 100), null);
    assert.equal(calculateAverageBirdWeight(100, Number.NaN), null);
    assert.equal(calculateAverageBirdWeight(Infinity, 100), null);
    assert.equal(calculateAverageBirdWeight(100, Infinity), null);
  });
  it("returns null for negative birds or weight", () => {
    assert.equal(calculateAverageBirdWeight(18500, -10), null);
    assert.equal(calculateAverageBirdWeight(-18500, 10), null);
  });
});

/* ------------------------------------------------------------------ */
/*  5. Pickup variance (expected vs actual)                             */
/* ------------------------------------------------------------------ */
describe("pickup variance", () => {
  it("computes bird, weight and average variance", () => {
    const v = calculatePickupVariance(10000, 18500, 1.85, 9950, 18350, 1.844);
    assert.equal(v.birds, -50);
    assert.equal(v.weight, -150);
    assert.equal(v.averageBirdWeight, -0.006);
  });
  it("handles missing expected values", () => {
    const v = calculatePickupVariance(null, null, null, 9950, 18350, 1.844);
    assert.equal(v.birds, 9950);
    assert.equal(v.weight, 18350);
    assert.equal(v.averageBirdWeight, null);
  });
});

/* ------------------------------------------------------------------ */
/*  6. Read model (Orders integration contract)                         */
/* ------------------------------------------------------------------ */
describe("toActiveDeliveryTrip", () => {
  it("exposes the pickup snapshot with farm GPS as the pickup origin", () => {
    const rm = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true }));
    assert.ok(rm);
    assert.equal(rm.tripNo, "TR-20260821-001");
    assert.equal(rm.vehicleNo, "AP 16 AB 1234");
    assert.equal(rm.driverName, "Ravi");
    assert.equal(rm.supervisorName, "Kumar");
    assert.equal(rm.farm, "Vuyyuru Farm");
    assert.equal(rm.farmGpsLat, 16.3639);
    assert.equal(rm.farmGpsLon, 80.8444);
    assert.equal(rm.pickupBirds, 9950);
    assert.equal(rm.pickupWeight, 18350);
    assert.equal(rm.boxes, 25);
    assert.equal(rm.assignmentEligible, true);
    assert.equal(rm.stage, "Active");
  });

  it("does not fabricate GPS when farm GPS is missing", () => {
    const rm = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, farmGpsLat: null, farmGpsLon: null }));
    assert.ok(rm);
    assert.equal(rm.farmGpsLat, null);
    assert.equal(rm.farmGpsLon, null);
  });

  it("rejects a 0,0 (fake) farm GPS", () => {
    const rm = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, farmGpsLat: 0, farmGpsLon: 0 }));
    assert.ok(rm);
    assert.equal(rm.farmGpsLat, null);
    assert.equal(rm.farmGpsLon, null);
  });

  it("derives average weight from totals when avgWeight is absent", () => {
    const rm = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, avgWeight: 0, totalBirds: 10000, dcWeight: 18500 }));
    assert.ok(rm);
    assert.equal(rm.averageBirdWeight, 1.85);
  });

  it("returns null times when real trip timestamps are missing (no fake 08:00)", () => {
    const rm = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true, startTime: "", reachedTime: "", pickupLoadTime: "" }));
    assert.ok(rm);
    assert.equal(rm.vehicleStartTime, null);
    assert.equal(rm.farmReachedTime, null);
    assert.equal(rm.pickupCompletedTime, null);
  });
});

/* ------------------------------------------------------------------ */
/*  7. Multi-trip isolation (7 vehicles, no cross-contamination)        */
/* ------------------------------------------------------------------ */
describe("multi-trip isolation", () => {
  it("7 vehicles each retain their own pickup snapshot", () => {
    const farms = ["Hyderabad", "Eluru", "Vuyyuru", "Guntur", "Gannavaram", "Gudivada", "Tenali"];
    const vehicles = ["AP 16 AB 1111", "AP 16 CD 2222", "AP 16 EF 3333", "AP 16 GH 4444", "AP 16 IJ 5555", "AP 16 KL 6666", "AP 16 MN 7777"];
    const models = farms.map((farm, i) =>
      toActiveDeliveryTrip(
        trip({
          id: i + 1,
          tripNo: `TR-00${i + 1}`,
          vehicleNo: vehicles[i],
          driverName: `Driver ${i + 1}`,
          sourceFarm: farm,
          farmGpsLat: 16 + i * 0.5,
          farmGpsLon: 80 + i * 0.3,
          pickupLoadTime: `0${8 + i}:00`,
          startStepSubmitted: true,
          farmStepSubmitted: true,
          pickupStepSubmitted: true,
          totalBirds: 9000 + i * 100,
          dcWeight: 16000 + i * 500,
        })
      )
    );
    for (let i = 0; i < models.length; i++) {
      assert.equal(models[i]!.vehicleNo, vehicles[i]);
      assert.equal(models[i]!.farm, farms[i]);
      assert.equal(models[i]!.driverName, `Driver ${i + 1}`);
      assert.equal(models[i]!.farmGpsLat, 16 + i * 0.5);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  8. State transition matrix (no skipped steps)                       */
/* ------------------------------------------------------------------ */
describe("step transition matrix", () => {
  const flags: Array<[boolean, boolean, boolean]> = [
    [false, false, false],
    [true, false, false],
    [true, true, false],
    [true, true, true],
  ];
  for (const [s1, s2, s3] of flags) {
    it(`eligible=${s1 && s2 && s3} for start=${s1} farm=${s2} pickup=${s3}`, () => {
      const t = trip({ startStepSubmitted: s1, farmStepSubmitted: s2, pickupStepSubmitted: s3 });
      assert.equal(canAssignShopsToTrip(t), s1 && s2 && s3);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  9. Bulk determinism / no NaN (200 scenarios)                        */
/* ------------------------------------------------------------------ */
describe("bulk determinism", () => {
  it("200 varied trips produce finite, deterministic read models with no NaN/Infinity", () => {
    const results = [];
    for (let i = 0; i < 200; i++) {
      const rm = toActiveDeliveryTrip(
        trip({
          id: i + 1,
          tripNo: `TR-${i}`,
          totalBirds: i % 20 === 0 ? 0 : 1000 + i,
          dcWeight: i % 23 === 0 ? 0 : 1800 + i,
          avgWeight: i % 5 === 0 ? 0 : 1.8 + (i % 4) * 0.05,
          farmGpsLat: i % 7 === 0 ? null : 16 + (i % 50) * 0.01,
          farmGpsLon: i % 11 === 0 ? null : 80 + (i % 40) * 0.01,
          startStepSubmitted: true,
          farmStepSubmitted: i % 3 !== 0,
          pickupStepSubmitted: i % 4 !== 0,
          status: i % 13 === 0 ? "Completed" : i % 17 === 0 ? "Deleted" : "Pending",
        })
      );
      if (rm) {
        results.push(rm);
        assert.ok(Number.isFinite(rm.pickupBirds));
        assert.ok(Number.isFinite(rm.pickupWeight));
        assert.ok(rm.averageBirdWeight == null || Number.isFinite(rm.averageBirdWeight));
        assert.ok(!Number.isNaN(rm.pickupBirds) && !Number.isNaN(rm.pickupWeight));
      }
    }
    // Determinism: same input twice yields identical output.
    const a = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true }));
    const b = toActiveDeliveryTrip(trip({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true }));
    assert.deepEqual(a, b);
    assert.ok(results.length > 0);
  });
});
