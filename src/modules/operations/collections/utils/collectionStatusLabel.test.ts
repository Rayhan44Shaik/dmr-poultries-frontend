import test from "node:test";
import assert from "node:assert/strict";
import { collectionStatusKey, collectionStatusLabel } from "./collectionStatusLabel";
const dict: Record<string,string> = {
  "status.pending":"Pending","status.approved":"Approved","status.deleted":"Deleted","status.rejected":"Rejected",
};
const t = (k: string) => dict[k] ?? k;
test("backend 'Pending Approval' renders as the short 'Pending'", () => {
  assert.equal(collectionStatusKey("Pending Approval"), "status.pending");
  assert.equal(collectionStatusLabel("Pending Approval", t), "Pending");
});
test("plain 'Pending' also maps to the short label", () => {
  assert.equal(collectionStatusLabel("Pending", t), "Pending");
});
test("other statuses are unaffected", () => {
  assert.equal(collectionStatusLabel("Approved", t), "Approved");
  assert.equal(collectionStatusLabel("Deleted", t), "Deleted");
  assert.equal(collectionStatusLabel("Rejected", t), "Rejected");
});
test("an untranslated status falls back to the raw backend value", () => {
  assert.equal(collectionStatusLabel("Something Odd", t), "Something Odd");
});
