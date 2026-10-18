import assert from "node:assert/strict";
import test from "node:test";
import { calculateTripExpenseTotals, dieselExpenseBreakdown } from "./dieselExpenseBreakdown";

test("other diesel includes only non-master bunk rows and derives amount", () => {
  const result = dieselExpenseBreakdown([
    { litres: 50, rate: 100, bunkName: "Shiva", bunkSource: "MASTER" },
    { litres: 20, rate: 101, bunkName: "Hari", bunkSource: "MASTER" },
    { litres: 10, rate: 102, bunkName: "Roadside", bunkSource: "OTHER" },
  ]);
  assert.equal(result.totalAmount, 8040);
  assert.equal(result.totalLitres, 80);
  assert.equal(result.otherAmount, 1020);
  assert.match(result.tooltip, /Shiva: ₹5,000\.00/);
  assert.match(result.tooltip, /Other: ₹1,020\.00/);
});

test("other diesel increases the expense subtotal without being doubled in the grand total", () => {
  const result = calculateTripExpenseTotals(500, 4_000, 1_000);
  assert.equal(result.expenseTotal, 1_500);
  assert.equal(result.grandTotal, 4_500);
});
