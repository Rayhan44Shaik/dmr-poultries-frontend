// src/modules/operations/orders/types.ts
// Orders module domain types — 3-tab, day-based workflow:
//
//   1. ORDER COLLECTION   (one collection per operational day; day-by-day
//                          navigation; past days read-only)
//   2. ORDER ASSIGNMENT   (select vehicle → select shops one by one →
//                          sequence + boxes → save/finish; a shop's order can
//                          be SPLIT across vehicles — the sum over all
//                          vehicles can never exceed the collected boxes)
//   3. DELIVERY TRACKING  (Step 4 delivery rows are the source of truth;
//                          ordered-vs-delivered report with differences)
//
// Persistence uses collection/assignment rows attached to the existing trip.id.
// The URL and API trip ID are authoritative; the trip number is display text only.

import type { ShopDelivery, Trip } from "../../../shared/trip";

/** Marker prefix stored in `remarks` of every row the Orders module creates. */
export const ORDER_PLAN_REMARKS = "[ORDER]";

/** Full marker for a row that belongs to a specific collection order. */
export function orderRowRemarks(orderTripNo: string): string {
  return `${ORDER_PLAN_REMARKS} O:${orderTripNo}`;
}

/** Extract the referenced collection order tripNo from a row remark. */
export function parseOrderRef(remarks: string | null | undefined): string | null {
  const m = String(remarks ?? "").match(/\[ORDER\]\s+O:([^\s|]+)/);
  return m ? m[1] : null;
}

/** True for rows written by the Orders module (original order). */
export function isOrderPlanRemarks(remarks: string | null | undefined): boolean {
  return String(remarks ?? "").trim().startsWith(ORDER_PLAN_REMARKS);
}

export type OrdersTab = "collection" | "assignment" | "tracking";

export type OrdersTrackingStatus = "Assigned" | "In Progress" | "Completed";

/**
 * Shop-delivery progress independent of Trip Entry lifecycle.
 * Trip status (Pending / Completed) decides which Delivery Tracking table
 * a trip sits in; this field is the shop-delivery bar (4 / 6 Delivered).
 */
export type OrdersDeliveryState = "pending" | "in_progress" | "partial" | "complete";

/**
 * One shop row inside the collection / assignment editors. Mirrors the
 * persisted ShopDelivery shape (what gets sent to the backend) plus editor
 * concerns (clientKey for stable local identity before the row has an id).
 */
export type OrderShopRow = ShopDelivery & {
  /** Stable local identity for rows that have not been persisted yet. */
  clientKey: string;
  /** Village copied from the Shop Master when the shop was listed. */
  village?: string;
};

/** Derived delivery progress for an order-assigned trip (Step 4 truth). */
export type OrdersProgress = {
  /** Distinct shops of the ORIGINAL order. */
  totalShops: number;
  /** Boxes ordered for the original shops (from the plan rows). */
  totalBoxes: number;
  /** Weight planned for the original shops (KG). */
  totalWeight: number;
  /** Birds planned for the original shops. */
  totalBirds: number;
  /**
   * Original shops that are FULLY delivered (captured boxes ≥ ordered).
   * A partial capture (15 of 21) does not count — that shop is
   * `partDeliveredShops`, not delivered.
   */
  deliveredShops: number;
  /** Original shops with zero capture (excludes part-delivered). */
  pendingShops: number;
  /** Original boxes with a Step 4 capture. */
  deliveredBoxes: number;
  /** Birds actually delivered for the original shops (Step 4 rows). */
  deliveredBirds: number;
  /** Weight (KG) actually delivered for the original shops (Step 4 rows). */
  deliveredWeight: number;
  /**
   * Original shops that got SOME boxes but not all — a partial delivery, which
   * stays open until the balance is closed.
   */
  partDeliveredShops: number;
  /**
   * Boxes still to deliver (ordered − delivered, never below 0). This is the
   * number a partial delivery leaves behind: 25 ordered, 10 in → 15 pending.
   */
  pendingBoxes: number;
  /** Birds still to deliver. */
  pendingBirds: number;
  /** Weight (KG) still to deliver. */
  pendingWeight: number;
  /** Shops present in Step 4 data but NOT part of the original order. */
  additionalShopCount: number;
  /**
   * Trip-lifecycle label derived from Trip Entry `status` (Completed vs not).
   * Never invented from 100% delivery — a fully-delivered trip still reads
   * Assigned / In Progress until Trip Entry marks it Completed.
   */
  status: OrdersTrackingStatus;
  /**
   * Shop-delivery bar, independent of Trip Entry. A COMPLETED trip can
   * still be `partial` (4 / 6 delivered); an open trip can be `complete`.
   */
  deliveryState: OrdersDeliveryState;
};

/** One trip enriched with everything the Orders page renders. */
export type OrdersTrip = {
  trip: Trip;
  /** Delivery progress (present for all tracking trips). */
  progress: OrdersProgress | null;
  /** Shop ids of the original order (empty when unknown/none). */
  originalShopIds: Set<number>;
  /** Shop ids added during delivery (Step 4) — outside the original order. */
  additionalShopIds: Set<number>;
  /**
   * Original ORDERED quantities per shop from the day's collection
   * container (authoritative — Step 4 rewrites vehicle rows in place, so
   * the row no longer carries the ordered box count after a delivery).
   */
  originalQuantities?: ShopOrderQuantities;
  /**
   * True when the trip is in Delivery Tracking but the original Order
   * Assignment shop list (the `[ORDER]` plan rows) is missing. The trip
   * MUST still appear — light-orange data-quality warning, never hidden.
   */
  assignmentIncomplete: boolean;
};

/**
 * Original ORDERED quantities per shop, read from the day's collection
 * container (the authoritative order record — Step 4 rewrites the vehicle
 * trip rows in place when a delivery is captured).
 */
export type ShopOrderQuantities = Map<
  number,
  { boxes: number; birds: number; weight: number; assignedBoxes?: number }
>;

/**
 * The share ONE vehicle trip carries of one collected shop (an order can be
 * split over several vehicles — 40 collected → 20 on TRP-A + 20 on TRP-B).
 * `boxes` is the share measured from the trip's plan rows; the sum of the
 * parts' `boxes` can never exceed the shop's collected boxes.
 */
export type DayShopAssignmentPart = {
  /** Vehicle trip id (stable identity — tripNo is display text). */
  tripId: number;
  tripNo: string;
  vehicleNo: string;
  /** Boxes of the shop's order this vehicle carries. */
  boxes: number;
  /** A Step 4 capture exists for this shop on that trip. */
  delivered: boolean;
  /** Boxes actually captured for this shop on that trip. */
  deliveredBoxes: number;
};

/**
 * Where ONE collected shop ended up for its day — derived from the
 * persisted vehicle-trip rows (the single source of truth for "is shop X
 * assigned to a vehicle for day D?" and "was it delivered?"). The flat
 * fields describe the FIRST (primary) vehicle; `parts` lists EVERY vehicle
 * carrying a share, and `assignedBoxesTotal` is their sum — the shop's
 * assignable balance is `boxes − assignedBoxesTotal`.
 */
export type DayShopAssignment = {
  /** Vehicle trip number (shown in the collection table). */
  tripNo: string;
  vehicleNo: string;
  /** Delivery sequence of this shop on that vehicle trip. */
  sequence: number;
  /** The shop's ORDERED boxes (from the collection row — authoritative). */
  boxes: number;
  birds: number;
  /** A Step 4 capture exists for this shop on any of its vehicles. */
  delivered: boolean;
  /** Boxes actually captured for this shop across all its vehicles
   *  (a partial delivery is < `boxes`). */
  deliveredBoxes: number;
  /** Trip-level status (kept in sync with Delivery Tracking). */
  tripStatus: OrdersTrackingStatus;
  /** Vehicle trip avg bird weight (for the weight estimate column). */
  avgBirdWeight: number;
  /** Every vehicle trip carrying a share of this shop's order. */
  parts: DayShopAssignmentPart[];
  /** Σ parts.boxes — the boxes already assigned to vehicles (never > boxes). */
  assignedBoxesTotal: number;
};

/** The collection of ONE operational day (one container per day). */
export type OrdersDayCollection = {
  trip: Trip;
  /** The collected shop rows (in saved order). */
  rows: OrderShopRow[];
  totalShops: number;
  totalBoxes: number;
  totalBirds: number;
  /** Collection finished (startStepSubmitted) — locked for editing. */
  finished: boolean;
  /** Shops with at least one vehicle carrying part of their order. */
  assignedShops: number;
  /** Boxes assigned to vehicle trips for this day (Σ over all vehicles). */
  assignedBoxes: number;
  /** Every collected box is assigned (no shop has a remaining balance). */
  fullyAssigned: boolean;
  /** Per-shop assignment facts (null = not assigned yet). */
  shops: Map<number, DayShopAssignment | null>;
};

/** One row of a vehicle trip's assignment view for a selected day. */
export type DayVehicleAssignmentRow = {
  shopId: number;
  shopName: string;
  sequence: number;
  boxes: number;
  birds: number;
  delivered: boolean;
};

/**
 * A vehicle trip's assignment view for one day (read-only history for past
 * days, and the data source for "this vehicle already took these shops").
 */
export type DayVehicleView = {
  trip: Trip;
  /** Rows of THIS day's collection assigned to the trip (in sequence). */
  rows: DayVehicleAssignmentRow[];
  boxes: number;
  shops: number;
  deliveredShops: number;
  status: OrdersTrackingStatus;
  allDelivered: boolean;
};

/** Vehicle-trip candidate for assignment (Step 2 complete, not delivered). */
export type OrdersEligibleVehicle = {
  trip: Trip;
  /** Vehicle master box capacity (no_of_boxes). */
  capacity: number;
  /** Boxes already assigned to this trip from previous orders. */
  alreadyAssigned: number;
  /** capacity - alreadyAssigned (never negative). */
  available: number;
};

/** Everything the Orders page needs, fetched with a single trips call. */
export type OrdersFetch = {
  /** Operational "today" (local date, YYYY-MM-DD). */
  today: string;
  /** 7-day scroller window: [today-6 … today] (no future days). */
  days: string[];
  /** Real Trip Entry records and collections keyed only by their backend ID. */
  trips: Trip[];
  collectionsByTripId: Record<number, OrdersDayCollection>;
  /** Vehicle trips eligible for assignment (Tab 2 vehicle select). */
  eligibleVehicles: OrdersEligibleVehicle[];
  /** Order-assigned trips with delivery tracking (Tab 3, week window). */
  tracking: OrdersTrip[];
  /** Per-day vehicle assignment views (Tab 2 read-only history). */
  dayVehicleViews: Record<string, DayVehicleView[]>;
};
