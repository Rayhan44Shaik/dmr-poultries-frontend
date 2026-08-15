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

export const completedTripService = {
  getCompletedTrips,
  getTrip,
  saveRates,
};
