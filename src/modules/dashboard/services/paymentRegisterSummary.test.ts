import assert from "node:assert/strict";
import test from "node:test";
import { buildSummary } from "./paymentRegisterSummary";

test("payment summary includes Approved records once and filters dates locally", () => {
  const base = {
    paymentDate: "2026-09-16",
    paymentType: "Diesel",
    paymentMode: "Cash",
  };
  const paid = { ...base, id: 1, status: "Paid", amount: 5000 };
  const summary = buildSummary(
    [
      paid,
      paid,
      { ...base, id: 2, status: "Approved", amount: "2000" },
      { ...base, id: 3, status: "Pending", amount: 999 },
      {
        ...base,
        id: 4,
        status: "Approved",
        paymentDate: "2026-08-16",
        amount: 999,
      },
    ],
    "2026-09-14",
    "2026-09-20",
  );
  assert.equal(summary.totalAmount, 2000);
  assert.equal(summary.totalCount, 1);
  assert.equal(
    summary.typeRows.reduce((sum, row) => sum + row.amount, 0),
    2000,
  );
  assert.equal(
    summary.modeRows.reduce((sum, row) => sum + row.amount, 0),
    2000,
  );
});
