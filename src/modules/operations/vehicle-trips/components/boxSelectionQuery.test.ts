import assert from "node:assert/strict";
import test from "node:test";
import { parseBoxSelectionQuery } from "./boxSelectionQuery";

const available = Array.from({ length: 70 }, (_, index) => String(index + 1));

test("accepts multiple individual box numbers", () => {
  assert.deepEqual(parseBoxSelectionQuery("44,56,46", available), ["44", "56", "46"]);
  assert.deepEqual(parseBoxSelectionQuery("16,17", available), ["16", "17"]);
  assert.deepEqual(parseBoxSelectionQuery("16 024", available), ["16", "24"]);
});

test("accepts hyphen and 'to' ranges", () => {
  assert.deepEqual(parseBoxSelectionQuery("46-56", available),
    Array.from({ length: 11 }, (_, index) => String(index + 46)));
  assert.deepEqual(parseBoxSelectionQuery("56 to 46", available),
    Array.from({ length: 11 }, (_, index) => String(56 - index)));
  assert.deepEqual(parseBoxSelectionQuery("16 - 24", available),
    Array.from({ length: 9 }, (_, index) => String(index + 16)));
});

test("accepts mixed groups, removes duplicates, and skips unavailable boxes", () => {
  assert.deepEqual(
    parseBoxSelectionQuery("44, 46-49, 47, 80", available),
    ["44", "46", "47", "48", "49"],
  );
});

test("rejects an invalid group instead of partially selecting", () => {
  assert.deepEqual(parseBoxSelectionQuery("44, wrong, 46", available), []);
});
