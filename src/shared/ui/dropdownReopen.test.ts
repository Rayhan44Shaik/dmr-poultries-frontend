import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dropdownReopenIndex } from "./dropdownReopen";

const options = Array.from({ length: 20 }, (_, index) => ({
  value: `shop-${index + 1}`,
}));

describe("dropdownReopenIndex", () => {
  it("reopens a single-select at its current value", () => {
    assert.equal(dropdownReopenIndex(options, "shop-14"), 13);
  });

  it("reopens a multi-select at its most recently selected value", () => {
    assert.equal(dropdownReopenIndex(options, "", ["shop-3", "shop-17"]), 16);
  });

  it("skips removed or disabled selections and uses the last valid one", () => {
    const withDisabled = options.map((option) => ({
      ...option,
      disabled: option.value === "shop-17",
    }));
    assert.equal(dropdownReopenIndex(withDisabled, "", ["shop-3", "shop-17"]), 2);
  });

  it("falls back to the first enabled option", () => {
    assert.equal(dropdownReopenIndex([{ value: "all", disabled: true }, { value: "one" }], "missing"), 1);
  });

  it("returns no anchor for an empty list", () => {
    assert.equal(dropdownReopenIndex([], "missing"), -1);
  });
});
