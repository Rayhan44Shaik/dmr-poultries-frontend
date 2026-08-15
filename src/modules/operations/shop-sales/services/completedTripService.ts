/**
 * Rate Entry data access — backed by PostgreSQL (via rateEntryApiService),
 * not localStorage. PostgreSQL is the single source of truth: a trip is
 * only ever "waiting for rate entry" here because the backend's eligibility
 * query says so, and a trip only ever disappears from this list because the
 * backend recorded an explicit lock.
 */
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import { loadTripById } from "../../vehicle-trips/services/tripHeaderApiService";
import { listEligibleTrips, saveAndLockRates } from "./rateEntryApiService";

/** Trips currently eligible for Rate Entry (Approved/Completed, not
 * deleted, not rate-locked) — the backend query is the authority. */
async function getCompletedTrips(): Promise<Trip[]> {
  return listEligibleTrips();
}

/** Loads a single trip with its shop-wise deliveries populated — used when
 * opening the Enter/Modify Rate modal for a specific trip. */
async function getTrip(id: number): Promise<Trip> {
  return loadTripById(id);
}

/** Saves shop-wise rates and locks the trip in one call (mirrors the
 * existing "Save & Lock Trip" button). Throws on failure — callers should
 * catch and surface the error rather than assume success. */
async function saveRates(tripId: number, deliveries: Trip["deliveries"]): Promise<boolean> {
  await saveAndLockRates(tripId, deliveries);
  return true;
}

/**
 * @deprecated Compatibility shims only. The separate (still localStorage-
 * based) Shop Sales module's useShopSales hook calls these to opportunistically
 * sync a delivery edit back onto a legacy "vehicleTrips" trip record — a
 * write-only path with no reader. Rate Entry itself no longer reads or
 * writes trip data via localStorage (PostgreSQL is now the only source of
 * truth for it), so these intentionally no-op rather than resurrect that
 * store. Wiring Shop Sales onto the real backend is out of scope here.
 */
function getAllTrips(): Trip[] {
  return [];
}
function updateTrip(_trip: Trip): boolean {
  return false;
}

export const completedTripService = {
  getCompletedTrips,
  getTrip,
  saveRates,
  getAllTrips,
  updateTrip,
};
