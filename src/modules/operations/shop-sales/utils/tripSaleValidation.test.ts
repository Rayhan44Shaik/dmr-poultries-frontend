import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dcAccountedWeight, isValidTripSaleRow } from "./tripSaleValidation";

const validRow = { shopId: 1, birds: 10, weight: 24.5, mortality: 0, mortalityWeight: 0, deliveryMode: "box" as const, rate: 126 };

describe("Shop Sales trip validation", () => {
  it("rejects birds saved with zero weight", () => assert.equal(isValidTripSaleRow({ ...validRow, weight: 0 }), false));
  it("accepts a complete delivered row", () => assert.equal(isValidTripSaleRow(validRow), true));
  it("treats an existing zeroed row as a removal", () => assert.equal(isValidTripSaleRow({ ...validRow, id: 9, birds: 0, weight: 0 }), true));
  it("rejects a new empty row", () => assert.equal(isValidTripSaleRow({ ...validRow, birds: 0, weight: 0 }), false));
  it("counts only Box mortality kg against DC weight", () => {
    assert.equal(dcAccountedWeight({ weight: 48.7, mortalityWeight: 2, deliveryMode: "box" }), 50.7);
    assert.equal(dcAccountedWeight({ weight: 48.7, mortalityWeight: 2, deliveryMode: "weight" }), 48.7);
  });
});
