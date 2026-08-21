// src/modules/order/services/tripIntegrationService.ts
// -----------------------------------------------------------------------------
// Trip Entry → Orders integration adapter.
//
// The Order module does NOT create or edit trips, vehicles, farms, or pickup
// data. It READS the existing Trip Entry / Trip Header data (tripService) and
// maps each *active* trip into the order module's RouteVehicle shape so the
// recommendation + delivery-sequencing services can run against REAL trip data.
//
// Active trip = trip that is in progress (status "Pending") and has completed
// Trip Entry Step 2 (farm/pickup submitted), so a pickup + GPS + schedule exist.
//
// Capacity is read from the vehicle master when available; otherwise it is
// null (unknown) and the capacity hard-constraint is simply not enforced
// (rather than fabricating a capacity number).
// -----------------------------------------------------------------------------

import { tripService } from "../../operations/vehicle-trips/services/tripService";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import { getVehicles } from "../../masters/vehicles/services/vehicleService";
import type { Address, GpsCoordinate, PickupSource } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";
import { classifyGps, isValidCoordinate } from "../utils/gps";
import { normalizeClockTime } from "../utils/businessTime";

/** A trip is active when in progress AND farm/pickup (Step 2) is known. */
export function getActiveTrips(): Trip[] {
  try {
    return tripService.getAll().filter((t) => t.status === "Pending" && t.farmStepSubmitted);
  } catch {
    return [];
  }
}

/** Build a GPS coordinate from a trip's farm GPS fields (null when absent/invalid). */
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

/** Resolve a departure "HH:mm" from the trip schedule (loading done → reached → start). */
function resolveDepartureTime(trip: Trip): string {
  return (
    normalizeClockTime(trip.pickupLoadTime) ??
    normalizeClockTime(trip.reachedTime) ??
    normalizeClockTime(trip.startTime) ??
    "08:00"
  );
}

/** Resolve vehicle capacity from the vehicle master (by vehicle number), else null. */
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

/** Map an active Trip Entry record into an Order-module RouteVehicle. */
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
      tripSubmittedTime: normalizeClockTime(trip.startTime) ?? "08:00",
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

/** All active trip-derived vehicles for the Order module. */
export function getActiveVehicles(): RouteVehicle[] {
  return getActiveTrips().map(tripToRouteVehicle);
}

/**
 * Rich per-trip info for the Vehicle Trips tab (trip number, status, remaining
 * capacity, assigned-shop counts including Order-module assignments).
 */
export interface ActiveTripSummary {
  trip: Trip;
  vehicle: RouteVehicle;
  tripNo: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  pickupFarm: string;
  pickupLocation: string;
  departureTime: string;
  tripStatus: string;
  gpsStatus: string;
  /** Shops already delivered per Trip Entry. */
  tripDeliveries: number;
  /** Orders assigned from the Order module to this trip's vehicle. */
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
