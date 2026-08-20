// src/modules/order/services/vehicleRecommendationService.ts
// -----------------------------------------------------------------------------
// Transparent, deterministic vehicle recommendation for the Order module.
// Not an optimization engine — plain, documented business rules.
// -----------------------------------------------------------------------------

import type { Order } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";
import { haversineKm } from "./routeCalculationService";

export interface VehicleRecommendation {
  vehicle: RouteVehicle;
  /** Short, human-readable reason for the recommendation. */
  reason: string;
  /** Score used to rank candidates (higher = better). */
  score: number;
}

export interface VehicleRecommendationInput {
  order: Order;
  vehicles: RouteVehicle[];
  /** Average loaded-vehicle speed used only to break ties in the reason text. */
  avgSpeedKmh?: number;
}

/**
 * Recommend a vehicle for an order using documented factors:
 *   1. Availability — unavailable vehicles are excluded outright.
 *   2. Capacity — a vehicle that cannot carry the order is excluded.
 *   3. Proximity — distance from the vehicle's pickup farm to the shop.
 *   4. Load balance — prefer vehicles with fewer already-assigned orders.
 *
 * Returns the ranked candidate or null when no suitable vehicle exists
 * (the UI then shows "No suitable vehicle is currently available").
 */
export function recommendVehicle(input: VehicleRecommendationInput): VehicleRecommendation | null {
  const { order, vehicles } = input;
  const shopGps = order.shop.gps;

  const candidates: VehicleRecommendation[] = [];

  for (const vehicle of vehicles) {
    if (!vehicle.available) continue;

    const birds = order.birds;
    const boxes = order.boxes;
    const capacityOk =
      birds <= vehicle.birdCapacity && boxes <= vehicle.boxCapacity;
    if (!capacityOk) continue;

    // Proximity: shorter pickup→shop distance is better (when GPS available).
    const distance = haversineKm(vehicle.pickup.gps, shopGps);
    const distancePenalty = distance == null ? 200 : distance;

    // Load balance: prefer vehicles carrying fewer orders.
    const loadPenalty = vehicle.assignedOrderCount * 12;

    const score = 1000 - distancePenalty - loadPenalty;

    const reason =
      distance == null
        ? "Pickup/Shop GPS unavailable — distance not used"
        : `Vehicle already near pickup location (~${distance} km)`;

    candidates.push({ vehicle, reason, score });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
