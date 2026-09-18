import type { ShopDelivery, BoxDetail } from "../../types/trip";

const FULLY_CONSUMED = Number.MAX_SAFE_INTEGER;

export interface BoxRemaining extends BoxDetail {
  boxNo: number;
  birds: number;
  weight: number;
}

/** Consumption map keyed by boxNo — the single source of truth for which
 * boxes have been delivered. A row consumes boxes differently depending on
 * how it was captured:
 *   - per-box data (weight mode): consumes exactly the split per box.
 *   - box mode, single box: consumes birds + mortality and weight + mortKg.
 *   - box mode, multiple boxes (no per-box split): consumes the WHOLE box —
 *     the row takes the box's full remaining birds/weight, so the box can
 *     never be selected again.
 *
 * Once all birds from a pickup box are delivered, the box is FULLY consumed
 * even if a few hundred grams of farm-vs-DC weight variance remain. That
 * leftover kg is not stock for another shop.
 */
export function computeRemainingBoxes(
  boxDetails: BoxDetail[],
  rows: ShopDelivery[],
  opts: { excludeRowId?: number | null } = {}
): Map<number, { birds: number; weight: number }> {
  const byNo = new Map<number, BoxDetail>();
  for (const b of boxDetails ?? []) {
    byNo.set(Number(b.boxNo), b);
  }

  const used = new Map<number, { birds: number; weight: number }>();
  const add = (boxNo: number, birds: number, weight: number) => {
    const cur = used.get(boxNo) ?? { birds: 0, weight: 0 };
    used.set(boxNo, { birds: cur.birds + birds, weight: cur.weight + weight });
  };

  const consumeBox = (boxNo: number, birdsTaken: number, weightTaken: number) => {
    const orig = byNo.get(boxNo);
    const origBirds = Number(orig?.birds || 0);
    // All birds gone → box is done (ignore residual kg variance).
    if (origBirds > 0 && birdsTaken >= origBirds) {
      add(boxNo, FULLY_CONSUMED, FULLY_CONSUMED);
      return;
    }
    add(boxNo, birdsTaken, weightTaken);
  };

  rows.forEach((row) => {
    if (opts.excludeRowId != null && Number(row.id) === Number(opts.excludeRowId)) return;
    // Pending `[ORDER]` plan stubs must not consume pickup boxes.
    if (!isDeliveredRow(row)) return;
    const extra = row as ShopDelivery & {
      perBoxData?: { boxNo: number; birds: number; weight: number }[];
      selectedBoxIds?: number[];
      mortKg?: number;
    };
    const per = Array.isArray(extra.perBoxData) ? extra.perBoxData : [];
    const selected: number[] = Array.isArray(extra.selectedBoxIds)
      ? extra.selectedBoxIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];

    if (per.length) {
      per.forEach((pb) =>
        consumeBox(Number(pb.boxNo), Number(pb.birds || 0), Number(pb.weight || 0))
      );
      return;
    }

    if (selected.length === 1) {
      consumeBox(
        selected[0],
        Number(row.birds || 0) + Number(row.mortality || 0),
        Number(row.weight || 0) + Number(extra.mortKg || 0)
      );
      return;
    }

    if (selected.length > 1) {
      selected.forEach((id) => add(id, FULLY_CONSUMED, FULLY_CONSUMED));
      return;
    }

    // Fallback: birds/weight saved but selectedBoxIds missing — still mark
    // delivered quantity against nothing selectable (defense for old rows).
  });
  return used;
}

/** Pending (not-yet-delivered) boxes derived from live delivery rows. */
export function pendingBoxesFromRows(
  boxDetails: BoxDetail[],
  rows: ShopDelivery[],
  opts: { excludeRowId?: number | null } = {}
): BoxRemaining[] {
  const used = computeRemainingBoxes(boxDetails, rows, opts);
  return boxDetails
    .map((b) => {
      const boxNo = Number(b.boxNo);
      const consumed = used.get(boxNo) ?? { birds: 0, weight: 0 };
      let remainBirds = Math.max(0, Number(b.birds || 0) - consumed.birds);
      let remainWeight = Math.max(0, Number(b.weight || 0) - consumed.weight);
      // Zero birds left ⇒ box is fully delivered; drop residual kg.
      if (remainBirds <= 0) {
        remainBirds = 0;
        remainWeight = 0;
      }
      return { ...b, boxNo, birds: remainBirds, weight: remainWeight } as BoxRemaining;
    })
    .filter((b) => b.birds > 0);
}

/** Assigned shops still awaiting a captured Step 4 delivery. */
export function pendingShopsFromRows(rows: ShopDelivery[]): number {
  const assigned = new Set<number>();
  const captured = new Set<number>();
  for (const row of rows) {
    const shopId = Number(row.shopId);
    if (!Number.isFinite(shopId) || shopId <= 0) continue;
    if (String(row.remarks ?? "").trim().startsWith("[ORDER]")) assigned.add(shopId);
    if (isDeliveredRow(row)) captured.add(shopId);
  }
  if (assigned.size === 0) return 0;
  let pending = 0;
  for (const id of assigned) {
    if (!captured.has(id)) pending += 1;
  }
  return pending;
}

/**
 * The `[ORDER]` remarks marker on a shop's assignment plan row, or "" when
 * this trip carries no assignment plan for that shop.
 */
export function orderRemarksForShop(rows: ShopDelivery[], shopId: number): string {
  const target = Number(shopId);
  for (const row of rows ?? []) {
    if (Number(row.shopId) !== target) continue;
    const remarks = String(row.remarks ?? "").trim();
    if (remarks.startsWith("[ORDER]")) return remarks;
  }
  return "";
}

/**
 * The remarks a Step 4 capture MUST be saved with.
 *
 * A delivery captured for a shop that Order Assignment put on this trip has to
 * carry that shop's `[ORDER] O:<tripNo>` marker: Delivery Tracking identifies
 * a shop's delivered rows by it (`isOrderPlanRow(row) && isCapturedRow(row)`),
 * so a capture saved without the marker leaves the tracking table's
 * "N shops / M delivered" count stuck at 0 no matter how many shops the driver
 * delivers and saves.
 *
 * Any note the driver typed is preserved, appended after the marker. An edit
 * loads the row's own remarks into the field, so an existing marker is stripped
 * from the note first — re-saving can never duplicate it.
 */
export function captureRemarksFor(
  rows: ShopDelivery[],
  shopId: number,
  typed: string
): string {
  const marker = orderRemarksForShop(rows, shopId);
  const note = String(typed ?? "")
    .replace(/\[ORDER\]\s*O:[^\s|]+/g, "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
  if (!marker) return note;
  return note ? `${marker} | ${note}` : marker;
}

/** Shop ids present on the assignment plan (`[ORDER]` rows). */
export function assignedShopIdsFromRows(rows: ShopDelivery[]): Set<number> {
  const ids = new Set<number>();
  for (const row of rows) {
    const shopId = Number(row.shopId);
    if (!Number.isFinite(shopId) || shopId <= 0) continue;
    if (String(row.remarks ?? "").trim().startsWith("[ORDER]")) ids.add(shopId);
  }
  return ids;
}

/**
 * The route order of the shops on the assignment plan (`[ORDER]` rows), keyed
 * shopId → `serialNo`. This is the "Shops (N)" list — the shops Order
 * Assignment put on this vehicle — and it is what floats them to the TOP of
 * the Step 4 shop dropdown. Shops added later in Step 4 are not part of it.
 */
export function assignedShopOrderFromRows(rows: ShopDelivery[]): Map<number, number> {
  const order = new Map<number, number>();
  for (const row of rows) {
    const shopId = Number(row.shopId);
    if (!Number.isFinite(shopId) || shopId <= 0) continue;
    if (!String(row.remarks ?? "").trim().startsWith("[ORDER]")) continue;
    const serial = Number(row.serialNo) || 0;
    const prev = order.get(shopId);
    if (prev === undefined || serial < prev) order.set(shopId, serial);
  }
  return order;
}

/**
 * Order the Step 4 shop dropdown: the shops on the assignment plan FIRST, in
 * their route (`serialNo`) order — exactly the "Shops (N)" list — then EVERY
 * remaining shop ALPHABETICALLY.
 *
 * The whole shop master is always offered; the Order Assignment only decides
 * what floats to the top, it never hides the rest. Input is not mutated.
 */
export function sortShopsAssignedFirst<T extends { value: number; label: string }>(
  options: readonly T[],
  assignedOrder: Map<number, number>
): T[] {
  const rankOf = (o: T) => assignedOrder.get(Number(o.value));
  return [...options].sort((a, b) => {
    const aRank = rankOf(a);
    const bRank = rankOf(b);
    const aAssigned = aRank !== undefined;
    const bAssigned = bRank !== undefined;
    // Assigned shops outrank everything else.
    if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
    // Among themselves they keep the assignment's route order.
    if (aAssigned && bAssigned && aRank !== bRank) return aRank! - bRank!;
    // Everyone else — and any assigned tie — is alphabetical.
    return a.label.localeCompare(b.label);
  });
}

/** A delivery row is "captured / delivered" once Step 4 has real delivery
 *  evidence — capture time, or (for non-plan Add-Shop rows) selected boxes /
 *  birds/weight. Bare `[ORDER]` plan rows may carry assigned `selectedBoxIds`
 *  from Order Assignment; those stay pending until a real capture stamps a
 *  time (otherwise remaining-box math locks those boxes and Step 4 rejects
 *  the shop with "available weight" errors). */
export function isDeliveredRow(row: ShopDelivery): boolean {
  const extra = row as ShopDelivery & {
    autoCaptureTime?: string;
    deliveredAt?: string;
    deliveryTime?: string;
  };
  if (extra.autoCaptureTime || extra.deliveredAt || extra.deliveryTime) return true;
  const remarks = String(row.remarks ?? "").trim();
  // Order-assignment plan stubs are reference-only until captured.
  if (remarks.startsWith("[ORDER]")) return false;
  const boxes = Array.isArray(row.selectedBoxIds) ? row.selectedBoxIds.length : 0;
  if (boxes > 0) return true;
  return Number(row.birds) > 0 || Number(row.weight) > 0;
}

/** Delivered-shop identity keyed by BOTH shop id and shop name, so a row whose
 *  id does not resolve still matches by name (and vice versa). */
export function buildDeliveredShopKeys(rows: ShopDelivery[]): {
  ids: Set<number>;
  names: Set<string>;
} {
  const ids = new Set<number>();
  const names = new Set<string>();
  rows.forEach((row) => {
    if (!isDeliveredRow(row)) return;
    const id = Number(row.shopId);
    if (id > 0) ids.add(id);
    const name = String(row.shopName ?? "").trim().toLowerCase();
    if (name) names.add(name);
  });
  return { ids, names };
}

/**
 * The Step 4 header "Shops (N)" count.
 *
 * It exists ONLY once the Order Assignment for this vehicle has actually been
 * SUBMITTED — Finish Assignment tags the trip remarks with `order:<tripNo>`,
 * Save Progress does not. Before that the button reads 0, because:
 *
 *   • counting the `[ORDER]` plan rows a Save Progress left behind advertises
 *     shops the driver never received — the reported "Shops (11) on
 *     TS07UB1111 and I haven't submitted anything yet";
 *   • falling back to the shop master advertises every shop in the system;
 *   • counting the trip's own delivery rows shows a number nobody assigned
 *     and that has nothing to do with the order.
 *
 * There is no assignment sheet to count until the assignment is submitted, so
 * 0 is the honest answer.
 */
export function step4ShopsCount(
  shops: readonly unknown[],
  rows: ShopDelivery[],
  assignmentSubmitted: boolean
): number {
  if (!assignmentSubmitted) return 0;
  if (!shops || shops.length === 0) return 0;
  const { ids, names } = buildDeliveredShopKeys(rows ?? []);
  const source = orderAssignedShops(shops, rows ?? []);
  return source.filter((shop) => {
    const s = (shop ?? {}) as { id?: unknown; shopId?: unknown; shopName?: unknown; name?: unknown };
    const id = Number(s.id ?? s.shopId ?? 0);
    const name = String(s.shopName ?? s.name ?? "").trim().toLowerCase();
    const delivered = (id > 0 && ids.has(id)) || (Boolean(name) && names.has(name));
    return !delivered;
  }).length;
}

/** Order-assignment shops = every shop present in the delivery rows (pending
 *  `[ORDER]` plan rows plus captured deliveries), keyed to its route order
 *  (`serialNo`). When a delivered shop replaces its `[ORDER]` row, its id
 *  still lives here so it stays selectable for a duplicate capture. */
export function shopIdsFromRows(
  rows: ShopDelivery[]
): { ids: Set<number>; order: Map<number, number> } {
  const ids = new Set<number>();
  const order = new Map<number, number>();
  for (const row of rows) {
    const shopId = Number(row.shopId);
    if (!Number.isFinite(shopId) || shopId <= 0) continue;
    ids.add(shopId);
    const serial = Number(row.serialNo) || 0;
    const prev = order.get(shopId);
    if (prev === undefined || serial < prev) order.set(shopId, serial);
  }
  return { ids, order };
}

/** Shop id off either of the two master shapes the trip pages pass around. */
function shopIdOf(shop: unknown): number {
  const s = (shop ?? {}) as { id?: unknown; shopId?: unknown };
  return Number(s.id ?? s.shopId ?? 0);
}

/**
 * The shops a Step 4 delivery may address: ONLY the shops this trip carries
 * in its delivery rows — i.e. exactly the shops Order Assignment assigned to
 * this vehicle — never the whole shop master.
 *
 * This is what keeps the header "Shops (N)" count, the Add-Shop dropdown and
 * the assignment-sheet PDF equal to the number of shops that were assigned:
 * assign 1 shop and Step 4 offers 1 shop. A plain manual trip (no delivery
 * rows at all) falls back to the full master list, so Step 4 still works when
 * the trip was never assigned from Orders.
 */
export function orderAssignedShops<T>(shops: readonly T[], rows: ShopDelivery[]): T[] {
  const list = shops ?? [];
  const { ids } = shopIdsFromRows(rows ?? []);
  if (ids.size === 0) return [...list];
  return list.filter((shop) => ids.has(shopIdOf(shop)));
}

/** Remaining map keyed by boxNo (mirrors `pendingBoxesFromRows` shape). */
export function remainingBoxesByNumber(
  boxDetails: BoxDetail[],
  rows: ShopDelivery[],
  opts: { excludeRowId?: number | null } = {}
): Map<number, { birds: number; weight: number }> {
  const used = computeRemainingBoxes(boxDetails, rows, opts);
  const remaining = new Map<number, { birds: number; weight: number }>();
  boxDetails.forEach((b) => {
    const boxNo = Number(b.boxNo);
    const consumed = used.get(boxNo) ?? { birds: 0, weight: 0 };
    let birds = Math.max(0, Number(b.birds || 0) - consumed.birds);
    let weight = Math.max(0, Number(b.weight || 0) - consumed.weight);
    if (birds <= 0) {
      birds = 0;
      weight = 0;
    }
    remaining.set(boxNo, { birds, weight });
  });
  return remaining;
}