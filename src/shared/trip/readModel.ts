// src/shared/trip/readModel.ts
// -----------------------------------------------------------------------------
// The integration contract exposed to the Orders module.
//
// Orders must NOT reconstruct pickup/vehicle/farm values from raw Trip fields.
// It reads this snapshot. The snapshot is derived purely from the trip's
// submitted-step data and is therefore historical — later Farm Master / vehicle
// master edits do not mutate an already-captured trip.
//
// Values that are genuinely missing stay missing (null) — never replaced with
// fabricated defaults (no "08:00", no "0,0" GPS).
// -----------------------------------------------------------------------------

import { canAssignShopsToTrip, deriveTripStage, type TripStage } from "./workflow";
import { calculateAvgWeight } from "./calculations";
import type { Trip } from "./types";

export interface ActiveDeliveryTrip {
  tripId: number;
  tripNo: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  farm: string;
  farmAddress: string;
  /** Step 2 captured farm GPS — the official pickup origin for Orders. */
  farmGpsLat: number | null;
  farmGpsLon: number | null;
  farmGpsAccuracy: number | null;
  farmGpsTimestamp: string | null;
  vehicleStartTime: string | null;
  farmReachedTime: string | null;
  pickupCompletedTime: string | null;
  /** Step 3 actual pickup totals (authoritative starting dataset for Orders). */
  pickupBirds: number;
  pickupWeight: number;
  boxes: number;
  /** Computed actual average bird weight (kg/bird), null when unavailable. */
  averageBirdWeight: number | null;
  /** Step 2 expected average bird weight (kg/bird) when provided. */
  expectedAverageBirdWeight: number | null;
  tripStatus: Trip["status"];
  stage: TripStage;
  assignmentEligible: boolean;
}

/**
 * Build the Orders read model from a submitted trip. Pure function — no storage
 * access, no fallback values. Returns null when the trip is not (yet) an active
 * delivery trip in a usable state.
 */
export function toActiveDeliveryTrip(trip: Trip): ActiveDeliveryTrip | null {
  const lat = isValidCoordinate(trip.farmGpsLat) ? trip.farmGpsLat : null;
  const lon = isValidCoordinate(trip.farmGpsLon) ? trip.farmGpsLon : null;
  // Never treat 0,0 as a real captured GPS point (no fake GPS).
  const gpsLat = lat != null && lon != null && !(lat === 0 && lon === 0) ? lat : null;
  const gpsLon = gpsLat != null ? lon : null;
  const hasGps = gpsLat != null && gpsLon != null;

  return {
    tripId: trip.id,
    tripNo: trip.tripNo,
    vehicleNo: trip.vehicleNo,
    driverName: trip.driverName,
    supervisorName: trip.supervisorName,
    farm: trip.sourceFarm,
    farmAddress: trip.farmAddress ?? "",
    farmGpsLat: hasGps ? gpsLat : null,
    farmGpsLon: hasGps ? gpsLon : null,
    farmGpsAccuracy: trip.farmGpsAccuracy ?? null,
    farmGpsTimestamp: trip.farmGpsTime ?? null,
    vehicleStartTime: trip.startTime || null,
    farmReachedTime: trip.reachedTime || null,
    pickupCompletedTime: trip.pickupLoadTime || null,
    pickupBirds: Number(trip.totalBirds) || 0,
    pickupWeight: Number(trip.dcWeight) || 0,
    boxes: Number(trip.boxes) || 0,
    averageBirdWeight:
      trip.avgWeight != null && trip.avgWeight > 0
        ? trip.avgWeight
        : trip.totalBirds > 0
          ? calculateAvgWeight(trip.dcWeight, trip.totalBirds)
          : null,
    expectedAverageBirdWeight: trip.avgBirdWeight != null && trip.avgBirdWeight > 0 ? trip.avgBirdWeight : null,
    tripStatus: trip.status,
    stage: deriveTripStage(trip),
    assignmentEligible: canAssignShopsToTrip(trip),
  };
}

function isValidCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
