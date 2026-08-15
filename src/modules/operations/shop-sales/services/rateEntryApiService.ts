/**
 * Rate Entry — PostgreSQL via shared Axios helpers. PostgreSQL (not
 * localStorage) is the single source of truth for eligible trips and their
 * shop-wise rates.
 *
 * GET  /operations/rate-entry                    -> eligible trips (Approved/Completed, not deleted, not locked)
 * POST /operations/rate-entry                     -> save (upsert) rates for a trip, unlocked
 * POST /operations/rate-entry/trip/:tripId/lock    -> explicit lock (immutable + unlocks Shop Sales)
 */
import { apiGet, apiPost } from "../../../../api";
import type { Trip, ShopDelivery } from "../../vehicle-trips/types/trip";

const RATE_ENTRY_PATH = "/operations/rate-entry";

/** Raw shape returned by GET /operations/rate-entry (RateEntryTrip, camelCase). */
interface RateEntryTripRow {
  tripId: number;
  tripNo: string;
  tripDate: string;
  tripStatus: string;
  vehicleId: number | null;
  vehicleNo: string | null;
  driverId: number | null;
  driverName: string | null;
  supervisorId: number | null;
  supervisorName: string | null;
  sourceFarmId: number | null;
  sourceFarm: string | null;
  totalBirds: number;
  totalWeight: number;
  totalShops: number;
  birdTypeId: number | null;
  birdType: string | null;
  rateStatus: "Pending" | "Entered";
  rateEntryId: number | null;
  rate: number | null;
  remarks: string | null;
  locked: boolean;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Maps a Rate Entry list row onto the frontend Trip shape the table/filter
 * components already consume. Deliveries are intentionally left empty here
 * — they're loaded on demand (loadTripWithDeliveries) only when the user
 * opens the Enter/Modify Rate modal for a specific trip. */
function mapRowToTrip(row: RateEntryTripRow): Trip {
  const now = new Date().toISOString();
  return {
    id: row.tripId,
    tripNo: row.tripNo,
    tripDate: row.tripDate,
    startTime: "",
    vehicleId: row.vehicleId ?? 0,
    vehicleNo: row.vehicleNo ?? "",
    driverId: row.driverId ?? 0,
    driverName: row.driverName ?? "",
    supervisorId: row.supervisorId ?? 0,
    supervisorName: row.supervisorName ?? "",
    advanceAmount: 0,
    helpers: [],
    openingMeter: 0,
    startStepSubmitted: true,
    sourceFarmId: row.sourceFarmId ?? 0,
    sourceFarm: row.sourceFarm ?? "",
    reachedTime: "",
    destMeter: 0,
    pickupTolls: 0,
    farmStepSubmitted: true,
    dcWeight: 0,
    totalBirds: row.totalBirds,
    boxes: 0,
    avgWeight: 0,
    pickupLoadTime: "",
    pickupStepSubmitted: true,
    boxNo: 0,
    birds: 0,
    weight: 0,
    boxDetails: [],
    deliveries: [],
    deliveryStepSubmitted: true,
    closingMeter: 0,
    endTime: "",
    deliveryTolls: 0,
    totalKm: 0,
    totalShops: row.totalShops,
    totalWeight: row.totalWeight,
    totalDeliveredWeight: row.totalWeight,
    totalBirdsDelivered: row.totalBirds,
    totalMortality: 0,
    totalMortalityCount: 0,
    totalMortalityWeight: 0,
    weightLoss: 0,
    survivalRate: 0,
    lastShop: "",
    fuel: 0,
    expense: 0,
    remarks: row.remarks ?? "",
    // Rate Entry only ever lists Approved/Completed trips (the backend
    // eligibility query enforces this) — surfaced as-is for display.
    status: row.tripStatus === "Approved" ? "Completed" : (row.tripStatus as Trip["status"]),
    // A trip only ever appears here while its rate is unlocked — locked
    // trips are excluded by the backend query, so this list never contains
    // a rateCompleted trip.
    rateCompleted: false,
    createdAt: row.createdAt ?? now,
    updatedAt: row.updatedAt ?? now,
  };
}

/** GET /operations/rate-entry — trips waiting for (or mid-way through)
 * rate entry. No pagination params are sent, so the backend returns the
 * full eligible list; filtering/pagination stays client-side exactly as
 * before, only the data source changed from localStorage to PostgreSQL. */
export async function listEligibleTrips(): Promise<Trip[]> {
  const { data } = await apiGet<RateEntryTripRow[]>(RATE_ENTRY_PATH);
  return data.map(mapRowToTrip);
}

/** Weighted-average rate across the shop-wise lines — used as the Rate
 * Entry header/reference rate (rate_entry.rate); the authoritative
 * per-shop values are what's actually written to trip_deliveries. */
function headerRate(deliveries: ShopDelivery[]): number {
  const totalWeight = deliveries.reduce((sum, d) => sum + (d.weight || 0), 0);
  if (totalWeight <= 0) {
    return deliveries.find((d) => (d.rate ?? 0) > 0)?.rate ?? 0;
  }
  const weighted = deliveries.reduce((sum, d) => sum + (d.weight || 0) * (d.rate ?? 0), 0);
  return Number((weighted / totalWeight).toFixed(2));
}

/**
 * Save shop-wise rates then immediately lock the trip — this mirrors the
 * existing "Save & Lock Trip" single modal action; the backend still
 * performs these as two distinct, separately-enforced steps (save is
 * idempotent while unlocked, lock is a one-way transition).
 */
export async function saveAndLockRates(
  tripId: number,
  deliveries: ShopDelivery[],
  actor = "web-user"
): Promise<void> {
  const lines = deliveries
    .filter((d) => d.rate != null && d.rate > 0)
    .map((d) => ({ id: d.id, rate: d.rate as number }));

  await apiPost(RATE_ENTRY_PATH, {
    tripId,
    rate: headerRate(deliveries),
    deliveries: lines,
    createdBy: actor,
    updatedBy: actor,
  });

  await apiPost(`${RATE_ENTRY_PATH}/trip/${tripId}/lock`, { lockedBy: actor });
}
