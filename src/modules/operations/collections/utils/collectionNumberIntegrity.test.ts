import test from "node:test";
import assert from "node:assert/strict";
import {
  assertUniqueCollectionNumbers,
  findDuplicateCollectionNumbers,
} from "./collectionNumberIntegrity";

test("collection numbers remain unique across Pending, Approved, and Deleted records", () => {
  const register = [
    { id: 1, collectionNo: "COL-20260915-001", status: "Pending Approval" },
    { id: 2, collectionNo: "COL-20260915-002", status: "Approved" },
    { id: 3, collectionNo: "COL-20260915-003", status: "Deleted" },
  ];

  assert.deepEqual(findDuplicateCollectionNumbers(register), []);
  assert.doesNotThrow(() => assertUniqueCollectionNumbers(register));
});

test("a deleted number cannot be reused by a pending or approved record", () => {
  const register = [
    { id: 1, collectionNo: "COL-20260915-004", status: "Deleted" },
    { id: 2, collectionNo: "COL-20260915-004", status: "Pending Approval" },
  ];

  assert.deepEqual(findDuplicateCollectionNumbers(register), ["COL-20260915-004"]);
  assert.throws(
    () => assertUniqueCollectionNumbers(register),
    /Duplicate collection number: COL-20260915-004/,
  );
});

test("number comparison is case-insensitive and ignores accidental outer spacing", () => {
  const register = [
    { id: 1, collectionNo: "COL-20260915-005" },
    { id: 2, collectionNo: " col-20260915-005 " },
  ];

  assert.deepEqual(findDuplicateCollectionNumbers(register), ["COL-20260915-005"]);
});
