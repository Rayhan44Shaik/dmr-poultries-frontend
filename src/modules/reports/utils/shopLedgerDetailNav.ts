/**
 * Pure helpers for the View Shop Ledger workflow.
 *
 * Navigation always runs over the full filtered cumulative-shop list (never
 * just the visible page), keyed by stable numeric shopId — row indexes and
 * shop names are never used as selection identity.
 */

export interface DetailShopRef {
  shopId?: number | null;
}

/** Raw-ledger cache key: shop + applied date range. Type/search scoping is
 *  pure and instant, so it stays out of the key and never duplicates fetches. */
export function shopDetailCacheKey(
  shopId: number,
  fromDate: string,
  toDate: string,
): string {
  return `${shopId}|${fromDate || ""}|${toDate || ""}`;
}

/** Index of a shop in the filtered cumulative list, or -1 when gone. */
export function findShopDetailIndex(
  rows: ReadonlyArray<DetailShopRef>,
  shopId: number,
): number {
  return rows.findIndex((row) => row.shopId === shopId);
}

/** Previous/next shop id in cumulative-table order, or null at the ends (or
 *  when the shop is no longer in scope — never another shop's id). */
export function adjacentShopDetailId(
  rows: ReadonlyArray<DetailShopRef>,
  shopId: number,
  delta: 1 | -1,
): number | null {
  const index = findShopDetailIndex(rows, shopId);
  if (index === -1) return null;
  const neighbour = rows[index + delta];
  return neighbour?.shopId ?? null;
}

/** 1-based table page holding a 0-based row index. */
export function pageForRowIndex(index: number, pageSize: number): number {
  if (index < 0 || pageSize <= 0) return 1;
  return Math.floor(index / pageSize) + 1;
}

/**
 * Keyboard step for the modal transaction table. Returns the next focused
 * row index, or null when the key is not a navigation key (or movement is
 * impossible) so the caller can leave focus and scrolling untouched.
 */
export function stepDetailTxIndex(
  index: number,
  key: string,
  count: number,
): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return index + 1 < count ? index + 1 : null;
    case "ArrowUp":
      return index - 1 >= 0 ? index - 1 : null;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case " ":
    case "Enter":
      return index >= 0 && index < count ? index : null;
    default:
      return null;
  }
}

/**
 * Stale-guard for async detail loads: only the newest request for the modal
 * may commit its rows. A slower earlier response can never overwrite the
 * newly selected shop, and unmounted/cancelled work commits nothing.
 */
export function isCurrentDetailRequest(
  requestId: number,
  latestRequestId: number,
  cancelled: boolean,
): boolean {
  return !cancelled && requestId === latestRequestId;
}
