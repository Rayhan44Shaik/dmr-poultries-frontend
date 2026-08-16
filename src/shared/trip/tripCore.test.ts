import assert from "node:assert/strict";
import test from "node:test";
import * as desktopTripFacade from "../../modules/operations/vehicle-trips/services/tripFormService";
import {
  TRIP_FIELD_DEFINITIONS,
  TRIP_STEP_DEFINITIONS,
  TRIP_STEP_LABELS,
  applyDeliveryMetrics,
  calculatePickupTotals,
  createEmptyTrip,
  getNextIncompleteTripStep,
  validateDeliveriesStep,
  validateFarmStep,
  validatePickupStep,
  validateStartStep,
} from "./index";

test("Desktop compatibility facade resolves to the shared validators and calculations", () => {
  assert.equal(desktopTripFacade.validateStartStep, validateStartStep);
  assert.equal(desktopTripFacade.validateFarmStep, validateFarmStep);
  assert.equal(desktopTripFacade.validatePickupStep, validatePickupStep);
  assert.equal(desktopTripFacade.calculatePickupTotals, calculatePickupTotals);
});

test("one shared definition describes the five-step Trip workflow", () => {
  assert.deepEqual(TRIP_STEP_LABELS, ["Start", "Farm", "Pickup", "Deliveries", "End"]);
  assert.equal(TRIP_STEP_DEFINITIONS.length, 5);
  assert.equal(TRIP_STEP_DEFINITIONS[0].fields.includes("vehicleId"), true);
  assert.equal(TRIP_FIELD_DEFINITIONS.vehicleId.required, true);
  assert.equal(TRIP_FIELD_DEFINITIONS.sourceFarmId.optionSource, "farms");
  assert.equal(TRIP_FIELD_DEFINITIONS.dcPhotoKey.required, true);
});

test("shared workflow and validation preserve current Step 1 to Step 5 behavior", () => {
  const trip = createEmptyTrip({ tripDate: "2026-08-16" });
  assert.equal(getNextIncompleteTripStep(trip), 0);
  assert.equal(validateStartStep(trip).valid, false);

  const started = {
    ...trip,
    vehicleId: 1,
    vehicleNo: "AP01AA0001",
    driverId: 2,
    driverName: "Driver",
    supervisorId: 3,
    supervisorName: "Supervisor",
    helpers: ["Helper"],
    loaders: ["Loader"],
    startStepSubmitted: true,
  };
  assert.equal(validateStartStep(started).valid, true);
  assert.equal(getNextIncompleteTripStep(started), 1);
});

test("pickup and delivery calculations are shared and deterministic", () => {
  const pickup = calculatePickupTotals([
    { boxNo: 1, birds: 40, weight: 80 },
    { boxNo: 2, birds: 38, weight: 76 },
  ]);
  assert.deepEqual(pickup, { totalBirds: 78, dcWeight: 156, boxes: 2, avgWeight: 2 });

  const trip = createEmptyTrip({ totalBirds: 78, dcWeight: 156, avgWeight: 2 });
  const deliveries = [
    {
      id: 1,
      boxNo: 1,
      shopId: 1,
      shopName: "Shop",
      birdTypeId: 1,
      birdType: "Broiler",
      birds: 77,
      weight: 154,
      mortality: 1,
      rate: null,
      amount: 0,
      remarks: "",
    },
  ];
  assert.equal(validateDeliveriesStep(trip, deliveries).valid, true);
  const calculated = applyDeliveryMetrics(trip, deliveries);
  assert.equal(calculated.totalBirdsDelivered, 77);
  assert.equal(calculated.totalMortalityCount, 1);
  assert.equal(calculated.weightLoss, 0);
});
