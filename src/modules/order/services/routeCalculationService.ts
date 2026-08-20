// src/modules/order/services/routeCalculationService.ts
// -----------------------------------------------------------------------------
// Distance / ETA / route abstraction for the Order module.
//
// A real routing API (e.g. a mapping provider) can later replace the mock
// implementation below *without* redesigning the UI — callers depend only on
// the `RouteCalculationService` interface.
//
// The default mock uses the haversine (great-circle) formula over static demo
// coordinates. These are STRAIGHT-LINE ESTIMATES, clearly flagged as estimates
// (`isEstimate: true`) and never presented as real routed distances.
// -----------------------------------------------------------------------------

import type { GpsCoordinate } from "../types/orderTypes";
import type { DistanceResult } from "../types/routeTypes";

export interface RouteCalculationService {
  /** Straight-line distance between two coordinates, or "Calculation Pending". */
  calculateDistance(origin: GpsCoordinate | null, destination: GpsCoordinate | null): DistanceResult;
  /** Estimated travel time in minutes for a given distance at an average speed. */
  estimateTravelMinutes(distanceKm: number, avgSpeedKmh?: number): number;
  /** Format an ETA clock time for a departure time + travel minutes. */
  calculateEta(departureIso: string, travelMinutes: number): string;
}

const EARTH_RADIUS_KM = 6371;
/** Average loaded-poultry truck speed (km/h) used for demo estimates only. */
const DEFAULT_AVG_SPEED_KMH = 40;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lon points (km).
 * Returns null when either coordinate is missing.
 */
export function haversineKm(a: GpsCoordinate | null, b: GpsCoordinate | null): number | null {
  if (!a || !b) return null;
  if (a.latitude == null || a.longitude == null) return null;
  if (b.latitude == null || b.longitude == null) return null;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

function hasUsableGps(g: GpsCoordinate | null): g is GpsCoordinate {
  return !!g && g.latitude != null && g.longitude != null;
}

export const mockRouteCalculationService: RouteCalculationService = {
  calculateDistance(origin, destination) {
    if (!hasUsableGps(origin) || !hasUsableGps(destination)) {
      return { distanceKm: null, travelMinutes: null, eta: null, state: "Calculation Pending", isEstimate: false };
    }
    const distanceKm = haversineKm(origin, destination);
    if (distanceKm == null) {
      return { distanceKm: null, travelMinutes: null, eta: null, state: "Calculation Pending", isEstimate: false };
    }
    const travelMinutes = this.estimateTravelMinutes(distanceKm);
    return { distanceKm, travelMinutes, eta: null, state: "Calculated", isEstimate: true };
  },

  estimateTravelMinutes(distanceKm, avgSpeedKmh = DEFAULT_AVG_SPEED_KMH) {
    if (distanceKm <= 0) return 0;
    const safeSpeed = avgSpeedKmh > 0 ? avgSpeedKmh : DEFAULT_AVG_SPEED_KMH;
    return Math.round((distanceKm / safeSpeed) * 60);
  },

  calculateEta(departureIso, travelMinutes) {
    const departure = new Date(departureIso);
    if (Number.isNaN(departure.getTime())) return "--";
    const eta = new Date(departure.getTime() + travelMinutes * 60_000);
    return eta.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  },
};
