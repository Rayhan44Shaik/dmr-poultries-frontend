/**
 * Browser-local refresh signal for views that show the same backend Trip
 * record. It is deliberately not a data store: recipients refetch from the
 * API, so Trip List never displays a client-side approximation of Shop Sales.
 */
export const TRIP_DATA_CHANGED_EVENT = "dmr:trip-data-changed";

export interface TripDataChangedDetail {
  tripId?: string | number;
  source: "shop-sales";
}

export function notifyTripDataChanged(detail: TripDataChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TripDataChangedDetail>(TRIP_DATA_CHANGED_EVENT, { detail }));
}
