import assert from "node:assert/strict";
import test from "node:test";
import { rateEntryRowAmount, rateEntryTotalAmount } from "./rateEntryCalculation";

test("modal total matches the outside trip total instead of summing rounded shop rupees", () => {
  const rows = [
    { weight: 1234.526, rate: 100 },
    { weight: 1234.526, rate: 100 },
    { weight: 1234.526, rate: 100 },
    { weight: 1234.516, rate: 100 },
  ];

  const incorrectRoundedRowTotal = rows.reduce(
    (sum, row) => sum + Math.round(rateEntryRowAmount(row)),
    0,
  );
  const canonicalTotal = rateEntryTotalAmount(rows);

  assert.equal(incorrectRoundedRowTotal, 493_811);
  assert.equal(Math.round(canonicalTotal), 493_809);
});

test("row amounts retain backend-compatible paise precision", () => {
  assert.equal(rateEntryRowAmount({ weight: 10.125, rate: 99.9 }), 1011.49);
  assert.equal(rateEntryRowAmount({ weight: 2.24, rate: 138 }), 309.12);
});
