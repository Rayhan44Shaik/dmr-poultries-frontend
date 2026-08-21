// src/modules/order/services/tripIntegrationService.ts
// -----------------------------------------------------------------------------
// Trip Entry → Orders integration adapter.
//
// The Order module does NOT create or edit trips, vehicles, farms, or pickup
// data. It READS the authoritative Trip Entry data via the shared read model
// (shared/trip/readModel.ts) and maps each *assignment-eligible* trip into the
// order module's RouteVehicle shape.
//
// Eligibility is the single shared rule `canAssignShopsToTrip(trip)`: a trip is
// usable by Orders ONLY after Step 1 (vehicle start) + Step 2 (farm reached) +
// Step 3 (pickup) are all submitted, and it is not completed/deleted.
//
// No fabricated fallbacks: missing departure time stays null (→ "Calculation
// Pending") and missing farm GPS stays null (→ "Unavailable"). Farm GPS is the
// Step 2 captured GPS — never farm-master GPS, never vehicle-start GPS.
// -----------------------------------------------------------------------------

import { tripService } from "../../operations/vehicle-trips/services/tripService";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import { getVehicles } from "../../masters/vehicles/services/vehicleService";
import {
  canAssignShopsToTrip,
  toActiveDeliveryTrip,
  type ActiveDeliveryTrip,
} from "../../../shared/trip";
import type { Address, GpsCoordinate, PickupSource } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";
import { classifyGps, isValidCoordinate } from "../utils/gps";
import { normalizeClockTime } from "../utils/businessTime";

/** Trips that are assignment-eligible (Step 1 + 2 + 3 submitted, not done). */
export function getActiveTrips(): Trip[] {
  try {
    return tripService.getAll().filter(canAssignShopsToTrip);
  } catch {
    return [];
  }
}

/** Build a GPS coordinate from the trip's Step 2 farm GPS (null when absent/invalid). */
function tripFarmGps(trip: Trip): GpsCoordinate | null {
  if (!isValidCoordinate({ latitude: trip.farmGpsLat ?? null, longitude: trip.farmGpsLon ?? null })) {
    return null;
  }
  return {
    latitude: trip.farmGpsLat as number,
    longitude: trip.farmGpsLon as number,
    accuracyMeters: trip.farmGpsAccuracy ?? null,
    timestamp: trip.farmGpsTime ?? null,
  };
}

function tripAddress(trip: Trip): Address {
  return {
    line1: trip.farmAddress ?? "",
    city: trip.sourceFarm ?? "",
    state: "",
    pinCode: "",
  };
}

/**
 * Resolve the delivery-ready departure clock from the trip event model:
 * pickup completion (Step 3) → farm reached (Step 2) → vehicle start (Step 1).
 * Returns null when no real trip timestamp exists — NEVER a fabricated "08:00".
 */
function resolveDepartureTime(trip: Trip): string | null {
  return (
    normalizeClockTime(trip.pickupLoadTime) ??
    normalizeClockTime(trip.reachedTime) ??
    normalizeClockTime(trip.startTime) ??
    null
  );
}

/** Resolve vehicle capacity from the vehicle master (by number), else null. */
function resolveCapacity(trip: Trip): { birdCapacity: number | null; boxCapacity: number | null } {
  try {
    const vehicles = getVehicles();
    const match = vehicles.find((v) => v.vehicleNumber === trip.vehicleNo);
    if (match) {
      return {
        birdCapacity: Number.isFinite(match.birdCapacity) ? match.birdCapacity : null,
        boxCapacity: Number.isFinite(match.noOfBoxes) ? match.noOfBoxes : null,
      };
    }
  } catch {
    /* vehicle master unavailable */
  }
  return {
    birdCapacity: null,
    boxCapacity: trip.vehicleBoxCapacity != null && Number.isFinite(trip.vehicleBoxCapacity)
      ? trip.vehicleBoxCapacity
      : null,
  };
}

/** Map a Trip Entry record into an Order-module PickupSource (display only). */
export function tripToPickupSource(trip: Trip): PickupSource {
  const gps = tripFarmGps(trip);
  const gpsStatus = classifyGps(gps, Date.now());
  return {
    id: `trip-${trip.id}-farm`,
    farmName: trip.sourceFarm || "Unknown Farm",
    location: trip.sourceFarm || trip.farmAddress || "",
    address: tripAddress(trip),
    gps,
    gpsStatus,
    source: "Trip Entry Step 2",
    tripNo: trip.tripNo,
    pickupStatus: "Assigned",
  };
}

/** Map an assignment-eligible Trip Entry record into an Order-module RouteVehicle. */
export function tripToRouteVehicle(trip: Trip): RouteVehicle {
  const gps = tripFarmGps(trip);
  const gpsStatus = classifyGps(gps, Date.now());
  const { birdCapacity, boxCapacity } = resolveCapacity(trip);
  const departure = resolveDepartureTime(trip);

  return {
    id: `trip-${trip.id}`,
    vehicleNo: trip.vehicleNo,
    driverName: trip.driverName || "—",
    supervisorName: trip.supervisorName || "—",
    pickup: tripToPickupSource(trip),
    birdCapacity,
    boxCapacity,
    available: true,
    assignedOrderCount: trip.deliveries?.length ?? 0,
    schedule: {
      tripSubmittedTime: normalizeClockTime(trip.startTime) ?? null,
      loadingCompletionTime: normalizeClockTime(trip.pickupLoadTime) ?? departure,
      departureTime: departure,
    },
    currentGps: gps,
    currentGpsStatus: gpsStatus,
    existingStopCities: (trip.deliveries ?? []).map((d) => d.shopName).filter((n): n is string => Boolean(n)),
    tripNo: trip.tripNo,
    tripId: trip.id,
  };
}

/** All assignment-eligible trip-derived vehicles for the Order module. */
export function getActiveVehicles(): RouteVehicle[] {
  return getActiveTrips().map(tripToRouteVehicle);
}

/** Authoritative read model for a trip (single shared source). */
export function getActiveDeliveryTrip(trip: Trip): ActiveDeliveryTrip | null {
  return toActiveDeliveryTrip(trip);
}

export type { ActiveDeliveryTrip };

/** Rich per-trip info for the Vehicle Trips tab. */
export interface ActiveTripSummary {
  trip: Trip;
  vehicle: RouteVehicle;
  tripNo: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  pickupFarm: string;
  pickupLocation: string;
  departureTime: string | null;
  tripStatus: string;
  gpsStatus: string;
  tripDeliveries: number;
  orderAssignments: number;
  totalAssignedShops: number;
  remainingBirds: number | null;
  remainingBoxes: number | null;
}

export function summarizeActiveTrip(
  trip: Trip,
  orderAssignedByVehicle: (vehicleNo: string) => number,
): ActiveTripSummary {
  const vehicle = tripToRouteVehicle(trip);
  const orderAssignments = orderAssignedByVehicle(trip.vehicleNo);
  return {
    trip,
    vehicle,
    tripNo: trip.tripNo,
    vehicleNo: trip.vehicleNo,
    driverName: trip.driverName || "—",
    supervisorName: trip.supervisorName || "—",
    pickupFarm: trip.sourceFarm || "Unknown Farm",
    pickupLocation: trip.sourceFarm || trip.farmAddress || "",
    departureTime: vehicle.schedule.departureTime,
    tripStatus: trip.status,
    gpsStatus: vehicle.currentGpsStatus,
    tripDeliveries: trip.deliveries?.length ?? 0,
    orderAssignments,
    totalAssignedShops: (trip.deliveries?.length ?? 0) + orderAssignments,
    remainingBirds: vehicle.birdCapacity != null ? Math.max(0, vehicle.birdCapacity - trip.totalBirds) : null,
    remainingBoxes: vehicle.boxCapacity != null ? Math.max(0, vehicle.boxCapacity - trip.boxes) : null,
  };
}
