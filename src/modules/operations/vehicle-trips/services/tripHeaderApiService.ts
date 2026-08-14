/**
 * Trip Entry wizard — PostgreSQL via shared Axios helpers.
 * Step 1: POST /trips/steps/start
 * Steps 2–5: POST /trips/:id/steps/:step
 * No draft/localStorage persistence for the active wizard session.
 */

import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  handleApiError,
} from "../../../../api";
import type { Trip, TripStatus, TripStepStatus, TripStepStatuses } from "../types/trip";

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
export function mapApiTripToTrip(raw: ApiTripRecord, existing?: Trip): Trip {  const defaults: Trip = existing ?? {
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
    driverBata: 0,
    totalTripExpense: 0,
    remarks: "",
    rateCompleted: false,
  };

  const mapped: Trip = {
    ...defaults,
    ...raw,
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
    startStepSubmittedAt: formatStartTimeForDisplay(raw.startStepSubmittedAt ?? raw.start_step_submitted_at) || defaults.startStepSubmittedAt,
    remarks: str(raw.remarks, defaults.remarks),
    farmStepSubmitted: Boolean(raw.farmStepSubmitted ?? raw.farm_step_submitted ?? defaults.farmStepSubmitted),
    farmStepSubmittedAt: formatStartTimeForDisplay(raw.farmStepSubmittedAt ?? raw.farm_step_submitted_at) || defaults.farmStepSubmittedAt,
    pickupStepSubmitted: Boolean(raw.pickupStepSubmitted ?? raw.pickup_step_submitted ?? defaults.pickupStepSubmitted),
    pickupStepSubmittedAt: formatStartTimeForDisplay(raw.pickupStepSubmittedAt ?? raw.pickup_step_submitted_at) || defaults.pickupStepSubmittedAt,
    deliveryStepSubmitted: Boolean(raw.deliveryStepSubmitted ?? raw.delivery_step_submitted ?? defaults.deliveryStepSubmitted),
    deliveriesStepSubmittedAt: formatStartTimeForDisplay(raw.deliveriesStepSubmittedAt ?? raw.deliveries_step_submitted_at) || defaults.deliveriesStepSubmittedAt,
    endStepSubmitted: Boolean(raw.endStepSubmitted ?? raw.end_step_submitted ?? defaults.endStepSubmitted),
    expensesStepSubmitted: Boolean(raw.expensesStepSubmitted ?? raw.expenses_step_submitted ?? defaults.expensesStepSubmitted),
    expensesStepSubmittedAt: formatStartTimeForDisplay(raw.expensesStepSubmittedAt ?? raw.expenses_step_submitted_at) || defaults.expensesStepSubmittedAt,
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
    driverBata: num(raw.driverBata ?? raw.driver_bata, defaults.driverBata),
    totalTripExpense: num(raw.totalTripExpense ?? raw.total_trip_expense, defaults.totalTripExpense),
    rateCompleted: Boolean(raw.rateCompleted ?? raw.rate_completed ?? defaults.rateCompleted),
    createdAt: str(raw.createdAt ?? raw.created_at, defaults.createdAt ?? new Date().toISOString()),
    updatedAt: str(raw.updatedAt ?? raw.updated_at, defaults.updatedAt ?? new Date().toISOString()),
    sourceFarmId: numOrZero(raw.sourceFarmId ?? raw.source_farm_id ?? defaults.sourceFarmId),
    sourceFarm: str(raw.sourceFarm ?? raw.source_farm, defaults.sourceFarm),
    reachedTime: formatStartTimeForDisplay(raw.reachedTime ?? raw.reached_time) || defaults.reachedTime,
    destMeter: numOrZero(raw.destMeter ?? raw.dest_meter ?? defaults.destMeter),
    pickupTolls: num(raw.pickupTolls ?? raw.pickup_tolls, defaults.pickupTolls),
    farmAddress: raw.farmAddress != null ? str(raw.farmAddress) : raw.farm_address != null ? str(raw.farm_address) : defaults.farmAddress,
    avgBirdWeight: num(raw.avgBirdWeight ?? raw.avg_bird_weight, defaults.avgBirdWeight),
    dcPhotoKey: raw.dcPhotoKey != null ? str(raw.dcPhotoKey) : raw.dc_photo_key != null ? str(raw.dc_photo_key) : defaults.dcPhotoKey,
    dcPhotoMime: raw.dcPhotoMime != null ? str(raw.dcPhotoMime) : defaults.dcPhotoMime,
    dcPhotoData: raw.dcPhotoData != null ? str(raw.dcPhotoData) : defaults.dcPhotoData,
    destinationTolls: num(raw.destinationTolls ?? raw.destination_tolls, defaults.destinationTolls),
    meals: num(raw.meals, defaults.meals),
    loading: num(raw.loading, defaults.loading),
    mealsTiffin: num(raw.mealsTiffin ?? raw.meals_tiffin, defaults.mealsTiffin),
    vehicleMaintenance: num(raw.vehicleMaintenance ?? raw.vehicle_maintenance, defaults.vehicleMaintenance),
    othersRC: num(raw.othersRC ?? raw.others_rc, defaults.othersRC),
    others1Amt: num(raw.others1Amt ?? raw.others1_amt, defaults.others1Amt),
    others2Amt: num(raw.others2Amt ?? raw.others2_amt, defaults.others2Amt),
    others3Amt: num(raw.others3Amt ?? raw.others3_amt, defaults.others3Amt),
    others4Amt: num(raw.others4Amt ?? raw.others4_amt, defaults.others4Amt),
    others5Amt: num(raw.others5Amt ?? raw.others5_amt, defaults.others5Amt),
    submittedAtTimestamp: str(raw.submittedAtTimestamp, defaults.submittedAtTimestamp),
    deleted: Boolean(raw.deleted ?? defaults.deleted),
    deletedReason: raw.deletedReason != null ? str(raw.deletedReason) : defaults.deletedReason,
    approvedBy: raw.approvedBy != null ? str(raw.approvedBy) : defaults.approvedBy,
  };

  const serverStatuses =
    raw.stepStatuses && typeof raw.stepStatuses === "object"
      ? (raw.stepStatuses as TripStepStatuses)
      : undefined;

  return {
    ...mapped,
    stepStatuses: serverStatuses ?? deriveStepStatuses(mapped),
  };
}

/** Fallback 3-state derivation when the backend hasn't supplied stepStatuses. */
export function deriveStepStatuses(t: Trip): TripStepStatuses {
  const status = (submitted: boolean, saved: boolean): TripStepStatus =>
    submitted ? "completed" : saved ? "saved" : "not_started";
  const any = (value?: number | null) => Boolean(value && value > 0);
  const extras = t as Trip & Record<string, unknown>;

  return {
    start: status(
      Boolean(t.startStepSubmitted),
      Boolean(t.vehicleId || t.driverId || any(t.openingMeter) || any(t.advanceAmount) || t.startTime)
    ),
    farm: status(
      Boolean(t.farmStepSubmitted),
      Boolean(
        t.sourceFarmId ||
          any(t.destMeter) ||
          t.reachedTime ||
          any(t.pickupTolls) ||
          any(extras.farmBirdTypeId as number) ||
          any(extras.farmBirdCount as number) ||
          t.farmAddress ||
          any(extras.avgBirdWeight as number)
      )
    ),
    pickup: status(
      Boolean(t.pickupStepSubmitted),
      Boolean(
        any(t.dcWeight) ||
          any(t.totalBirds) ||
          any(t.boxes) ||
          t.dcPhotoKey ||
          (t.boxDetails || []).length > 0
      )
    ),
    deliveries: status(
      Boolean(t.deliveryStepSubmitted),
      Boolean((t.deliveries || []).length > 0 || any(t.totalShops))
    ),
    expenses: status(
      Boolean(t.endStepSubmitted || t.expensesStepSubmitted),
      Boolean(
        any(t.closingMeter) ||
          any(extras.endMeter as number) ||
          t.endTime ||
          any(t.deliveryTolls) ||
          any(extras.destinationTolls as number) ||
          any(extras.meals as number) ||
          any(extras.mealsTiffin as number) ||
          any(extras.loading as number) ||
          any(extras.vehicleMaintenance as number) ||
          any(extras.othersRC as number) ||
          any(extras.others1Amt as number) ||
          any(extras.others2Amt as number) ||
          any(extras.others3Amt as number) ||
          any(extras.others4Amt as number) ||
          any(extras.others5Amt as number) ||
          t.remarks
      )
    ),
  };
}

/** Step 1 payload sent to PUT /trips/:id and POST /trips/:id/steps/start */
export function toStep1Payload(trip: Partial<Trip>): Record<string, unknown> {
  return {
    tripDate: trip.tripDate,
    tripNo: trip.tripNo,
    status: trip.status ?? "Draft",
    startTime: trip.startStepSubmitted ? (trip.startTime || null) : null,
    vehicleId: trip.vehicleId || null,
    vehicleNo: trip.vehicleNo || null,
    driverId: trip.driverId || null,
    driverName: trip.driverName || null,
    supervisorId: trip.supervisorId || null,
    supervisorName: trip.supervisorName || null,
    openingMeter: trip.openingMeter ?? 0,
    advanceAmount: trip.advanceAmount ?? 0,
    helpers: trip.helpers ?? [],
    loaders: trip.loaders ?? [],
    remarks: trip.remarks ?? "",
    startStepSubmitted: trip.startStepSubmitted ?? false,
  };
}

/** GET /api/trips/:id — load full trip (Step 1 resume). */
export async function loadTripById(id: number): Promise<Trip> {
  const { data } = await apiGet<ApiTripRecord>(`${TRIPS_PATH}/${id}`);
  return mapApiTripToTrip(data);
}

/** GET /api/trips — PostgreSQL-backed Recent Trips. */
export async function listTrips(): Promise<Trip[]> {
  try {
    const { data } = await apiGet<ApiTripRecord[]>(TRIPS_PATH);
    return data.map((trip) => mapApiTripToTrip(trip));
  } catch (error) {
    // Offline fallback: the original localStorage trip store (the same data
    // source the executive dashboard reads) keeps the trip list usable when
    // the local PostgreSQL backend is not running.
    try {
      const raw = localStorage.getItem("vehicleTrips");
      if (!raw) throw error;
      const stored = JSON.parse(raw) as Trip[];
      if (!Array.isArray(stored)) throw error;
      return stored.sort((a, b) => new Date(b.tripDate).getTime() - new Date(a.tripDate).getTime());
    } catch {
      throw error;
    }
  }
}

/** Single final Step 1 submission. No draft is created or updated before this request. */
export async function submitStep1(trip: Partial<Trip>): Promise<Trip> {
  const payload = {
    ...toStep1Payload(trip),
    // A brand-new trip has no server-assigned number yet. The backend ALWAYS
    // generates the Trip No on create; never forward a stale client-side value
    // here because it would collide with trips_trip_no_key ("Duplicate record").
    tripNo: "",
    startStepSubmitted: true,
    startTime: trip.startTime || new Date().toISOString(),
    status: "Draft" as TripStatus,
  };
  const { data } = await apiPost<ApiTripRecord>(`${TRIPS_PATH}/steps/start`, payload);
  return mapApiTripToTrip(data, trip as Trip);
}

export type TripWizardStep = "start" | "farm" | "pickup" | "deliveries" | "expenses";

/**
 * Save partial Step 1 on a brand-new trip (no row yet). POST /trips creates a
 * Draft row and persists whatever start fields were entered — no validation.
 */
export async function saveNewStart(trip: Partial<Trip>): Promise<Trip> {
  const { data } = await apiPost<ApiTripRecord>(TRIPS_PATH, {
    ...toStep1Payload(trip),
    status: "Draft" as TripStatus,
  });
  return mapApiTripToTrip(data, trip as Trip);
}

/**
 * Submit a later wizard step against an existing trip ID.
 * Uses POST /api/trips/:id/steps/:step — one request per submit.
 */
export async function submitTripStep(
  tripId: number,
  step: TripWizardStep,
  trip: Partial<Trip>
): Promise<Trip> {
  const { data } = await apiPost<ApiTripRecord>(
    `${TRIPS_PATH}/${tripId}/steps/${step}`,
    { ...trip, mode: "submit" }
  );
  return mapApiTripToTrip(data, trip as Trip);
}

/** Explicitly persist a valid step without submitting/locking it. */
export async function saveTripStepProgress(
  tripId: number,
  step: TripWizardStep,
  trip: Partial<Trip>
): Promise<Trip> {
  const { data } = await apiPost<ApiTripRecord>(
    `${TRIPS_PATH}/${tripId}/steps/${step}`,
    { ...trip, mode: "save" }
  );
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

/** DELETE /api/trips/:id — server-side soft delete (Recent Trips). */
export async function deleteTripOnServer(id: number, reason?: string): Promise<void> {
  await apiDelete(`${TRIPS_PATH}/${id}`, { params: { reason } });
}

/** PATCH /api/trips/:id/status — server-side lifecycle transition (Recent Trips). */
export async function changeTripStatusOnServer(
  id: number,
  status: TripStatus,
  approvedBy?: string
): Promise<Trip> {
  const { data } = await apiPatch<ApiTripRecord>(`${TRIPS_PATH}/${id}/status`, {
    status,
    approvedBy,
  });
  return mapApiTripToTrip(data);
}

export { handleApiError };
