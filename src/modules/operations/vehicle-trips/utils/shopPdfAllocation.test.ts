import assert from "node:assert/strict";
import test from "node:test";
import { allocateSavedDeliveryAcrossBoxes } from "./shopPdfAllocation";

test("Box receipt keeps the box but uses the edited Shop Sales quantity", () => {
  assert.deepEqual(
    allocateSavedDeliveryAcrossBoxes([{ birds: 30, weight: 68.7 }], 20, 48.7),
    [{ birds: 20, weight: 48.7 }]
  );
});

test("multi-box allocation preserves exact edited totals", () => {
  const rows = allocateSavedDeliveryAcrossBoxes(
    [{ birds: 10, weight: 20 }, { birds: 20, weight: 40 }],
    25,
    50
  );
  assert.equal(rows.reduce((sum, row) => sum + row.birds, 0), 25);
  assert.equal(rows.reduce((sum, row) => sum + row.weight, 0), 50);
});
