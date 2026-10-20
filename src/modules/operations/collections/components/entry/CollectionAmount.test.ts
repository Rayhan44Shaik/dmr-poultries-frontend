import assert from "node:assert/strict";
import test from "node:test";
import { formatCollectionAmountInput } from "./CollectionAmount";

test("collection amount applies Indian grouping immediately while typing", () => {
  assert.deepEqual(formatCollectionAmountInput("700"), { display: "700", amount: 700 });
  assert.deepEqual(formatCollectionAmountInput("7000"), { display: "7,000", amount: 7000 });
  assert.deepEqual(formatCollectionAmountInput("100000"), { display: "1,00,000", amount: 100000 });
  assert.deepEqual(formatCollectionAmountInput("7,000.5"), { display: "7,000.5", amount: 7000.5 });
});
