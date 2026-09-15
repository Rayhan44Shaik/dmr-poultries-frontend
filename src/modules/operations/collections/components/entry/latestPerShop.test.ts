import test from "node:test";
import assert from "node:assert/strict";
import type { RecentCollection } from "../../types/collection";
import {
  collectionShopKey,
  latestApprovedPerShop,
} from "./latestApprovedPerShop";

function row(overrides: Partial<RecentCollection>): RecentCollection {
  return {
    id: "1",
    collectionNo: "COL-20260901-001",
    collectionDate: "2026-09-01",
    shopName: "Sri Balaji",
    collectorName: "Ravi",
    paymentModeName: "Cash",
    referenceNo: "",
    amount: 1000,
    remarks: "",
    status: "Approved",
    rawStatus: "Approved",
    numericId: 1,
    numericShopId: 1,
    ...overrides,
  };
}

const rows: RecentCollection[] = [
  row({ id: "1", collectionNo: "COL-20260901-001", collectionDate: "2026-09-01", numericId: 1 }),
  row({ id: "9", collectionNo: "COL-20260910-009", collectionDate: "2026-09-10", numericId: 9 }),
  row({ id: "5", collectionNo: "COL-20260905-005", collectionDate: "2026-09-05", numericId: 5 }),
  row({
    id: "2",
    collectionNo: "COL-20260902-002",
    collectionDate: "2026-09-02",
    shopName: "Hanuman",
    numericId: 2,
    numericShopId: 2,
  }),
  row({
    id: "7",
    collectionNo: "COL-20260911-007",
    collectionDate: "2026-09-11",
    shopName: "Gayatri",
    numericId: 7,
    numericShopId: 3,
    status: "Pending",
    rawStatus: "Pending Approval",
  }),
];

test("Approved output contains every approved shop exactly once", () => {
  const output = latestApprovedPerShop(rows);
  assert.deepEqual(output.map((item) => item.shopName), ["Sri Balaji", "Hanuman"]);
  assert.equal(new Set(output.map(collectionShopKey)).size, output.length);
});

test("each shop row carries its newest approved collection number", () => {
  const output = latestApprovedPerShop(rows);
  assert.equal(
    output.find((item) => item.shopName === "Sri Balaji")?.collectionNo,
    "COL-20260910-009",
  );
});

test("Pending and Deleted records never leak into or displace Approved rows", () => {
  const mixed = [
    ...rows,
    row({
      id: "12",
      numericId: 12,
      collectionNo: "COL-20260912-012",
      collectionDate: "2026-09-12",
      status: "Pending",
      rawStatus: "Pending Approval",
    }),
    row({
      id: "13",
      numericId: 13,
      collectionNo: "COL-20260913-013",
      collectionDate: "2026-09-13",
      status: "Deleted",
      rawStatus: "Deleted",
    }),
  ];
  const output = latestApprovedPerShop(mixed);
  assert.equal(output.length, 2);
  assert.equal(output[0].collectionNo, "COL-20260910-009");
  assert.ok(output.every((item) => item.rawStatus === "Approved"));
});

test("same-day entries are broken by backend id, not insertion order", () => {
  const tied = [
    row({ id: "4", numericId: 4, collectionNo: "COL-20260909-004", collectionDate: "2026-09-09" }),
    row({ id: "11", numericId: 11, collectionNo: "COL-20260909-011", collectionDate: "2026-09-09" }),
  ];
  assert.equal(latestApprovedPerShop(tied)[0].collectionNo, "COL-20260909-011");
  assert.equal(latestApprovedPerShop([...tied].reverse())[0].collectionNo, "COL-20260909-011");
});

test("stable shop ids preserve distinct shops that share the same display name", () => {
  const sameName = [
    row({ id: "21", numericId: 21, numericShopId: 21, shopName: "Main Shop" }),
    row({ id: "22", numericId: 22, numericShopId: 22, shopName: "Main Shop" }),
  ];
  const output = latestApprovedPerShop(sameName);
  assert.equal(output.length, 2);
  assert.equal(new Set(output.map(collectionShopKey)).size, 2);
});

test("searching an older approved number can retain the shop without changing its latest row", () => {
  const matchingKeys = new Set(
    rows
      .filter((item) => item.collectionNo === "COL-20260901-001")
      .map(collectionShopKey),
  );
  const output = latestApprovedPerShop(rows).filter((item) =>
    matchingKeys.has(collectionShopKey(item)),
  );
  assert.equal(output.length, 1);
  assert.equal(output[0].collectionNo, "COL-20260910-009");
});
