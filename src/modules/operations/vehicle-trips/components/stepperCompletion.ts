import { TRIP_STEP_KEYS } from "../../../../shared/trip/workflow";

export type TripWizardCompletedMask = {
  start: boolean;
  farm: boolean;
  pickup: boolean;
  delivery: boolean;
  end?: boolean;
};

/** Map the trip completed-mask onto the 5 stepper slots (Step 5 = expenses/end). */
export function resolveStepperCompletion(completedMask: TripWizardCompletedMask): boolean[] {
  return TRIP_STEP_KEYS.map((key) => {
    if (key === "expenses") return Boolean(completedMask.end);
    const maskKey = (key === "deliveries" ? "delivery" : key) as keyof TripWizardCompletedMask;
    return Boolean(completedMask[maskKey]);
  });
}
