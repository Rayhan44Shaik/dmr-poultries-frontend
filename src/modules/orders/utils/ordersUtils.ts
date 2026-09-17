// src/modules/orders/utils/ordersUtils.ts
// Pure business logic for the Orders module — no React, no API.
//
// The 3-tab workflow is DERIVED entirely from persisted data on every load:
//   - collection containers  (no vehicle, step flags + plan rows)
//   - eligible vehicle trips (Step 2 complete, not yet delivered)
//   - delivery tracking      (Step 4 rows are the source of truth)
// Refreshing always reproduces the correct state — no local business state.

import type { BoxDetail, ShopDelivery, Trip } from "../../../shared/trip";
import {
  isOrderPlanRemarks,
  parseOrderRef,
  type OrderShopRow,
  type OrdersDeliveryState,
  type OrdersEligibleVehicle,
  type OrdersProgress,
  type OrdersTrip,
  type ShopOrderQuantities,
} from "../types";

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ─── Row helpers ─────────────────────────────────────────────────────────────

/** True for rows the Orders module wrote (original order plan). */
export function isOrderPlanRow(row: ShopDelivery): boolean {
  return isOrderPlanRemarks(row.remarks);
}

/** True when Step 4 actually captured this delivery (real delivery data). */
export function isCapturedRow(row: ShopDelivery): boolean {
  return Boolean(
    row.autoCaptureTime ||
      (row as { deliveredAt?: string }).deliveredAt ||
      (row as { deliveryTime?: string }).deliveryTime
  );
}

/** The persisted delivery rows of a trip, in delivery (serial) order. */
export function rowsInSequence(trip: Trip): ShopDelivery[] {
  const rows = Array.isArray(trip.deliveries) ? trip.deliveries : [];
  return [...rows].sort((a, b) => {
    const sa = num(a.serialNo ?? a.id);
    const sb = num(b.serialNo ?? b.id);
    if (sa !== sb) return sa - sb;
    return num(a.id) - num(b.id);
  });
}

/** First occurrence of each shopId wins — Collection / Assignment never show duplicate shops. */
export function uniqueShopRows<T extends { shopId?: number | null }>(rows: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    const shopId = num(row.shopId);
    if (!shopId || seen.has(shopId)) continue;
    seen.add(shopId);
    out.push(row);
  }
  return out;
}

/** Boxes carried by one delivery row (plan rows store the box count). */
export function rowBoxes(row: ShopDelivery): number {
  return Math.max(0, num(row.boxNo ?? row.selectedBoxIds?.length));
}

/** Re-exported for consumers of the breakdown helpers. */
export type { ShopOrderQuantities } from "../types";

/**
 * Boxes ACTUALLY DELIVERED on a captured Step 4 row. Step 4 deselects the
 * boxes that were not delivered and rewrites `boxNo` to the delivered
 * count, so the row's selected boxes are the delivered quantity. Falls back
 * to `boxNo` when no selection is persisted.
 */
export function deliveredRowBoxes(row: ShopDelivery): number {
  if (Array.isArray(row.selectedBoxIds) && row.selectedBoxIds.length > 0) {
    return row.selectedBoxIds.length;
  }
  return rowBoxes(row);
}

// ─── Trip classification ─────────────────────────────────────────────────────

/** True when a trip has at least one Orders plan row. */
export function hasOrderRows(trip: Trip): boolean {
  return rowsInSequence(trip).some(isOrderPlanRow);
}

/**
 * A collection container: NO vehicle (vehicleId 0/empty), Orders plan rows,
 * not deleted. startStepSubmitted = "collection finished (collected)".
 */
export function isOrderContainer(trip: Trip): boolean {
  return (
    trip.deleted !== true &&
    (trip.vehicleId == null || trip.vehicleId === 0) &&
    !trip.vehicleNo &&
    hasOrderRows(trip)
  );
}

/**
 * Container whose collection was finished via Finish Collection.
 * Assignment does NOT require this — Save Progress is enough for Tab 2.
 */
export function isCollectedOrder(trip: Trip): boolean {
  return isOrderContainer(trip) && trip.startStepSubmitted === true;
}

/** Container still being collected → the single Tab 1 working collection. */
export function isActiveCollection(trip: Trip): boolean {
  return isOrderContainer(trip) && trip.startStepSubmitted !== true;
}

/**
 * A vehicle trip eligible for order assignment: Step 2 (farm) submitted,
 * Step 4 (deliveries) NOT submitted, vehicle set.
 *
 * Trips that already carry PARTIAL order rows stay eligible (their
 * `alreadyAssigned` boxes are deducted from the available capacity, and the
 * assignment editor resumes on them). Fully finished assignments set
 * deliveryStepSubmitted and are therefore excluded here — a vehicle that
 * already delivered an order is locked.
 */
export function isEligibleVehicleTrip(trip: Trip): boolean {
  return (
    trip.deleted !== true &&
    trip.farmStepSubmitted === true &&
    trip.deliveryStepSubmitted !== true &&
    (trip.vehicleId != null && trip.vehicleId > 0)
  );
}

/**
 * True when Finish Assignment tagged the trip remarks with `order:<tripNo>`.
 * Survives a lost `[ORDER]` plan-row list so the trip still appears in
 * Delivery Tracking (with `assignmentIncomplete`) instead of vanishing.
 */
export function hasOrderTag(trip: Trip): boolean {
  return String(trip.remarks ?? "")
    .split("|")
    .some((tag) => tag.trim().startsWith("order:"));
}

/**
 * A trip with an assigned order whose delivery progress is tracked (Tab 3).
 * Requires Finish Assignment (`deliveryStepSubmitted`) — never a premature
 * row — plus either the `[ORDER]` plan rows or the `order:` remarks tag
 * (so a missing shop list still shows, never hides).
 */
export function isTrackingTrip(trip: Trip): boolean {
  return (
    trip.deleted !== true &&
    trip.deliveryStepSubmitted === true &&
    (hasOrderRows(trip) || hasOrderTag(trip))
  );
}

/** Next collection container tripNo for today (ORD-YYYYMMDD-NN). */
export function nextOrderTripNo(allTrips: Trip[], now = new Date()): string {
  const date = localToday(now);
  const stamp = date.replace(/-/g, "");
  let max = 0;
  for (const t of allTrips) {
    const m = String(t.tripNo ?? "").match(/^ORD-(\d{8})-(\d+)$/);
    if (m && m[1] === stamp) max = Math.max(max, num(m[2]));
  }
  return `ORD-${stamp}-${String(max + 1).padStart(2, "0")}`;
}

/** One-week operational window (project date convention: tripDate). */
export function isWithinOneWeek(dateStr: string | undefined, now = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // current 7-day window, inclusive
  start.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

// ─── Vehicle capacity ────────────────────────────────────────────────────────

/** Vehicle master box capacity for a trip's vehicle (fallback: trip field). */
export function vehicleCapacityOf(
  trip: Trip,
  vehicles: Array<{ id: number; noOfBoxes?: number }>
): number {
  const vehicle = trip.vehicleId ? vehicles.find((v) => v.id === trip.vehicleId) : undefined;
  return Math.max(0, num(vehicle?.noOfBoxes) || num(trip.vehicleBoxCapacity) || 0);
}

/** Boxes already assigned to a trip (all UNCAPTURED Orders plan rows on it). */
export function assignedBoxesOnTrip(trip: Trip): number {
  return rowsInSequence(trip).reduce(
    (sum, row) => (isOrderPlanRow(row) && !isCapturedRow(row) ? sum + rowBoxes(row) : sum),
    0
  );
}

/**
 * Boxes ONE vehicle carries of one shop's order, measured from the trip's
 * rows for that shop: the UNCAPTURED plan rows are the assigned share (they
 * keep the assigned box count even after partial Step 4 captures, which the
 * Orders module persists as separate captured rows). When every plan row
 * was captured in place (external Step 4 edits), the captured boxes are the
 * closest truth for what the vehicle took.
 */
export function planShareBoxes(rows: ShopDelivery[]): number {
  const uncaptured = rows.filter((r) => !isCapturedRow(r));
  if (uncaptured.length > 0) return uncaptured.reduce((s, r) => s + rowBoxes(r), 0);
  return rows.filter(isCapturedRow).reduce((s, r) => s + deliveredRowBoxes(r), 0);
}

/** Enrich an eligible vehicle trip with capacity facts for the UI. */
export function toEligibleVehicle(
  trip: Trip,
  vehicles: Array<{ id: number; noOfBoxes?: number }>
): OrdersEligibleVehicle {
  const capacity = vehicleCapacityOf(trip, vehicles);
  const alreadyAssigned = assignedBoxesOnTrip(trip);
  return {
    trip,
    capacity,
    alreadyAssigned,
    available: Math.max(0, capacity - alreadyAssigned),
  };
}

/** Rows of a vehicle trip that belong to one specific collection order. */
export function orderRowsOnTrip(trip: Trip, orderTripNo: string): ShopDelivery[] {
  return rowsInSequence(trip).filter(
    (row) => isOrderPlanRow(row) && parseOrderRef(row.remarks) === orderTripNo
  );
}

// ─── Progress (Step 4 is the source of truth) ───────────────────────────────

/**
 * Derives the delivery progress of an order-assigned trip purely from the
 * persisted Step 4 rows:
 * - original shops  = shops whose plan rows carry the Orders marker
 * - delivered shop  = an original shop with at least one captured row
 * - additional shop = a shop in Step 4 data that was never in the order
 *
 * `originalQuantities` (from the day's collection container) supplies the
 * ORDERED totals — Step 4 rewrites vehicle rows in place, so the row itself
 * no longer carries the ordered box count after a delivery.
 */
export function computeOrdersProgress(
  trip: Trip,
  originalQuantities?: ShopOrderQuantities
): OrdersProgress {
  const rows = rowsInSequence(trip);

  const planShopIds = new Set<number>();
  const capturedShopIds = new Set<number>();
  let totalBoxes = 0;
  let totalWeight = 0;
  let totalBirds = 0;
  let deliveredBoxes = 0;
  let deliveredBirds = 0;
  let deliveredWeight = 0;

  const planByShop = new Map<number, ShopDelivery>();
  for (const row of rows) {
    const shopId = num(row.shopId);
    if (!shopId) continue;
    if (isOrderPlanRow(row) && !planByShop.has(shopId)) {
      planByShop.set(shopId, row);
      planShopIds.add(shopId);
    }
    if (isCapturedRow(row)) capturedShopIds.add(shopId);
  }
  void capturedShopIds;

  for (const [shopId, row] of planByShop) {
    const ordered = originalQuantities?.get(shopId);
    totalBoxes += ordered ? ordered.boxes : rowBoxes(row);
    totalWeight += ordered ? ordered.weight : num(row.farmWeight ?? row.weight);
    totalBirds += ordered ? ordered.birds : num(row.farmBirds ?? row.birds);
  }
  // Delivered totals per shop — a shop can have several captures (each partial
  // delivery adds one), so the balance is measured shop by shop, never per row.
  const capturedByShop = new Map<number, { boxes: number; birds: number; weight: number }>();
  for (const row of rows) {
    if (!isOrderPlanRow(row) || !isCapturedRow(row)) continue;
    const shopId = num(row.shopId);
    if (!shopId) continue;
    const acc = capturedByShop.get(shopId) ?? { boxes: 0, birds: 0, weight: 0 };
    acc.boxes += deliveredRowBoxes(row);
    // Step 4 rewrites the row in place: birds/weight = delivered values.
    acc.birds += num(row.birds);
    acc.weight += num(row.weight);
    capturedByShop.set(shopId, acc);
  }
  for (const acc of capturedByShop.values()) {
    deliveredBoxes += acc.boxes;
    deliveredBirds += acc.birds;
    deliveredWeight += acc.weight;
  }

  // ── PENDING = what the order asked for minus what actually came in ───────
  // A partial delivery (10 of 25 boxes) leaves 15 boxes pending, and that shop
  // is counted separately so the balance never looks like a finished shop.
  let pendingBoxes = 0;
  let pendingBirds = 0;
  let pendingWeight = 0;
  let partDeliveredShops = 0;
  for (const [shopId, row] of planByShop) {
    const ordered = originalQuantities?.get(shopId);
    const orderedBoxes = ordered ? ordered.boxes : rowBoxes(row);
    const orderedBirds = ordered ? ordered.birds : num(row.farmBirds ?? row.birds);
    const orderedWeight = ordered ? ordered.weight : num(row.farmWeight ?? row.weight);
    const got = capturedByShop.get(shopId);
    pendingBoxes += Math.max(0, orderedBoxes - (got?.boxes ?? 0));
    pendingBirds += Math.max(0, orderedBirds - (got?.birds ?? 0));
    pendingWeight += Math.max(0, orderedWeight - (got?.weight ?? 0));
    if (got && got.boxes > 0 && got.boxes < orderedBoxes) partDeliveredShops += 1;
  }

  // Fallback when the marker was lost (e.g. remarks edited in Step 4):
  // every shop in the data is treated as an original shop.
  const allShopIds = new Set<number>();
  for (const row of rows) {
    const shopId = num(row.shopId);
    if (shopId) allShopIds.add(shopId);
  }
  const originalShopIds = planShopIds.size > 0 ? planShopIds : allShopIds;

  let additionalShopCount = 0;
  if (planShopIds.size > 0) {
    for (const shopId of allShopIds) {
      if (!planShopIds.has(shopId)) additionalShopCount += 1;
    }
  }

  // Count captured rows even when the [ORDER] marker was lost, so a
  // tracking trip with assignmentIncomplete still has honest delivered totals.
  if (planByShop.size === 0) {
    capturedByShop.clear();
    deliveredBoxes = 0;
    deliveredBirds = 0;
    deliveredWeight = 0;
    for (const row of rows) {
      if (!isCapturedRow(row)) continue;
      const shopId = num(row.shopId);
      if (!shopId) continue;
      const acc = capturedByShop.get(shopId) ?? { boxes: 0, birds: 0, weight: 0 };
      acc.boxes += deliveredRowBoxes(row);
      acc.birds += num(row.birds);
      acc.weight += num(row.weight);
      capturedByShop.set(shopId, acc);
    }
    for (const acc of capturedByShop.values()) {
      deliveredBoxes += acc.boxes;
      deliveredBirds += acc.birds;
      deliveredWeight += acc.weight;
    }
    if (totalBoxes === 0) {
      for (const shopId of originalShopIds) {
        const ordered = originalQuantities?.get(shopId);
        const got = capturedByShop.get(shopId);
        totalBoxes += ordered ? ordered.boxes : (got?.boxes ?? 0);
        totalWeight += ordered ? ordered.weight : (got?.weight ?? 0);
        totalBirds += ordered ? ordered.birds : (got?.birds ?? 0);
      }
    }
    for (const shopId of originalShopIds) {
      const ordered = originalQuantities?.get(shopId);
      const orderedBoxes = ordered ? ordered.boxes : (capturedByShop.get(shopId)?.boxes ?? 0);
      const orderedBirds = ordered ? ordered.birds : (capturedByShop.get(shopId)?.birds ?? 0);
      const orderedWeight = ordered ? ordered.weight : (capturedByShop.get(shopId)?.weight ?? 0);
      const got = capturedByShop.get(shopId);
      pendingBoxes += Math.max(0, orderedBoxes - (got?.boxes ?? 0));
      pendingBirds += Math.max(0, orderedBirds - (got?.birds ?? 0));
      pendingWeight += Math.max(0, orderedWeight - (got?.weight ?? 0));
      if (got && got.boxes > 0 && orderedBoxes > 0 && got.boxes < orderedBoxes) {
        partDeliveredShops += 1;
      }
    }
  }

  const totalShops = originalShopIds.size;
  // Fully delivered shops only — a partial (15 of 21) is NOT "Delivered".
  let fullyDeliveredShops = 0;
  for (const shopId of originalShopIds) {
    const ordered = originalQuantities?.get(shopId);
    const plan = planByShop.get(shopId);
    const orderedBoxes = ordered ? ordered.boxes : plan ? rowBoxes(plan) : 0;
    const gotBoxes = capturedByShop.get(shopId)?.boxes ?? 0;
    if (orderedBoxes > 0 && gotBoxes >= orderedBoxes) fullyDeliveredShops += 1;
    else if (orderedBoxes === 0 && gotBoxes > 0 && planByShop.size === 0) fullyDeliveredShops += 1;
  }
  const deliveredShopsCount = fullyDeliveredShops;
  const pendingShops = Math.max(0, totalShops - deliveredShopsCount - partDeliveredShops);

  // ── AUTHORITATIVE completion (CRITICAL RULE #4 / #5) ─────────────────
  // A trip is "Completed" ONLY when the existing Trip Entry lifecycle says
  // so: `trips.status = 'Completed'` (set by Trip Entry's Step 5 submission
  // / status transition — the same field the Recent Trips list uses).
  // Delivery percentage, 100% boxes, all shops delivered or a Step 4
  // submission ALONE are NEVER sufficient — Orders keeps no independent
  // completion state.
  const tripCompleted = isLifecycleCompleted(trip);

  let status: OrdersProgress["status"];
  if (tripCompleted) {
    status = "Completed";
  } else if (deliveredShopsCount === 0 && partDeliveredShops === 0) {
    status = "Assigned";
  } else {
    status = "In Progress";
  }

  let deliveryState: OrdersDeliveryState;
  if (totalShops > 0 && pendingShops === 0 && partDeliveredShops === 0 && pendingBoxes === 0) {
    deliveryState = "complete";
  } else if (partDeliveredShops > 0) {
    deliveryState = "partial";
  } else if (deliveredShopsCount > 0) {
    deliveryState = "in_progress";
  } else {
    deliveryState = "pending";
  }

  return {
    totalShops,
    totalBoxes,
    totalWeight: Number(totalWeight.toFixed(2)),
    totalBirds,
    deliveredShops: deliveredShopsCount,
    pendingShops,
    partDeliveredShops,
    pendingBoxes,
    pendingBirds,
    pendingWeight: Number(pendingWeight.toFixed(2)),
    deliveredBoxes,
    deliveredBirds,
    deliveredWeight: Number(deliveredWeight.toFixed(2)),
    additionalShopCount,
    status,
    deliveryState,
  };
}

/** Trip Entry lifecycle — the only thing that moves a trip between tables. */
export function isLifecycleCompleted(trip: Trip): boolean {
  return trip.status === "Completed" && trip.deleted !== true;
}

/**
 * Split tracking trips into the two Delivery Tracking tables.
 * Dedupes by trip.id so a refetch can never append the same trip twice,
 * and a trip can never sit in both tables at once.
 */
export function partitionTrackingTrips(trips: OrdersTrip[]): {
  pending: OrdersTrip[];
  completed: OrdersTrip[];
} {
  const pending: OrdersTrip[] = [];
  const completed: OrdersTrip[] = [];
  const seen = new Set<number>();
  for (const ot of trips) {
    const id = ot.trip.id;
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    if (isLifecycleCompleted(ot.trip)) completed.push(ot);
    else pending.push(ot);
  }
  return { pending, completed };
}

/** Delivered-shops percentage for the progress bar (0–100). */
export function deliveryProgressPct(progress: OrdersProgress | null | undefined): number {
  if (!progress || progress.totalShops <= 0) return 0;
  return Math.round((progress.deliveredShops / progress.totalShops) * 100);
}

/** Compact YYYY-MM-DD → DD/MM/YYYY (tracking Date column). */
export function formatDayShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Visible page range for "Showing X–Y of Z" (1-based, empty → 0–0). */
export function pageRange(
  total: number,
  page: number,
  pageSize: number
): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const from = (Math.max(1, page) - 1) * pageSize + 1;
  return { from, to: Math.min(from + pageSize - 1, total) };
}

/**
 * Client-side search haystack for one tracking trip. Includes trip / vehicle /
 * supervisor / driver / shop name / shop number / village — never invents
 * values. Empty pieces are skipped so they cannot match unrelated queries.
 */
export function trackingSearchHaystack(
  ot: OrdersTrip,
  extras: {
    supervisorMobile?: string;
    shopNumberOf?: (shopId: number) => string;
    villageOf?: (shopId: number, shopName: string) => string;
  } = {}
): string {
  const { trip, progress } = ot;
  const parts: string[] = [
    trip.tripNo,
    trip.vehicleNo,
    trip.supervisorName,
    trip.driverName,
    extras.supervisorMobile ?? "",
    progress?.status ?? "",
    progress?.deliveryState ?? "",
  ];
  for (const d of Array.isArray(trip.deliveries) ? trip.deliveries : []) {
    parts.push(d.shopName || "");
    if (extras.villageOf) parts.push(extras.villageOf(num(d.shopId), d.shopName || ""));
    if (extras.shopNumberOf) parts.push(extras.shopNumberOf(num(d.shopId)));
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function buildOrdersTrip(trip: Trip, originalQuantities?: ShopOrderQuantities): OrdersTrip {
  const rows = rowsInSequence(trip);
  const originalShopIds = new Set<number>();
  const additionalShopIds = new Set<number>();
  for (const row of rows) {
    const shopId = num(row.shopId);
    if (!shopId) continue;
    if (isOrderPlanRow(row)) originalShopIds.add(shopId);
  }
  const hasMarker = originalShopIds.size > 0;
  if (hasMarker) {
    for (const row of rows) {
      const shopId = num(row.shopId);
      if (shopId && !originalShopIds.has(shopId)) additionalShopIds.add(shopId);
    }
  }
  const tracking = isTrackingTrip(trip);
  const progress = tracking ? computeOrdersProgress(trip, originalQuantities) : null;
  return {
    trip,
    progress,
    originalShopIds,
    additionalShopIds,
    originalQuantities,
    assignmentIncomplete: tracking && !hasOrderRows(trip),
  };
}

// ─── Collection editor: boxes + quantities ──────────────────────────────────

/**
 * Assigns real pickup boxes to shop rows in sequence order (the existing
 * Step 4 box logic: each box belongs to one shop). Returns a NEW array of
 * rows with selectedBoxIds + birds/weight derived from the assigned boxes.
 * When the trip has no pickup box data yet, quantities stay as entered
 * (honest "no data yet" state — no invented calculations).
 */
export function assignBoxesToRows(
  rows: OrderShopRow[],
  boxDetails: BoxDetail[]
): OrderShopRow[] {
  const boxes = [...(boxDetails ?? [])].sort((a, b) => num(a.boxNo) - num(b.boxNo));
  const used = new Set<number>();
  const out: OrderShopRow[] = [];

  for (const row of rows) {
    const wanted = Math.max(0, Math.floor(num(row.boxNo)));
    const selected: number[] = [];
    let birds = 0;
    let weight = 0;
    for (const box of boxes) {
      if (selected.length >= wanted) break;
      const key = num(box.boxNo);
      if (used.has(key)) continue;
      used.add(key);
      selected.push(key);
      birds += num(box.birds);
      weight += num(box.weight);
    }
    out.push({
      ...row,
      selectedBoxIds: selected,
      boxNo: selected.length > 0 ? selected.length : row.boxNo,
      birds: selected.length > 0 ? birds : num(row.birds),
      weight: selected.length > 0 ? Number(weight.toFixed(2)) : num(row.weight),
    });
  }
  return out;
}

/** Live summary of collection/assignment rows. */
export function collectionTotals(rows: OrderShopRow[]) {
  let boxes = 0;
  let weight = 0;
  let birds = 0;
  for (const row of rows) {
    boxes += num(row.boxNo);
    weight += num(row.weight);
    birds += num(row.birds);
  }
  return {
    totalShops: rows.length,
    totalBoxes: boxes,
    totalWeight: Number(weight.toFixed(2)),
    totalBirds: birds,
  };
}

/** A collection row is "Entered" once it has boxes (and birds where known). */
export function rowStatus(
  row: OrderShopRow,
  hasBoxData: boolean
): "Entered" | "Draft" {
  if (num(row.boxNo) > 0) {
    if (!hasBoxData || num(row.birds) > 0) return "Entered";
  }
  return "Draft";
}

/** Weight derived from the trip's average bird weight (Step 2 data). */
export function weightForBirds(birds: number, avgBirdWeight: number | null | undefined): number {
  const b = Math.max(0, num(birds));
  const w = num(avgBirdWeight);
  if (!b || !w) return 0;
  return Number((b * w).toFixed(2));
}

// ─── Farm location ───────────────────────────────────────────────────────────

/** Segments that name an area, never a city (district / state / pincode). */
const FARM_AREA_WORDS =
  /(?:\bdist(?:rict)?\.?\b|\bmandal\b|\bmdal\b|\bvillage\b|\bstate\b|\bpin(?:code)?\b|andhra pradesh|telangana|\b\d{6}\b)/i;
/** Segments that are a plot / door detail, never a city. */
const FARM_PLOT_WORDS = /(?:\bsurvey\b|\bsy\.?\b|\bplot\b|\bd\.?\s?no\b|\bdoor\b|\bflat\b)/i;
/** Trailing suffixes that hide the place name ("Ibrahimpatnam Road"). */
const FARM_PLACE_SUFFIX =
  /\s+(?:road|rd|highway|hwy|nh\s?\d*|sh\s?\d*|street|st|nagar|colony|phase|x\s?road|junction|jnc|circle|chowl?k|bazaar|bazar|bypass|ring road)$/i;

/**
 * The city / town of a farm address — a short, recognisable place name
 * ("Vijayawada", "Kodad") instead of the full address line.
 *
 * Reads the address from the last segment backwards and returns the first
 * place name: district / state / pincode / plot lines are skipped, and a
 * place hidden behind a suffix ("Ibrahimpatnam Road") is reduced to the place
 * itself. Falls back to the farm name, then the raw value — never empty.
 */
export function farmCityOf(trip: Pick<Trip, "farmAddress" | "sourceFarm">): string {
  const raw =
    String(trip.farmAddress ?? "").trim() || String(trip.sourceFarm ?? "").trim();
  if (!raw) return "—";
  const segments = raw
    .split(/[,;\n|]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (FARM_AREA_WORDS.test(seg) || FARM_PLOT_WORDS.test(seg)) continue;
    const place = seg.replace(FARM_PLACE_SUFFIX, "").replace(/[,.\s]+$/, "").trim();
    // A bare number / initials is not a city either.
    if (place && /[A-Za-z\u0C00-\u0C7F]/.test(place)) return place;
  }
  // Every segment was structural — drop the area words from the last one.
  const last = (segments[segments.length - 1] ?? raw)
    .replace(FARM_AREA_WORDS, "")
    .replace(FARM_PLACE_SUFFIX, "")
    .replace(/[,.\s]+$/, "")
    .trim();
  return last || raw;
}

// ─── Day-based operational dates (local timezone — the user's day) ──────────

/** Local calendar date (YYYY-MM-DD) — the operational day. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

/** Add days to a YYYY-MM-DD date (local, no timezone drift). */
export function addLocalDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** True when the day is in the past (ISO dates compare lexicographically). */
export function isPastDay(day: string, today: string): boolean {
  return day < today;
}

// ─── Collection auto-close window ────────────────────────────────────────────

/**
 * An operational day's Order Collection stays open for 48 hours from the start
 * of that day: the 04/09 collection can still be edited on 05/09 and is
 * AUTO-CLOSED at 06/09 12:00 AM — finished or not. The clock, not the
 * "Finish Collection" button, decides when a day stops accepting entries.
 */
export const COLLECTION_GRACE_DAYS = 2;

/** Local midnight that ends the day's editing window (day + 2 days, 00:00). */
export function collectionDeadline(day: string): Date {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + COLLECTION_GRACE_DAYS);
  return d;
}

/** True once the window has passed — the day is closed by the clock. */
export function isCollectionAutoClosed(day: string, now = new Date()): boolean {
  const deadline = collectionDeadline(day);
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() >= deadline.getTime();
}

/** "06/09 12:00 AM" — the moment the day's collection closed. */
export function formatCollectionDeadline(day: string): string {
  const d = collectionDeadline(day);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" })} 12:00 AM`;
}

/** Compact chip label: "29 Aug". */
export function formatDayLabel(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Full label: "29 Aug 2026". */
export function formatDayFull(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Completed view: per-shop delivery breakdown ─────────────────────────────

export type ShopDeliveryBreakdownStatus =
  | "delivered"
  | "part_delivered"
  | "delivered_with_diff"
  | "not_delivered"
  | "not_listed";

export type ShopDeliveryBreakdown = {
  shopId: number;
  shopName: string;
  village: string;
  /** Shop Master number ("" when the master has none). */
  shopNumber: string;
  /** Shop Mobile — Shop Master only ("" when the master has none). */
  mobile: string;
  /** Sequence of the first row for this shop. */
  serialNo: number;
  /** Was this shop in the original Order Collection / Assignment? */
  ordered: boolean;
  orderedBoxes: number;
  orderedWeight: number;
  orderedBirds: number;
  /**
   * Boxes THIS vehicle is carrying for the shop (the assignment plan row).
   * The shop's order can be split over vehicles, so the deliverable balance
   * is measured against this, not against orderedBoxes.
   */
  tripBoxes: number;
  deliveredBoxes: number;
  deliveredWeight: number;
  deliveredBirds: number;
  /** Delivered - ordered (negative when short-delivered). */
  boxDifference: number;
  /** Delivered - ordered (negative when short-delivered). */
  birdDifference: number;
  deliveredAt: string | null;
  delivered: boolean;
  /** true = ADDED DURING DELIVERY (Step 4 delivered a shop that was never
   *  in the original order) — surfaced as NOT LISTED, never hidden. */
  additional: boolean;
  /** Delivered · Delivered with Difference · Not Delivered · Not Listed. */
  status: ShopDeliveryBreakdownStatus;
  /**
   * Boxes this vehicle collected for the shop (assignment share). Falls back
   * to orderedBoxes when the plan row has no tripBoxes. Always 0 for not-listed.
   */
  collectedBoxes: number;
  /** Boxes assigned to THIS vehicle (plan share). 0 for not-listed. */
  assignedBoxes: number;
  /** Boxes still open on this vehicle: max(0, assigned − delivered). */
  pendingBoxes: number;
};

/** Merges the persisted rows per shop into the detail-view columns.
 * Ordered values come from the ORIGINAL order (the collection container via
 * `originalQuantities` — authoritative, since Step 4 rewrites vehicle rows
 * in place); delivered values are the actual captured Step 4 figures.
 * Without container context it falls back to the row's own plan snapshot
 * (farmBirds/farmWeight keep the ordered birds/weight). */
export function buildShopBreakdown(
  rows: ShopDelivery[],
  originalShopIds: Set<number>,
  villageOf: (shopId: number, shopName: string) => string,
  originalQuantities?: ShopOrderQuantities,
  mobileOf?: (shopId: number) => string,
  shopNumberOf?: (shopId: number) => string
): ShopDeliveryBreakdown[] {
  type Acc = {
    first: ShopDelivery;
    captured: ShopDelivery[];
    plan: ShopDelivery | null;
  };
  const byShop = new Map<number, Acc>();
  for (const row of rows) {
    const shopId = num(row.shopId);
    if (!shopId) continue;
    const acc = byShop.get(shopId) ?? {
      first: row,
      captured: [],
      plan: null,
    };
    if (num(acc.first.serialNo ?? acc.first.id) > num(row.serialNo ?? row.id)) {
      acc.first = row;
    }
    if (isOrderPlanRow(row) && !acc.plan) acc.plan = row;
    if (isCapturedRow(row)) acc.captured.push(row);
    byShop.set(shopId, acc);
  }

  const out: ShopDeliveryBreakdown[] = [];
  for (const [shopId, acc] of byShop) {
    const plan = acc.plan ?? acc.first;
    const captured = acc.captured;
    const delivered = captured.length > 0;
    // ACTUAL Step 4 capture timestamp (never generated by the frontend).
    const deliveredAt = delivered
      ? captured
          .map((r) => String(r.autoCaptureTime ?? ""))
          .filter(Boolean)
          .sort()[0] ?? null
      : null;
    const ordered = originalQuantities?.get(shopId);
    const orderedBoxes = ordered
      ? ordered.boxes
      : num(plan.boxNo ?? plan.selectedBoxIds?.length);
    const orderedBirds = ordered ? ordered.birds : num(plan.farmBirds ?? plan.birds);
    const deliveredBoxes = captured.reduce((s, r) => s + deliveredRowBoxes(r), 0);
    const deliveredBirds = captured.reduce((s, r) => s + num(r.birds), 0);
    // NOT LISTED = Step 4 delivered a shop that was never in the original
    // order (no plan row for it). Shown, flagged — never discarded.
    const additional = originalShopIds.size > 0 && !originalShopIds.has(shopId);
    // Difference vs the ORIGINAL order:
    //  - not listed  → no original order, difference is "—" (0 here)
    //  - not delivered → delivered 0 vs ordered n → −n (visible shortfall)
    const boxDifference = additional ? 0 : deliveredBoxes - orderedBoxes;
    const birdDifference = additional ? 0 : deliveredBirds - orderedBirds;
    const status: ShopDeliveryBreakdownStatus = additional
      ? "not_listed"
      : !delivered
        ? "not_delivered"
        // PART DELIVERED — part of the order is in, the rest stays open.
        : deliveredBoxes > 0 && deliveredBoxes < orderedBoxes
          ? "part_delivered"
          : boxDifference < 0 || birdDifference < 0
            ? "delivered_with_diff"
            : "delivered";
    out.push({
      shopId,
      shopName: acc.first.shopName || "—",
      village: villageOf(shopId, acc.first.shopName || ""),
      shopNumber: shopNumberOf ? shopNumberOf(shopId) : "",
      mobile: mobileOf ? mobileOf(shopId) : "",
      serialNo: num(acc.first.serialNo ?? acc.first.id),
      ordered: !additional,
      orderedBoxes,
      tripBoxes: num(plan.boxNo ?? plan.selectedBoxIds?.length),
      orderedWeight: ordered ? ordered.weight : num(plan.farmWeight ?? plan.weight),
      orderedBirds,
      deliveredBoxes,
      deliveredWeight: Number(
        captured.reduce((s, r) => s + num(r.weight), 0).toFixed(2)
      ),
      deliveredBirds,
      boxDifference,
      birdDifference,
      deliveredAt,
      delivered,
      additional,
      status,
      collectedBoxes: additional ? 0 : orderedBoxes,
      assignedBoxes: additional
        ? 0
        : num(plan.boxNo ?? plan.selectedBoxIds?.length) > 0
          ? num(plan.boxNo ?? plan.selectedBoxIds?.length)
          : orderedBoxes,
      pendingBoxes: additional
        ? 0
        : Math.max(
            0,
            (num(plan.boxNo ?? plan.selectedBoxIds?.length) > 0
              ? num(plan.boxNo ?? plan.selectedBoxIds?.length)
              : orderedBoxes) - deliveredBoxes
          ),
    });
  }
  return out.sort((a, b) => a.serialNo - b.serialNo);
}

/**
 * Boxes still to be delivered for one shop on THIS vehicle (0 = complete).
 * Drives the shop-level capture: the input's maximum, and the "no duplicate"
 * lock. Measured against what the vehicle carries (tripBoxes) — a shop's
 * order can be split over vehicles — falling back to the shop's order.
 */
export function shopRemainingBoxes(row: {
  orderedBoxes: number;
  deliveredBoxes: number;
  tripBoxes?: number;
}): number {
  const basis = num(row.tripBoxes) > 0 ? num(row.tripBoxes) : num(row.orderedBoxes);
  return Math.max(0, basis - num(row.deliveredBoxes));
}

/** Boxes this shop ordered in collection (0 for not-listed). */
export function shopCollectedBoxes(row: {
  additional?: boolean;
  collectedBoxes?: number;
  orderedBoxes: number;
}): number {
  if (row.additional) return 0;
  const collected = num(row.collectedBoxes);
  return collected > 0 ? collected : num(row.orderedBoxes);
}

/** Boxes this vehicle was assigned for the shop. */
export function shopAssignedBoxes(row: {
  additional?: boolean;
  assignedBoxes?: number;
  tripBoxes?: number;
  orderedBoxes: number;
}): number {
  if (row.additional) return 0;
  const assigned = num(row.assignedBoxes);
  if (assigned > 0) return assigned;
  return num(row.tripBoxes) > 0 ? num(row.tripBoxes) : num(row.orderedBoxes);
}

/** Shop-row status label keys shared by View and PDF. */
export function shopDeliveryStatusI18nKey(status: ShopDeliveryBreakdownStatus): string {
  switch (status) {
    case "delivered":
    case "delivered_with_diff":
      return "orders.status_delivered";
    case "part_delivered":
      return "orders.status_part_delivered";
    case "not_listed":
      return "orders.status_not_listed";
    default:
      return "orders.status_pending";
  }
}

/**
 * Compact delivery-report numbers shared by the View modal and the PDF so
 * both surfaces render the same collected / delivered / pending dataset.
 * Box / bird / weight figures come from the shop breakdown (never invented);
 * shop counts prefer the trip progress already shown on the tracking table.
 */
export type DeliveryReportSummary = {
  totalShops: number;
  deliveredShops: number;
  pendingShops: number;
  partDeliveredShops: number;
  collectedBoxes: number;
  assignedBoxes: number;
  deliveredBoxes: number;
  pendingBoxes: number;
  deliveredBirds: number;
  deliveredWeight: number;
};

export function buildDeliveryReportSummary(
  progress: OrdersProgress | null | undefined,
  shops: ShopDeliveryBreakdown[]
): DeliveryReportSummary {
  const listed = shops.filter((s) => s.ordered);
  const collectedBoxes = listed.reduce((sum, r) => sum + shopCollectedBoxes(r), 0);
  const assignedBoxes = listed.reduce((sum, r) => sum + shopAssignedBoxes(r), 0);
  const pendingBoxes = listed.reduce((sum, r) => sum + shopRemainingBoxes(r), 0);
  const deliveredBoxes = shops.reduce((sum, r) => sum + r.deliveredBoxes, 0);
  const deliveredBirds = shops.reduce((sum, r) => sum + r.deliveredBirds, 0);
  const deliveredWeight = Number(
    shops.reduce((sum, r) => sum + r.deliveredWeight, 0).toFixed(2)
  );
  return {
    totalShops: progress?.totalShops ?? listed.length,
    deliveredShops:
      progress?.deliveredShops ??
      listed.filter((s) => s.status === "delivered" || s.status === "delivered_with_diff")
        .length,
    pendingShops:
      progress?.pendingShops ?? listed.filter((s) => s.status === "not_delivered").length,
    partDeliveredShops:
      progress?.partDeliveredShops ??
      listed.filter((s) => s.status === "part_delivered").length,
    collectedBoxes,
    assignedBoxes,
    deliveredBoxes,
    pendingBoxes,
    deliveredBirds,
    deliveredWeight,
  };
}

/**
 * Build the Step 4 capture row for ONE shop-level delivery.
 *
 * Pure — no clock beyond the injected `now`, no I/O. The row copies the
 * shop's plan facts (id 0 = new record) and stamps `autoCaptureTime`, which
 * is what marks a row as an actual delivery. Partial by design: only the
 * entered boxes are captured, so the remaining boxes stay open.
 */
export function buildShopDeliveryRow(
  trip: Trip,
  plan: ShopDelivery | null,
  entry: { shopId: number; boxes: number },
  now = new Date()
): ShopDelivery {
  const rows = rowsInSequence(trip);
  const boxes = Math.max(1, Math.round(num(entry.boxes)));
  const orderedBoxes = plan ? Math.max(1, rowBoxes(plan)) : boxes;
  const orderedBirds = plan ? num(plan.farmBirds ?? plan.birds) : 0;
  // Birds follow the shop's own order ratio; weight follows the trip average.
  const birds = Math.round((orderedBirds * boxes) / orderedBoxes);
  const weight = weightForBirds(birds, trip.avgBirdWeight);
  const nextSerial = rows.reduce((max, r) => Math.max(max, num(r.serialNo)), 0) + 1;
  const base: ShopDelivery = plan
    ? { ...plan }
    : {
        id: 0,
        boxNo: boxes,
        shopId: num(entry.shopId),
        shopName: "",
        birdTypeId: 0,
        birdType: "",
        birds,
        weight,
        mortality: 0,
        rate: null,
        amount: 0,
        remarks: "",
      };
  return {
    ...base,
    id: 0,
    serialNo: nextSerial,
    shopId: num(entry.shopId) || num(plan?.shopId),
    boxNo: boxes,
    birds,
    weight,
    mortality: 0,
    mortKg: 0,
    deliveryMode: "box",
    // Empty on purpose — deliveredRowBoxes() must read the entered boxNo.
    selectedBoxIds: [],
    perBoxData: [],
    autoCaptureTime: now.toISOString(),
    clientKey: `dlv-${num(entry.shopId)}-${nextSerial}`,
  };
}

/**
 * Move one row of a sequence to another position — the single rule behind the
 * drag handle, the ↑/↓ arrows and "first / last". Targets clamp to the list,
 * so with 45 shops on a vehicle the last shop can be sent to #1 in one move
 * instead of 44 arrow clicks. The other rows shift around it (no swap).
 */
export function moveInSequence<T>(rows: T[], from: number, to: number): T[] {
  if (rows.length < 2) return rows;
  const f = Math.max(0, Math.min(rows.length - 1, Math.round(from)));
  const t = Math.max(0, Math.min(rows.length - 1, Math.round(to)));
  if (f === t) return rows;
  const next = [...rows];
  const [moved] = next.splice(f, 1);
  next.splice(t, 0, moved as T);
  return next;
}

/**
 * Table-level search for the SHOP DELIVERY REPORT modal — one compact
 * input filtering shop-level records by shop name, village, status, trip
 * number or vehicle (no separate filter panels). Empty query = all rows.
 */
export function filterShopBreakdown(
  rows: ShopDeliveryBreakdown[],
  query: string,
  labels: {
    ordered: string;
    notListed: string;
    delivered: string;
    partDelivered: string;
    deliveredWithDiff: string;
    notDelivered: string;
  },
  tripNo = "",
  vehicleNo = ""
): ShopDeliveryBreakdown[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const haystack = [
      row.shopName,
      row.shopNumber,
      row.village,
      row.status === "not_listed" ? labels.notListed : labels.ordered,
      row.status === "delivered"
        ? labels.delivered
        : row.status === "part_delivered"
          ? labels.partDelivered
          : row.status === "delivered_with_diff"
            ? labels.deliveredWithDiff
            : row.status === "not_delivered"
              ? labels.notDelivered
              : "",
      tripNo,
      vehicleNo,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

// ─── Small shared formatting ─────────────────────────────────────────────────

/**
 * Formats an ACTUAL persisted Step 4 timestamp (never generates one):
 * "2026-08-29T16:35:00.000Z" → "29 Aug 2026 · 04:35 PM". Falls back to the
 * raw stored value when it cannot be parsed.
 */
/**
 * The ORDER(S) a vehicle trip is delivering.
 *
 * Read from the persisted data — every assigned row carries
 * "[ORDER] O:<orderTripNo>" and a finished assignment tags the trip remarks
 * with "order:<orderTripNo>" — so the report and the check popup always name
 * the order, never just the vehicle trip.
 */
export function orderRefsOnTrip(trip: Trip): string[] {
  const fromRows = rowsInSequence(trip)
    .map((r) => parseOrderRef(r.remarks))
    .filter((v): v is string => Boolean(v));
  const fromTrip = String(trip.remarks ?? "")
    .split("|")
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith("order:"))
    .map((tag) => tag.slice("order:".length).trim())
    .filter(Boolean);
  return Array.from(new Set([...fromRows, ...fromTrip]));
}

/** "ORD-20260903-01" → "2026-09-03" (empty when the ref carries no date). */
export function orderDateOfRef(ref: string): string {
  const m = /^ORD-(\d{4})(\d{2})(\d{2})-\d+$/.exec(ref);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export function formatDeliveredAtLabel(
  iso: string | null | undefined,
  compact = false
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // "03 Sept 09:15" — for narrow PDF cells, so a row stays one line tall.
  if (compact) {
    const day = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    const hhmm = d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${day} ${hhmm}`;
  }
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

export function formatKg(value: number, withUnit = true): string {
  const n = num(value);
  if (!n) return withUnit ? "0 KG" : "0";
  return n.toFixed(2) + (withUnit ? " KG" : "");
}

export function formatCount(value: number): string {
  return num(value).toLocaleString("en-IN");
}

// ─── WhatsApp assignment message (the text previewed before sending) ──────────

/** One shop line of the assignment message / sheet (delivery order). */
export type AssignmentSheetRow = {
  serialNo: number;
  shopId: number;
  shopName: string;
  village: string;
  mobile: string;
  /** Boxes assigned to THIS vehicle (the shop's share). */
  boxes: number;
  /** Birds for that share (prorated from the shop's order). */
  birds: number;
};

export type AssignmentSheetInput = {
  tripNo: string;
  tripDate: string;
  vehicleNo: string;
  supervisorName: string;
  supervisorMobile: string;
  driverName: string;
  orderTripNo: string;
  orderDate: string;
  rows: AssignmentSheetRow[];
  language?: "en" | "te";
};

/**
 * The WhatsApp message text for a shop assignment — exactly what the popup
 * shows for confirmation before the send goes out. Compact on purpose: the
 * per-shop DELIVERY SEQUENCE lives in the attached PDF, the message just
 * carries the facts and the totals, and points at that PDF.
 */
export function buildAssignmentWhatsAppMessage(input: AssignmentSheetInput): string {
  const d = (value: string) => (value && value.trim() ? value.trim() : "—");
  const totalBoxes = input.rows.reduce((s, r) => s + r.boxes, 0);
  const totalBirds = input.rows.reduce((s, r) => s + r.birds, 0);
  if (input.language === "te") {
    return [
      "*డీఎంఆర్ పౌల్ట్రీస్ — షాప్ అసైన్‌మెంట్*",
      "",
      `ట్రిప్: ${d(input.tripNo)} · వాహనం: ${d(input.vehicleNo)}`,
      `సూపర్‌వైజర్: ${d(input.supervisorName)}${input.supervisorMobile ? ` (${input.supervisorMobile})` : ""}`,
      `డ్రైవర్: ${d(input.driverName)}`,
      `ఆర్డర్: ${d(input.orderTripNo)} · తేదీ: ${d(input.orderDate || input.tripDate)}`,
      `షాప్‌లు: ${input.rows.length} · బాక్స్‌లు: ${totalBoxes} · పక్షులు: ${totalBirds}`,
      "",
      "📄 షాప్ డెలివరీ క్రమం PDF లో చూడండి.",
    ].join("\n");
  }
  const lines = [
    "*DMR POULTRIES — Shop Assignment*",
    "",
    `Trip: ${d(input.tripNo)} · Vehicle: ${d(input.vehicleNo)}`,
    `Supervisor: ${d(input.supervisorName)}${input.supervisorMobile ? ` (${input.supervisorMobile})` : ""}`,
    `Driver: ${d(input.driverName)}`,
    `Order: ${d(input.orderTripNo)} · Date: ${d(input.orderDate || input.tripDate)}`,
    `Shops: ${input.rows.length} · Boxes: ${totalBoxes} · Birds: ${totalBirds}`,
    "",
    "📄 Delivery sequence of shops: please check the PDF.",
  ];
  return lines.join("\n");
}
