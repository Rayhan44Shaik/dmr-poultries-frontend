// src/modules/order/types/routeTypes.ts
// -----------------------------------------------------------------------------
// Route / delivery planning types for the Order module.
// -----------------------------------------------------------------------------

import type { OrderPriority, OrderStatus, PickupSource } from "./orderTypes";

export type RouteStatus = "Planned" | "Ready" | "In Transit" | "Completed";

/** A single delivery stop along a route. */
export interface RouteStop {
  stopNumber: number;
  orderId: string;
  orderNumber: string;
  shopName: string;
  birds: number;
  boxes: number;
  priority: OrderPriority;
  importantCustomer: boolean;
  deadline: string;
  /** Straight-line (estimated) leg distance from the previous point, km. */
  legDistanceKm: number | null;
  /** Cumulative distance from the pickup farm, km. */
  cumulativeDistanceKm: number | null;
  eta: string | null;
  status: OrderStatus;
}

/** Aggregated delivery route for one vehicle. */
export interface DeliveryRoute {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  pickup: PickupSource;
  stops: RouteStop[];
  totalDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  totalBirds: number;
  totalBoxes: number;
  routeStatus: RouteStatus;
  routePriority: RoutePriorityLevel;
  /** Human-readable reasons that drove the priority level (requirement #18). */
  priorityReasons: string[];
}

export type RoutePriorityLevel = "HIGH" | "MEDIUM" | "LOW";

/** Result of a distance/ETA calculation. */
export interface DistanceResult {
  distanceKm: number | null;
  travelMinutes: number | null;
  eta: string | null;
  /** "Calculated" (estimated) or "Calculation Pending" (no GPS/routing). */
  state: "Calculated" | "Calculation Pending";
  /** True when the value is a straight-line estimate, not a routed distance. */
  isEstimate: boolean;
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
}
