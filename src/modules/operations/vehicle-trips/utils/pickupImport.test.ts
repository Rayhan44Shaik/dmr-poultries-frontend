import assert from "node:assert/strict";
import test from "node:test";
import { continuePickupBoxNumbers, fitPickupAppendToCapacity, parsePickupRows, validatePickupAppend } from "./pickupImport";

test("pickup import reads every side-by-side Box/Birds/Weight group", () => {
  const rows: unknown[][] = [
    ["Vehicle No", "AP 39 TS 4699", "Driver", "Ravi"],
    ["Box", "Birds", "Weight", "Box", "Birds", "Weight"],
  ];
  for (let index = 1; index <= 42; index += 1) {
    rows.push([index, 18, 40 + index / 10, index + 42, 18, 44 + index / 10]);
  }
  const result = parsePickupRows(rows);
  assert.equal(result.boxes.length, 84);
  assert.equal(result.boxes[83].boxNo, 84);
  assert.equal(result.metadata.vehicleNo, "AP 39 TS 4699");
  assert.equal(result.metadata.driverName, "Ravi");
});

test("repeated imports continue numbering and enforce total vehicle capacity", () => {
  const first = Array.from({ length: 60 }, (_, index) => ({ boxNo: index + 1, birds: 18, weight: 42, avgWeight: 2.33 }));
  const secondFile = Array.from({ length: 20 }, (_, index) => ({ boxNo: index + 1, birds: 18, weight: 43, avgWeight: 2.39 }));
  const continued = continuePickupBoxNumbers(secondFile, first.length);
  assert.equal(continued[0].boxNo, 61);
  assert.equal(continued[19].boxNo, 80);
  assert.deepEqual(validatePickupAppend(first, continued, 84), []);

  const tooMany = continuePickupBoxNumbers(Array.from({ length: 25 }, (_, index) => ({ boxNo: index + 1, birds: 18, weight: 43 })), first.length);
  assert.deepEqual(validatePickupAppend(first, tooMany, 84), ["Only 24 vehicle box slots remain, but this file contains 25 boxes."]);
});

test("pickup import automatically removes trailing boxes above vehicle capacity", () => {
  const incoming = Array.from({ length: 85 }, (_, index) => ({
    boxNo: index + 1,
    birds: 17,
    weight: 42,
    avgWeight: 2.47,
  }));
  const fitted = fitPickupAppendToCapacity([], incoming, 84);

  assert.equal(fitted.rows.length, 84);
  assert.equal(fitted.rows[83].boxNo, 84);
  assert.deepEqual(fitted.removed.map((row) => row.boxNo), [85]);
  assert.deepEqual(validatePickupAppend([], fitted.rows, 84), []);
});
