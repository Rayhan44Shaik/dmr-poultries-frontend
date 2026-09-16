import assert from "node:assert/strict";
import test from "node:test";
import {
  collectionRecoveryPercentage,
  normalizeCollectionPerformance,
  sortCollectionPerformance,
  summarizeCollectionPerformance,
  type CollectionPerformanceDatum,
} from "./collectionPerformance";

const rows: CollectionPerformanceDatum[] = [
  { shopName: " Balaji Traders ", salesAmount: 1000, collectionAmount: 700, outstandingAmount: 300 },
  { shopName: "balaji traders", salesAmount: 500, collectionAmount: 200, outstandingAmount: 300 },
  { shopName: "Annapurna Farms", salesAmount: 800, collectionAmount: 720, outstandingAmount: 80 },
  { shopName: "Cash-only adjustment", salesAmount: 0, collectionAmount: 50, outstandingAmount: 0 },
];

test("collection performance merges duplicate shop rows and cleans unsafe amounts", () => {
  const normalized = normalizeCollectionPerformance([
    ...rows,
    { shopName: "Invalid", salesAmount: Number.NaN, collectionAmount: -20, outstandingAmount: Number.POSITIVE_INFINITY },
    { shopName: "  ", salesAmount: 10, collectionAmount: 10, outstandingAmount: 0 },
  ]);

  assert.equal(normalized.length, 4);
  assert.deepEqual(normalized[0], {
    shopName: "Balaji Traders",
    salesAmount: 1500,
    collectionAmount: 900,
    outstandingAmount: 600,
  });
  assert.deepEqual(normalized[normalized.length - 1], {
    shopName: "Invalid",
    salesAmount: 0,
    collectionAmount: 0,
    outstandingAmount: 0,
  });
});

test("collection performance totals and recovery use sales as the 100 percent baseline", () => {
  const normalized = normalizeCollectionPerformance(rows);
  const summary = summarizeCollectionPerformance(normalized);

  assert.equal(summary.salesAmount, 2300);
  assert.equal(summary.collectionAmount, 1670);
  assert.equal(summary.outstandingAmount, 680);
  assert.equal(Number(summary.recoveryPercentage.toFixed(2)), 72.61);
  assert.equal(collectionRecoveryPercentage(normalized[0]), 60);
  assert.equal(collectionRecoveryPercentage(normalized[2]), 100);
});

test("collection performance supports deterministic amount and recovery sorting", () => {
  const normalized = normalizeCollectionPerformance(rows);

  assert.equal(sortCollectionPerformance(normalized, "outstanding")[0].shopName, "Balaji Traders");
  assert.equal(sortCollectionPerformance(normalized, "collections")[0].shopName, "Balaji Traders");
  assert.equal(sortCollectionPerformance(normalized, "collectionsLow")[0].shopName, "Cash-only adjustment");
  assert.equal(sortCollectionPerformance(normalized, "recoveryHigh")[0].shopName, "Cash-only adjustment");
  assert.equal(sortCollectionPerformance(normalized, "recoveryLow")[0].shopName, "Balaji Traders");
  assert.deepEqual(
    sortCollectionPerformance(normalized, "shop").map((row) => row.shopName),
    ["Annapurna Farms", "Balaji Traders", "Cash-only adjustment"],
  );
});
