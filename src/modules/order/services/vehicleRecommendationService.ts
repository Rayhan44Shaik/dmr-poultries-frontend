// src/modules/order/services/vehicleRecommendationService.ts
// -----------------------------------------------------------------------------
// Transparent, deterministic vehicle recommendation for the Order module.
//
// The logic is split into two layers so it is exactly testable:
//
//   1. evaluateCandidate(order, vehicle, distanceKm, travelMinutes)
//      — pure decision logic (hard constraints + soft scoring + feasibility).
//   2. recommendVehicles(order, vehicles)
//      — computes distance/travel via the (replaceable) routing service, then
//        delegates to evaluateCandidate and finalizes the ranking.
//
// Hard constraints (a vehicle MUST pass these to be eligible):
//   1. Available
//   2. Capacity sufficient (birds <= birdCapacity AND boxes <= boxCapacity)
//   3. Pickup assigned (a farm/pickup exists)
//   4. Valid shop GPS + pickup GPS (route distance is calculable)
//
// A vehicle that is eligible but predicted to arrive after the deadline is
// classified "At Risk" — it is never silently dropped nor falsely shown as
// "Can Meet".
//
// Soft preferences (only compared AFTER hard constraints pass):
//   - Earlier predicted arrival (ETA)
//   - Shorter travel time
//   - Existing route alignment (already serving this shop's city)
//   - Fewer existing stops (load balance)
//   - Important customer (small nudge, never overrides a missed deadline)
//   - Urgent priority (amplifies deadline feasibility, never overrides it)
//
// Predicted arrival = departureTime + travelMinutes, then compared against the
// order's deadline to derive buffer + feasibility. A later-starting vehicle
// that arrives earlier is correctly preferred.
// -----------------------------------------------------------------------------

import type { Order } from "../types/orderTypes";
import type {
  RecommendationTier,
  RouteVehicle,
  VehicleCandidate,
  VehicleEligibility,
} from "../types/routeTypes";
import { classifyBuffer, classifyFeasibility } from "../utils/feasibility";
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

function reasonCapacity(order: Order, vehicle: RouteVehicle): string | null {
  if (order.birds > vehicle.birdCapacity) {
    return `Capacity insufficient — needs ${order.birds.toLocaleString("en-IN")} birds, has ${vehicle.birdCapacity.toLocaleString("en-IN")}`;
  }
  if (order.boxes > vehicle.boxCapacity) {
    return `Capacity insufficient — needs ${order.boxes} boxes, has ${vehicle.boxCapacity}`;
  }
  return null;
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
    distanceKm,
    travelMinutes,
    departureTime: vehicle.schedule.departureTime,
    predictedArrival: null,
    bufferMinutes: null,
    bufferState: "Unknown",
    deadlineFeasible: "Unknown",
    score: 0,
    reasons: [],
    tier: "Not Suitable",
  };

  /* ----- Hard constraints ----- */
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
    return { ...base, eligibilityReasons: ["Shop GPS is missing or invalid — route calculation unavailable"] };
  }
  if (!isValidCoordinate(vehicle.pickup.gps)) {
    return { ...base, eligibilityReasons: ["Pickup GPS is missing or invalid — route calculation unavailable"] };
  }

  /* ----- Arrival / buffer / feasibility ----- */
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

  /* ----- Reasons ----- */
  const reasons: string[] = [];
  if (deadlineFeasible === "Can Meet") reasons.push("Can meet delivery deadline");
  else if (deadlineFeasible === "At Risk") reasons.push("Arrival is close to the deadline");
  else if (deadlineFeasible === "Cannot Meet" && bufferMinutes != null) {
    reasons.push(`Predicted arrival ${Math.abs(bufferMinutes)} min after deadline`);
  }
  if (travelMinutes != null) reasons.push(`Travel ~${travelMinutes} min`);
  if (distanceKm != null) reasons.push(`Distance ~${distanceKm} km (estimate)`);
  if (vehicle.assignedOrderCount > 0) {
    reasons.push(`${vehicle.assignedOrderCount} existing stop${vehicle.assignedOrderCount > 1 ? "s" : ""}`);
  } else {
    reasons.push("No existing stops");
  }
  if (order.shop.location && vehicle.existingStopCities.includes(order.shop.location)) {
    reasons.push("Existing route already serves this area");
  }

  /* ----- Soft scoring ----- */
  let score = 0;
  if (deadlineFeasible === "Can Meet") score += 5000;
  else if (deadlineFeasible === "At Risk") score += 1000;
  else score -= 5000;

  if (departureMinutes != null && travelMinutes != null) {
    const arrivalMinutes = departureMinutes + travelMinutes;
    score += 1440 - arrivalMinutes;
  }
  if (travelMinutes != null) score += 500 - travelMinutes;
  score -= vehicle.assignedOrderCount * 40;
  if (order.shop.location && vehicle.existingStopCities.includes(order.shop.location)) score += 120;
  if (order.importantCustomer && deadlineFeasible !== "Cannot Meet") score += 30;

  if (order.priority === "Urgent") {
    if (deadlineFeasible === "Cannot Meet") score -= 10_000;
    else if (deadlineFeasible === "At Risk") score -= 3000;
    else score += 200;
  }

  return {
    ...base,
    eligibility,
    eligibilityReasons: [],
    predictedArrival,
    bufferMinutes,
    bufferState,
    deadlineFeasible,
    score,
    reasons,
  };
}

/** Rank candidates and assign recommendation tiers (best first). */
export function finalizeRecommendation(candidates: VehicleCandidate[]): RecommendationResult {
  const sorted = [...candidates].sort((a, b) => {
    const aEligible = a.eligibility !== "Not Eligible" ? 1 : 0;
    const bEligible = b.eligibility !== "Not Eligible" ? 1 : 0;
    if (aEligible !== bEligible) return bEligible - aEligible;
    if (aEligible === 1 && bEligible === 1) return b.score - a.score;
    return a.vehicle.vehicleNo.localeCompare(b.vehicle.vehicleNo);
  });

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
    summary = "Deadline at risk — no vehicle can fully meet the deadline.";
  } else if (recommended.deadlineFeasible === "At Risk") {
    summary = "Best available vehicle has a tight delivery buffer.";
  } else {
    summary = `${recommended.vehicle.vehicleNo} can meet the deadline.`;
  }

  sorted.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.score - a.score);

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
  return finalizeRecommendation(candidates);
}
