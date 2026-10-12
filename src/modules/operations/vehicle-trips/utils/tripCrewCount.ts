import type { Trip } from "../types/trip";

/** Number of employees travelling on the trip for the Meals expense label. */
export function tripMealEmployeeCount(trip: Partial<Trip>): number {
  const people = new Set<string>();
  const add = (value: unknown, fallback?: string) => {
    const name = String(value ?? "").trim().toLocaleUpperCase("en-IN");
    if (name) people.add(name);
    else if (fallback) people.add(fallback);
  };

  add(trip.driverName, trip.driverId ? `DRIVER:${trip.driverId}` : undefined);
  add(trip.supervisorName, trip.supervisorId ? `SUPERVISOR:${trip.supervisorId}` : undefined);
  for (const helper of Array.isArray(trip.helpers) ? trip.helpers : []) add(helper);
  for (const loader of Array.isArray(trip.loaders) ? trip.loaders : []) add(loader);
  return people.size;
}
