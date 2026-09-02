// src/modules/operations/orders/types.ts
// Orders module domain types.
//
// The workflow is owned by the BACKEND Orders module (/api/orders):
//
//   1. ORDER COLLECTION   `orders`            — required boxes per shop/day
//   2. ORDER ASSIGNMENT   `order_assignments` — order → vehicle trip
//   3. DELIVERY TRACKING  order_assignments.delivered_* — synced from Step 4
//
// The row/progress types below describe the TRIP-side projection only: the
// `[ORDER]` plan rows the backend writes onto `trip_deliveries` so Trip Entry
// Step 4 can deliver the assigned route shop by shop. They are used by the
// delivery detail sheet and the PDF, which compare the ordered quantities
// (from /api/orders) against the actual Step 4 capture.

import type { ShopDelivery, Trip } from "../../../shared/trip";
import type { OrderStatus } from "./services/ordersApi";

/** Marker the backend stores in `remarks` of every projected plan row. */
export const ORDER_PLAN_REMARKS = "[ORDER]";

/** True for rows written by the Orders module (assignment plan rows). */
export function isOrderPlanRemarks(remarks: string | null | undefined): boolean {
  return String(remarks ?? "").trim().startsWith(ORDER_PLAN_REMARKS);
}

export type OrdersTab = "collection" | "assignment" | "tracking";

export type OrdersTrackingStatus = "Assigned" | "In Progress" | "Completed";

/** Re-exported so components can type a status badge without a second import. */
export type { OrderStatus };

/** Derived delivery progress for an order-assigned trip (Step 4 truth). */
export type OrdersProgress = {
  /** Distinct shops of the ORIGINAL order. */
  totalShops: number;
  /** Boxes ordered for the original shops. */
  totalBoxes: number;
  /** Weight planned for the original shops (KG). */
  totalWeight: number;
  /** Birds planned for the original shops. */
  totalBirds: number;
  /** Original shops that already have a Step 4 capture. */
  deliveredShops: number;
  /** Original shops still pending. */
  pendingShops: number;
  /** Original boxes with a Step 4 capture. */
  deliveredBoxes: number;
  /** Birds actually delivered for the original shops (Step 4 rows). */
  deliveredBirds: number;
  /** Weight (KG) actually delivered for the original shops (Step 4 rows). */
  deliveredWeight: number;
  /** Shops present in Step 4 data but NOT part of the original order. */
  additionalShopCount: number;
  /** Assigned = 0 delivered · In Progress = partial · Completed = trip done. */
  status: OrdersTrackingStatus;
};

/** One trip enriched with everything the delivery detail sheet renders. */
export type OrdersTrip = {
  trip: Trip;
  /** Delivery progress (present for all tracking trips). */
  progress: OrdersProgress | null;
  /** Shop ids of the original order (empty when unknown/none). */
  originalShopIds: Set<number>;
  /** Shop ids added during delivery (Step 4) — outside the original order. */
  additionalShopIds: Set<number>;
  /** ORDERED quantities per shop, read from the Orders backend module. */
  originalQuantities?: ShopOrderQuantities;
};

/** ORDERED quantities per shop (authoritative — from /api/orders). */
export type ShopOrderQuantities = Map<
  number,
  { boxes: number; birds: number; weight: number }
>;

/** One projected plan row, as Step 4 receives it. */
export type OrderShopRow = ShopDelivery & {
  /** Stable local identity for rows that have not been persisted yet. */
  clientKey: string;
  /** City copied from the Shop Master when the shop was listed. */
  city?: string;
};
