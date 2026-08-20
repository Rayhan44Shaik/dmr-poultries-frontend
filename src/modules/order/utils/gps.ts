// src/modules/order/utils/gps.ts
// -----------------------------------------------------------------------------
// GPS validation + quality classification. A coordinate is never trusted merely
// because it exists — latitude/longitude ranges and accuracy are verified.
// -----------------------------------------------------------------------------

import type { GpsCoordinate, GpsQuality } from "../types/orderTypes";
import { POOR_ACCURACY_METERS, STALE_AFTER_MINUTES } from "./businessTime";

export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;

export function isValidLatitude(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value >= MIN_LATITUDE && value <= MAX_LATITUDE;
}

export function isValidLongitude(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value >= MIN_LONGITUDE && value <= MAX_LONGITUDE;
}

/** A coordinate is usable only when both lat and lon are within valid ranges. */
export function isValidCoordinate(gps: GpsCoordinate | null | undefined): gps is GpsCoordinate {
  return !!gps && isValidLatitude(gps.latitude) && isValidLongitude(gps.longitude);
}

/**
 * Classify a coordinate into a GpsQuality. `nowMs` must be passed explicitly so
 * this stays a pure, testable function (no Date.now() inside).
 */
export function classifyGps(gps: GpsCoordinate | null | undefined, nowMs: number): GpsQuality {
  if (!gps) return "Unavailable";
  if (!isValidCoordinate(gps)) return "Invalid";
  if (gps.accuracyMeters != null && gps.accuracyMeters > POOR_ACCURACY_METERS) return "Poor Accuracy";
  if (gps.timestamp == null) return "Unavailable";
  const ageMs = nowMs - new Date(gps.timestamp).getTime();
  if (Number.isNaN(ageMs)) return "Unavailable";
  if (ageMs > STALE_AFTER_MINUTES * 60_000) return "Stale";
  return "Fresh";
}
