import { TRIP_STEP_DEFINITIONS, type TripStepKey } from "./definitions";
import type { Trip, TripStatus } from "./types";

export const TRIP_STATUSES = ["Draft", "Pending", "Completed", "Deleted"] as const;
export const TRIP_STEP_LABELS = TRIP_STEP_DEFINITIONS.map((step) => step.label);
export const TRIP_STEP_KEYS = TRIP_STEP_DEFINITIONS.map((step) => step.key);

export function getNextIncompleteTripStep(trip: Pick<
  Trip,
  "startStepSubmitted" | "farmStepSubmitted" | "pickupStepSubmitted" | "deliveryStepSubmitted"
>): number {
  if (!trip.startStepSubmitted) return 0;
  if (!trip.farmStepSubmitted) return 1;
  if (!trip.pickupStepSubmitted) return 2;
  if (!trip.deliveryStepSubmitted) return 3;
  return 4;
}

export function getTripStepKey(index: number): TripStepKey {
  return TRIP_STEP_DEFINITIONS[index]?.key ?? "start";
}

export function isTripEnded(
  trip: Pick<Trip, "endStepSubmitted" | "expensesStepSubmitted" | "status">
): boolean {
  return Boolean(
    trip.endStepSubmitted ||
      trip.expensesStepSubmitted ||
      trip.status === "Pending" ||
      trip.status === "Completed"
  );
}

export function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === "string" && TRIP_STATUSES.includes(value as TripStatus);
}

export function isDraftStatus(status: TripStatus): boolean {
  return status === "Draft";
}
