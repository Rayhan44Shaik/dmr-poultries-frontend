// src/modules/order/types/orderTypes.ts
// -----------------------------------------------------------------------------
// Frontend-only domain types for the Order module.
//
// These types are intentionally independent of any backend model. They describe
// the *order* lifecycle: Shop Requirement -> Order -> Priority -> Farm/Trip
// connection -> Vehicle assignment -> Route planning -> Delivery tracking.
//
// Farm / pickup information is NOT owned by this module — it is inherited from
// the existing Trip Entry (Step 2) workflow and merely *displayed* here.
// -----------------------------------------------------------------------------

export type OrderPriority = "Normal" | "Important" | "Urgent";

export type RequirementType = "Birds" | "Boxes" | "Birds + Boxes";

export type OrderStatus =
  | "Draft"
  | "Pending"
  | "Confirmed"
  | "Awaiting Assignment"
  | "Assigned"
  | "Pickup Pending"
  | "Picked Up"
  | "Route Planned"
  | "In Transit"
  | "Arrived"
  | "Delivered"
  | "Cancelled";

/**
 * GPS quality classification. Never assume GPS is always present or accurate.
 * "Fresh"/"Stale" are derived from the coordinate timestamp; "Invalid" means
 * the lat/lon are out of range; "Poor Accuracy" means the accuracy exceeds the
 * configured threshold.
 */
export type GpsQuality = "Fresh" | "Stale" | "Unavailable" | "Invalid" | "Poor Accuracy";

/** Nullable GPS fields — see requirement #41. */
export interface GpsCoordinate {
  latitude: number | null;
  longitude: number | null;
  /** Horizontal accuracy in metres. */
  accuracyMeters?: number | null;
  /** Last fix timestamp (ISO). */
  timestamp?: string | null;
  /** Speed in km/h. */
  speedKmh?: number | null;
  /** Heading in degrees (0-360). */
  heading?: number | null;
}

/** Structured physical address (never a database id). */
export interface Address {
  line1: string;
  line2?: string;
  area?: string;
  city: string;
  district?: string;
  state: string;
  pinCode: string;
}

export interface OrderShop {
  /** Opaque frontend identifier — never a database id. */
  id: string;
  name: string;
  /** Readable city label, e.g. "Vijayawada". */
  location: string;
  address: Address;
  gps: GpsCoordinate | null;
  gpsStatus: GpsQuality;
}

/**
 * Pickup source — inherited from Trip Entry Step 2 (farm / pickup).
 * This module never creates or edits farms; it only displays the relationship.
 */
export interface PickupSource {
  id: string;
  farmName: string;
  location: string;
  address: Address;
  gps: GpsCoordinate | null;
  gpsStatus: GpsQuality;
  /** Constant marker clarifying that the farm originates from the trip flow. */
  source: "Trip Entry Step 2";
  tripNo: string | null;
  pickupStatus: "Not Assigned" | "Assigned" | "Pending";
}

export interface VehicleAssignment {
  vehicleId: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  tripNo: string;
  pickupFarm: string;
  pickupLocation: string;
  orderCount: number;
  routeStatus: string;
  /** Vehicle departure time "HH:mm" (business-local). */
  departureTime: string;
  /** Distinguish system recommendation from manual override (requirement #20). */
  assignmentType: "System Recommended" | "Manually Assigned";
}

export interface Order {
  id: string;
  orderNumber: string;
  shop: OrderShop;
  birdType: string;
  requirementType: RequirementType;
  birds: number;
  boxes: number;
  expectedWeightKg: number | null;
  remarks: string;
  priority: OrderPriority;
  importantCustomer: boolean;
  /** ISO date string (yyyy-mm-dd) — business-local. */
  deliveryDate: string;
  /** Comparable 24h deadline "HH:mm" (business-local). */
  deadlineTime: string;
  /** Human display label, e.g. "Before 14:00". */
  deadlineLabel: string;
  /** Optional delivery window, e.g. "10:00 – 14:00". */
  deliveryWindow: string | null;
  status: OrderStatus;
  pickupSource: PickupSource | null;
  vehicleAssignment: VehicleAssignment | null;
  createdAt: string;
  updatedAt: string;
}

/** Input shape for creating / editing an order (see New Order form). */
export interface OrderDraft {
  shopId: string;
  birdType: string;
  requirementType: RequirementType;
  birds: number;
  boxes: number;
  expectedWeightKg: number | null;
  remarks: string;
  priority: OrderPriority;
  importantCustomer: boolean;
  deliveryDate: string;
  deadlineTime: string;
  deadlineLabel: string;
  deliveryWindow: string | null;
}
