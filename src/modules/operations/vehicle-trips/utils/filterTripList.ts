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
  /** Matches all visible Trip List columns, including vehicle plates. */
  search?: string;
};

const dateOnly = (value: string | undefined) => (value || "").slice(0, 10);
const compact = (value: string) => value.toLocaleLowerCase().replace(/[\s-]/g, "");

function matchesGlobalSearch(trip: Trip, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  const values = [
    trip.tripNo,
    trip.tripDate,
    trip.vehicleNo,
    trip.driverName,
    trip.supervisorName,
    trip.sourceFarm,
    trip.totalShops,
    trip.totalBirds,
    trip.totalWeight,
    trip.totalMortality,
  ].map((value) => String(value ?? ""));
  const haystack = values.join(" ").toLocaleLowerCase();
  // Vehicle plates are displayed as "TS 07 UB 1222", but are often stored as
  // "TS07UB1222". Ignore spaces and hyphens so either form finds the same trip.
  return haystack.includes(query) || compact(haystack).includes(compact(query));
}

export function filterTripListTrips(
  trips: readonly Trip[],
  { fromDate, toDate, vehicleId, supervisorId, farmId, search = "" }: TripListClientFilters,
): Trip[] {
  const from = dateOnly(fromDate);
  const to = dateOnly(toDate);

  return trips.filter((trip) => {
    const tripDate = dateOnly(trip.tripDate);
    if ((from && (!tripDate || tripDate < from)) || (to && (!tripDate || tripDate > to))) return false;
    if (vehicleId != null && Number(trip.vehicleId) !== vehicleId) return false;
    if (supervisorId != null && Number(trip.supervisorId) !== supervisorId) return false;
    if (farmId != null && Number(trip.sourceFarmId) !== farmId) return false;
    return matchesGlobalSearch(trip, search);
  });
}
