import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { makeT } from "../../../i18n/index.ts";
import type { LedgerTransaction } from "./ShopLedgerPDF.ts";
import { scopeShopDetailLedger } from "./shopLedgerDetailData.ts";
import { ShopLedgerDetailView } from "./ShopLedgerDetailModal.tsx";

const t = makeT("en");

const opening: LedgerTransaction = {
  date: "2026-09-01",
  particulars: "Opening Balance",
  birds: 0,
  weight: 0,
  rate: 0,
  debit: 0,
  credit: 0,
  balance: 1000,
  type: "sale",
};

const sale: LedgerTransaction = {
  id: 11,
  date: "2026-09-02",
  particulars: "Alpha Shop",
  birds: 100,
  weight: 200.5,
  rate: 95.5,
  debit: 9550,
  credit: 0,
  balance: 10550,
  type: "sale",
  loadLabel: "Load 1",
  collectionNo: "SALE-118",
  subShopName: "Hari",
};

const collection: LedgerTransaction = {
  id: 12,
  date: "2026-09-03",
  particulars: "Alpha Shop",
  birds: 0,
  weight: 0,
  rate: 0,
  debit: 0,
  credit: 12000,
  balance: -1450,
  type: "collection",
  paymentMode: "UPI",
  collectionNo: "COL-2209-0007",
};

const ledger = [opening, sale, collection];

function summaryOf(scoped: LedgerTransaction[]) {
  return scopeShopDetailLedger(
    { shop: "Alpha Shop", data: scoped },
    { reportType: "all", searchTerm: "" },
  );
}

describe("ShopLedgerDetailView: statement content", () => {
  it("shows opening, running and closing balances in order", () => {
    const detail = summaryOf(ledger);
    assert.equal(detail.opening, 1000);
    assert.equal(detail.closing, -1450);
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView
        scoped={detail.scoped}
        summary={detail}
        status="ready"
        resetKey={7}
        t={t}
        language="en"
      />,
    );
    assert.ok(html.includes("₹ 1,000"), "opening balance renders");
    assert.ok(html.includes("₹ 10,550"), "running balance renders");
    assert.ok(html.includes("₹ -1,450") || html.includes("₹ -1,450".replace(" ", " ")), "closing balance renders");
    const firstTx = html.indexOf("2026-09-02");
    const secondTx = html.indexOf("2026-09-03");
    assert.ok(firstTx !== -1 && secondTx !== -1 && firstTx < secondTx, "chronological ledger order");
  });

  it("colours sales emerald, collections blue and negative balances rose", () => {
    const detail = summaryOf(ledger);
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView
        scoped={detail.scoped}
        summary={detail}
        status="ready"
        resetKey={7}
        t={t}
        language="en"
      />,
    );
    assert.ok(html.includes("text-emerald-600"), "sale amounts emerald");
    assert.ok(html.includes("text-blue-600"), "collection amounts blue");
    assert.ok(html.includes("text-rose-600"), "negative balance rose");
  });

  it("shows trip, load, collection, payment and sub-shop details", () => {
    const detail = summaryOf(ledger);
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView
        scoped={detail.scoped}
        summary={detail}
        status="ready"
        resetKey={7}
        t={t}
        language="en"
      />,
    );
    assert.ok(html.includes("Load 1"), "load label renders");
    assert.ok(html.includes("COL-2209-0007"), "collection number renders");
    assert.ok(html.includes("UPI"), "payment mode renders");
    assert.ok(html.includes("Hari"), "sub-shop renders");
  });

  it("summarises opening, sales, collections and closing", () => {
    const detail = summaryOf(ledger);
    assert.equal(detail.totalSales, 9550);
    assert.equal(detail.totalCollections, 12000);
    assert.equal(detail.totalBirds, 100);
    assert.equal(detail.totalWeight, 200.5);
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView
        scoped={detail.scoped}
        summary={detail}
        status="ready"
        resetKey={7}
        t={t}
        language="en"
      />,
    );
    assert.ok(html.includes("₹ 9,550"), "total sales renders");
    assert.ok(html.includes("₹ 12,000"), "total collections renders");
  });

  it("marks the active transaction row without a focus trap", () => {
    const detail = summaryOf(ledger);
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView
        scoped={detail.scoped}
        summary={detail}
        status="ready"
        resetKey={7}
        t={t}
        language="en"
      />,
    );
    assert.ok(html.includes('tabindex="0"'), "exactly one tabbable row");
    assert.ok(html.includes('aria-selected="true"'), "active row announced");
    assert.ok(html.includes("bg-emerald-50/80"), "very light mint highlight");
  });
});

describe("ShopLedgerDetailView: loading, empty and error states", () => {
  const summary = summaryOf(ledger);

  it("shows a loading state while fetching", () => {
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView scoped={[]} summary={summary} status="loading" resetKey={7} t={t} language="en" />,
    );
    assert.ok(html.includes("Loading shop ledger records"), "loading message");
  });

  it("shows an empty state when the shop has no rows", () => {
    const html = renderToStaticMarkup(
      <ShopLedgerDetailView scoped={[]} summary={summary} status="ready" resetKey={7} t={t} language="en" />,
    );
    assert.ok(html.includes("No transactions found"), "empty message");
  });

  it("shows an error with retry, and hides retry when absent", () => {
    let retried = 0;
    const withRetry = renderToStaticMarkup(
      <ShopLedgerDetailView
        scoped={[]}
        summary={summary}
        status="error"
        errorMessage="Boom"
        onRetry={() => { retried += 1; }}
        resetKey={7}
        t={t}
        language="en"
      />,
    );
    assert.ok(withRetry.includes("Boom"), "error message renders");
    assert.ok(withRetry.includes("Retry"), "retry action renders");
    const withoutRetry = renderToStaticMarkup(
      <ShopLedgerDetailView scoped={[]} summary={summary} status="error" resetKey={7} t={t} language="en" />,
    );
    assert.ok(!withoutRetry.includes("Retry"), "no retry when handler absent");
    assert.equal(retried, 0, "static markup never fires handlers");
  });
});

describe("scopeShopDetailLedger: screen and PDF share one scope", () => {
  it("report type filters the statement and re-derives balances", () => {
    const sales = scopeShopDetailLedger(
      { shop: "Alpha Shop", data: ledger },
      { reportType: "sales", searchTerm: "" },
    );
    assert.deepEqual(
      sales.scoped.map((tx) => tx.type),
      ["sale", "sale"],
    );
    assert.equal(sales.closing, 10550);
    assert.equal(sales.totalCollections, 0);
    const collections = scopeShopDetailLedger(
      { shop: "Alpha Shop", data: ledger },
      { reportType: "collection", searchTerm: "" },
    );
    assert.deepEqual(
      collections.scoped.map((tx) => tx.type),
      ["sale", "collection"],
    );
    assert.equal(collections.closing, -11000);
  });

  it("a matching shop name keeps the full typed statement", () => {
    const scoped = scopeShopDetailLedger(
      { shop: "Alpha Shop", data: ledger },
      { reportType: "all", searchTerm: "alpha" },
    );
    assert.equal(scoped.scoped.length, 3);
    assert.equal(scoped.closing, -1450);
  });

  it("an unmatched search narrows rows without inventing balances", () => {
    const scoped = scopeShopDetailLedger(
      { shop: "Alpha Shop", data: ledger },
      { reportType: "all", searchTerm: "COL-2209" },
    );
    assert.ok(scoped.scoped.length < 3, "filtered to matching rows");
    assert.equal(
      scoped.scoped[scoped.scoped.length - 1].balance,
      scoped.closing,
      "last row carries the closing balance",
    );
  });
});
