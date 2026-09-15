import test from "node:test";
import assert from "node:assert/strict";

type Row = { id: string; shopName: string; collectionNo: string; collectionDate: string; numericId?: number; rawStatus?: string; status?: string };

// Mirrors the component's reducer exactly.
function latestPerShop(collections: Row[], matching: (r: Row) => boolean) {
  const allApproved = collections.filter((r) => (r.rawStatus || r.status) === "Approved");
  const isNewer = (c: Row, cur: Row) => {
    const byDate = c.collectionDate.localeCompare(cur.collectionDate);
    if (byDate !== 0) return byDate > 0;
    return (c.numericId ?? 0) > (cur.numericId ?? 0);
  };
  const m = new Map<string, Row>();
  for (const col of allApproved) {
    const ex = m.get(col.shopName);
    if (!ex || isNewer(col, ex)) m.set(col.shopName, col);
  }
  const matchingShops = new Set(collections.filter(matching).filter(r => (r.rawStatus||r.status)==="Approved").map((r) => r.shopName));
  return [...m.values()].filter((r) => matchingShops.has(r.shopName))
    .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
}

const rows: Row[] = [
  { id:"1", shopName:"Sri Balaji", collectionNo:"COL-001", collectionDate:"2026-09-01", numericId:1, rawStatus:"Approved" },
  { id:"2", shopName:"Sri Balaji", collectionNo:"COL-009", collectionDate:"2026-09-10", numericId:9, rawStatus:"Approved" },
  { id:"3", shopName:"Sri Balaji", collectionNo:"COL-005", collectionDate:"2026-09-05", numericId:5, rawStatus:"Approved" },
  { id:"4", shopName:"Hanuman",    collectionNo:"COL-throw", collectionDate:"2026-09-02", numericId:2, rawStatus:"Approved" },
  { id:"5", shopName:"Gayatri",    collectionNo:"COL-007", collectionDate:"2026-09-07", numericId:7, rawStatus:"Pending Approval" },
];

test("every shop with an approved entry appears, exactly once", () => {
  const out = latestPerShop(rows, () => true);
  assert.deepEqual(out.map(r => r.shopName), ["Sri Balaji", "Hanuman"]);
  assert.equal(new Set(out.map(r=>r.shopName)).size, out.length);
});

test("the row carries that shop's LATEST collection number", () => {
  const out = latestPerShop(rows, () => true);
  assert.equal(out.find(r => r.shopName === "Sri Balaji")!.collectionNo, "COL-009");
});

test("a shop with only pending entries does not appear", () => {
  assert.equal(latestPerShop(rows, () => true).some(r => r.shopName === "Gayatri"), false);
});

test("same-day entries are broken by id, not insertion order", () => {
  const tie: Row[] = [
    { id:"a", shopName:"S", collectionNo:"COL-A", collectionDate:"2026-09-09", numericId:4, rawStatus:"Approved" },
    { id:"b", shopName:"S", collectionNo:"COL-B", collectionDate:"2026-09-09", numericId:11, rawStatus:"Approved" },
  ];
  assert.equal(latestPerShop(tie, () => true)[0].collectionNo, "COL-B");
  assert.equal(latestPerShop([...tie].reverse(), () => true)[0].collectionNo, "COL-B");
});

test("REGRESSION: searching an older entry still shows the shop's latest number", () => {
  // User searches "COL-001" — the oldest Sri Balaji entry. The shop row must
  // still report COL-009, the actual latest, not the matched older one.
  const out = latestPerShop(rows, (r) => r.collectionNo === "COL-001");
  assert.deepEqual(out.map(r => r.shopName), ["Sri Balaji"]);
  assert.equal(out[0].collectionNo, "COL-009");
});
