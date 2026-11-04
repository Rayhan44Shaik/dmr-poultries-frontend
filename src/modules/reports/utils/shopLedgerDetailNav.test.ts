import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adjacentShopDetailId,
  findShopDetailIndex,
  isCurrentDetailRequest,
  pageForRowIndex,
  shopDetailCacheKey,
  stepDetailTxIndex,
} from "./shopLedgerDetailNav.ts";

const rows = [
  { shopId: 11, shop: "Alpha" },
  { shopId: 22, shop: "Beta" },
  { shopId: 33, shop: "Gamma" },
  { shopId: null, shop: "Legacy" },
  { shopId: 44, shop: "Delta" },
];

describe("shopLedgerDetailNav: stable shop identity", () => {
  it("finds shops by numeric id, never by index or name", () => {
    assert.equal(findShopDetailIndex(rows, 22), 1);
    assert.equal(findShopDetailIndex(rows, 44), 4);
    assert.equal(findShopDetailIndex(rows, 999), -1);
  });

  it("a removed shop resolves to -1 so selection clears instead of leaking", () => {
    assert.equal(findShopDetailIndex([{ shopId: 11 }], 22), -1);
    assert.equal(findShopDetailIndex([], 11), -1);
  });

  it("cache keys combine shop id with the applied date range", () => {
    assert.equal(shopDetailCacheKey(22, "2026-09-01", "2026-09-30"), "22|2026-09-01|2026-09-30");
    assert.notEqual(
      shopDetailCacheKey(22, "2026-09-01", "2026-09-30"),
      shopDetailCacheKey(22, "2026-09-01", "2026-10-31"),
    );
    assert.notEqual(
      shopDetailCacheKey(22, "2026-09-01", "2026-09-30"),
      shopDetailCacheKey(33, "2026-09-01", "2026-09-30"),
    );
  });
});

describe("shopLedgerDetailNav: previous and next", () => {
  it("moves through the full filtered list in table order", () => {
    assert.equal(adjacentShopDetailId(rows, 11, 1), 22);
    assert.equal(adjacentShopDetailId(rows, 22, 1), 33);
    assert.equal(adjacentShopDetailId(rows, 33, -1), 22);
    assert.equal(adjacentShopDetailId(rows, 44, -1), null);
  });

  it("skips id-less rows instead of selecting them", () => {
    assert.equal(adjacentShopDetailId(rows, 33, 1), null);
    assert.equal(adjacentShopDetailId(rows, 44, -1), null);
  });

  it("disables at the ends and for shops out of scope", () => {
    assert.equal(adjacentShopDetailId(rows, 11, -1), null);
    assert.equal(adjacentShopDetailId(rows, 44, 1), null);
    assert.equal(adjacentShopDetailId(rows, 999, 1), null);
    assert.equal(adjacentShopDetailId(rows, 999, -1), null);
    assert.equal(adjacentShopDetailId([], 11, 1), null);
  });

  it("a single-shop scope has neither previous nor next", () => {
    const single = [{ shopId: 7 }];
    assert.equal(adjacentShopDetailId(single, 7, 1), null);
    assert.equal(adjacentShopDetailId(single, 7, -1), null);
  });
});

describe("shopLedgerDetailNav: pagination follow", () => {
  it("maps a global row index to its 1-based table page", () => {
    assert.equal(pageForRowIndex(0, 10), 1);
    assert.equal(pageForRowIndex(9, 10), 1);
    assert.equal(pageForRowIndex(10, 10), 2);
    assert.equal(pageForRowIndex(25, 10), 3);
  });

  it("falls back to page one for invalid input", () => {
    assert.equal(pageForRowIndex(-1, 10), 1);
    assert.equal(pageForRowIndex(5, 0), 1);
  });
});

describe("shopLedgerDetailNav: transaction keyboard steps", () => {
  it("moves down and up within the statement", () => {
    assert.equal(stepDetailTxIndex(0, "ArrowDown", 4), 1);
    assert.equal(stepDetailTxIndex(3, "ArrowDown", 4), null);
    assert.equal(stepDetailTxIndex(2, "ArrowUp", 4), 1);
    assert.equal(stepDetailTxIndex(0, "ArrowUp", 4), null);
  });

  it("Home and End jump to the statement ends", () => {
    assert.equal(stepDetailTxIndex(2, "Home", 4), 0);
    assert.equal(stepDetailTxIndex(1, "End", 4), 3);
    assert.equal(stepDetailTxIndex(0, "End", 1), 0);
  });

  it("Space and Enter keep the focused row without scrolling the page", () => {
    assert.equal(stepDetailTxIndex(2, " ", 4), 2);
    assert.equal(stepDetailTxIndex(2, "Enter", 4), 2);
    assert.equal(stepDetailTxIndex(9, "Enter", 4), null);
  });

  it("other keys and empty statements do nothing", () => {
    assert.equal(stepDetailTxIndex(1, "ArrowLeft", 4), null);
    assert.equal(stepDetailTxIndex(1, "a", 4), null);
    assert.equal(stepDetailTxIndex(0, "ArrowDown", 0), null);
    assert.equal(stepDetailTxIndex(0, "Home", 0), null);
  });
});

describe("shopLedgerDetailNav: stale-request guard", () => {
  it("only the newest uncancelled request may commit", () => {
    assert.equal(isCurrentDetailRequest(2, 2, false), true);
    assert.equal(isCurrentDetailRequest(1, 2, false), false);
    assert.equal(isCurrentDetailRequest(2, 2, true), false);
    assert.equal(isCurrentDetailRequest(3, 2, false), false);
  });
});
