import type { RecentCollection } from "../../types/collection";

/** Stable identity for a shop row. Prefer the backend id so two shops that
 * happen to share a display name are never collapsed into one row. */
export function collectionShopKey(collection: RecentCollection): string {
  if (collection.numericShopId != null) return `id:${collection.numericShopId}`;
  return `name:${collection.shopName.trim().toLocaleLowerCase()}`;
}

function isApproved(collection: RecentCollection): boolean {
  return (collection.rawStatus || collection.status) === "Approved";
}

/** Positive means `candidate` is newer than `current`. Collection date is the
 * common business clock; backend id and collection number make same-day order
 * deterministic. */
export function compareCollectionRecency(
  candidate: RecentCollection,
  current: RecentCollection,
): number {
  const byDate = candidate.collectionDate.localeCompare(current.collectionDate);
  if (byDate !== 0) return byDate;

  const byId = (candidate.numericId ?? 0) - (current.numericId ?? 0);
  if (byId !== 0) return byId;

  const byNumber = candidate.collectionNo.localeCompare(current.collectionNo, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (byNumber !== 0) return byNumber;

  return candidate.id.localeCompare(current.id, undefined, { numeric: true });
}

/**
 * Approved Recent Collections contract:
 * - Approved records only;
 * - exactly one row for every shop that has an approved record;
 * - that row is the shop's newest approved collection.
 */
export function latestApprovedPerShop(collections: RecentCollection[]): RecentCollection[] {
  const latestByShop = new Map<string, RecentCollection>();

  for (const collection of collections) {
    if (!isApproved(collection)) continue;
    const key = collectionShopKey(collection);
    const current = latestByShop.get(key);
    if (!current || compareCollectionRecency(collection, current) > 0) {
      latestByShop.set(key, collection);
    }
  }

  return Array.from(latestByShop.values()).sort((a, b) => compareCollectionRecency(b, a));
}
