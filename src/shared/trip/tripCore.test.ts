import assert from "node:assert/strict";
import test from "node:test";
import * as desktopTripFacade from "../../modules/operations/vehicle-trips/services/tripFormService";
import {
  TRIP_FIELD_DEFINITIONS,
  TRIP_STEP_DEFINITIONS,
  TRIP_STEP_LABELS,
  applyDeliveryMetrics,
  calculatePickupTotals,
  clampTripStepIndex,
  createEmptyTrip,
  getLastSubmittedTripStep,
  getMaxAllowedTripStep,
  getNextIncompleteTripStep,
  getResumeActionLabel,
  getTripStepLockMask,
  getTripWizardCompletedMask,
  isTripEnded,
  isTripWizardComplete,
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
  assert.deepEqual(TRIP_STEP_LABELS, [
    "Trip Details",
    "Farm Details",
    "Pickup Details",
    "Delivery Details",
    "Expenses / End Details",
  ]);
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

test("Step 2 submit validation: GPS required, address optional, meter > start; toll 0 valid", () => {
  const farmTrip = {
    ...createEmptyTrip({ tripDate: "2026-08-16" }),
    sourceFarmId: 1,
    sourceFarm: "Farm",
    birdTypeId: 1,
    birdType: "Broiler",
    farmAddress: "Master address",
    farmGpsLat: 17.4849,
    farmGpsLon: 78.6033,
    destMeter: 50001,
    openingMeter: 50000,
    pickupTolls: 0,
    avgBirdWeight: 2,
  };
  assert.equal(validateFarmStep(farmTrip).valid, true);
  assert.equal(validateFarmStep({ ...farmTrip, destMeter: 49999 }).valid, false);
  assert.equal(validateFarmStep({ ...farmTrip, destMeter: 50000 }).valid, false);
  // Farm address is optional.
  assert.equal(validateFarmStep({ ...farmTrip, farmAddress: "" }).valid, true);
  // GPS capture is MANDATORY (missing or 0,0 coordinates are rejected).
  assert.equal(validateFarmStep({ ...farmTrip, farmGpsLat: null, farmGpsLon: null }).valid, false);
  assert.equal(validateFarmStep({ ...farmTrip, farmGpsLat: 0, farmGpsLon: 0 }).valid, false);
  assert.equal(validateFarmStep({ ...farmTrip, pickupTolls: 0 }).valid, true);
  assert.equal(getNextIncompleteTripStep({ ...farmTrip, startStepSubmitted: true, farmStepSubmitted: false }), 1);
  assert.equal(getNextIncompleteTripStep({ ...farmTrip, startStepSubmitted: true, farmStepSubmitted: true }), 2);
});

test("Step 1 treats empty KM/Advance as valid and keeps explicit zero", () => {
  const base = createEmptyTrip({
    tripDate: "2026-08-16",
    vehicleId: 1,
    vehicleNo: "AP01AA0001",
    driverId: 2,
    driverName: "Driver",
    supervisorId: 3,
    supervisorName: "Supervisor",
    helpers: ["Helper"],
    loaders: ["Loader"],
    openingMeter: null,
    advanceAmount: null,
  });
  assert.equal(validateStartStep(base).valid, true);

  assert.equal(validateStartStep({ ...base, openingMeter: 0, advanceAmount: 0 }).valid, true);
  assert.equal(validateStartStep({ ...base, openingMeter: -1 }).valid, false);
  assert.equal(validateStartStep({ ...base, advanceAmount: -5 }).valid, false);
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

test("Resume opens the first unsubmitted step; Edit opens the last submitted step", () => {
  const after1 = createEmptyTrip({ startStepSubmitted: true });
  assert.equal(getNextIncompleteTripStep(after1), 1);
  assert.equal(getResumeActionLabel(after1), "Resume — Farm / Step 2");
  assert.equal(getLastSubmittedTripStep(after1), 0);

  const after2 = { ...after1, farmStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(after2), 2);
  assert.equal(getResumeActionLabel(after2), "Resume — Pickup / Step 3");
  assert.equal(getLastSubmittedTripStep(after2), 1);

  const after3 = { ...after2, pickupStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(after3), 3);
  assert.equal(getResumeActionLabel(after3), "Resume — Deliveries / Step 4");
  assert.equal(getLastSubmittedTripStep(after3), 2);

  const after4 = { ...after3, deliveryStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(after4), 4);
  assert.equal(getResumeActionLabel(after4), "Resume — End / Step 5");
  assert.equal(getLastSubmittedTripStep(after4), 3);

  const after5 = { ...after4, endStepSubmitted: true, expensesStepSubmitted: true, status: "Pending" as const };
  assert.equal(getResumeActionLabel(after5), null);
  assert.equal(getLastSubmittedTripStep(after5), 4);
  assert.equal(isTripWizardComplete(after5), true);
  assert.equal(isTripEnded(after5), true);
  assert.equal(isTripEnded(after4), false);
});

test("View stepper mask marks Step 5 submitted only from Step 5 flags", () => {
  const through4 = createEmptyTrip({
    startStepSubmitted: true,
    farmStepSubmitted: true,
    pickupStepSubmitted: true,
    deliveryStepSubmitted: true,
    status: "Pending",
  });
  assert.deepEqual(getTripWizardCompletedMask(through4), {
    start: true,
    farm: true,
    pickup: true,
    delivery: true,
    end: false,
  });

  const complete = { ...through4, endStepSubmitted: true, expensesStepSubmitted: true };
  assert.deepEqual(getTripWizardCompletedMask(complete), {
    start: true,
    farm: true,
    pickup: true,
    delivery: true,
    end: true,
  });
});

test("Step-enablement dependency matrix: each step opens only after its predecessor is submitted; Step 5 opens after Step 1", () => {
  const mask = (trip: Parameters<typeof getTripStepLockMask>[0]) => getTripStepLockMask(trip);

  // NEW TRIP — only Step 1 (idx 0) enabled.
  const fresh = createEmptyTrip({});
  assert.deepEqual(mask(fresh), [false, true, true, true, true]);
  assert.equal(getMaxAllowedTripStep(fresh), 0);

  // AFTER STEP 1 — Step 2 (idx 1) and Step 5 (idx 4) enabled; Steps 3-4 locked.
  const after1 = { ...fresh, startStepSubmitted: true };
  assert.deepEqual(mask(after1), [false, false, true, true, false]);
  assert.equal(getMaxAllowedTripStep(after1), 1);

  // AFTER STEP 2 — Step 3 (idx 2) + Step 5 enabled; Step 4 (idx 3) still locked.
  const after2 = { ...after1, farmStepSubmitted: true };
  assert.deepEqual(mask(after2), [false, false, false, true, false]);
  assert.equal(getMaxAllowedTripStep(after2), 2);

  // AFTER STEP 3 — Step 4 (idx 3) + Step 5 enabled.
  const after3 = { ...after2, pickupStepSubmitted: true };
  assert.deepEqual(mask(after3), [false, false, false, false, false]);
  assert.equal(getMaxAllowedTripStep(after3), 3);

  // AFTER STEP 4 — all five open.
  const after4 = { ...after3, deliveryStepSubmitted: true };
  assert.deepEqual(mask(after4), [false, false, false, false, false]);
  assert.equal(getMaxAllowedTripStep(after4), 4);

  // AFTER STEP 5 — everything submitted, nothing re-locks.
  const complete = { ...after4, endStepSubmitted: true, expensesStepSubmitted: true, status: "Pending" as const };
  assert.deepEqual(mask(complete), [false, false, false, false, false]);
});

test("clampTripStepIndex redirects a locked requested step to the first incomplete step", () => {
  const fresh = createEmptyTrip({});
  // Direct click / stale URL asking for Step 3 on a brand-new trip → Step 1.
  assert.equal(clampTripStepIndex(fresh, 2), 0);
  assert.equal(clampTripStepIndex(fresh, 4), 0);
  assert.equal(clampTripStepIndex(fresh, 0), 0);

  const after1 = { ...fresh, startStepSubmitted: true };
  // Step 2 and Step 5 are reachable; Step 3/4 fall back to the next step (Step 2).
  assert.equal(clampTripStepIndex(after1, 1), 1);
  assert.equal(clampTripStepIndex(after1, 4), 4);
  assert.equal(clampTripStepIndex(after1, 2), 1);
  assert.equal(clampTripStepIndex(after1, 3), 1);

  const after2 = { ...after1, farmStepSubmitted: true };
  assert.equal(clampTripStepIndex(after2, 3), 2);
  assert.equal(clampTripStepIndex(after2, 2), 2);
});

test("Resume always opens the first incomplete step; completed steps stay reopenable", () => {
  const after1 = createEmptyTrip({ startStepSubmitted: true });
  assert.equal(getNextIncompleteTripStep(after1), 1);
  assert.equal(getLastSubmittedTripStep(after1), 0);

  const after2 = { ...after1, farmStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(after2), 2);
  assert.equal(getLastSubmittedTripStep(after2), 1);

  const after3 = { ...after2, pickupStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(after3), 3);
  assert.equal(getLastSubmittedTripStep(after3), 2);

  const after4 = { ...after3, deliveryStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(after4), 4);
  assert.equal(getLastSubmittedTripStep(after4), 3);

  const complete = { ...after4, endStepSubmitted: true, expensesStepSubmitted: true };
  assert.equal(getNextIncompleteTripStep(complete), 4);
  assert.equal(getLastSubmittedTripStep(complete), 4);
});
