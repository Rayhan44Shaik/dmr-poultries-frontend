import type { Trip, ShopDelivery } from "../types/trip";

// ==========================
// Calculate Trip Totals
// ==========================
export function calculateTotals(rows: ShopDelivery[]) {
  return {
    totalShops: rows.length,
    totalBirds: rows.reduce((sum, row) => sum + Number(row.birds || 0), 0),
    totalWeight: rows.reduce((sum, row) => sum + Number(row.weight || 0), 0),
    totalMortality: rows.reduce((sum, row) => sum + Number(row.mortality || 0), 0),
    lastShop: rows.length > 0 ? rows[rows.length - 1].shopName : "",
  };
}

// ==========================
// KM Calculation
// ==========================
export function calculateKM(openingMeter: number, closingMeter: number) {
  if (!openingMeter || !closingMeter || closingMeter <= openingMeter) return 0;
  return closingMeter - openingMeter;
}

// ==========================
// Generate Sequential Trip Number (per date)
// ==========================
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

// ==========================
// ✅ Renumber Pending Trips After Deletion (per date)
// ==========================
export function renumberPendingTripsForDate(date: string): Trip[] {
  const allTrips: Trip[] = JSON.parse(localStorage.getItem("vehicleTrips") || "[]");
  const dateStr = date.replace(/-/g, "");
  
  // Get pending trips for this date, sorted by current sequence number
  const pendingTrips = allTrips
    .filter((t) => t.tripDate === date && t.status === "Pending")
    .sort((a, b) => {
      const numA = parseInt(a.tripNo.split("-")[2] || "0", 10);
      const numB = parseInt(b.tripNo.split("-")[2] || "0", 10);
      return numA - numB;
    });

  // Renumber sequentially
  pendingTrips.forEach((trip, index) => {
    const newSeq = String(index + 1).padStart(3, "0");
    const newTripNo = `TRP-${dateStr}-${newSeq}`;
    trip.tripNo = newTripNo;
  });

  // Save back to localStorage
  localStorage.setItem("vehicleTrips", JSON.stringify(allTrips));
  return allTrips;
}

// ==========================
// Trip Validation (with mandatory row fields)
// ==========================
export function validateTrip(trip: Trip) {
  const errors: string[] = [];

  if (!trip.tripDate) errors.push("Trip Date is required.");
  if (!trip.vehicleId) errors.push("Please select Vehicle.");
  if (!trip.driverId) errors.push("Please select Driver.");
  if (!trip.supervisorId) errors.push("Please select Supervisor.");
  if (!trip.sourceFarmId) errors.push("Please select Source Farm.");

  if (trip.deliveries.length === 0) {
    errors.push("Please add at least one Shop.");
  }

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

// ==========================
// Edit/Delete Eligibility
// ==========================
export function canEditTrip(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 10;
}

export function canDeleteTrip(createdAt: string): boolean {
  return canEditTrip(createdAt);
}

// ==========================
// Status Helpers
// ==========================
export function isTripCompleted(status: "Pending" | "Completed"): boolean {
  return status === "Completed";
}

export function isTripPending(status: "Pending" | "Completed"): boolean {
  return status === "Pending";
}