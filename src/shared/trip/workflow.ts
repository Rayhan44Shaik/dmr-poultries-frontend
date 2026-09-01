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
 * Highest step a user may legitimately OPEN right now (0-based).
 *
 * Part G business rule: before Step 1 is submitted (and the permanent Trip No
 * generated) only Step 1 is available. The moment Step 1 is submitted ALL FIVE
 * steps become openable — expenses (Step 5) can be filled while the trip is
 * still in progress. Opening a step is NOT submitting it; per-step submit
 * validation and step-order gating are enforced separately (backend-authoritative).
 */
export function getMaxAllowedTripStep(trip: TripStepFlags): number {
  return trip.startStepSubmitted ? 4 : 0;
}

/** True when the given step index cannot be opened yet (Step 1 not submitted). */
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

/**
 * Frontend mirror of the backend trip status transition state machine.
 * Backend source: backend/src/validation/trips.ts TRIP_STATUS_TRANSITIONS
 */
export const TRIP_STATUS_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  Draft: ["Pending", "Deleted"],
  Pending: ["Completed", "Deleted"],
  Completed: ["Deleted"],
  Deleted: [],
};

/**
 * Check if a status transition is valid according to the backend state machine.
 */
export function isValidTripStatusTransition(from: TripStatus, to: TripStatus): boolean {
  const allowed = TRIP_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/**
 * Get the list of valid next statuses for a given current status.
 */
export function getValidNextStatuses(status: TripStatus): TripStatus[] {
  return TRIP_STATUS_TRANSITIONS[status] ?? [];
}

/**
 * Get user-friendly label for a trip status.
 */
export function getTripStatusLabel(status: TripStatus): string {
  const labels: Record<TripStatus, string> = {
    Draft: "Draft",
    Pending: "Pending",
    Completed: "Completed",
    Deleted: "Deleted",
  };
  return labels[status] ?? status;
}
