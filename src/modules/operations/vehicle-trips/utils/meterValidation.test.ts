import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findMeterChainIssues,
  isMeterInvalid,
  meterMustBeGreaterThan,
} from "./meterValidation";

describe("meterValidation", () => {
  it("flags values not strictly greater than previous meter", () => {
    assert.equal(isMeterInvalid(99, 100), true);
    assert.equal(isMeterInvalid(100, 100), true);
    assert.equal(isMeterInvalid(101, 100), false);
    assert.equal(meterMustBeGreaterThan(100), "Meter reading must be greater than 100.");
  });

  it("does not compare the first diesel bill with the farm meter", () => {
    const slots = [
      { row: 1, sno: "01", meter: 900 },
      { row: 2, sno: "02", meter: 1100 },
    ];
    assert.deepEqual(findMeterChainIssues(slots), []);
    assert.equal(findMeterChainIssues(slots, 1000).length, 1, "legacy farm baseline would reject row 1");
  });
});
