import assert from "node:assert/strict";
import test from "node:test";
import type { LedgerTransaction } from "../components/ShopLedgerPDF";
import {
  filterStatementByType,
  recalculateStatementBalances,
  scopeShopLedgersForPdf,
  shopLedgerHasPrintableActivity,
} from "../utils/shopLedgerBalances";

const row = (overrides: Partial<LedgerTransaction>): LedgerTransaction => ({
  date: "2026-08-01",
  particulars: "",
  birds: 0,
  weight: 0,
  rate: 0,
  debit: 0,
  credit: 0,
  balance: 0,
  type: "sale",
  ...overrides,
});

test("filtered ledger balances use only visible debits and credits", () => {
  const opening = row({ particulars: "Opening Balance", balance: 100 });
  const sales = recalculateStatementBalances([
    opening,
    row({ debit: 40, balance: 999 }),
    row({ debit: 10, balance: 999 }),
  ]);
  assert.deepEqual(sales.map((item) => item.balance), [100, 140, 150]);

  const collections = recalculateStatementBalances([
    opening,
    row({ type: "collection", credit: 25, balance: 999 }),
    row({ type: "collection", credit: 5, balance: 999 }),
  ]);
  assert.deepEqual(collections.map((item) => item.balance), [100, 75, 70]);

  const all = recalculateStatementBalances([
    opening,
    row({ debit: 40 }),
    row({ type: "collection", credit: 25 }),
  ]);
  assert.deepEqual(all.map((item) => item.balance), [100, 140, 115]);
});

test("report type keeps opening and calculates the requested cumulative closing", () => {
  const statement = [
    row({ particulars: "Opening Balance", balance: 100 }),
    row({ debit: 40, birds: 12, weight: 25 }),
    row({ type: "collection", credit: 25 }),
    row({ debit: 10, birds: 5, weight: 11 }),
    row({ type: "collection", credit: 5 }),
  ];

  const sales = filterStatementByType(statement, "sales");
  assert.equal(sales.length, 3);
  assert.equal(sales[sales.length - 1]?.balance, 150, "opening + sales");
  assert.ok(sales.slice(1).every((item) => item.type === "sale"));

  const collections = filterStatementByType(statement, "collection");
  assert.equal(collections.length, 3);
  assert.equal(collections[collections.length - 1]?.balance, 70, "opening - collections");
  assert.ok(collections.slice(1).every((item) => item.type === "collection"));

  const all = filterStatementByType(statement, "all");
  assert.equal(all[all.length - 1]?.balance, 120, "opening + sales - collections");
});

test("PDF scope follows applied filters, not shop-only or empty dates", () => {
  const opening = row({ particulars: "Opening Balance", balance: 80 });
  const entries = [
    {
      shop: "Hari Shop",
      data: [
        opening,
        row({ particulars: "Hari Sale", debit: 40, birds: 10, weight: 20 }),
        row({ type: "collection", particulars: "Hari Cash", credit: 15 }),
      ],
    },
    {
      shop: "Quiet Shop",
      data: [row({ particulars: "Opening Balance", balance: 0 })],
    },
    {
      shop: "Farm Gate",
      data: [
        opening,
        row({ particulars: "Farm Sale", debit: 25, birds: 8, weight: 16 }),
      ],
    },
  ];

  const allShops = scopeShopLedgersForPdf(entries, { reportType: "all" });
  assert.deepEqual(allShops.map((item) => item.shop), ["Hari Shop", "Farm Gate"]);
  assert.equal(shopLedgerHasPrintableActivity(entries[1].data), false);

  const salesOnly = scopeShopLedgersForPdf(entries, { reportType: "sales" });
  assert.ok(salesOnly.every((item) => item.data.slice(1).every((tx) => tx.type === "sale")));

  const searched = scopeShopLedgersForPdf(entries, {
    reportType: "all",
    searchTerm: "farm",
  });
  assert.deepEqual(searched.map((item) => item.shop), ["Farm Gate"]);

  const keptEmpty = scopeShopLedgersForPdf(entries, {
    reportType: "all",
    keepEmptySelectedShop: "Quiet Shop",
  });
  assert.ok(keptEmpty.some((item) => item.shop === "Quiet Shop"));
});
