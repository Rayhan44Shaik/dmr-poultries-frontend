// src/modules/order/services/routeCalculationService.ts
// -----------------------------------------------------------------------------
// Distance / ETA / route abstraction for the Order module.
//
// A real routing API (map provider) can later replace the mock implementation
// *without* redesigning the UI — callers depend only on the functions and the
// `RouteCalculationService` interface below. The intended future surface is a
// route matrix (pickup → each shop, and shop → shop), which the default mock
// approximates with the haversine (great-circle) straight-line distance.
//
// Every distance produced here is a STRAIGHT-LINE ESTIMATE, flagged as such
// (`isEstimate: true`, `calculationState: "Estimated"`). It is never presented
// as a real road distance.
// -----------------------------------------------------------------------------

import type { GpsCoordinate } from "../types/orderTypes";
import type { DistanceResult, RouteLeg } from "../types/routeTypes";
import { formatHHmm } from "../utils/businessTime";
import { isValidCoordinate } from "../utils/gps";

export interface RouteCalculationService {
  /** Straight-line distance between two coordinates, or "Unavailable". */
  calculateDistance(origin: GpsCoordinate | null, destination: GpsCoordinate | null): DistanceResult;
  /** Estimated travel time in minutes for a distance at an average speed. */
  estimateTravelMinutes(distanceKm: number, avgSpeedKmh?: number): number;
}

const EARTH_RADIUS_KM = 6371;
/** Average loaded-poultry truck speed (km/h) used for demo estimates only. */
const DEFAULT_AVG_SPEED_KMH = 40;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lon points (km).
 * Returns null when either coordinate is missing or invalid.
 */
export function haversineKm(a: GpsCoordinate | null, b: GpsCoordinate | null): number | null {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return null;
  const lat1 = a.latitude as number;
  const lon1 = a.longitude as number;
  const lat2 = b.latitude as number;
  const lon2 = b.longitude as number;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const km = EARTH_RADIUS_KM * c;
  return Math.round(km * 10) / 10;
}

export const mockRouteCalculationService: RouteCalculationService = {
  calculateDistance(origin, destination) {
    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
      return { distanceKm: null, travelMinutes: null, eta: null, state: "Unavailable", isEstimate: false };
    }
    const distanceKm = haversineKm(origin, destination);
    if (distanceKm == null) {
      return { distanceKm: null, travelMinutes: null, eta: null, state: "Unavailable", isEstimate: false };
    }
    const travelMinutes = this.estimateTravelMinutes(distanceKm);
    return { distanceKm, travelMinutes, eta: null, state: "Estimated", isEstimate: true };
  },

  estimateTravelMinutes(distanceKm, avgSpeedKmh = DEFAULT_AVG_SPEED_KMH) {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
    const safeSpeed = avgSpeedKmh && avgSpeedKmh > 0 ? avgSpeedKmh : DEFAULT_AVG_SPEED_KMH;
    return Math.round((distanceKm / safeSpeed) * 60);
  },
};

/** Input for building a single sequential route leg. */
export interface LegInput {
  legNumber: number;
  fromName: string;
  fromGps: GpsCoordinate | null;
  toName: string;
  toAddress: string;
  toGps: GpsCoordinate | null;
  /** Departure minutes-since-midnight from the leg origin (null = unknown). */
  departureMinutes: number | null;
}

/**
 * Build a single route leg: previous point → this point, with distance, travel
 * time, and (when a departure time is known) an arrival time.
 */
export function computeLeg(input: LegInput): RouteLeg {
  const { legNumber, fromName, fromGps, toName, toAddress, toGps, departureMinutes } = input;

  if (!isValidCoordinate(fromGps) || !isValidCoordinate(toGps)) {
    return {
      legNumber,
      fromName,
      fromGps,
      toName,
      toAddress,
      toGps,
      distanceKm: null,
      travelMinutes: null,
      departureTime: departureMinutes != null ? formatHHmm(departureMinutes) : null,
      arrivalTime: null,
      calculationState: "Unavailable",
      isEstimate: false,
    };
  }

  const distanceKm = haversineKm(fromGps, toGps);
  if (distanceKm == null) {
    return {
      legNumber,
      fromName,
      fromGps,
      toName,
      toAddress,
      toGps,
      distanceKm: null,
      travelMinutes: null,
      departureTime: departureMinutes != null ? formatHHmm(departureMinutes) : null,
      arrivalTime: null,
      calculationState: "Unavailable",
      isEstimate: false,
    };
  }

  const travelMinutes = mockRouteCalculationService.estimateTravelMinutes(distanceKm);
  const arrivalMinutes = departureMinutes != null ? departureMinutes + travelMinutes : null;

  return {
    legNumber,
    fromName,
    fromGps,
    toName,
    toAddress,
    toGps,
    distanceKm,
    travelMinutes,
    departureTime: departureMinutes != null ? formatHHmm(departureMinutes) : null,
    arrivalTime: arrivalMinutes != null ? formatHHmm(arrivalMinutes) : null,
    calculationState: "Estimated",
    isEstimate: true,
  };
}
