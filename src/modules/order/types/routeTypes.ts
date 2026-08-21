// src/modules/order/types/routeTypes.ts
// -----------------------------------------------------------------------------
// Route / delivery planning types for the Order module.
// -----------------------------------------------------------------------------

import type { GpsCoordinate, GpsQuality, OrderPriority, OrderStatus, PickupSource } from "./orderTypes";

/**
 * Route status — a route is never silently "complete" when orders remain
 * unrouteable or at risk.
 */
export type RouteStatus =
  | "Ready"
  | "Planned"
  | "Partially Planned"
  | "At Risk"
  | "Conflict"
  | "Blocked"
  | "Completed";

/** State of a route/distance calculation — never fake a "Calculated" value. */
export type CalculationState = "Pending" | "Estimated" | "Calculated" | "Unavailable" | "Invalid";

/** Deadline feasibility of a predicted arrival vs. the required deadline. */
export type DeadlineFeasibility = "Can Meet" | "At Risk" | "Cannot Meet" | "Unknown";

/**
 * Explicit planning state for a stop / candidate (requirement #5). UNROUTABLE
 * means GPS/routing data is unavailable or invalid — never silently dropped.
 */
export type PlanningState = "Feasible" | "At Risk" | "Cannot Meet" | "Unroutable";

/** Delivery buffer classification (deadline minus predicted arrival). */
export type BufferState = "Healthy" | "Tight" | "At Risk" | "Late" | "Unknown";

/**
 * Delivery planning phase. Distinct from OrderPriority — the phase is the
 * *current route-planning stage*, derived from priority AND customer
 * importance:
 *   1 = Critical (Urgent orders, or Urgent + Important customer)
 *   2 = Important (Important orders, or Normal + Important customer)
 *   3 = Normal
 */
export type DeliveryPhase = "Critical" | "Important" | "Normal";

export type DeliveryPhaseNumber = 1 | 2 | 3;

/**
 * A single sequential route leg: pickup → A → B → C (not pickup → each shop).
 * Real road routing will later fill distanceKm / travelMinutes.
 */
export interface RouteLeg {
  legNumber: number;
  fromName: string;
  fromGps: GpsCoordinate | null;
  toName: string;
  toAddress: string;
  toGps: GpsCoordinate | null;
  distanceKm: number | null;
  travelMinutes: number | null;
  /** Departure from this leg's origin, "HH:mm" (business-local). */
  departureTime: string | null;
  /** Arrival at this leg's destination, "HH:mm" (business-local). */
  arrivalTime: string | null;
  calculationState: CalculationState;
  isEstimate: boolean;
  /** Optional on-site service time (default 0) — future arrival + service = next departure. */
  serviceMinutes: number;
}

/** A single delivery stop along a route, enriched with arrival/buffer info. */
export interface RouteStop {
  stopNumber: number;
  orderId: string;
  orderNumber: string;
  shopName: string;
  address: string;
  birds: number;
  boxes: number;
  priority: OrderPriority;
  importantCustomer: boolean;
  deadlineLabel: string;
  deadlineTime: string;
  /** The order's natural phase (priority-derived). */
  basePhase: DeliveryPhase;
  /** The phase this stop was actually planned within (may be promoted). */
  effectivePlanningPhase: DeliveryPhase;
  /** True when a lower-phase order was promoted to protect its deadline. */
  deadlineException: boolean;
  /** Human-readable reason for the deadline exception (null when none). */
  promotionReason: string | null;
  /** Name of the previous point (farm or previous shop) this leg started from. */
  fromName: string;
  /** Distance of the leg leading into this stop (previous point → stop). */
  legDistanceKm: number | null;
  /** Cumulative distance from the pickup farm along the route. */
  cumulativeDistanceKm: number | null;
  legTravelMinutes: number | null;
  arrivalTime: string | null;
  etaLabel: string | null;
  bufferMinutes: number | null;
  bufferState: BufferState;
  deadlineFeasible: DeadlineFeasibility;
  planningState: PlanningState;
  /** Human-readable reasons for selecting this stop next. */
  reason: string[];
  /** Optional on-site service time (default 0). */
  serviceMinutes: number;
  status: OrderStatus;
}

/** A planned delivery stop (sequencing-service shape, pre-route-utils). */
export interface DeliveryStopPlan {
  orderId: string;
  orderNumber: string;
  shopName: string;
  address: string;
  priority: OrderPriority;
  importantCustomer: boolean;
  deadlineLabel: string;
  deadlineTime: string;
  basePhase: DeliveryPhase;
  effectivePlanningPhase: DeliveryPhase;
  deadlineException: boolean;
  promotionReason: string | null;
  fromName: string;
  fromGps: GpsCoordinate | null;
  legDistanceKm: number | null;
  cumulativeDistanceKm: number | null;
  travelMinutes: number | null;
  departureTime: string | null;
  arrivalTime: string | null;
  arrivalMinutes: number | null;
  bufferMinutes: number | null;
  bufferState: BufferState;
  deadlineFeasible: DeadlineFeasibility;
  planningState: PlanningState;
  reason: string[];
  serviceMinutes: number;
}

/** An order that could not be routed (e.g. missing/invalid GPS). */
export interface UnplannedOrder {
  orderId: string;
  orderNumber: string;
  shopName: string;
  birds: number;
  boxes: number;
  priority: OrderPriority;
  basePhase: DeliveryPhase;
  reason: string;
  planningState: "Unroutable";
}

/** Vehicle schedule — each vehicle starts and departs independently. */
export interface VehicleSchedule {
  /** Trip submission time "HH:mm". */
  tripSubmittedTime: string;
  /** Loading completion time "HH:mm". */
  loadingCompletionTime: string;
  /** Vehicle departure time "HH:mm". */
  departureTime: string;
}

/** A vehicle that can be recommended / assigned (frontend representation). */
export interface RouteVehicle {
  id: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  pickup: PickupSource;
  /**
   * Configured bird capacity, used only for recommendation checks.
   * Null = unknown (vehicle master unavailable) — capacity is then not enforced.
   */
  birdCapacity: number | null;
  boxCapacity: number | null;
  available: boolean;
  assignedOrderCount: number;
  schedule: VehicleSchedule;
  currentGps: GpsCoordinate | null;
  currentGpsStatus: GpsQuality;
  /** Cities already served by this vehicle's existing route. */
  existingStopCities: string[];
  /** Source trip (Trip Entry), when this vehicle was derived from a real trip. */
  tripNo?: string;
  tripId?: number;
}

/** Aggregated delivery route for one vehicle. */
export interface DeliveryRoute {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  pickup: PickupSource;
  schedule: VehicleSchedule;
  legs: RouteLeg[];
  stops: RouteStop[];
  /** Orders that could not be routed (never silently dropped). */
  unplannedOrders: UnplannedOrder[];
  /** stops.length + unplannedOrders.length — always equals the input order count. */
  totalOrderCount: number;
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  /** Birds across planned stops. */
  plannedBirds: number;
  /** Birds across unplanned orders. */
  unplannedBirds: number;
  /** Boxes across planned stops. */
  plannedBoxes: number;
  /** Boxes across unplanned orders. */
  unplannedBoxes: number;
  /** Total birds (planned + unplanned) — same dataset as totalOrderCount. */
  totalBirds: number;
  totalBoxes: number;
  routeStatus: RouteStatus;
  routePriority: RoutePriorityLevel;
  priorityReasons: string[];
  calculationState: CalculationState;
  /** True when any stop was promoted to protect a cross-phase deadline. */
  deadlineConflicts: boolean;
  /** Number of stops whose arrival is at/after deadline. */
  atRiskCount: number;
}

export type RoutePriorityLevel = "HIGH" | "MEDIUM" | "LOW";

/* ------------------------------------------------------------------ */
/*  Vehicle recommendation                                             */
/* ------------------------------------------------------------------ */

/** Hard-constraint eligibility (availability/capacity/pickup/GPS). */
export type VehicleEligibility = "Eligible" | "At Risk" | "Not Eligible";

/** Soft recommendation tier, surfaced to the supervisor. */
export type RecommendationTier = "Best Match" | "Alternative" | "At Risk" | "Not Suitable";

/** A candidate vehicle for a single order (hierarchically evaluated). */
export interface VehicleCandidate {
  vehicle: RouteVehicle;
  eligibility: VehicleEligibility;
  /** Human-readable reasons for eligibility or exclusion. */
  eligibilityReasons: string[];
  /** Human-readable warnings (e.g. "arrives 20 min after deadline"). */
  warnings: string[];
  distanceKm: number | null;
  travelMinutes: number | null;
  departureTime: string | null;
  /** Predicted arrival "HH:mm". */
  predictedArrival: string | null;
  bufferMinutes: number | null;
  bufferState: BufferState;
  deadlineFeasible: DeadlineFeasibility;
  planningState: PlanningState;
  /** Human-readable recommendation reasons. */
  reasons: string[];
  tier: RecommendationTier;
}

/** Result of a distance/ETA calculation. */
export interface DistanceResult {
  distanceKm: number | null;
  travelMinutes: number | null;
  eta: string | null;
  state: CalculationState;
  isEstimate: boolean;
}
