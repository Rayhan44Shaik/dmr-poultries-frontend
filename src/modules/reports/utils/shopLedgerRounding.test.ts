import assert from "node:assert/strict";
import test from "node:test";
import { roundLedgerValue } from "./shopLedgerRounding";

test("Shop Ledger rounds halves up and values below half down", () => {
  assert.equal(roundLedgerValue(100.5), 101);
  assert.equal(roundLedgerValue(100.4), 100);
  assert.equal(roundLedgerValue(0.5), 1);
  assert.equal(roundLedgerValue(0.49), 0);
  assert.equal(roundLedgerValue(-100.5), -101);
});
