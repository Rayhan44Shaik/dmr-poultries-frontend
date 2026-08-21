import { TRIP_STEP_DEFINITIONS, type TripStepKey } from "./definitions";
import type { Trip, TripStatus } from "./types";

export const TRIP_STATUSES = ["Draft", "Pending", "Completed", "Deleted"] as const;
export const TRIP_STEP_LABELS = TRIP_STEP_DEFINITIONS.map((step) => step.label);
export const TRIP_STEP_KEYS = TRIP_STEP_DEFINITIONS.map((step) => step.key);

export const TRIP_RESUME_ACTION_LABELS = [
  "Resume — Start / Step 1",
  "Resume — Farm / Step 2",
  "Resume — Pickup / Step 3",
  "Resume — Deliveries / Step 4",
  "Resume — End / Step 5",
] as const;

type TripStepFlags = Pick<
  Trip,
  | "startStepSubmitted"
  | "farmStepSubmitted"
  | "pickupStepSubmitted"
  | "deliveryStepSubmitted"
  | "endStepSubmitted"
  | "expensesStepSubmitted"
>;

export function isTripWizardComplete(
  trip: Pick<Trip, "endStepSubmitted" | "expensesStepSubmitted">
): boolean {
  return Boolean(trip.endStepSubmitted || trip.expensesStepSubmitted);
}

export function getNextIncompleteTripStep(trip: TripStepFlags): number {
  if (!trip.startStepSubmitted) return 0;
  if (!trip.farmStepSubmitted) return 1;
  if (!trip.pickupStepSubmitted) return 2;
  if (!trip.deliveryStepSubmitted) return 3;
  return 4;
}

/**
 * Highest step a user may legitimately open right now (0-based).
 * Completed steps below it stay reopenable; the returned index is the
 * working step; anything above it is LOCKED until the previous step is
 * actually submitted. All five steps become viewable once the trip is complete.
 */
export function getMaxAllowedTripStep(trip: TripStepFlags): number {
  if (isTripWizardComplete(trip)) return 4;
  return getNextIncompleteTripStep(trip);
}

/** True when the given step index is locked until an earlier step is submitted. */
export function isTripStepLocked(trip: TripStepFlags, index: number): boolean {
  return index > getMaxAllowedTripStep(trip);
}

export function getLastSubmittedTripStep(trip: TripStepFlags): number | null {
  if (isTripWizardComplete(trip)) return 4;
  if (trip.deliveryStepSubmitted) return 3;
  if (trip.pickupStepSubmitted) return 2;
  if (trip.farmStepSubmitted) return 1;
  if (trip.startStepSubmitted) return 0;
  return null;
}

export function getResumeActionLabel(trip: TripStepFlags): string | null {
  if (isTripWizardComplete(trip)) return null;
  return TRIP_RESUME_ACTION_LABELS[getNextIncompleteTripStep(trip)] ?? null;
}

export function getTripWizardCompletedMask(trip: TripStepFlags): {
  start: boolean;
  farm: boolean;
  pickup: boolean;
  delivery: boolean;
  end: boolean;
} {
  return {
    start: Boolean(trip.startStepSubmitted),
    farm: Boolean(trip.farmStepSubmitted),
    pickup: Boolean(trip.pickupStepSubmitted),
    delivery: Boolean(trip.deliveryStepSubmitted),
    end: isTripWizardComplete(trip),
  };
}

export function getTripStepKey(index: number): TripStepKey {
  return TRIP_STEP_DEFINITIONS[index]?.key ?? "start";
}

export function isTripEnded(
  trip: Pick<Trip, "endStepSubmitted" | "expensesStepSubmitted">
): boolean {
  return isTripWizardComplete(trip);
}

export function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === "string" && TRIP_STATUSES.includes(value as TripStatus);
}

export function isDraftStatus(status: TripStatus): boolean {
  return status === "Draft";
}

/* ------------------------------------------------------------------ */
/*  Trip lifecycle stage (derived — the authoritative assignment gate) */
/* ------------------------------------------------------------------ */

/**
 * Explicit, human-readable trip stage. Derived from the existing step-submitted
 * flags + status (NOT a new persisted status enum — the persisted `status`
 * remains Draft/Pending/Completed/Deleted to avoid breaking the backend
 * contract). Only the first three steps gate shop assignment.
 */
export type TripStage =
  | "Draft"
  | "VehicleStarted"
  | "FarmReached"
  | "PickupPending"
  | "Active"
  | "Delivering"
  | "Completed"
  | "Deleted";

export function deriveTripStage(
  trip: Pick<
    Trip,
    | "status"
    | "startStepSubmitted"
    | "farmStepSubmitted"
    | "pickupStepSubmitted"
    | "deliveryStepSubmitted"
    | "endStepSubmitted"
    | "expensesStepSubmitted"
  >
): TripStage {
  if (trip.status === "Deleted") return "Deleted";
  if (trip.status === "Completed" || isTripWizardComplete(trip)) return "Completed";
  if (trip.deliveryStepSubmitted) return "Delivering";
  if (trip.pickupStepSubmitted) return "Active";
  if (trip.farmStepSubmitted) return "PickupPending";
  if (trip.startStepSubmitted) return "FarmReached";
  return "Draft";
}

/**
 * SINGLE source of truth for whether a trip may receive shop assignments.
 *
 * A trip is assignable ONLY when:
 *   - Step 1 (vehicle start) is submitted,
 *   - Step 2 (farm reached) is submitted,
 *   - Step 3 (pickup) is submitted, AND
 *   - the trip is neither completed nor deleted.
 *
 * Orders MUST consume this rule rather than re-deriving the condition.
 */
export function canAssignShopsToTrip(
  trip: Pick<Trip, "status" | "startStepSubmitted" | "farmStepSubmitted" | "pickupStepSubmitted" | "endStepSubmitted" | "expensesStepSubmitted">
): boolean {
  if (trip.status === "Deleted" || trip.status === "Completed") return false;
  if (isTripWizardComplete(trip)) return false;
  return Boolean(trip.startStepSubmitted && trip.farmStepSubmitted && trip.pickupStepSubmitted);
}
