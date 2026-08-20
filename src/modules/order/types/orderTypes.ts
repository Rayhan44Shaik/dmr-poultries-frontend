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
 * GPS availability state, surfaced to the user as readable text.
 * Never assume GPS is always present.
 */
export type GpsAvailability =
  | "Available"
  | "Not Available"
  | "Pending"
  | "Stale"
  | "Invalid"
  | "Poor Accuracy";

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

export interface OrderShop {
  /** Opaque frontend identifier — never a database id. */
  id: string;
  name: string;
  /** Readable city / village label, e.g. "Vijayawada". */
  location: string;
  gps: GpsCoordinate | null;
  gpsStatus: GpsAvailability;
}

/**
 * Pickup source — inherited from Trip Entry Step 2 (farm / pickup).
 * This module never creates or edits farms; it only displays the relationship.
 */
export interface PickupSource {
  id: string;
  farmName: string;
  location: string;
  gps: GpsCoordinate | null;
  gpsStatus: GpsAvailability;
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
  /** ISO date string (yyyy-mm-dd). */
  deliveryDate: string;
  /** Human readable deadline, e.g. "Before 14:00". */
  deliveryDeadline: string;
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
  deliveryDeadline: string;
  deliveryWindow: string | null;
}
