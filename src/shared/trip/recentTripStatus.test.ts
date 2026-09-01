import assert from "node:assert/strict";
import test from "node:test";
import {
  TRIP_STATUS_TRANSITIONS,
  getNextIncompleteTripStep,
  getValidNextStatuses,
  isValidTripStatusTransition,
} from "./index";

/**
 * Regression coverage for Recent Trip Activity:
 *  - Part B: the badge must point at the FIRST step that is not yet submitted.
 *  - Part M/N: the lifecycle state machine. Pending -> Draft must never exist.
 */

const flags = (over: Partial<Record<
  | "startStepSubmitted"
  | "farmStepSubmitted"
  | "pickupStepSubmitted"
  | "deliveryStepSubmitted"
  | "endStepSubmitted"
  | "expensesStepSubmitted",
  boolean
>>) => ({
  startStepSubmitted: false,
  farmStepSubmitted: false,
  pickupStepSubmitted: false,
  deliveryStepSubmitted: false,
  endStepSubmitted: false,
  expensesStepSubmitted: false,
  ...over,
});

test("Part B: first incomplete step is reported (0-based)", () => {
  assert.equal(getNextIncompleteTripStep(flags({ startStepSubmitted: true })), 1);
  assert.equal(
    getNextIncompleteTripStep(flags({ startStepSubmitted: true, farmStepSubmitted: true })),
    2
  );
  assert.equal(
    getNextIncompleteTripStep(
      flags({ startStepSubmitted: true, farmStepSubmitted: true, pickupStepSubmitted: true })
    ),
    3,
    "Steps 1-3 submitted, Step 4 pending -> badge must show Step 4"
  );
  assert.equal(
    getNextIncompleteTripStep(
      flags({
        startStepSubmitted: true,
        farmStepSubmitted: true,
        pickupStepSubmitted: true,
        deliveryStepSubmitted: true,
      })
    ),
    4
  );
});

test("Part M: lifecycle transition map has no Pending -> Draft", () => {
  assert.deepEqual(TRIP_STATUS_TRANSITIONS.Draft, ["Pending", "Deleted"]);
  assert.deepEqual(TRIP_STATUS_TRANSITIONS.Pending, ["Completed", "Deleted"]);
  assert.deepEqual(TRIP_STATUS_TRANSITIONS.Completed, ["Deleted"]);
  assert.deepEqual(TRIP_STATUS_TRANSITIONS.Deleted, []);
});

test("Part N: valid / invalid transitions", () => {
  assert.equal(isValidTripStatusTransition("Draft", "Pending"), true);
  assert.equal(isValidTripStatusTransition("Draft", "Deleted"), true);
  assert.equal(isValidTripStatusTransition("Pending", "Completed"), true);
  assert.equal(isValidTripStatusTransition("Pending", "Deleted"), true);

  assert.equal(isValidTripStatusTransition("Pending", "Draft"), false);
  assert.equal(isValidTripStatusTransition("Completed", "Draft"), false);
  assert.equal(isValidTripStatusTransition("Completed", "Pending"), false);
  assert.equal(isValidTripStatusTransition("Deleted", "Draft"), false);
  assert.equal(isValidTripStatusTransition("Deleted", "Pending"), false);

  assert.equal(getValidNextStatuses("Pending").includes("Draft"), false);
  assert.equal(getValidNextStatuses("Completed").includes("Draft"), false);
});
