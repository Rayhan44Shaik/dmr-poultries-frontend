import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_COLLECTION_DATE,
  DEFAULT_COLLECTION_PAYMENT_MODE,
  defaultCollectionCollector,
  orderCollectionCollectors,
} from "./collectionEntryDefaults";

test("new collection defaults use the requested date and cash mode", () => {
  assert.equal(DEFAULT_COLLECTION_DATE, "2026-10-12");
  assert.equal(DEFAULT_COLLECTION_PAYMENT_MODE, "Cash");
});

test("V. Rangaiah is matched punctuation-insensitively and placed first", () => {
  const ordered = orderCollectionCollectors(["Z Collector", "V Rangaiah", "A Collector"]);
  assert.deepEqual(ordered, ["V Rangaiah", "A Collector", "Z Collector"]);
  assert.equal(defaultCollectionCollector(ordered), "V Rangaiah");
});
