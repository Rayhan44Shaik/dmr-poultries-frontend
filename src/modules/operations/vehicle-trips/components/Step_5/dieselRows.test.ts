import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeVisibleDieselRows } from "./DieselExpensesTable";

describe("mergeVisibleDieselRows", () => {
  it("does not reopen empty slot 1 when bills already live on 2/3/4 (step remount)", () => {
    assert.deepEqual(mergeVisibleDieselRows([1], [2, 3, 4], new Set()), [2, 3, 4]);
  });

  it("shows a single empty row when there are no diesel bills yet", () => {
    assert.deepEqual(mergeVisibleDieselRows([1], [], new Set()), [1]);
  });

  it("keeps an empty row the operator just opened with Add Diesel Entry", () => {
    assert.deepEqual(mergeVisibleDieselRows([2, 3, 4, 5], [2, 3, 4], new Set([5])), [2, 3, 4, 5]);
  });

  it("drops an empty leftover slot that was not opened this visit", () => {
    assert.deepEqual(mergeVisibleDieselRows([2, 3, 4, 5], [2, 3, 4], new Set()), [2, 3, 4]);
  });
});
