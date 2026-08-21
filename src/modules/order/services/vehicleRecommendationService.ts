// src/modules/order/services/vehicleRecommendationService.ts
// -----------------------------------------------------------------------------
// Transparent, deterministic vehicle recommendation for the Order module.
//
// The logic is split into two layers so it is exactly testable:
//
//   1. evaluateCandidate(order, vehicle, distanceKm, travelMinutes)
//      — pure decision logic (hard constraints + hierarchical comparison).
//   2. recommendVehicles(order, vehicles)
//      — computes distance/travel via the (replaceable) routing service, then
//        delegates to evaluateCandidate and finalizes the ranking.
//
// There is NO single "magic score" (requirement #14). Ranking uses a
// deterministic hierarchy, most-significant first:
//
//   L1  Eligibility  (Eligible > At Risk > Not Eligible)
//       - available, capacity, pickup assigned, valid shop + pickup GPS
//   L2  Deadline feasibility  (Can Meet > At Risk > Cannot Meet)
//   L3  Predicted arrival  (earlier = better) — a later-starting vehicle that
//       arrives earlier wins.
//   L4  Existing route alignment  (already serving this shop's city)
//   L5  Existing route load  (fewer assigned stops)
//   L6  Vehicle number  (stable, deterministic tie-break)
//
// A vehicle that is eligible but predicted to arrive after the deadline is
// classified "At Risk" — never silently dropped nor falsely shown as "Can
// Meet". Important customer and Urgent priority adjust the *explanation*, not
// the hard feasibility (an impossible deadline stays impossible).
// -----------------------------------------------------------------------------

import type { Order } from "../types/orderTypes";
import type {
  RecommendationTier,
  RouteVehicle,
  VehicleCandidate,
  VehicleEligibility,
} from "../types/routeTypes";
import { classifyBuffer, classifyFeasibility, planningStateOf } from "../utils/feasibility";
import { isValidCoordinate } from "../utils/gps";
import { formatHHmm, parseHHmm } from "../utils/businessTime";
import { haversineKm, mockRouteCalculationService } from "./routeCalculationService";

export interface RecommendationResult {
  /** All candidates, best first (Not Eligible candidates sort to the bottom). */
  candidates: VehicleCandidate[];
  /** The best feasible candidate, or null when no eligible vehicle exists. */
  recommended: VehicleCandidate | null;
  /** True when no candidate can fully meet the deadline. */
  allLate: boolean;
  /** Short human-readable summary. */
  summary: string;
}

export interface RecommendVehiclesInput {
  order: Order;
  vehicles: RouteVehicle[];
}

const TIER_ORDER: Record<RecommendationTier, number> = {
  "Best Match": 0,
  Alternative: 1,
  "At Risk": 2,
  "Not Suitable": 3,
};

const ELIGIBILITY_RANK: Record<VehicleEligibility, number> = {
  Eligible: 2,
  "At Risk": 1,
  "Not Eligible": 0,
};

const FEASIBILITY_RANK: Record<string, number> = {
  "Can Meet": 3,
  "At Risk": 2,
  "Cannot Meet": 1,
  Unknown: 0,
};

function reasonCapacity(order: Order, vehicle: RouteVehicle): string | null {
  if (order.birds > vehicle.birdCapacity) {
    return `Capacity insufficient — needs ${order.birds.toLocaleString("en-IN")} birds, has ${vehicle.birdCapacity.toLocaleString("en-IN")}`;
  }
  if (order.boxes > vehicle.boxCapacity) {
    return `Capacity insufficient — needs ${order.boxes} boxes, has ${vehicle.boxCapacity}`;
  }
  return null;
}

/** Deterministic hierarchical comparator (higher = better candidate). */
function compareCandidates(order: Order, a: VehicleCandidate, b: VehicleCandidate): number {
  const eligibility = ELIGIBILITY_RANK[a.eligibility] - ELIGIBILITY_RANK[b.eligibility];
  if (eligibility !== 0) return eligibility;

  const feasibility = (FEASIBILITY_RANK[a.deadlineFeasible] ?? 0) - (FEASIBILITY_RANK[b.deadlineFeasible] ?? 0);
  if (feasibility !== 0) return feasibility;

  const arrivalA = a.predictedArrival != null ? parseHHmm(a.predictedArrival) : null;
  const arrivalB = b.predictedArrival != null ? parseHHmm(b.predictedArrival) : null;
  if (arrivalA != null && arrivalB != null && arrivalA !== arrivalB) return arrivalB - arrivalA;

  const routeA = order.shop.location && a.vehicle.existingStopCities.includes(order.shop.location) ? 1 : 0;
  const routeB = order.shop.location && b.vehicle.existingStopCities.includes(order.shop.location) ? 1 : 0;
  if (routeA !== routeB) return routeA - routeB;

  const loadA = a.vehicle.assignedOrderCount;
  const loadB = b.vehicle.assignedOrderCount;
  if (loadA !== loadB) return loadB - loadA;

  return b.vehicle.vehicleNo.localeCompare(a.vehicle.vehicleNo);
}

/**
 * Pure decision logic for a single vehicle, given an already-computed distance
 * and travel time (from the routing abstraction).
 */
export function evaluateCandidate(
  order: Order,
  vehicle: RouteVehicle,
  distanceKm: number | null,
  travelMinutes: number | null,
): VehicleCandidate {
  const base: VehicleCandidate = {
    vehicle,
    eligibility: "Not Eligible",
    eligibilityReasons: [],
    warnings: [],
    distanceKm,
    travelMinutes,
    departureTime: vehicle.schedule.departureTime,
    predictedArrival: null,
    bufferMinutes: null,
    bufferState: "Unknown",
    deadlineFeasible: "Unknown",
    planningState: "Unroutable",
    reasons: [],
    tier: "Not Suitable",
  };

  /* ----- Hard constraints (L1) ----- */
  if (!vehicle.available) {
    return { ...base, eligibilityReasons: ["Vehicle is not available"] };
  }
  const capacityReason = reasonCapacity(order, vehicle);
  if (capacityReason) {
    return { ...base, eligibilityReasons: [capacityReason] };
  }
  if (!vehicle.pickup) {
    return { ...base, eligibilityReasons: ["No pickup/farm assigned to this vehicle"] };
  }
  if (!isValidCoordinate(order.shop.gps)) {
    return { ...base, eligibilityReasons: ["Shop GPS is missing or invalid — route calculation unavailable"], warnings: ["Shop GPS is unavailable"] };
  }
  if (!isValidCoordinate(vehicle.pickup.gps)) {
    return { ...base, eligibilityReasons: ["Pickup GPS is missing or invalid — route calculation unavailable"], warnings: ["Pickup GPS is unavailable"] };
  }

  /* ----- Arrival / buffer / feasibility (L2/L3) ----- */
  const departureMinutes = parseHHmm(vehicle.schedule.departureTime);
  const deadlineMinutes = parseHHmm(order.deadlineTime);

  const predictedArrival =
    departureMinutes != null && travelMinutes != null ? formatHHmm(departureMinutes + travelMinutes) : null;
  const bufferMinutes =
    deadlineMinutes != null && departureMinutes != null && travelMinutes != null
      ? deadlineMinutes - (departureMinutes + travelMinutes)
      : null;

  const bufferState = classifyBuffer(bufferMinutes);
  const deadlineFeasible = classifyFeasibility(bufferMinutes);

  let eligibility: VehicleEligibility = "Eligible";
  if (deadlineFeasible === "Cannot Meet" || deadlineFeasible === "At Risk") eligibility = "At Risk";

  /* ----- Reasons + warnings ----- */
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (deadlineFeasible === "Can Meet") reasons.push("Deadline feasible");
  else if (deadlineFeasible === "At Risk") {
    reasons.push("Arrival is close to the deadline");
    warnings.push("Arrival is close to the deadline");
  } else if (deadlineFeasible === "Cannot Meet" && bufferMinutes != null) {
    warnings.push(`Predicted arrival ${Math.abs(bufferMinutes)} min after deadline`);
    reasons.push(`Predicted arrival ${Math.abs(bufferMinutes)} min after deadline`);
  }
  if (distanceKm != null) reasons.push(`Distance ~${distanceKm} km (estimate)`);
  if (travelMinutes != null) reasons.push(`Travel ~${travelMinutes} min`);
  if (vehicle.assignedOrderCount > 0) {
    reasons.push(`${vehicle.assignedOrderCount} existing stop${vehicle.assignedOrderCount > 1 ? "s" : ""}`);
  } else {
    reasons.push("No existing stops");
  }
  if (order.shop.location && vehicle.existingStopCities.includes(order.shop.location)) {
    reasons.push("Existing route already serves this area");
  }

  return {
    ...base,
    eligibility,
    eligibilityReasons: [],
    predictedArrival,
    bufferMinutes,
    bufferState,
    deadlineFeasible,
    planningState: planningStateOf(deadlineFeasible),
    reasons,
    warnings,
  };
}

/** Rank candidates hierarchically and assign recommendation tiers (best first). */
export function finalizeRecommendation(order: Order, candidates: VehicleCandidate[]): RecommendationResult {
  const sorted = [...candidates].sort((a, b) => compareCandidates(order, b, a));

  const eligible = sorted.filter((c) => c.eligibility !== "Not Eligible");
  const recommended = eligible.length > 0 ? eligible[0] : null;

  const minAssigned = eligible.length > 0 ? Math.min(...eligible.map((c) => c.vehicle.assignedOrderCount)) : 0;
  const maxAssigned = eligible.length > 0 ? Math.max(...eligible.map((c) => c.vehicle.assignedOrderCount)) : 0;

  for (const candidate of sorted) {
    if (candidate.eligibility === "Not Eligible") {
      candidate.tier = "Not Suitable";
      continue;
    }
    if (recommended && candidate.vehicle.id === recommended.vehicle.id) {
      candidate.tier = candidate.deadlineFeasible === "Cannot Meet" ? "At Risk" : "Best Match";
      if (candidate.tier === "Best Match") {
        candidate.reasons.unshift("Earliest feasible ETA");
        candidate.reasons.unshift("Capacity available");
        if (candidate.vehicle.assignedOrderCount === minAssigned && minAssigned < maxAssigned) {
          candidate.reasons.unshift("Lower existing route load");
        }
      }
    } else if (candidate.deadlineFeasible === "Cannot Meet" || candidate.deadlineFeasible === "At Risk") {
      candidate.tier = "At Risk";
    } else {
      candidate.tier = "Alternative";
    }
  }

  const allLate = eligible.length > 0 && eligible.every((c) => c.deadlineFeasible === "Cannot Meet");

  let summary: string;
  if (!recommended) {
    summary = "No eligible vehicle is currently available.";
  } else if (allLate) {
    summary = "No vehicle can meet the deadline — best available (least late) shown.";
  } else if (recommended.deadlineFeasible === "At Risk") {
    summary = "Best available vehicle has a tight delivery buffer.";
  } else {
    summary = `${recommended.vehicle.vehicleNo} can meet the deadline.`;
  }

  sorted.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || compareCandidates(order, b, a));

  return { candidates: sorted, recommended, allLate, summary };
}

export function recommendVehicles(input: RecommendVehiclesInput): RecommendationResult {
  const { order, vehicles } = input;
  const candidates = vehicles.map((vehicle) => {
    const distanceKm = haversineKm(vehicle.pickup.gps, order.shop.gps);
    const travelMinutes =
      distanceKm != null ? mockRouteCalculationService.estimateTravelMinutes(distanceKm) : null;
    return evaluateCandidate(order, vehicle, distanceKm, travelMinutes);
  });
  return finalizeRecommendation(order, candidates);
}
