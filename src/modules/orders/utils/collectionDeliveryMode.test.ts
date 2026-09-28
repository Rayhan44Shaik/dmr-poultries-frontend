/**
 * Collection delivery-mode derivation tests.
 *
 * Locks the rule the collection sheet uses when it has no mode toggle:
 * boxed rows ride as box sales, weight-only captures (boxes 0 / missing)
 * ride as weight sales — so a weight shop can never again land in the trip
 * mislabelled as box on Trip List, Rate Entry, and Step 4.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { collectionDeliveryMode } from "./collectionDeliveryMode";

test("boxed rows derive box mode", () => {
  assert.equal(collectionDeliveryMode(1), "box");
  assert.equal(collectionDeliveryMode(5), "box");
});

test("weight-only captures derive weight mode", () => {
  assert.equal(collectionDeliveryMode(0), "weight");
  assert.equal(collectionDeliveryMode(null), "weight");
  assert.equal(collectionDeliveryMode(undefined), "weight");
});
