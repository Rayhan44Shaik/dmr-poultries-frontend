import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyTrip } from "../../../../shared/trip";
import type { Trip, TripLeg } from "../../../../shared/trip/types";
import { withActiveTripLeg } from "./useTripEntry";

function leg(legIndex: number, deliveryStepSubmitted: boolean): TripLeg {
  return {
    id: legIndex,
    tripId: 101,
    legIndex,
    sourceFarmId: legIndex * 10,
    sourceFarm: `Farm ${legIndex}`,
    destMeter: legIndex * 100,
    dcWeight: legIndex * 1_000,
    totalBirds: legIndex * 100,
    boxes: legIndex * 5,
    avgWeight: 2,
    farmStepSubmitted: true,
    pickupStepSubmitted: true,
    deliveryStepSubmitted,
    boxDetails: [{ boxNo: legIndex, birds: 10, weight: 20 }],
    deliveries: [],
  };
}

describe("withActiveTripLeg", () => {
  it("keeps Load 1 selected when a Step 4 response points to Load 2", () => {
    const response: Trip = {
      ...createEmptyTrip(),
      id: 101,
      activeLegIndex: 2,
      legCount: 2,
      legs: [leg(1, true), leg(2, true)],
    };

    const result = withActiveTripLeg(response, 1);

    assert.equal(result.activeLegIndex, 1);
    assert.equal(result.sourceFarm, "Farm 1");
    assert.equal(result.dcWeight, 1_000);
    assert.equal(result.deliveryStepSubmitted, true);
    assert.deepEqual(result.boxDetails, response.legs?.[0].boxDetails);
  });

  it("preserves an explicit load index even before its leg summary arrives", () => {
    const response: Trip = { ...createEmptyTrip(), id: 101, activeLegIndex: 2, legs: [] };
    assert.equal(withActiveTripLeg(response, 1).activeLegIndex, 1);
  });
});
