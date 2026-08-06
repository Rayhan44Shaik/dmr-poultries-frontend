import type { Trip, ShopDelivery } from "../types/trip";

// =========================================================================
// 🔹 NEW KPI CALCULATIONS (For the Step-by-Step Wizard)
// =========================================================================

/**
 * Calculate Average Weight per Bird
 */
export function calculateAvgWeight(dcWeight: number, totalBirds: number): number {
  if (!dcWeight || !totalBirds || totalBirds === 0) return 0;
  return Number((dcWeight / totalBirds).toFixed(3));
}

/**
 * Calculate Live KPI Updates for Trip (Weight Loss, Mortality Weight, Survival Rate)
 */
export function calculateTripKPIs(
  dcWeight: number,
  totalBirds: number,
  totalDeliveredWeight: number,
  totalMortalityCount: number,
  avgWeight: number
) {
  const totalMortalityWeight = Number((totalMortalityCount * avgWeight).toFixed(2));
  const weightLoss = Number((dcWeight - totalDeliveredWeight - totalMortalityWeight).toFixed(2));
  const survivalRate = totalBirds > 0 ? Number(((1 - (totalMortalityCount / totalBirds)) * 100).toFixed(1)) : 0;

  return { totalMortalityWeight, weightLoss, survivalRate };
}

/**
 * ✅ Enhanced Totals (Legacy + New fields supported)
 */
export function calculateTotals(rows: ShopDelivery[], avgWeight: number = 0) {
  const totalShops = rows.length;
  const totalBirds = rows.reduce((sum, row) => sum + Number(row.birds || 0), 0);
  const totalWeight = rows.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  const totalMortality = rows.reduce((sum, row) => sum + Number(row.mortality || 0), 0);
  const lastShop = rows.length > 0 ? rows[rows.length - 1].shopName : "";

  // Compute advanced KPIs
  const { totalMortalityWeight, weightLoss, survivalRate } = calculateTripKPIs(
    0, // We need DC weight passed separately, set to 0 here for default
    totalBirds,
    totalWeight,
    totalMortality,
    avgWeight
  );

  return {
    // Legacy fields
    totalShops,
    totalBirds,
    totalWeight,
    totalMortality,
    lastShop,
    // New fields
    totalDeliveredWeight: totalWeight,
    totalBirdsDelivered: totalBirds,
    totalMortalityWeight,
    weightLoss,
    survivalRate,
  };
}

// =========================================================================
// 🔹 STEP-BY-STEP VALIDATIONS (For the new Wizard)
// =========================================================================

export function validateStartStep(trip: Trip): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!trip.tripDate) errors.push("Trip Date is required.");
  if (!trip.vehicleId || !trip.vehicleNo) errors.push("Please select a Vehicle.");
  if (!trip.driverId || !trip.driverName) errors.push("Please select a Driver.");
  if (!trip.supervisorId || !trip.supervisorName) errors.push("Please select a Supervisor.");
  if (!trip.helpers || trip.helpers.length === 0) errors.push("Please add at least one Helper.");
  if (!trip.loaders || trip.loaders.length === 0) errors.push("Please add at least one Loader.");
  
  // 🔹 UPDATED: Allows 0.00 to pass. The validation logic is now handled in the component's useEffect.
  if (trip.openingMeter === undefined || trip.openingMeter === null || isNaN(trip.openingMeter)) {
    errors.push("Valid Opening Meter reading is required.");
  }
  if (
    trip.advanceAmount === undefined ||
    trip.advanceAmount === null ||
    isNaN(trip.advanceAmount) ||
    trip.advanceAmount < 0
  ) {
    errors.push("Valid Advance amount is required.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateFarmStep(trip: Trip): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!trip.sourceFarmId || !trip.sourceFarm) errors.push("Please select a Destination Farm.");
  if (!trip.destMeter || trip.destMeter <= 0) errors.push("Valid Destination Meter reading is required.");
  if (trip.destMeter <= trip.openingMeter && trip.openingMeter > 0) {
    errors.push("Destination Meter cannot be less than or equal to the Start Meter.");
  }
  if (!trip.pickupTolls || trip.pickupTolls <= 0) errors.push("Please enter the number of tolls crossed on the pickup route.");
  return { valid: errors.length === 0, errors };
}

export function validatePickupStep(trip: Trip): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!trip.dcWeight || trip.dcWeight <= 0) errors.push("Total DC Weight is required.");
  if (!trip.totalBirds || trip.totalBirds <= 0) errors.push("Total Birds loaded is required.");
  if (!trip.boxes || trip.boxes <= 0) errors.push("Number of Boxes loaded is required.");
  return { valid: errors.length === 0, errors };
}

export function validateEndStep(trip: Trip): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!trip.closingMeter || trip.closingMeter <= 0) errors.push("Valid End Meter reading is required.");
  if (trip.closingMeter <= trip.destMeter && trip.destMeter > 0) {
    errors.push("Closing Meter cannot be less than the Destination Meter.");
  }
  if (!trip.deliveryTolls || trip.deliveryTolls <= 0) errors.push("Please enter the number of tolls crossed on the delivery route.");
  return { valid: errors.length === 0, errors };
}

/**
 * 🔹 FINAL SUBMISSION VALIDATION (Before Trip becomes Completed)
 */
export function validateFinalTrip(trip: Trip): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 1. Bird Balance Validation: Pickup Birds MUST equal (Delivered Birds + Mortality)
  const expectedBirds = trip.totalBirdsDelivered + trip.totalMortality;
  if (trip.totalBirds !== expectedBirds) {
    errors.push(`Bird Count Mismatch: Trip Birds (${trip.totalBirds}) must equal Delivered (${trip.totalBirdsDelivered}) + Mortality (${trip.totalMortality}) = ${expectedBirds}.`);
  }

  // 2. Weight Balance Validation: Weight Loss cannot be negative (Delivery + Mortality cannot be greater than DC Weight)
  // Note: weightLoss in the KPI object is automatically calculated, but we calculate it again here for absolute validation.
  const calculatedMortalityWeight = trip.totalMortality * trip.avgWeight;
  const loss = trip.dcWeight - trip.totalDeliveredWeight - calculatedMortalityWeight;
  if (loss < 0) {
    errors.push(`Weight Mismatch: Delivered Weight + Mortality Weight exceeds DC Weight by ${Math.abs(loss).toFixed(2)} Kg.`);
  }

  // 3. KM Validation
  if (trip.closingMeter <= trip.destMeter && trip.destMeter > 0) {
    errors.push("KM Logic Error: Closing Meter must be greater than Destination Meter.");
  }

  return { valid: errors.length === 0, errors };
}

// =========================================================================
// 🔹 LEGACY FUNCTIONS (Kept intact for existing Trip List & Edit flows)
// =========================================================================

// Calculate KM
export function calculateKM(openingMeter: number, closingMeter: number) {
  if (!openingMeter || !closingMeter || closingMeter <= openingMeter) return 0;
  return closingMeter - openingMeter;
}

// Generate Sequential Trip Number
export function generateTripNo(existingTrips: Trip[], date: string): string {
  const dateStr = date.replace(/-/g, ""); // YYYYMMDD
  const tripsOnDate = existingTrips.filter((t) => t.tripDate === date);
  const count = tripsOnDate.length + 1;
  if (count > 999) {
    const ts = Date.now().toString().slice(-4);
    return `TRP-${dateStr}-${ts}`;
  }
  const seq = String(count).padStart(3, "0");
  return `TRP-${dateStr}-${seq}`;
}

// Renumber Pending Trips After Deletion
export function renumberPendingTripsForDate(date: string): Trip[] {
  const allTrips: Trip[] = JSON.parse(localStorage.getItem("vehicleTrips") || "[]");
  const dateStr = date.replace(/-/g, "");
  const pendingTrips = allTrips
    .filter((t) => t.tripDate === date && t.status === "Pending")
    .sort((a, b) => {
      const numA = parseInt(a.tripNo.split("-")[2] || "0", 10);
      const numB = parseInt(b.tripNo.split("-")[2] || "0", 10);
      return numA - numB;
    });
  pendingTrips.forEach((trip, index) => {
    const newSeq = String(index + 1).padStart(3, "0");
    const newTripNo = `TRP-${dateStr}-${newSeq}`;
    trip.tripNo = newTripNo;
  });
  localStorage.setItem("vehicleTrips", JSON.stringify(allTrips));
  return allTrips;
}

// Legacy Trip Validation (Used for the old single-page form)
export function validateTrip(trip: Trip) {
  const errors: string[] = [];
  if (!trip.tripDate) errors.push("Trip Date is required.");
  if (!trip.vehicleId) errors.push("Please select Vehicle.");
  if (!trip.driverId) errors.push("Please select Driver.");
  if (!trip.supervisorId) errors.push("Please select Supervisor.");
  if (!trip.sourceFarmId) errors.push("Please select Source Farm.");
  if (trip.deliveries.length === 0) errors.push("Please add at least one Shop.");
  trip.deliveries.forEach((row, index) => {
    const prefix = `Row ${index + 1}:`;
    if (!row.boxNo || row.boxNo <= 0) errors.push(`${prefix} Box No is required.`);
    if (!row.shopId) errors.push(`${prefix} Select Shop.`);
    if (!row.birdTypeId) errors.push(`${prefix} Select Bird Type.`);
    if (!row.birds || row.birds <= 0) errors.push(`${prefix} Enter No. of Birds.`);
    if (!row.weight || row.weight <= 0) errors.push(`${prefix} Enter Weight.`);
    if (row.mortality < 0) errors.push(`${prefix} Invalid Mortality.`);
  });
  return { valid: errors.length === 0, errors };
}

// Edit/Delete Eligibility
export function canEditTrip(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 10;
}

export function canDeleteTrip(createdAt: string): boolean {
  return canEditTrip(createdAt);
}

// Status Helpers
export function isTripCompleted(status: "Pending" | "Completed"): boolean {
  return status === "Completed";
}

export function isTripPending(status: "Pending" | "Completed"): boolean {
  return status === "Pending";
}