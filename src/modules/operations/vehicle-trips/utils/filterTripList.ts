import type { Trip } from "../types/trip";

/**
 * Applies the Trip List's visible filters on the client as a final safeguard.
 *
 * The API receives the same filters to keep the response small when the server
 * supports them. Filtering the complete returned result here guarantees that a
 * server which ignores one of those query parameters can never show unrelated
 * trips in the table.
 */
export type TripListSortKey =
  | "tripNo"
  | "tripDate"
  | "vehicleNo"
  | "driverName"
  | "supervisorName"
  | "sourceFarm"
  | "totalShops"
  | "totalBirds"
  | "totalWeight"
  | "totalMortality";

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
    // Older servers may ignore the completed-only endpoint contract.
    if (trip.deleted || !['Completed', 'Approved'].includes(String(trip.status))) return false;
    const tripDate = dateOnly(trip.tripDate);
    if ((from && (!tripDate || tripDate < from)) || (to && (!tripDate || tripDate > to))) return false;
    if (vehicleId != null && Number(trip.vehicleId) !== vehicleId) return false;
    if (supervisorId != null && Number(trip.supervisorId) !== supervisorId) return false;
    if (farmId != null && Number(trip.sourceFarmId) !== farmId) return false;
    return matchesGlobalSearch(trip, search);
  });
}

/**
 * Applies the selected Trip List ordering client-side as well as through the
 * API query. This keeps the displayed order reliable on older API versions
 * that return valid filter data but ignore a sort query.
 */
/**
 * Default Trip List order — newest first, oldest last.
 *
 * With no column chosen, the list reads the way the register is used: the run
 * that just came in sits at the top, and the earliest trip falls to the bottom
 * of the page. Trip numbers are date-stamped (TRP-YYYYMMDD-NNN) and the day is
 * compared first, so the order survives a same-day renumber and never depends
 * on the order the API happened to return rows in.
 */
function compareTripsNewestFirst(left: Trip, right: Trip): number {
  const byDay = String(right.tripDate ?? "").localeCompare(String(left.tripDate ?? ""));
  if (byDay !== 0) return byDay;
  return String(right.tripNo ?? "").localeCompare(String(left.tripNo ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortTripListTrips(
  trips: readonly Trip[],
  sortBy: TripListSortKey | null | undefined,
  sortDir: "asc" | "desc" = "asc",
): Trip[] {
  if (!sortBy) return [...trips].sort(compareTripsNewestFirst);

  const direction = sortDir === "desc" ? -1 : 1;
  const numericKeys = new Set<TripListSortKey>([
    "totalShops",
    "totalBirds",
    "totalWeight",
    "totalMortality",
  ]);
  const stringValue = (trip: Trip) => String(trip[sortBy] ?? "");

  return [...trips].sort((left, right) => {
    const comparison = numericKeys.has(sortBy)
      ? Number(left[sortBy]) - Number(right[sortBy])
      : stringValue(left).localeCompare(stringValue(right), undefined, { numeric: true, sensitivity: "base" });
    if (comparison !== 0) return comparison * direction;
    return String(left.tripNo).localeCompare(String(right.tripNo), undefined, { numeric: true }) * direction;
  });
}
