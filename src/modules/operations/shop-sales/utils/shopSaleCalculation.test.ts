import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShopSale, ShopSaleFilter } from "../types/shopSale";
import { filterShopSales, paginateSales, calculateSummary } from "./shopSaleCalculation";

function sale(overrides: Partial<ShopSale> = {}): ShopSale {
  return {
    id: "1",
    saleNo: "TR-20260820-001-S001",
    tripId: "9",
    tripNo: "TR-20260820-001",
    tripDate: "2026-08-20",
    shopId: "7",
    shopName: "Rayhan",
    birdType: "Broiler",
    totalBirds: 10,
    totalWeight: 53.3,
    rate: 100,
    amount: 5330,
    remark: "",
    status: "Completed",
    editable: true,
    ...overrides,
  };
}

const baseFilter: ShopSaleFilter = {
  fromDate: "",
  toDate: "",
  shopName: "",
  search: "",
};

const list = [
  sale({
    id: "1", saleNo: "TR-20260820-001-S001", tripNo: "TR-20260820-001", tripDate: "2026-08-20", shopName: "Rayhan", amount: 5330, remark: "",
  }),
  sale({
    id: "2", saleNo: "TR-20260820-001-S002", tripNo: "TR-20260820-001", tripDate: "2026-08-20", shopName: "Maahirah", amount: 5800, remark: "Urgent",
  }),
  sale({
    id: "3", saleNo: "TR-20260821-002-S001", tripNo: "TR-20260821-002", tripDate: "2026-08-21", shopName: "Alpha", amount: 4221, remark: "",
  }),
];

describe("filterShopSales", () => {
  it("search matches the full Shop Sales No", () => {
    const out = filterShopSales(list, { ...baseFilter, search: "TR-20260820-001-S002" });
    assert.equal(out.length, 1);
    assert.equal(out[0].saleNo, "TR-20260820-001-S002");
  });

  it("search matches a Trip No and returns every sale on that trip", () => {
    const out = filterShopSales(list, { ...baseFilter, search: "TR-20260820-001" });
    assert.deepEqual(out.map((s) => s.saleNo).sort(), [
      "TR-20260820-001-S001",
      "TR-20260820-001-S002",
    ]);
  });

  it("search matches a shop name", () => {
    const out = filterShopSales(list, { ...baseFilter, search: "maahirah" });
    assert.equal(out.length, 1);
    assert.equal(out[0].shopName, "Maahirah");
  });

  it("shop-name filter works", () => {
    const out = filterShopSales(list, { ...baseFilter, shopName: "Rayhan" });
    assert.equal(out.length, 1);
    assert.equal(out[0].shopName, "Rayhan");
  });

  it("from/to date filters work", () => {
    const out = filterShopSales(list, { ...baseFilter, fromDate: "2026-08-21", toDate: "2026-08-21" });
    assert.equal(out.length, 1);
    assert.equal(out[0].saleNo, "TR-20260821-002-S001");
  });


  it("does not mutate the input list", () => {
    const copy = [...list];
    filterShopSales(list, baseFilter);
    assert.deepEqual(list.map((s) => s.id), copy.map((s) => s.id));
  });
});

describe("paginateSales", () => {
  const rows = Array.from({ length: 25 }, (_, i) => sale({ id: String(i) }));

  it("returns page slices with a 10-per-page default", () => {
    assert.equal(paginateSales(rows, 1, 10).length, 10);
    assert.equal(paginateSales(rows, 2, 10).length, 10);
    assert.equal(paginateSales(rows, 3, 10).length, 5);
    assert.equal(paginateSales(rows, 3, 10)[0].id, "20");
  });

  it("clamps invalid pages", () => {
    assert.equal(paginateSales(rows, 0, 10).length, 10);
    assert.equal(paginateSales(rows, -3, 10)[0].id, "0");
  });
});

describe("calculateSummary", () => {
  it("sums birds, weight and amount and counts unique shops", () => {
    const summary = calculateSummary(list);
    assert.equal(summary.totalBirds, 30);
    assert.equal(summary.totalShops, 3);
    assert.equal(Number(summary.totalWeight.toFixed(1)), 159.9);
    assert.equal(summary.totalAmount, 15351);
    assert.equal(summary.averageRate, 100);
  });
});