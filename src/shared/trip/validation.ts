import { TRIP_FIELD_DEFINITIONS, type TripFieldDefinitionName } from "./definitions";
import type { ShopDelivery, Trip } from "./types";

export interface TripValidationResult {
  valid: boolean;
  errors: string[];
}

function result(errors: string[]): TripValidationResult {
  return { valid: errors.length === 0, errors };
}

function required(field: TripFieldDefinitionName): boolean {
  return TRIP_FIELD_DEFINITIONS[field].required;
}

export function validateStartStep(trip: Trip): TripValidationResult {
  const errors: string[] = [];
  if (required("tripDate") && !trip.tripDate) errors.push("Trip Date is required.");
  if (required("vehicleId") && (!trip.vehicleId || !trip.vehicleNo)) {
    errors.push("Please select a Vehicle.");
  }
  if (required("driverId") && (!trip.driverId || !trip.driverName)) {
    errors.push("Please select a Driver.");
  }
  if (required("supervisorId") && (!trip.supervisorId || !trip.supervisorName)) {
    errors.push("Please select a Supervisor.");
  }
  if (required("helpers") && !trip.helpers?.length) {
    errors.push("Please add at least one Helper.");
  }
  if (required("loaders") && !trip.loaders?.length) {
    errors.push("Please add at least one Loader.");
  }
  if (required("openingMeter") && (trip.openingMeter == null || Number.isNaN(trip.openingMeter))) {
    errors.push("Valid Opening Meter reading is required.");
  }
  if (
    required("advanceAmount") && (
      trip.advanceAmount == null ||
      Number.isNaN(trip.advanceAmount) ||
      trip.advanceAmount < 0
    )
  ) {
    errors.push("Valid Advance amount is required.");
  }
  return result(errors);
}

export function validateFarmStep(trip: Trip): TripValidationResult {
  const errors: string[] = [];
  if (required("sourceFarmId") && (!trip.sourceFarmId || !trip.sourceFarm)) {
    errors.push("Please select a Destination Farm.");
  }
  if (required("destMeter") && (!trip.destMeter || trip.destMeter <= 0)) {
    errors.push("Valid Destination Meter reading is required.");
  }
  if (trip.destMeter <= trip.openingMeter && trip.openingMeter > 0) {
    errors.push("Destination Meter cannot be less than or equal to the Start Meter.");
  }
  if (required("pickupTolls") && (!trip.pickupTolls || trip.pickupTolls <= 0)) {
    errors.push("Please enter the number of tolls crossed on the pickup route.");
  }
  if (required("avgBirdWeight") && (!trip.avgBirdWeight || trip.avgBirdWeight <= 0)) {
    errors.push("Please enter a valid Average Bird Weight.");
  }
  return result(errors);
}

export function validatePickupStep(trip: Trip): TripValidationResult {
  const errors: string[] = [];
  if (required("dcPhotoKey") && !trip.dcPhotoKey) errors.push("DC Photo is required.");
  if (required("boxDetails") && !trip.boxDetails.length) {
    errors.push("At least one complete box is required.");
  }
  if (required("dcWeight") && (!trip.dcWeight || trip.dcWeight <= 0)) {
    errors.push("Total DC Weight is required.");
  }
  if (required("totalBirds") && (!trip.totalBirds || trip.totalBirds <= 0)) {
    errors.push("Total Birds loaded is required.");
  }
  if (required("boxes") && (!trip.boxes || trip.boxes <= 0)) {
    errors.push("Number of Boxes loaded is required.");
  }
  return result(errors);
}

export function validateDeliveriesStep(
  trip: Pick<Trip, "dcWeight" | "totalBirds">,
  rows: ShopDelivery[],
  weightToleranceKg = 0.05
): TripValidationResult {
  if (required("deliveries") && !rows.length) {
    return result(["Please add at least one shop delivery."]);
  }
  if (required("dcWeight") && trip.dcWeight <= 0) {
    return result(["DC Weight must be greater than 0."]);
  }

  const totalMortalityCount = rows.reduce((sum, row) => sum + Number(row.mortality || 0), 0);
  const totalBirdsDelivered = rows.reduce((sum, row) => sum + Number(row.birds || 0), 0);
  const totalDeliveredWeight = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  const averageWeight = trip.totalBirds > 0 ? trip.dcWeight / trip.totalBirds : 0;
  const explicitMortalityWeight = rows.reduce((sum, row) => {
    const extra = row as ShopDelivery & { mortalityWeight?: number; mortalityKg?: number };
    return sum + Number(extra.mortalityWeight ?? extra.mortalityKg ?? 0);
  }, 0);
  const mortalityWeight = explicitMortalityWeight > 0
    ? explicitMortalityWeight
    : totalMortalityCount * averageWeight;

  if (trip.totalBirds !== totalBirdsDelivered + totalMortalityCount) {
    return result([
      `Bird count mismatch! Farm (${trip.totalBirds}) != Delivered (${totalBirdsDelivered}) + Mor (${totalMortalityCount})`,
    ]);
  }
  const totalOutWeight = totalDeliveredWeight + mortalityWeight;
  if (totalOutWeight - trip.dcWeight > weightToleranceKg) {
    return result([
      `Total weight (${totalOutWeight.toFixed(2)} Kg) exceeds DC Weight (${trip.dcWeight.toFixed(2)} Kg)`,
    ]);
  }
  return result([]);
}

export function validateEndStep(trip: Trip): TripValidationResult {
  const errors: string[] = [];
  if (required("closingMeter") && (!trip.closingMeter || trip.closingMeter <= 0)) {
    errors.push("Valid End Meter reading is required.");
  }
  if (trip.closingMeter <= trip.destMeter && trip.destMeter > 0) {
    errors.push("Closing Meter cannot be less than the Destination Meter.");
  }
  if (required("deliveryTolls") && (!trip.deliveryTolls || trip.deliveryTolls <= 0)) {
    errors.push("Please enter the number of tolls crossed on the delivery route.");
  }
  return result(errors);
}

export function validateFinalTrip(trip: Trip): TripValidationResult {
  const errors: string[] = [];
  const expectedBirds = trip.totalBirdsDelivered + trip.totalMortality;
  if (trip.totalBirds !== expectedBirds) {
    errors.push(
      `Bird Count Mismatch: Trip Birds (${trip.totalBirds}) must equal Delivered (${trip.totalBirdsDelivered}) + Mortality (${trip.totalMortality}) = ${expectedBirds}.`
    );
  }
  const mortalityWeight = trip.totalMortality * trip.avgWeight;
  const loss = trip.dcWeight - trip.totalDeliveredWeight - mortalityWeight;
  if (loss < 0) {
    errors.push(
      `Weight Mismatch: Delivered Weight + Mortality Weight exceeds DC Weight by ${Math.abs(loss).toFixed(2)} Kg.`
    );
  }
  if (trip.closingMeter <= trip.destMeter && trip.destMeter > 0) {
    errors.push("KM Logic Error: Closing Meter must be greater than Destination Meter.");
  }
  return result(errors);
}

export function validateTrip(trip: Trip): TripValidationResult {
  const errors: string[] = [];
  if (!trip.tripDate) errors.push("Trip Date is required.");
  if (!trip.vehicleId) errors.push("Please select Vehicle.");
  if (!trip.driverId) errors.push("Please select Driver.");
  if (!trip.supervisorId) errors.push("Please select Supervisor.");
  if (!trip.sourceFarmId) errors.push("Please select Source Farm.");
  if (!trip.deliveries.length) errors.push("Please add at least one Shop.");
  trip.deliveries.forEach((row, index) => {
    const prefix = `Row ${index + 1}:`;
    if (!row.boxNo || row.boxNo <= 0) errors.push(`${prefix} Box No is required.`);
    if (!row.shopId) errors.push(`${prefix} Select Shop.`);
    if (!row.birdTypeId) errors.push(`${prefix} Select Bird Type.`);
    if (!row.birds || row.birds <= 0) errors.push(`${prefix} Enter No. of Birds.`);
    if (!row.weight || row.weight <= 0) errors.push(`${prefix} Enter Weight.`);
    if (row.mortality < 0) errors.push(`${prefix} Invalid Mortality.`);
  });
  return result(errors);
}
