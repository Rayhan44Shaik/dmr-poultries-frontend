import type { Trip } from "../types/trip";

/**
 * Applies the Trip List's visible filters on the client as a final safeguard.
 *
 * The API receives the same filters to keep the response small when the server
 * supports them. Filtering the complete returned result here guarantees that a
 * server which ignores one of those query parameters can never show unrelated
 * trips in the table.
 */
export type TripListClientFilters = {
  fromDate?: string;
  toDate?: string;
  vehicleId?: number;
  supervisorId?: number;
  farmId?: number;
};

const dateOnly = (value: string | undefined) => (value || "").slice(0, 10);

export function filterTripListTrips(
  trips: readonly Trip[],
  { fromDate, toDate, vehicleId, supervisorId, farmId }: TripListClientFilters,
): Trip[] {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);

  return trips.filter((trip) => {
    const tripDate = dateOnly(trip.tripDate);
    if ((from && (!tripDate || tripDate < from)) || (to && (!tripDate || tripDate > to))) return false;
    if (vehicleId != null && Number(trip.vehicleId) !== vehicleId) return false;
    if (supervisorId != null && Number(trip.supervisorId) !== supervisorId) return false;
    if (farmId != null && Number(trip.sourceFarmId) !== farmId) return false;
    return true;
  });
}
