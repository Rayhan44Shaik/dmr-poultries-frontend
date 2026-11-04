/**
 * Per-load tooltip data-integrity: lines come straight from the backend
 * breakdowns, single-load shops get no tooltip, and line sums always equal
 * the shop cumulative totals.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  cumulativeLoadLines,
  hasCumulativeLoadBreakdown,
} from "./cumulativeLoadBreakdown";
import type { ShopLedgerCumulativeRow } from "../components/ShopLedgerPDF";

function row(overrides: Partial<ShopLedgerCumulativeRow> = {}): ShopLedgerCumulativeRow {
  return {
    shop: "Test Shop",
    birds: 135,
    weight: 270,
    farmBirds: 150,
    farmWeight: 300,
    mortalityBirds: 15,
    mortalityWeight: 5,
    weightLoss: 25,
    openingBalance: 0,
    sale: 0,
    collection: 0,
    closingBalance: 0,
    ...overrides,
  };
}

const twoLoads = row({
  deliveriesByLoad: [
    { load: 1, birds: 90, weight: 180, mortalityBirds: 10, mortalityWeight: 5, weightLoss: 15 },
    { load: 2, birds: 45, weight: 90, mortalityBirds: 5, mortalityWeight: 0, weightLoss: 10 },
  ],
  mortalityByLoad: [
    { load: 1, boxBirds: 10, boxWeight: 5, weightModeBirds: 0 },
    { load: 2, boxBirds: 0, boxWeight: 0, weightModeBirds: 5 },
  ],
});

test("multi-load shop exposes actual per-load values that sum to the totals", () => {
  assert.deepEqual(
    cumulativeLoadLines(twoLoads, "birds").map((line) => [line.load, line.value]),
    [[1, 90], [2, 45]],
  );
  assert.deepEqual(
    cumulativeLoadLines(twoLoads, "weight").map((line) => [line.load, line.value]),
    [[1, 180], [2, 90]],
  );
  const weightLoss = cumulativeLoadLines(twoLoads, "weightLoss");
  assert.equal(weightLoss.reduce((sum, line) => sum + line.value, 0), twoLoads.weightLoss);
});

test("mortality combines box and weight modes per load; weight is box-only", () => {
  assert.deepEqual(
    cumulativeLoadLines(twoLoads, "mortalityBirds").map((line) => [line.load, line.value]),
    [[1, 10], [2, 5]],
  );
  assert.deepEqual(
    cumulativeLoadLines(twoLoads, "mortalityWeight").map((line) => [line.load, line.value]),
    [[1, 5], [2, 0]],
  );
});

test("mortality lines name box birds with their kg weight, skipping zero parts", () => {
  const lines = cumulativeLoadLines(twoLoads, "mortalityBirds");
  assert.equal(lines[0].sub, "Box 10 birds · 5.00 kg");
  assert.equal(lines[1].sub, "Wt-mode 5 birds");
  const mixed = row({
    mortalityByLoad: [{ load: 1, boxBirds: 120, boxWeight: 245.6, weightModeBirds: 30 }],
  });
  assert.equal(
    cumulativeLoadLines(mixed, "mortalityBirds")[0].sub,
    "Box 120 birds · 245.60 kg · Wt-mode 30 birds",
  );
  const empty = row({
    mortalityByLoad: [{ load: 1, boxBirds: 0, boxWeight: 0, weightModeBirds: 0 }],
  });
  assert.equal(cumulativeLoadLines(empty, "mortalityBirds")[0].sub, undefined);
});

test("single-load and legacy shops render plain values with no tooltip", () => {
  const single = row({
    deliveriesByLoad: [
      { load: 1, birds: 90, weight: 180, mortalityBirds: 10, mortalityWeight: 5, weightLoss: 15 },
    ],
    mortalityByLoad: [{ load: 1, boxBirds: 10, boxWeight: 5, weightModeBirds: 0 }],
  });
  for (const metric of ["birds", "mortalityBirds", "weight", "mortalityWeight", "weightLoss"] as const) {
    assert.equal(hasCumulativeLoadBreakdown(single, metric), false, metric);
  }
  assert.equal(hasCumulativeLoadBreakdown(twoLoads, "birds"), true);
  assert.equal(hasCumulativeLoadBreakdown(twoLoads, "mortalityWeight"), true);
});

test("zero-activity shops have no breakdown lines", () => {
  const empty = row({ deliveriesByLoad: [], mortalityByLoad: [] });
  assert.deepEqual(cumulativeLoadLines(empty, "birds"), []);
  assert.equal(hasCumulativeLoadBreakdown(empty, "weightLoss"), false);
});
