// src/modules/operations/orders/ordersUtils.ts
// Pure helpers for the Orders module — no React, no API, no business state.
//
// Every quantity rule (remaining boxes, delivered locks, statuses) is owned
// by the BACKEND Orders module. What is left here is:
//   - reading the trip-side `[ORDER]` plan rows Step 4 delivers against,
//   - deriving the ordered-vs-delivered breakdown the detail sheet / PDF show,
//   - operational-day and formatting helpers.

import type { ShopDelivery, Trip } from "../../../shared/trip";
import type { OrderView } from "./services/ordersApi";
import type { ShopDirectory } from "./ordersService";
import {
  isOrderPlanRemarks,
  type OrdersProgress,
  type OrdersTrip,
  type ShopOrderQuantities,
} from "./types";

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// ─── Row helpers ─────────────────────────────────────────────────────────────

/** True for rows the Orders backend projected (assignment plan row). */
export function isOrderPlanRow(row: ShopDelivery): boolean {
  return isOrderPlanRemarks(row.remarks);
}

/**
 * True when Step 4 actually DELIVERED this shop (real delivery data), not
 * merely when a row exists.
 *
 * The backend stamps `auto_capture_time` on every `trip_deliveries` INSERT —
 * including the box-less, weight-0 plan rows Order Assignment projects — so a
 * capture timestamp alone cannot tell a planned stop from a delivered one. A
 * real Step 4 capture always carries actual delivered quantities: delivered
 * weight > 0, or one or more selected pickup boxes. This mirrors the backend
 * predicate used by ordersService.syncTripAssignments.
 */
export function isCapturedRow(row: ShopDelivery): boolean {
  const hasDeliveredActuals =
    (Number(row.weight) || 0) > 0 ||
    (Array.isArray(row.selectedBoxIds) && row.selectedBoxIds.length > 0);
  if (!hasDeliveredActuals) return false;
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

/** True when a trip carries at least one Orders plan row. */
export function hasOrderRows(trip: Trip): boolean {
  return rowsInSequence(trip).some(isOrderPlanRow);
}

/** A vehicle trip whose order delivery progress is tracked. */
export function isTrackingTrip(trip: Trip): boolean {
  return (
    trip.deleted !== true &&
    trip.vehicleId != null &&
    trip.vehicleId > 0 &&
    hasOrderRows(trip)
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
 * `originalQuantities` (from /api/orders) supplies the ORDERED totals —
 * Step 4 rewrites the vehicle rows in place, so the row itself no longer
 * carries the ordered box count after a delivery.
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

  // ── AUTHORITATIVE completion ─────────────────────────────────────────
  // A trip is "Completed" ONLY when the Trip Entry lifecycle says so
  // (`trips.status = 'Completed'`). Delivery percentage, 100% boxes, all
  // shops delivered or a Step 4 submission are NEVER sufficient — Orders
  // keeps no independent completion state.
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

export function buildOrdersTrip(
  trip: Trip,
  originalQuantities?: ShopOrderQuantities
): OrdersTrip {
  const rows = rowsInSequence(trip);
  const originalShopIds = new Set<number>();
  const additionalShopIds = new Set<number>();
  for (const row of rows) {
    const shopId = num(row.shopId);
    if (!shopId) continue;
    if (isOrderPlanRow(row)) originalShopIds.add(shopId);
  }
  if (originalShopIds.size > 0) {
    for (const row of rows) {
      const shopId = num(row.shopId);
      if (shopId && !originalShopIds.has(shopId)) additionalShopIds.add(shopId);
    }
  }
  const progress = computeOrdersProgress(trip, originalQuantities);
  return { trip, progress, originalShopIds, additionalShopIds, originalQuantities };
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
  /** Shop Master CITY (the column formerly labelled "Village"). */
  city: string;
  /** Shop Mobile — Shop Master only ("" when the master has none). */
  mobile: string;
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
 * Ordered values come from the ORIGINAL order (`originalQuantities`, read
 * from /api/orders — authoritative, since Step 4 rewrites vehicle rows in
 * place); delivered values are the actual captured Step 4 figures. Without
 * order context it falls back to the row's own plan snapshot. */
export function buildShopBreakdown(
  rows: ShopDelivery[],
  originalShopIds: Set<number>,
  cityOf: (shopId: number, shopName: string) => string,
  originalQuantities?: ShopOrderQuantities,
  mobileOf?: (shopId: number) => string
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
      city: cityOf(shopId, acc.first.shopName || ""),
      mobile: mobileOf ? mobileOf(shopId) : "",
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
 * input filtering shop-level records by shop name, city, status, trip
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
      row.city,
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

// ─── Loaded-shop list (Order Assignment → "View Loaded Shops") ───────────────

/** One shop carrying boxes on a specific vehicle trip. */
export type LoadedShopRow = {
  /** Stable identity — the assignment row, unique per (order, trip). */
  key: string;
  orderNo: string;
  shopName: string;
  owner: string;
  city: string;
  mobile: string;
  sequence: number;
  requiredBoxes: number;
  pickupBoxes: number;
  deliveredBoxes: number;
  /** Loaded but not yet delivered ON THIS TRIP (never negative). */
  openBoxes: number;
  status: OrderView["status"];
};

/**
 * Server order rows → the shops actually LOADED on `tripId`.
 *
 * "Loaded" means the order holds an assignment on THIS trip with more than
 * zero pickup boxes: an order assigned to another vehicle, or present on this
 * one with zero boxes, is not on the truck and is left out. Shop Master
 * decorations (owner / city / mobile) are read straight from the directory —
 * never invented — and fall back to the order's own city, then "".
 */
export function toLoadedShops(
  rows: OrderView[],
  tripId: number,
  shopDirectory: ShopDirectory
): LoadedShopRow[] {
  const out: LoadedShopRow[] = [];
  for (const row of rows) {
    const assignment = row.assignments.find((a) => a.tripId === tripId);
    if (!assignment || assignment.pickupBoxes <= 0) continue;
    const shop = shopDirectory.get(row.shopId);
    out.push({
      key: `a:${assignment.id}`,
      orderNo: row.orderNo,
      shopName: row.shopName,
      owner: shop?.ownerName ?? "",
      city: shop?.city || row.city || "",
      mobile: shop?.mobile ?? "",
      sequence: assignment.sequence,
      requiredBoxes: row.requiredBoxes,
      pickupBoxes: assignment.pickupBoxes,
      deliveredBoxes: assignment.deliveredBoxes,
      openBoxes: Math.max(0, assignment.pickupBoxes - assignment.deliveredBoxes),
      status: row.status,
    });
  }
  return out;
}

/** Route order: sequence, then shop name, then order no — fully deterministic. */
export function sortLoadedShops(rows: LoadedShopRow[]): LoadedShopRow[] {
  return [...rows].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.shopName.localeCompare(b.shopName) ||
      a.orderNo.localeCompare(b.orderNo)
  );
}
