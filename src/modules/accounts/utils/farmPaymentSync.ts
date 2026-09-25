import { useEffect } from 'react';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { FarmPayment, TripFarmPayment } from '../types/farmPayment.types';

/**
 * Farm Payment ↔ Trip List sync helpers.
 *
 * A trip belongs on the Farm Payment page exactly when the backend counts it
 * as completed: status 'Completed' and not soft-deleted (the same rule as
 * GET /api/operations/trip-list and GET /api/accounts/farm-payments), plus a
 * submitted pickup step so the farm-figure columns (birds / DC weight) exist.
 * The predicate lives here — not inline in the page — so the rule is defined
 * once and unit-tested.
 */
export function isFarmPaymentTrip(
  trip: Pick<Trip, 'status' | 'deleted' | 'pickupStepSubmitted'>,
): boolean {
  return trip.status === 'Completed' && !trip.deleted && trip.pickupStepSubmitted === true;
}

/**
 * Merge a freshly loaded trip list into the page's payment form state.
 *
 * Newly completed trips appear immediately (a row per trip, built from the
 * trip + its ledger row); rows the user edited since the last load/save are
 * preserved untouched, so a background refresh landing mid-entry can never
 * eat typed rates. Trips that left the list simply lose their key — the table
 * renders from the trip list, so no ghost rows.
 */
export function mergeFarmPaymentRows(
  prev: Record<string, Partial<FarmPayment>>,
  trips: Trip[],
  ledger: Map<string, TripFarmPayment>,
  dirtyIds: Set<string>,
  buildRow: (trip: Trip, apiRow?: TripFarmPayment) => Partial<FarmPayment>,
): Record<string, Partial<FarmPayment>> {
  const next: Record<string, Partial<FarmPayment>> = {};
  for (const trip of trips) {
    const id = String(trip.id);
    const kept = dirtyIds.has(id) ? prev[id] : undefined;
    next[id] = kept ?? buildRow(trip, ledger.get(id));
  }
  return next;
}

/**
 * Farm-supplied figures for one payment row.
 *
 * The backend ledger carries the persisted pickup figures (total_birds /
 * dc_weight); the trip summary's totalBirds is the delivery-side aggregate,
 * net of in-transit mortality. Preferring the ledger keeps the row identical
 * to what Account Analysis charges for the same trip.
 */
export function farmPaymentRowDetails(
  trip: Pick<Trip, 'totalBirds' | 'dcWeight'>,
  apiRow?: TripFarmPayment,
): { totalBirds: number; dcWeight: number } {
  return {
    totalBirds: apiRow?.totalBirds || trip.totalBirds || 0,
    dcWeight: apiRow?.dcWeight || trip.dcWeight || 0,
  };
}

/**
 * Quiet resync signal: bump the refresh key whenever the page becomes visible
 * again or the window regains focus, so a trip completed elsewhere (another
 * tab, another user, supervisor mobile) lands on Farm Payment without a
 * manual Refresh. Deliberately silent — no spinner, no toast; the loader that
 * consumes the key decides what to show.
 */
export function useQuietRefreshSignal(bump: (update: (key: number) => number) => void): void {
  useEffect(() => {
    const resync = () => {
      if (document.hidden) return;
      bump((key) => key + 1);
    };
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', resync);
    return () => {
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [bump]);
}
