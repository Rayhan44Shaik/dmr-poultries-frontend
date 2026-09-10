// src/modules/staff/utils/performanceGrading.test.ts
// Deterministic presentation-level grading for Driver/Supervisor Performance.
// Run: tsx --test src/modules/staff/utils/performanceGrading.test.ts

/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  DriverPerformanceRow,
  SupervisorPerformanceRow,
} from "../types/performance";
import {
  assessDriverPerformance,
  assessDriverRows,
  assessSupervisorRows,
  computeDriverBaselines,
  rankDriverRows,
  rankSupervisorRows,
} from "./performanceGrading";

function driverRow(overrides: Partial<DriverPerformanceRow>): DriverPerformanceRow {
  return {
    driverId: 1,
    driverName: "Test Driver",
    employeeStatus: "Active",
    trips: 10,
    distance: 500,
    avgDistancePerTrip: 50,
    vehicles: 1,
    vehicleNos: ["AP01AB1234"],
    fuelLitres: 100,
    fuelCost: 8000,
    maintenanceCost: 500,
    tollCost: 0,
    otherCost: 0,
    totalCost: 8500,
    costPerKm: 17,
    mileage: 5,
    ...overrides,
  };
}

function supervisorRow(
  overrides: Partial<SupervisorPerformanceRow>,
): SupervisorPerformanceRow {
  return {
    supervisorId: 1,
    supervisorName: "Test Supervisor",
    employeeStatus: "Active",
    trips: 10,
    shops: 20,
    birds: 5000,
    weight: 4000,
    mortality: 10,
    mortalityRate: 0.2,
    weightLoss: 40,
    ...overrides,
  };
}

const AWARD_FIXTURE = [
  // Medians (sorted, even count): trips 19.5 · distance 540 · mileage 5.05 ·
  // cost/km 15.5. Band results: 1 strong-everywhere, 2 strong-trips-only,
  // 3 weak-trips, 4 weak-nearly-everything.
  driverRow({ driverId: 1, trips: 30, distance: 1600, mileage: 6.5, costPerKm: 8 }),
  driverRow({ driverId: 2, trips: 26, distance: 560, mileage: 5.1, costPerKm: 15 }),
  driverRow({ driverId: 3, trips: 13, distance: 520, mileage: 5, costPerKm: 16 }),
  driverRow({ driverId: 4, trips: 4, distance: 500, mileage: 4.4, costPerKm: 28 }),
];

test("band grades are deterministic: same rows → same bands", () => {
  const baselines = computeDriverBaselines(AWARD_FIXTURE);
  const band = (id: number) => assessDriverPerformance(AWARD_FIXTURE[id - 1], baselines).grade;
  assert.equal(band(1), "OUTSTANDING");
  assert.equal(band(2), "EXCELLENT");
  assert.equal(band(3), "GOOD");
  assert.equal(band(4), "GOOD");
});

test("award policy: exactly one OUTSTANDING, one EXCELLENT, one GOOD — rest unranked", () => {
  const first = assessDriverRows(AWARD_FIXTURE);
  const second = assessDriverRows(AWARD_FIXTURE);
  assert.deepEqual([...first.entries()], [...second.entries()]); // deterministic
  assert.equal(first.get(1)?.grade, "OUTSTANDING");
  assert.equal(first.get(1)?.awardRank, 1);
  assert.equal(first.get(2)?.grade, "EXCELLENT");
  assert.equal(first.get(2)?.awardRank, 2);
  assert.equal(first.get(3)?.grade, "GOOD");
  assert.equal(first.get(3)?.awardRank, 3);
  assert.equal(first.get(4)?.grade, null);
  assert.equal(first.get(4)?.awardRank, null);
});

test("award order is deterministic on ties: strong count, then trips, then name", () => {
  // Drivers 2 and 3 both have exactly one strong band (trips) — the tie is
  // broken by primary output (trips 26 > 13), never by input order.
  const ranked = rankDriverRows(AWARD_FIXTURE);
  assert.deepEqual(
    ranked.map((entry) => entry.row.driverId),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    ranked.map((entry) => entry.rank),
    [1, 2, 3, 4],
  );
});

test("a driver sitting exactly at the fleet median bands GOOD (awarded 2nd)", () => {
  // Medians (odd count): trips 13 · distance 520 · mileage 5 · cost/km 16 —
  // exactly driver 2's values.
  const rows = [
    driverRow({ driverId: 1, trips: 30, distance: 1600, mileage: 6.5, costPerKm: 8 }),
    driverRow({ driverId: 2, trips: 13, distance: 520, mileage: 5, costPerKm: 16 }),
    driverRow({ driverId: 3, trips: 4, distance: 500, mileage: 4.4, costPerKm: 28 }),
  ];
  // Band level: driver 2 IS the median on every metric — fair everywhere.
  const baselines = computeDriverBaselines(rows);
  assert.equal(assessDriverPerformance(rows[1], baselines).grade, "GOOD");
  // Award level: 2nd-strongest row takes the single EXCELLENT slot.
  const assessments = assessDriverRows(rows);
  assert.equal(assessments.get(1)?.grade, "OUTSTANDING");
  assert.equal(assessments.get(2)?.grade, "EXCELLENT");
  assert.equal(assessments.get(3)?.grade, "GOOD");
});

test("weak metrics produce improvement areas, unavailable ones never do", () => {
  const rows = [
    driverRow({ driverId: 1, trips: 20, distance: 1000, mileage: 6, costPerKm: 12 }),
    driverRow({ driverId: 2, trips: 10, distance: 500, mileage: 5, costPerKm: 17 }),
    // Driver 3: weak mileage + weak cost/km, but fuel=0 → mileage unmeasurable.
    driverRow({ driverId: 3, trips: 4, distance: 200, fuelLitres: 0, mileage: 0, costPerKm: 30 }),
  ];
  const assessments = assessDriverRows(rows);
  const third = assessments.get(3)!;
  const keys = third.improvements.map((item) => item.metricKey);
  assert.ok(keys.includes("costPerKm"), "weak cost/km should be an improvement");
  assert.ok(!keys.includes("mileage"), "unavailable mileage must not be an improvement");
  assert.equal(
    third.factors.find((f) => f.key === "mileage")?.band,
    "unavailable",
  );
});

test("zero-activity rows are never awarded a grade", () => {
  const rows = [
    driverRow({ driverId: 1, trips: 0, distance: 0, mileage: 0, costPerKm: 0, fuelLitres: 0 }),
    driverRow({ driverId: 2, trips: 8, distance: 400 }),
    driverRow({ driverId: 3, trips: 20, distance: 900 }),
  ];
  const baselines = computeDriverBaselines(rows);
  const idle = assessDriverPerformance(
    driverRow({ driverId: 4, trips: 0, distance: 0, mileage: 0, costPerKm: 0 }),
    baselines,
  );
  assert.equal(idle.grade, "GOOD"); // band floor…
  assert.equal(idle.scored, false);
  assert.deepEqual(idle.improvements, []);
  // …but the award policy leaves every zero-activity row unranked.
  const assessments = assessDriverRows(rows);
  assert.equal(assessments.get(1)?.grade, null); // zero-activity → unranked
  assert.equal(assessments.get(2)?.grade, "EXCELLENT");
  assert.equal(assessments.get(3)?.grade, "OUTSTANDING");
});

test("fewer than two participating peers → unranked, scored=false", () => {
  const rows = [driverRow({ driverId: 1, trips: 10, distance: 600, mileage: 6, costPerKm: 10 })];
  const assessments = assessDriverRows(rows);
  const only = assessments.get(1)!;
  assert.equal(only.grade, null);
  assert.equal(only.awardRank, null);
  assert.equal(only.scored, false);
  assert.ok(only.factors.every((factor) => factor.band === "unavailable"));
});

test("lower-is-better metrics: high cost/km and high mortality grade down", () => {
  const rows = [
    driverRow({ driverId: 1, costPerKm: 10, mileage: 6 }),
    driverRow({ driverId: 2, costPerKm: 12, mileage: 5 }),
    driverRow({ driverId: 3, costPerKm: 30, mileage: 3 }),
  ];
  const assessments = assessDriverRows(rows);
  // Worst row still takes the single remaining GOOD award (3rd place)…
  assert.equal(assessments.get(3)?.grade, "GOOD");
  // …and weak bands still drive improvements regardless of the award.
  assert.ok(
    assessments.get(3)!.improvements.some((item) => item.metricKey === "costPerKm"),
  );

  const supRows = [
    supervisorRow({ supervisorId: 1, mortalityRate: 0.1, weightLoss: 30 }),
    supervisorRow({ supervisorId: 2, mortalityRate: 0.2, weightLoss: 40 }),
    supervisorRow({ supervisorId: 3, mortalityRate: 1.5, weightLoss: 90 }),
  ];
  const supAssessments = assessSupervisorRows(supRows);
  assert.ok(
    supAssessments.get(3)!.improvements.some((item) => item.metricKey === "mortalityRate"),
  );
  assert.equal(supAssessments.get(1)!.grade, "OUTSTANDING"); // strongest → 1st award
  assert.equal(supAssessments.get(2)!.grade, "EXCELLENT"); // second award
  assert.equal(supAssessments.get(3)!.grade, "GOOD"); // third award
});

test("mortality/weight are ignored when no birds/weight were delivered", () => {
  const rows = [
    supervisorRow({ supervisorId: 1, birds: 5000, weight: 4000 }),
    supervisorRow({ supervisorId: 2, birds: 3000, weight: 2000 }),
    supervisorRow({ supervisorId: 3, birds: 0, weight: 0, mortalityRate: 0, weightLoss: 0 }),
  ];
  const assessment = assessSupervisorRows(rows).get(3)!;
  assert.equal(
    assessment.factors.find((f) => f.key === "mortalityRate")?.band,
    "unavailable",
  );
  assert.equal(
    assessment.factors.find((f) => f.key === "weightLoss")?.band,
    "unavailable",
  );
  assert.ok(
    !assessment.improvements.some((item) => item.metricKey === "mortalityRate"),
  );
});

test("supervisor awards follow the same top-three policy", () => {
  const rows = [
    supervisorRow({ supervisorId: 1, trips: 20, shops: 40, mortalityRate: 0.1, weightLoss: 20 }),
    supervisorRow({ supervisorId: 2, trips: 10, shops: 20, mortalityRate: 0.2, weightLoss: 40 }),
    supervisorRow({ supervisorId: 3, trips: 9, shops: 19, mortalityRate: 0.25, weightLoss: 45 }),
  ];
  const assessments = assessSupervisorRows(rows);
  assert.equal(assessments.get(1)?.grade, "OUTSTANDING");
  assert.equal(assessments.get(2)?.grade, "EXCELLENT");
  assert.equal(assessments.get(3)?.grade, "GOOD");
  // Display order: awards first, then output desc — never input order.
  const ranked = rankSupervisorRows(rows);
  assert.deepEqual(
    ranked.map((entry) => entry.row.supervisorId),
    [1, 2, 3],
  );
});
