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
 * Step-enablement dependency model (0-based step indexes).
 *
 * Each step opens only once its immediate predecessor has been SUBMITTED —
 * authoritative state comes from the persisted `*StepSubmitted` flags, never
 * from "a trip exists" or temporary React state:
 *
 *   Step 1 (start, idx 0)      : always open.
 *   Step 2 (farm, idx 1)       : open once Step 1 submitted.
 *   Step 3 (pickup, idx 2)     : open once Step 2 submitted.
 *   Step 4 (deliveries, idx 3) : open once Step 3 submitted.
 *   Step 5 (expenses, idx 4)   : open once Step 1 submitted — expenses/end
 *                                details can be entered mid-trip. Its FINAL
 *                                submit is still gated on Steps 1–4 (enforced
 *                                in useTripEntry.submitEndTrip + backend
 *                                assertStepOrder); opening ≠ submitting.
 */
export function isTripStepLocked(trip: TripStepFlags, index: number): boolean {
  switch (index) {
    case 0:
      return false;
    case 1:
      return !trip.startStepSubmitted;
    case 2:
      return !trip.farmStepSubmitted;
    case 3:
      return !trip.pickupStepSubmitted;
    case 4:
      return !trip.startStepSubmitted;
    default:
      return true;
  }
}

/** Per-step lock mask for the wizard stepper (index → locked?). */
export function getTripStepLockMask(trip: TripStepFlags): boolean[] {
  return TRIP_STEP_DEFINITIONS.map((_, index) => isTripStepLocked(trip, index));
}

/**
 * Clamp a requested step index to one the user may actually open right now.
 * If the requested step is locked (stale click, direct URL/state manipulation)
 * fall back to the first incomplete step, which is always unlocked.
 */
export function clampTripStepIndex(trip: TripStepFlags, requested: number): number {
  const safe = Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 0;
  if (!isTripStepLocked(trip, safe)) return safe;
  return getNextIncompleteTripStep(trip);
}

/**
 * Highest step reachable through the normal linear chain (0-based). Kept for
 * callers that only need the contiguous ceiling; note Step 5 (idx 4) can be
 * open even when this returns a lower value — use {@link isTripStepLocked} /
 * {@link getTripStepLockMask} for authoritative per-step gating.
 */
export function getMaxAllowedTripStep(trip: TripStepFlags): number {
  if (!trip.startStepSubmitted) return 0;
  if (!trip.farmStepSubmitted) return 1;
  if (!trip.pickupStepSubmitted) return 2;
  if (!trip.deliveryStepSubmitted) return 3;
  return 4;
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
 *
 * This governs the *status control* only:
 *   Draft    → Pending      (once Step 5 is submitted — automatic on submit)
 *   Pending  → Completed    (manual approve on Recent Trip Activity Pending tab)
 *   Completed → (terminal for ordinary editing — leaves Pending list)
 *   Deleted  → (terminal)
 *
 * `Pending → Draft` MUST NEVER EXIST.
 * Completed trips leave the Pending tab (shown on Trip List / accounts, not here).
 *
 * Deletion is NOT a status transition. Reaching `Deleted` is done exclusively
 * through the dedicated Delete action and its 10-second undo — never the status
 * dropdown, on either the frontend or the backend.
 */
export const TRIP_STATUS_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  Draft: ["Pending"],
  Pending: ["Completed"],
  Completed: [],
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
