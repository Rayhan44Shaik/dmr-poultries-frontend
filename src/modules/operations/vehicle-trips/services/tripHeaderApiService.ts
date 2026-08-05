/**
 * Trip Entry Step 1 (header) — PostgreSQL via shared Axios helpers.
 * Steps 2–5 continue to use localStorage through tripService until migrated.
 */

import {
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
  ApiError,
} from "../../../../api";
import type { Trip, TripStatus } from "../types/trip";

const TRIPS_PATH = "/trips";

/** Raw trip shape returned by GET/PUT/POST /api/trips */
type ApiTripRecord = Record<string, unknown>;

export type LastClosingMeter = {
  closingMeter: number;
  tripNo: string;
  tripDate: string;
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrZero(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return num(value, 0);
}

function str(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

function formatStartTimeForDisplay(value: unknown): string {
  if (!value) return "";
  const raw = String(value);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }
  return raw;
}

function normalizeStatus(value: unknown): TripStatus {
  const status = str(value, "Draft");
  if (status === "Draft" || status === "Pending" || status === "Completed" || status === "Deleted") {
    return status;
  }
  return "Draft";
}

function normalizeDate(value: unknown): string {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw;
}

/** Map backend trip JSON onto the frontend Trip model. */
export function mapApiTripToTrip(raw: ApiTripRecord, existing?: Trip): Trip {
  const defaults: Trip = existing ?? {
    id: 0,
    tripNo: "",
    tripDate: "",
    startTime: "",
    vehicleId: 0,
    vehicleNo: "",
    driverId: 0,
    driverName: "",
    supervisorId: 0,
    supervisorName: "",
    helpers: [],
    openingMeter: 0,
    advanceAmount: 0,
    startStepSubmitted: false,
    sourceFarmId: 0,
    sourceFarm: "",
    reachedTime: "",
    destMeter: 0,
    pickupTolls: 0,
    farmStepSubmitted: false,
    dcWeight: 0,
    totalBirds: 0,
    boxes: 0,
    avgWeight: 0,
    pickupLoadTime: "",
    pickupStepSubmitted: false,
    boxNo: 0,
    birds: 0,
    weight: 0,
    boxDetails: [],
    deliveries: [],
    deliveryStepSubmitted: false,
    closingMeter: 0,
    endTime: "",
    deliveryTolls: 0,
    totalKm: 0,
    totalShops: 0,
    totalWeight: 0,
    totalDeliveredWeight: 0,
    totalBirdsDelivered: 0,
    totalMortality: 0,
    totalMortalityCount: 0,
    totalMortalityWeight: 0,
    weightLoss: 0,
    survivalRate: 0,
    lastShop: "",
    status: "Draft",
    fuel: 0,
    expense: 0,
    remarks: "",
    rateCompleted: false,
  };

  return {
    ...defaults,
    id: num(raw.id, defaults.id),
    tripNo: str(raw.tripNo ?? raw.trip_no, defaults.tripNo),
    tripDate: normalizeDate(raw.tripDate ?? raw.trip_date) || defaults.tripDate,
    status: normalizeStatus(raw.status ?? defaults.status),
    startTime: formatStartTimeForDisplay(raw.startTime ?? raw.start_time) || defaults.startTime,
    vehicleId: numOrZero(raw.vehicleId ?? raw.vehicle_id ?? defaults.vehicleId),
    vehicleNo: str(raw.vehicleNo ?? raw.vehicle_no, defaults.vehicleNo),
    driverId: numOrZero(raw.driverId ?? raw.driver_id ?? defaults.driverId),
    driverName: str(raw.driverName ?? raw.driver_name, defaults.driverName),
    supervisorId: numOrZero(raw.supervisorId ?? raw.supervisor_id ?? defaults.supervisorId),
    supervisorName: str(raw.supervisorName ?? raw.supervisor_name, defaults.supervisorName),
    helpers: Array.isArray(raw.helpers) ? (raw.helpers as string[]) : defaults.helpers,
    loaders: Array.isArray(raw.loaders) ? (raw.loaders as string[]) : defaults.loaders ?? [],
    openingMeter: numOrZero(raw.openingMeter ?? raw.opening_meter ?? defaults.openingMeter),
    advanceAmount: num(raw.advanceAmount ?? raw.advance_amount, defaults.advanceAmount),
    startStepSubmitted: Boolean(raw.startStepSubmitted ?? raw.start_step_submitted ?? defaults.startStepSubmitted),
    remarks: str(raw.remarks, defaults.remarks),
    farmStepSubmitted: Boolean(raw.farmStepSubmitted ?? raw.farm_step_submitted ?? defaults.farmStepSubmitted),
    pickupStepSubmitted: Boolean(raw.pickupStepSubmitted ?? raw.pickup_step_submitted ?? defaults.pickupStepSubmitted),
    deliveryStepSubmitted: Boolean(raw.deliveryStepSubmitted ?? raw.delivery_step_submitted ?? defaults.deliveryStepSubmitted),
    endStepSubmitted: Boolean(raw.endStepSubmitted ?? raw.end_step_submitted ?? defaults.endStepSubmitted),
    expensesStepSubmitted: Boolean(raw.expensesStepSubmitted ?? raw.expenses_step_submitted ?? defaults.expensesStepSubmitted),
    dcWeight: num(raw.dcWeight ?? raw.dc_weight, defaults.dcWeight),
    totalBirds: num(raw.totalBirds ?? raw.total_birds, defaults.totalBirds),
    boxes: num(raw.boxes, defaults.boxes),
    avgWeight: num(raw.avgWeight ?? raw.avg_weight, defaults.avgWeight),
    pickupLoadTime: formatStartTimeForDisplay(raw.pickupLoadTime ?? raw.pickup_load_time) || defaults.pickupLoadTime,
    boxDetails: Array.isArray(raw.boxDetails) ? (raw.boxDetails as Trip["boxDetails"]) : defaults.boxDetails,
    deliveries: Array.isArray(raw.deliveries) ? (raw.deliveries as Trip["deliveries"]) : defaults.deliveries,
    closingMeter: numOrZero(raw.closingMeter ?? raw.closing_meter ?? defaults.closingMeter),
    endTime: formatStartTimeForDisplay(raw.endTime ?? raw.end_time) || defaults.endTime,
    deliveryTolls: num(raw.deliveryTolls ?? raw.delivery_tolls, defaults.deliveryTolls),
    totalKm: num(raw.totalKm ?? raw.total_km, defaults.totalKm),
    totalShops: num(raw.totalShops ?? raw.total_shops, defaults.totalShops),
    totalWeight: num(raw.totalWeight ?? raw.total_weight, defaults.totalWeight),
    totalDeliveredWeight: num(raw.totalDeliveredWeight ?? raw.total_delivered_weight, defaults.totalDeliveredWeight),
    totalBirdsDelivered: num(raw.totalBirdsDelivered ?? raw.total_birds_delivered, defaults.totalBirdsDelivered),
    totalMortality: num(raw.totalMortality ?? raw.total_mortality, defaults.totalMortality),
    totalMortalityCount: num(raw.totalMortalityCount ?? raw.total_mortality_count, defaults.totalMortalityCount),
    totalMortalityWeight: num(raw.totalMortalityWeight ?? raw.total_mortality_weight, defaults.totalMortalityWeight),
    weightLoss: num(raw.weightLoss ?? raw.weight_loss, defaults.weightLoss),
    survivalRate: num(raw.survivalRate ?? raw.survival_rate, defaults.survivalRate),
    lastShop: str(raw.lastShop ?? raw.last_shop, defaults.lastShop),
    fuel: num(raw.fuel, defaults.fuel),
    expense: num(raw.expense, defaults.expense),
    rateCompleted: Boolean(raw.rateCompleted ?? raw.rate_completed ?? defaults.rateCompleted),
    createdAt: str(raw.createdAt ?? raw.created_at, defaults.createdAt ?? new Date().toISOString()),
    updatedAt: str(raw.updatedAt ?? raw.updated_at, defaults.updatedAt ?? new Date().toISOString()),
    sourceFarmId: numOrZero(raw.sourceFarmId ?? raw.source_farm_id ?? defaults.sourceFarmId),
    sourceFarm: str(raw.sourceFarm ?? raw.source_farm, defaults.sourceFarm),
    reachedTime: formatStartTimeForDisplay(raw.reachedTime ?? raw.reached_time) || defaults.reachedTime,
    destMeter: numOrZero(raw.destMeter ?? raw.dest_meter ?? defaults.destMeter),
    pickupTolls: num(raw.pickupTolls ?? raw.pickup_tolls, defaults.pickupTolls),
    farmAddress: raw.farmAddress != null ? str(raw.farmAddress) : raw.farm_address != null ? str(raw.farm_address) : defaults.farmAddress,
    dcPhotoKey: raw.dcPhotoKey != null ? str(raw.dcPhotoKey) : raw.dc_photo_key != null ? str(raw.dc_photo_key) : defaults.dcPhotoKey,
    deleted: Boolean(raw.deleted ?? defaults.deleted),
    deletedReason: raw.deletedReason != null ? str(raw.deletedReason) : defaults.deletedReason,
    approvedBy: raw.approvedBy != null ? str(raw.approvedBy) : defaults.approvedBy,
  };
}

/** Step 1 payload sent to PUT /trips/:id and POST /trips/:id/steps/start */
export function toStep1Payload(trip: Partial<Trip>): Record<string, unknown> {
  return {
    tripDate: trip.tripDate,
    tripNo: trip.tripNo,
    status: trip.status ?? "Draft",
    startTime: trip.startTime || null,
    vehicleId: trip.vehicleId || null,
    vehicleNo: trip.vehicleNo || null,
    driverId: trip.driverId || null,
    driverName: trip.driverName || null,
    supervisorId: trip.supervisorId || null,
    supervisorName: trip.supervisorName || null,
    openingMeter: trip.openingMeter ?? null,
    advanceAmount: trip.advanceAmount ?? 0,
    helpers: trip.helpers ?? [],
    loaders: trip.loaders ?? [],
    remarks: trip.remarks ?? "",
    startStepSubmitted: trip.startStepSubmitted ?? false,
  };
}

function arraysEqual(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/** Return only Step 1 fields that differ from the last persisted snapshot. */
export function diffStep1Payload(
  trip: Partial<Trip>,
  lastPersisted: Record<string, unknown> | null
): Record<string, unknown> | null {
  const current = toStep1Payload(trip);
  if (!lastPersisted) return current;

  const diff: Record<string, unknown> = {};
  let hasChanges = false;

  for (const [key, value] of Object.entries(current)) {
    const previous = lastPersisted[key];
    if (Array.isArray(value) || Array.isArray(previous)) {
      if (!arraysEqual(value, previous)) {
        diff[key] = value;
        hasChanges = true;
      }
      continue;
    }
    if (value !== previous) {
      diff[key] = value;
      hasChanges = true;
    }
  }

  return hasChanges ? diff : null;
}

function normalizeTripsList(data: unknown): ApiTripRecord[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as ApiTripRecord[];
    if (Array.isArray(record.trips)) return record.trips as ApiTripRecord[];
  }
  return [];
}

function sortTripsNewestFirst(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

/** GET /api/trips?status=Draft — list open drafts (optional trip-date filter). */
export async function fetchDraftTrips(tripDate?: string): Promise<Trip[]> {
  const params = new URLSearchParams({ status: "Draft" });
  if (tripDate) {
    params.set("fromDate", tripDate);
    params.set("toDate", tripDate);
  }
  const { data } = await apiGet<unknown>(`${TRIPS_PATH}?${params.toString()}`);
  return normalizeTripsList(data).map((record) => mapApiTripToTrip(record));
}

/** Resume the most recent Draft whose Step 1 is not yet submitted. */
export async function fetchLatestOpenStep1Draft(tripDate?: string): Promise<Trip | null> {
  const drafts = await fetchDraftTrips(tripDate);
  const open = sortTripsNewestFirst(
    drafts.filter((trip) => trip.status === "Draft" && !trip.startStepSubmitted)
  );
  return open[0] ?? null;
}

/** POST /api/trips — create empty Draft; backend assigns trip_no and id. */
export async function createDraft(tripDate: string): Promise<Trip> {
  const { data } = await apiPost<ApiTripRecord>(TRIPS_PATH, { tripDate });
  return mapApiTripToTrip(data);
}

/** GET /api/trips/:id — load full trip (Step 1 resume). */
export async function loadTripById(id: number): Promise<Trip> {
  const { data } = await apiGet<ApiTripRecord>(`${TRIPS_PATH}/${id}`);
  return mapApiTripToTrip(data);
}

/** PUT /api/trips/:id — autosave changed Step 1 header fields on existing draft. */
export async function saveStep1Header(
  id: number,
  trip: Partial<Trip>,
  changedFields?: Record<string, unknown> | null
): Promise<Trip> {
  const payload = changedFields ?? toStep1Payload(trip);
  const { data } = await apiPut<ApiTripRecord>(`${TRIPS_PATH}/${id}`, payload);
  return mapApiTripToTrip(data, trip as Trip);
}

/** POST /api/trips/:id/steps/start — validate & lock Step 1. */
export async function submitStep1(id: number, trip: Partial<Trip>): Promise<Trip> {
  const payload = {
    ...toStep1Payload(trip),
    startStepSubmitted: true,
    startTime: trip.startTime || new Date().toISOString(),
    status: "Draft" as TripStatus,
  };
  const { data } = await apiPost<ApiTripRecord>(`${TRIPS_PATH}/${id}/steps/start`, payload);
  return mapApiTripToTrip(data, trip as Trip);
}

/** GET /api/trips/vehicle/:vehicleId/last-meter — opening KM validation. */
export async function fetchLastClosingMeter(vehicleId: number): Promise<LastClosingMeter | null> {
  const { data } = await apiGet<LastClosingMeter | null>(
    `${TRIPS_PATH}/vehicle/${vehicleId}/last-meter`
  );
  if (!data || data.closingMeter == null) return null;
  return data;
}

export function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export { handleApiError };
