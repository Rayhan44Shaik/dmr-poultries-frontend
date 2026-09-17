import type { ShopDelivery, Trip } from "../../../shared/trip";
import { isOrderPlanRemarks, parseOrderRef } from "../types";

export type AssignmentBucket = { trip: Trip; rows: ShopDelivery[] };

/**
 * Index once per snapshot instead of scanning every trip for every collection.
 * Keep trip and row order intact: the first vehicle remains the primary
 * assignment and multiple vehicles retain their separate split-order shares.
 * No TTL or persisted cache: the next server snapshot is always re-indexed.
 */
export function indexOrderAssignments(
  trips: readonly Trip[],
  rowsOf: (trip: Trip) => readonly ShopDelivery[],
): Map<string, Map<number, AssignmentBucket[]>> {
  const index = new Map<string, Map<number, AssignmentBucket[]>>();
  for (const trip of trips) {
    if (trip.deleted) continue;
    const tripBuckets = new Map<string, Map<number, AssignmentBucket>>();
    for (const row of rowsOf(trip)) {
      if (!isOrderPlanRemarks(row.remarks)) continue;
      const ref = parseOrderRef(row.remarks);
      const shopId = Number(row.shopId);
      if (!ref || !Number.isFinite(shopId) || !shopId) continue;
      let shops = index.get(ref);
      if (!shops) index.set(ref, (shops = new Map()));
      let ownShops = tripBuckets.get(ref);
      if (!ownShops) tripBuckets.set(ref, (ownShops = new Map()));
      let bucket = ownShops.get(shopId);
      if (!bucket) {
        bucket = { trip, rows: [] };
        ownShops.set(shopId, bucket);
        const buckets = shops.get(shopId);
        if (buckets) buckets.push(bucket);
        else shops.set(shopId, [bucket]);
      }
      bucket.rows.push(row);
    }
  }
  return index;
}
