import assert from "node:assert/strict";
import test from "node:test";
import type { ShopDelivery, Trip } from "../../../shared/trip";
import { indexOrderAssignments } from "./orderAssignmentIndex";
import { isOrderPlanRemarks, parseOrderRef } from "./types";

const row = (shopId: number, remarks: string) => ({ shopId, remarks }) as ShopDelivery;
const trip = (id: number, rows: ShopDelivery[], deleted = false) =>
  ({ id, shopDeliveries: rows, deleted }) as unknown as Trip;
const rowsOf = (t: Trip) => (t as unknown as { shopDeliveries: ShopDelivery[] }).shopDeliveries;

function oldScan(trips: Trip[], ref: string) {
  const shops = new Map<number, Array<{ trip: Trip; rows: ShopDelivery[] }>>();
  for (const t of trips) {
    if (t.deleted) continue;
    for (const r of rowsOf(t)) {
      if (!isOrderPlanRemarks(r.remarks) || parseOrderRef(r.remarks) !== ref) continue;
      const id = Number(r.shopId);
      if (!Number.isFinite(id) || !id) continue;
      let buckets = shops.get(id);
      if (!buckets) shops.set(id, (buckets = []));
      let bucket = buckets.find((b) => b.trip.id === t.id);
      if (!bucket) buckets.push((bucket = { trip: t, rows: [] }));
      bucket.rows.push(r);
    }
  }
  return shops;
}

test("index preserves split shares, primary vehicle, duplicate rows and order isolation", () => {
  const trips = [
    trip(1, [row(12, "[ORDER] O:ORD-A"), row(12, "[ORDER] O:ORD-A"), row(12, "[ORDER] O:ORD-B")]),
    trip(2, [row(12, "[ORDER] O:ORD-A"), row(14, "[ORDER] O:ORD-A")]),
    trip(3, [row(12, "[ORDER] O:ORD-A")], true),
    trip(4, [row(0, "[ORDER] O:ORD-A"), row(NaN, "[ORDER] O:ORD-A"), row(12, "manual"), row(12, "[ORDER]")]),
  ];
  const index = indexOrderAssignments(trips, rowsOf);
  for (const ref of ["ORD-A", "ORD-B"]) assert.deepEqual(index.get(ref), oldScan(trips, ref));
  assert.equal(index.size, 2);
  assert.equal(index.get("ORD-A")?.get(12)?.length, 2);
  assert.equal(index.get("ORD-A")?.get(12)?.[0].rows.length, 2);
});

test("large snapshots read each non-deleted trip once, independent of collection count", () => {
  const trips = Array.from({ length: 640 }, (_, id) => trip(id + 1,
    Array.from({ length: 12 }, (_, shop) => row(shop + 1, `[ORDER] O:ORD-${id % 92}`))));
  let calls = 0;
  const index = indexOrderAssignments(trips, (t) => { calls++; return rowsOf(t); });
  assert.equal(calls, 640);
  assert.equal(index.size, 92);
  for (const ref of index.keys()) assert.deepEqual(index.get(ref), oldScan(trips, ref));
});

test("a later snapshot has no stale assignments and source arrays are not mutated", () => {
  const rows = [row(2, "[ORDER] O:ORD-A"), row(1, "[ORDER] O:ORD-A")];
  const before = rows.slice();
  indexOrderAssignments([trip(1, rows)], rowsOf);
  assert.deepEqual(rows, before);
  assert.equal(indexOrderAssignments([], rowsOf).size, 0);
});
