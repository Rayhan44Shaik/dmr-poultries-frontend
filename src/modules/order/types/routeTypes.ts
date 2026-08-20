// src/modules/order/types/routeTypes.ts
// -----------------------------------------------------------------------------
// Route / delivery planning types for the Order module.
// -----------------------------------------------------------------------------

import type { GpsCoordinate, GpsQuality, OrderPriority, OrderStatus, PickupSource } from "./orderTypes";

export type RouteStatus = "Planned" | "Ready" | "In Transit" | "Completed";

/** State of a route/distance calculation — never fake a "Calculated" value. */
export type CalculationState = "Pending" | "Estimated" | "Calculated" | "Unavailable" | "Invalid";

/** Deadline feasibility of a predicted arrival vs. the required deadline. */
export type DeadlineFeasibility = "Can Meet" | "At Risk" | "Cannot Meet" | "Unknown";

/** Delivery buffer classification (deadline minus predicted arrival). */
export type BufferState = "Healthy" | "Tight" | "At Risk" | "Late" | "Unknown";

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
  status: OrderStatus;
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
  /** Configured bird capacity, used only for recommendation checks. */
  birdCapacity: number;
  boxCapacity: number;
  available: boolean;
  assignedOrderCount: number;
  schedule: VehicleSchedule;
  currentGps: GpsCoordinate | null;
  currentGpsStatus: GpsQuality;
  /** Cities already served by this vehicle's existing route. */
  existingStopCities: string[];
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
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  totalBirds: number;
  totalBoxes: number;
  routeStatus: RouteStatus;
  routePriority: RoutePriorityLevel;
  priorityReasons: string[];
  calculationState: CalculationState;
}

export type RoutePriorityLevel = "HIGH" | "MEDIUM" | "LOW";

/* ------------------------------------------------------------------ */
/*  Vehicle recommendation                                             */
/* ------------------------------------------------------------------ */

/** Hard-constraint eligibility (availability/capacity/pickup/GPS). */
export type VehicleEligibility = "Eligible" | "At Risk" | "Not Eligible";

/** Soft recommendation tier, surfaced to the supervisor. */
export type RecommendationTier = "Best Match" | "Alternative" | "At Risk" | "Not Suitable";

/** A scored candidate vehicle for a single order. */
export interface VehicleCandidate {
  vehicle: RouteVehicle;
  eligibility: VehicleEligibility;
  /** Human-readable reasons for eligibility or exclusion. */
  eligibilityReasons: string[];
  distanceKm: number | null;
  travelMinutes: number | null;
  departureTime: string | null;
  /** Predicted arrival "HH:mm". */
  predictedArrival: string | null;
  bufferMinutes: number | null;
  bufferState: BufferState;
  deadlineFeasible: DeadlineFeasibility;
  score: number;
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
