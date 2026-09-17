// src/modules/orders/utils/sequenceOrder.test.ts
// Reordering a delivery sequence of ~45 shops: the last shop must be able to
// become #1 in ONE move, not 44 arrow clicks.
// Run: npm run test:mobile
import test from "node:test";
import assert from "node:assert/strict";
import { moveInSequence } from "./ordersUtils";

const shops = (n: number) => Array.from({ length: n }, (_, i) => `S${i + 1}`);

test("the 45th shop becomes #1 in one move", () => {
  const list = shops(45);
  const next = moveInSequence(list, 44, 0);
  assert.equal(next[0], "S45");
  assert.equal(next[1], "S1", "the others shift down, nothing is lost");
  assert.equal(next.length, 45);
  assert.deepEqual([...next].sort(), [...list].sort(), "same shops, no loss or duplication");
});

test("the first shop can be sent to the end", () => {
  const next = moveInSequence(shops(5), 0, 4);
  assert.deepEqual(next, ["S2", "S3", "S4", "S5", "S1"]);
});

test("one-step moves behave like the ↑/↓ arrows", () => {
  assert.deepEqual(moveInSequence(shops(4), 2, 1), ["S1", "S3", "S2", "S4"]);
  assert.deepEqual(moveInSequence(shops(4), 1, 2), ["S1", "S3", "S2", "S4"]);
});

test("out-of-range targets clamp instead of dropping the row", () => {
  const list = shops(4);
  assert.deepEqual(moveInSequence(list, 3, 99), ["S1", "S2", "S3", "S4"]);
  assert.equal(moveInSequence(list, 3, -5)[0], "S4");
  assert.equal(moveInSequence(list, 2, 2), list, "same position = same list");
  assert.deepEqual(moveInSequence(["only"], 0, 3), ["only"]);
});

test("the source array is never mutated", () => {
  const list = shops(5);
  const copy = [...list];
  moveInSequence(list, 4, 0);
  assert.deepEqual(list, copy);
});
