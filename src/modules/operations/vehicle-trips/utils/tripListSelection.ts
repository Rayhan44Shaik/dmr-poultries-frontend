/**
 * Keeps the Trip List selection honest: a selected id is only usable while its
 * trip is part of the currently visible page. Returns the id unchanged when it
 * is visible, otherwise null so View can never open a stale trip.
 */
export function resolveVisibleTripSelection<T extends { id: number }>(
  selectedId: number | null,
  visibleTrips: readonly T[],
): number | null {
  if (selectedId == null) return null;
  return visibleTrips.some((trip) => trip.id === selectedId) ? selectedId : null;
}
