// src/modules/operations/orders/ordersUtils.ts
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
  type OrdersEligibleVehicle,
  type OrdersProgress,
  type OrdersTrip,
  type ShopOrderQuantities,
} from "./types";

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

/** Boxes carried by one delivery row (plan rows store the box count). */
export function rowBoxes(row: ShopDelivery): number {
  return Math.max(0, num(row.boxNo ?? row.selectedBoxIds?.length));
}

/** Re-exported for consumers of the breakdown helpers. */
export type { ShopOrderQuantities } from "./types";

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

/** Container whose collection is finished → shows in Tab 2. */
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

/** A trip with an assigned order whose delivery progress is tracked (Tab 3). */
export function isTrackingTrip(trip: Trip): boolean {
  return (
    trip.deleted !== true &&
    trip.deliveryStepSubmitted === true &&
    hasOrderRows(trip)
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

/** Boxes already assigned to a trip (all Orders plan rows on it). */
export function assignedBoxesOnTrip(trip: Trip): number {
  return rowsInSequence(trip).reduce(
    (sum, row) => (isOrderPlanRow(row) ? sum + rowBoxes(row) : sum),
    0
  );
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

  for (const [shopId, row] of planByShop) {
    const ordered = originalQuantities?.get(shopId);
    totalBoxes += ordered ? ordered.boxes : rowBoxes(row);
    totalWeight += ordered ? ordered.weight : num(row.farmWeight ?? row.weight);
    totalBirds += ordered ? ordered.birds : num(row.farmBirds ?? row.birds);
  }
  for (const row of rows) {
    if (isOrderPlanRow(row) && isCapturedRow(row)) {
      deliveredBoxes += deliveredRowBoxes(row);
      // Step 4 rewrites the row in place: birds/weight = delivered values.
      deliveredBirds += num(row.birds);
      deliveredWeight += num(row.weight);
    }
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

  let deliveredShops = 0;
  for (const shopId of originalShopIds) {
    if (capturedShopIds.has(shopId)) deliveredShops += 1;
  }

  const totalShops = originalShopIds.size;
  const pendingShops = Math.max(0, totalShops - deliveredShops);

  // ── AUTHORITATIVE completion (CRITICAL RULE #4 / #5) ─────────────────
  // A trip is "Completed" ONLY when the existing Trip Entry lifecycle says
  // so: `trips.status = 'Completed'` (set by Trip Entry's Step 5 submission
  // / status transition — the same field the Recent Trips list uses).
  // Delivery percentage, 100% boxes, all shops delivered or a Step 4
  // submission ALONE are NEVER sufficient — Orders keeps no independent
  // completion state.
  const tripCompleted = trip.status === "Completed" && trip.deleted !== true;

  let status: OrdersProgress["status"];
  if (tripCompleted) {
    status = "Completed";
  } else if (deliveredShops === 0) {
    status = "Assigned";
  } else {
    status = "In Progress";
  }

  return {
    totalShops,
    totalBoxes,
    totalWeight: Number(totalWeight.toFixed(2)),
    totalBirds,
    deliveredShops,
    pendingShops,
    deliveredBoxes,
    deliveredBirds,
    deliveredWeight: Number(deliveredWeight.toFixed(2)),
    additionalShopCount,
    status,
  };
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
  const progress = isTrackingTrip(trip) ? computeOrdersProgress(trip, originalQuantities) : null;
  return { trip, progress, originalShopIds, additionalShopIds, originalQuantities };
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
  | "delivered_with_diff"
  | "not_delivered"
  | "not_listed";

export type ShopDeliveryBreakdown = {
  shopId: number;
  shopName: string;
  village: string;
  /** Sequence of the first row for this shop. */
  serialNo: number;
  /** Was this shop in the original Order Collection / Assignment? */
  ordered: boolean;
  orderedBoxes: number;
  orderedWeight: number;
  orderedBirds: number;
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
  originalQuantities?: ShopOrderQuantities
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
        : boxDifference < 0 || birdDifference < 0
          ? "delivered_with_diff"
          : "delivered";
    out.push({
      shopId,
      shopName: acc.first.shopName || "—",
      village: villageOf(shopId, acc.first.shopName || ""),
      serialNo: num(acc.first.serialNo ?? acc.first.id),
      ordered: !additional,
      orderedBoxes,
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
    });
  }
  return out.sort((a, b) => a.serialNo - b.serialNo);
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
      row.village,
      row.status === "not_listed" ? labels.notListed : labels.ordered,
      row.status === "delivered"
        ? labels.delivered
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
export function formatDeliveredAtLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
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
