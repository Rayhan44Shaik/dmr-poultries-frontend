import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateOperational,
  isOperationalRowInRange,
  summariseOperational,
  type OperationalRow,
} from "./trendSeries";

const rows: OperationalRow[] = [
  {
    tripDate: "2026-09-09",
    farmBirds: 100,
    farmWeight: 200,
    deliveredBirds: 98,
    deliveredWeight: 194,
    mortalityCount: 1,
    mortalityWeight: 2,
    weightLoss: 4,
  },
  {
    tripDate: "2026-09-10",
    farmBirds: 50,
    farmWeight: 100,
    deliveredBirds: 48,
    deliveredWeight: 94,
    mortalityCount: 1,
    mortalityWeight: 2,
    weightLoss: 4,
  },
  {
    tripDate: "2026-09-11",
    farmBirds: 75,
    farmWeight: 150,
    deliveredBirds: 72,
    deliveredWeight: 141,
    mortalityCount: 2,
    mortalityWeight: 3,
    weightLoss: 6,
  },
  {
    tripDate: "2026-09-12",
    farmBirds: 125,
    farmWeight: 250,
    deliveredBirds: 120,
    deliveredWeight: 235,
    mortalityCount: 3,
    mortalityWeight: 5,
    weightLoss: 10,
  },
];

test("custom weight movement totals use inclusive start and end dates only", () => {
  const range = { fromDate: "2026-09-10", toDate: "2026-09-11" };
  const buckets = aggregateOperational(rows, "daily", range);
  const summary = summariseOperational(buckets);

  assert.deepEqual(
    buckets.map((bucket) => bucket.date),
    ["2026-09-10", "2026-09-11"],
  );
  assert.equal(summary.trips, 2);
  assert.equal(summary.farmWeight, 250);
  assert.equal(summary.deliveredWeight, 235);
  assert.equal(summary.mortalityWeight, 5);
  assert.equal(summary.mortalityCount, 3);
  assert.equal(summary.weightLoss, 10);
  assert.equal(Number(summary.deliveredPct.toFixed(2)), 94);
  assert.equal(Number(summary.weightLossPct.toFixed(2)), 4);
});

test("custom range guard excludes invalid and out-of-range trip dates", () => {
  const range = { fromDate: "2026-09-10", toDate: "2026-09-11" };

  assert.equal(isOperationalRowInRange("2026-09-10", range), true);
  assert.equal(isOperationalRowInRange("2026-09-11T23:59:59", range), true);
  assert.equal(isOperationalRowInRange("2026-09-09", range), false);
  assert.equal(isOperationalRowInRange("2026-09-12", range), false);
  assert.equal(isOperationalRowInRange("not-a-date", range), false);
});
