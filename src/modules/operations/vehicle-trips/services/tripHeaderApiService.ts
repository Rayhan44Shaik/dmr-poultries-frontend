/**
 * Trip Entry wizard — PostgreSQL via shared Axios helpers.
 * Step 1: POST /trips/steps/start
 * Steps 2–5: POST /trips/:id/steps/:step
 * No draft/localStorage persistence for the active wizard session.
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  handleApiError,
  toApiError,
} from "../../../../api";
import {
  createEmptyTrip,
  isTripStatus,
  type Trip,
  type TripStatus,
} from "../../../../shared/trip";

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

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionalQuantity(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numOrZero(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return num(value, 0);
}

function str(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

/** Shared user-facing timestamp formatter for Step 1–5 View (locale/timezone as-is). */
export function formatStartTimeForDisplay(value: unknown): string {
  if (!value) return "";
  const raw = String(value);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString();
  }
  return raw;
}

function finiteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function mapBoxIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((id) => finiteNumber(id))
    .filter((id): id is number => id != null);
}

function mapPerBoxData(value: unknown): NonNullable<Trip["deliveries"][number]["perBoxData"]> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = item as { boxNo?: unknown; birds?: unknown; weight?: unknown };
    const boxNo = finiteNumber(row.boxNo);
    const birds = finiteNumber(row.birds);
    const weight = finiteNumber(row.weight);
    if (boxNo == null || birds == null || weight == null) return [];
    return [{ boxNo, birds, weight }];
  });
}

function mapDeliveriesForDisplay(value: unknown, fallback: Trip["deliveries"]): Trip["deliveries"] {
  if (!Array.isArray(value)) return fallback;
  return value.map((raw) => {
    const row = raw as Trip["deliveries"][number];
    const selectedBoxIds = mapBoxIdList(row.selectedBoxIds);
    const perBoxData = mapPerBoxData(row.perBoxData);
    const derivedBoxIds = selectedBoxIds.length
      ? selectedBoxIds
      : perBoxData.map((item) => item.boxNo);
    const boxCount = derivedBoxIds.length || finiteNumber(row.boxNo);
    return {
      ...row,
      shopId: finiteNumber(row.shopId) ?? row.shopId,
      birdTypeId: finiteNumber(row.birdTypeId) ?? row.birdTypeId,
      birdType: row.birdType || "",
      birds: finiteNumber(row.birds) ?? 0,
      weight: finiteNumber(row.weight) ?? 0,
      mortality: finiteNumber(row.mortality) ?? 0,
      mortKg: finiteNumber(row.mortKg),
      rate: row.rate == null ? null : finiteNumber(row.rate) ?? null,
      amount: finiteNumber(row.amount) ?? 0,
      selectedBoxIds: derivedBoxIds,
      perBoxData,
      boxNo: boxCount ?? 0,
      farmBirds: finiteNumber(row.farmBirds),
      farmWeight: finiteNumber(row.farmWeight),
      autoCaptureTime: formatStartTimeForDisplay((row as { autoCaptureTime?: unknown }).autoCaptureTime)
        || (row as { autoCaptureTime?: string }).autoCaptureTime,
    };
  });
}

function mapDieselEntriesForDisplay(
  value: unknown,
  fallback: Trip["dieselEntries"]
): Trip["dieselEntries"] {
  if (!Array.isArray(value)) return fallback;
  return value.map((row) => {
    const entry = row as NonNullable<Trip["dieselEntries"]>[number];
    return {
      ...entry,
      submittedAt: formatStartTimeForDisplay(entry.submittedAt) || entry.submittedAt,
    };
  });
}

function mapFlattenedDieselTimestamps(raw: ApiTripRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (/^dieselSubmittedAt\d+$/.test(key)) {
      out[key] = formatStartTimeForDisplay(value) || value;
    }
  }
  return out;
}

function normalizeStatus(value: unknown): TripStatus {
  const status = str(value, "Draft");
  return isTripStatus(status) ? status : "Draft";
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
  const defaults: Trip = existing ?? createEmptyTrip({ tripDate: "" });

  return {
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
    openingMeter: numOrNull(raw.openingMeter ?? raw.opening_meter),
    advanceAmount: numOrNull(raw.advanceAmount ?? raw.advance_amount),
    startStepSubmitted: Boolean(raw.startStepSubmitted ?? raw.start_step_submitted ?? defaults.startStepSubmitted),
    remarks: str(raw.remarks, defaults.remarks),
    farmStepSubmitted: Boolean(raw.farmStepSubmitted ?? raw.farm_step_submitted ?? defaults.farmStepSubmitted),
    pickupStepSubmitted: Boolean(raw.pickupStepSubmitted ?? raw.pickup_step_submitted ?? defaults.pickupStepSubmitted),
    deliveryStepSubmitted: Boolean(raw.deliveryStepSubmitted ?? raw.delivery_step_submitted ?? defaults.deliveryStepSubmitted),
    endStepSubmitted: Boolean(raw.endStepSubmitted ?? raw.end_step_submitted ?? defaults.endStepSubmitted),
    expensesStepSubmitted: Boolean(raw.expensesStepSubmitted ?? raw.expenses_step_submitted ?? defaults.expensesStepSubmitted),
    expensesStepSubmittedAt: raw.expensesStepSubmittedAt != null || raw.expenses_step_submitted_at != null
      ? formatStartTimeForDisplay(raw.expensesStepSubmittedAt ?? raw.expenses_step_submitted_at)
      : defaults.expensesStepSubmittedAt,
    submittedAtTimestamp: formatStartTimeForDisplay(
      raw.expensesStepSubmittedAt ?? raw.expenses_step_submitted_at ?? raw.submittedAtTimestamp ?? raw.submittedAt
    ) || defaults.submittedAtTimestamp,
    mileageKmL: numOrNull(raw.mileageKmL ?? raw.mileage_km_l),
    dieselEntries: mapDieselEntriesForDisplay(raw.dieselEntries, defaults.dieselEntries),
    dcWeight: num(raw.dcWeight ?? raw.dc_weight, defaults.dcWeight),
    totalBirds: num(raw.totalBirds ?? raw.total_birds, defaults.totalBirds),
    boxes: num(raw.boxes, defaults.boxes),
    avgWeight: num(raw.avgWeight ?? raw.avg_weight, defaults.avgWeight),
    pickupLoadTime: formatStartTimeForDisplay(raw.pickupLoadTime ?? raw.pickup_load_time) || defaults.pickupLoadTime,
    boxDetails: Array.isArray(raw.boxDetails) ? (raw.boxDetails as Trip["boxDetails"]) : defaults.boxDetails,
    deliveries: mapDeliveriesForDisplay(raw.deliveries, defaults.deliveries),
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
    avgBirdWeight: num(raw.avgBirdWeight ?? raw.avg_bird_weight, defaults.avgBirdWeight ?? 0),
    farmGpsLat: numOrNull(raw.farmGpsLat ?? raw.farm_gps_lat),
    farmGpsLon: numOrNull(raw.farmGpsLon ?? raw.farm_gps_lon),
    farmGpsAccuracy: numOrNull(raw.farmGpsAccuracy ?? raw.farm_gps_accuracy),
    farmGpsTime: raw.farmGpsTime != null ? str(raw.farmGpsTime) : raw.farm_gps_time != null ? str(raw.farm_gps_time) : defaults.farmGpsTime ?? null,
    dcPhotoKey: raw.dcPhotoKey != null ? str(raw.dcPhotoKey) : raw.dc_photo_key != null ? str(raw.dc_photo_key) : defaults.dcPhotoKey,
    dcPhotoMime: raw.dcPhotoMime != null ? str(raw.dcPhotoMime) : defaults.dcPhotoMime,
    dcPhotoData: raw.dcPhotoData != null ? str(raw.dcPhotoData) : defaults.dcPhotoData,
    dcPhotoKey2: raw.dcPhotoKey2 != null ? str(raw.dcPhotoKey2) : defaults.dcPhotoKey2,
    dcPhotoMime2: raw.dcPhotoMime2 != null ? str(raw.dcPhotoMime2) : defaults.dcPhotoMime2,
    dcPhotoData2: raw.dcPhotoData2 != null ? str(raw.dcPhotoData2) : defaults.dcPhotoData2,
    vehicleBoxCapacity: numOrNull(raw.vehicleBoxCapacity) ?? defaults.vehicleBoxCapacity,
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
    deleted: Boolean(raw.deleted ?? defaults.deleted),
    deletedReason: raw.deletedReason != null ? str(raw.deletedReason) : defaults.deletedReason,
    approvedBy: raw.approvedBy != null ? str(raw.approvedBy) : defaults.approvedBy,
    ...mapFlattenedDieselTimestamps(raw),
  };
}

/** Step 1 payload sent to PUT /trips/:id and POST /trips/:id/steps/start */
export function toStep1Payload(trip: Partial<Trip>): Record<string, unknown> {
  return {
    tripDate: trip.tripDate,
    status: trip.status ?? "Draft",
    vehicleId: trip.vehicleId || null,
    vehicleNo: trip.vehicleNo || null,
    driverId: trip.driverId || null,
    driverName: trip.driverName || null,
    supervisorId: trip.supervisorId || null,
    supervisorName: trip.supervisorName || null,
    openingMeter: optionalQuantity(trip.openingMeter),
    advanceAmount: optionalQuantity(trip.advanceAmount),
    helpers: trip.helpers ?? [],
    loaders: trip.loaders ?? [],
    remarks: trip.remarks ?? "",
    startStepSubmitted: trip.startStepSubmitted ?? false,
  };
}

function normalizeTolls(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Step 2 payload — Farm Loading only. Never sends Completed Trips / Average Rate / client reachedTime. */
export function toStep2Payload(trip: Partial<Trip>): Record<string, unknown> {
  const destMeter = optionalQuantity(trip.destMeter);
  const avgBirdWeight = optionalQuantity(trip.avgBirdWeight);
  const payload: Record<string, unknown> = {
    sourceFarmId: trip.sourceFarmId || null,
    sourceFarm: trip.sourceFarm || null,
    farmAddress: trip.farmAddress ?? "",
    destMeter: destMeter === 0 ? null : destMeter,
    pickupTolls: normalizeTolls(trip.pickupTolls),
    avgBirdWeight: avgBirdWeight === 0 ? null : avgBirdWeight,
    remarks: trip.remarks ?? "",
    farmStepSubmitted: trip.farmStepSubmitted ?? false,
  };
  const lat = numOrNull(trip.farmGpsLat);
  const lon = numOrNull(trip.farmGpsLon);
  if (
    lat != null &&
    lon != null &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !(lat === 0 && lon === 0)
  ) {
    payload.farmGpsLat = lat;
    payload.farmGpsLon = lon;
    const acc = numOrNull(trip.farmGpsAccuracy);
    payload.farmGpsAccuracy = acc != null && acc >= 0 ? acc : null;
    payload.farmGpsTime = trip.farmGpsTime || null;
  }
  return payload;
}

export function toStep3Payload(trip: Partial<Trip> & { removedBoxNos?: number[]; syncPickupPhotos?: boolean }): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (Array.isArray(trip.boxDetails) && trip.boxDetails.length) {
    payload.boxDetails = trip.boxDetails.map((b) => ({
      boxNo: b.boxNo,
      birds: b.birds ?? 0,
      weight: b.weight ?? 0,
    }));
  }
  if (Array.isArray(trip.removedBoxNos) && trip.removedBoxNos.length) {
    payload.removedBoxNos = trip.removedBoxNos;
  }
  if (trip.dcPhotoKey) payload.dcPhotoKey = trip.dcPhotoKey;
  if (trip.dcPhotoMime) payload.dcPhotoMime = trip.dcPhotoMime;
  if (trip.dcPhotoData) payload.dcPhotoData = trip.dcPhotoData;
  if (trip.dcPhotoKey2) payload.dcPhotoKey2 = trip.dcPhotoKey2;
  if (trip.dcPhotoMime2) payload.dcPhotoMime2 = trip.dcPhotoMime2;
  if (trip.dcPhotoData2) payload.dcPhotoData2 = trip.dcPhotoData2;
  if (trip.syncPickupPhotos) payload.syncPickupPhotos = true;
  return payload;
}

export function toStep5Payload(trip: Partial<Trip> & Record<string, unknown>): Record<string, unknown> {
  const n = (v: unknown) => {
    if (v === undefined || v === null || v === "") return 0;
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const payload: Record<string, unknown> = {
    meals: n(trip.meals),
    loading: n(trip.loading),
    mealsTiffin: n(trip.mealsTiffin),
    vehicleMaintenance: n(trip.vehicleMaintenance),
    othersRC: n(trip.othersRC),
    others1Amt: n(trip.others1Amt),
    others2Amt: n(trip.others2Amt),
    others3Amt: n(trip.others3Amt),
    others4Amt: n(trip.others4Amt),
    others5Amt: n(trip.others5Amt),
    remarks: trip.remarks ?? "",
  };
  const raw = trip as Record<string, unknown>;
  const endRaw = raw.endMeter ?? trip.closingMeter;
  if (endRaw !== "" && endRaw != null && Number.isFinite(Number(endRaw))) {
    payload.endMeter = Number(endRaw);
    payload.closingMeter = Number(endRaw);
  }
  const tollRaw = raw.destinationTolls ?? trip.deliveryTolls;
  if (tollRaw !== "" && tollRaw != null && Number.isFinite(Number(tollRaw))) {
    payload.destinationTolls = Number(tollRaw);
    payload.deliveryTolls = Number(tollRaw);
  }
  return payload;
}

export type DieselSubmitPayload = {
  clientKey: string;
  litres: number;
  rate: number;
  meter: number;
  bunkName: string;
  gpsLat: number;
  gpsLon: number;
  gpsAccuracy: number | null;
  gpsCapturedAt: string | null;
  imageData: string;
  imageName?: string | null;
};

export async function submitTripDiesel(tripId: number, payload: DieselSubmitPayload): Promise<Trip> {
  const { data } = await apiPost<ApiTripRecord>(`${TRIPS_PATH}/${tripId}/diesel`, payload);
  return mapApiTripToTrip(data);
}

export async function updateTripDiesel(
  tripId: number,
  entryId: number,
  payload: DieselSubmitPayload
): Promise<Trip> {
  const { data } = await apiPatch<ApiTripRecord>(`${TRIPS_PATH}/${tripId}/diesel/${entryId}`, payload);
  return mapApiTripToTrip(data);
}

export async function deleteTripDiesel(tripId: number, entryId: number): Promise<Trip> {
  const { data } = await apiDelete<ApiTripRecord>(`${TRIPS_PATH}/${tripId}/diesel/${entryId}`);
  return mapApiTripToTrip(data);
}

export function validateStep4Deliveries(rows: Trip["deliveries"]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return ["Please add at least one shop delivery."];
  }
  rows.forEach((d, index) => {
    const prefix = rows.length > 1 ? `Delivery ${index + 1}: ` : "";
    if (!finiteNumber(d.shopId)) errors.push(`${prefix}Shop is required.`);
    if (!finiteNumber(d.birdTypeId) || !String(d.birdType || "").trim()) {
      errors.push(`${prefix}Bird Type is required.`);
    }
    if (finiteNumber(d.birds) == null) errors.push(`${prefix}Birds must be a valid number.`);
    if (finiteNumber(d.weight) == null) errors.push(`${prefix}Weight must be a valid number.`);
    if (d.mortality != null && finiteNumber(d.mortality) == null) {
      errors.push(`${prefix}Mortality must be a valid number.`);
    }
    if (d.mortKg != null && finiteNumber(d.mortKg) == null) {
      errors.push(`${prefix}Mortality weight must be a valid number.`);
    }
    const boxes = mapBoxIdList(d.selectedBoxIds);
    const perBox = mapPerBoxData(d.perBoxData);
    if (!boxes.length && !perBox.length && !finiteNumber(d.boxNo)) {
      errors.push(`${prefix}Box information is required.`);
    }
  });
  return errors;
}

export function toStep4Payload(trip: Partial<Trip> & { deliveries?: Trip["deliveries"] }): Record<string, unknown> {
  const rows = Array.isArray(trip.deliveries) ? trip.deliveries : [];
  return {
    deliveries: rows.map((d) => {
      const selectedBoxIds = mapBoxIdList(d.selectedBoxIds);
      const perBoxData = mapPerBoxData(d.perBoxData);
      const birds = finiteNumber(d.birds);
      const weight = finiteNumber(d.weight);
      const mortality = finiteNumber(d.mortality) ?? 0;
      const mortKg = finiteNumber(d.mortKg) ?? 0;
      const serialNo = finiteNumber(d.serialNo);
      const boxNo = selectedBoxIds.length || finiteNumber(d.boxNo) || 0;
      return {
        id: d.id && d.id < 1e12 && Number.isFinite(Number(d.id)) ? Number(d.id) : undefined,
        clientKey: d.clientKey || undefined,
        shopId: finiteNumber(d.shopId) ?? null,
        shopName: d.shopName || "",
        birdTypeId: finiteNumber(d.birdTypeId) ?? null,
        birdType: d.birdType || "",
        birds,
        weight,
        mortality,
        mortKg,
        rate: d.rate == null ? null : finiteNumber(d.rate) ?? null,
        amount: finiteNumber(d.amount) ?? 0,
        remarks: d.remarks ?? "",
        deliveryMode: d.deliveryMode === "weight" ? "weight" : "box",
        selectedBoxIds,
        perBoxData,
        serialNo,
        boxNo,
        farmBirds: finiteNumber(d.farmBirds) ?? null,
        farmWeight: finiteNumber(d.farmWeight) ?? null,
      };
    }),
  };
}

function firstValidationMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const data = body as {
    error?: unknown;
    message?: unknown;
    details?: unknown;
    issues?: unknown;
    errors?: unknown;
  };
  const collect = (value: unknown): string | null => {
    if (!Array.isArray(value)) return null;
    for (const item of value) {
      if (typeof item === "string" && item.trim()) return item.trim();
      if (item && typeof item === "object" && typeof (item as { message?: unknown }).message === "string") {
        const message = String((item as { message: string }).message).trim();
        if (message) return message;
      }
    }
    return null;
  };
  return (
    collect(data.issues) ||
    collect(data.errors) ||
    collect((data.details as { issues?: unknown; errors?: unknown } | undefined)?.issues) ||
    collect((data.details as { issues?: unknown; errors?: unknown } | undefined)?.errors) ||
    (typeof data.error === "string" && data.error.trim() ? data.error.trim() : null) ||
    (typeof data.message === "string" && data.message.trim() ? data.message.trim() : null)
  );
}

export function formatWizardApiError(error: unknown): string {
  const apiError = toApiError(error);
  if (apiError.code === "NETWORK_ERROR") return "Unable to connect. Please try again.";
  if (apiError.status && apiError.status >= 500) return "Unable to submit. Please try again.";
  const fromBody = firstValidationMessage(apiError.details);
  if (fromBody && !/postgres|sql|smtp|\/home\/|stack/i.test(fromBody)) {
    return fromBody;
  }
  if (apiError.status === 422) {
    return apiError.message && apiError.message !== "The request could not be processed."
      ? apiError.message
      : "Please correct the highlighted delivery fields.";
  }
  return handleApiError(error);
}

export async function saveTripDeliveries(tripId: number, trip: Partial<Trip>): Promise<Trip> {
  const { data } = await apiPut<ApiTripRecord>(`${TRIPS_PATH}/${tripId}/deliveries`, toStep4Payload(trip));
  return mapApiTripToTrip(data, trip as Trip);
}

/** GET /api/trips/:id — load full trip (Step 1 resume). */
export async function loadTripById(id: number): Promise<Trip> {
  const { data } = await apiGet<ApiTripRecord>(`${TRIPS_PATH}/${id}`);
  return mapApiTripToTrip(data);
}

/** GET /api/trips — PostgreSQL-backed Trip List / Recent Trips. The backend
 * is the single source of truth — never fall back to stale localStorage
 * data that could override PostgreSQL (Trip List must reflect the same
 * updated trip deliveries/summaries as Shop Sales). */
export async function listTrips(options?: { includeDeleted?: boolean }): Promise<Trip[]> {
  const { data } = await apiGet<ApiTripRecord[]>(TRIPS_PATH, {
    params: options?.includeDeleted ? { includeDeleted: "true" } : undefined,
  });
  return data.map((trip) => mapApiTripToTrip(trip));
}

/** GET /api/operations/trip-list — completed/approved, non-deleted trips only. */
export async function listCompletedTrips(): Promise<Trip[]> {
  const { data } = await apiGet<ApiTripRecord[] | { data: ApiTripRecord[] }>(
    "/operations/trip-list"
  );
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];
  return rows.map((trip) => mapApiTripToTrip(trip));
}

/** Single final Step 1 submission. No draft is created or updated before this request. */
export async function submitStep1(trip: Partial<Trip>): Promise<Trip> {
  const payload = {
    ...toStep1Payload(trip),
    startStepSubmitted: true,
    status: "Draft" as TripStatus,
  };
  const { data } = await apiPost<ApiTripRecord>(`${TRIPS_PATH}/steps/start`, payload);
  return mapApiTripToTrip(data, trip as Trip);
}

export type TripWizardStep = "start" | "farm" | "pickup" | "deliveries" | "expenses";

/**
 * Submit a later wizard step against an existing trip ID.
 * Uses POST /api/trips/:id/steps/:step — one request per submit.
 */
export async function submitTripStep(
  tripId: number,
  step: TripWizardStep,
  trip: Partial<Trip>
): Promise<Trip> {
  let body: Record<string, unknown> = { ...trip, mode: "submit" };
  if (step === "start") {
    delete body.startTime;
    body.startStepSubmitted = true;
    Object.assign(body, toStep1Payload({ ...trip, startStepSubmitted: true }));
    body.mode = "submit";
  }
  if (step === "farm") {
    body = {
      ...toStep2Payload({ ...trip, farmStepSubmitted: true }),
      mode: "submit",
      farmStepSubmitted: true,
    };
  }
  if (step === "pickup") {
    body = {
      ...toStep3Payload(trip),
      mode: "submit",
      pickupStepSubmitted: true,
      pickupBoxWrite: "replace",
    };
  }
  if (step === "deliveries") {
    const payload = toStep4Payload(trip);
    const deliveryErrors = validateStep4Deliveries((trip.deliveries || []) as Trip["deliveries"]);
    if (deliveryErrors.length) {
      throw toApiError(new Error(deliveryErrors[0]));
    }
    const rows = (payload.deliveries as Array<Record<string, unknown>>) || [];
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "number" && !Number.isFinite(value)) {
          throw toApiError(new Error(`${key} must be a valid number.`));
        }
      }
    }
    body = {
      ...payload,
      mode: "submit",
    };
  }
  if (step === "expenses") {
    body = {
      ...toStep5Payload(trip as Partial<Trip> & Record<string, unknown>),
      mode: "submit",
    };
  }
  const { data } = await apiPost<ApiTripRecord>(
    `${TRIPS_PATH}/${tripId}/steps/${step}`,
    body
  );
  return mapApiTripToTrip(data, trip as Trip);
}

/** Explicitly persist a valid step without submitting/locking it. */
export async function saveTripStepProgress(
  tripId: number,
  step: TripWizardStep,
  trip: Partial<Trip>
): Promise<Trip> {
  const body: Record<string, unknown> =
    step === "farm"
      ? { ...toStep2Payload({ ...trip, farmStepSubmitted: false }), mode: "save" }
      : step === "pickup"
        ? { ...toStep3Payload(trip), mode: "save", pickupBoxWrite: "upsert" }
        : step === "deliveries"
          ? { ...toStep4Payload(trip), mode: "save" }
          : step === "expenses"
            ? { ...toStep5Payload(trip as Partial<Trip> & Record<string, unknown>), mode: "save" }
          : { ...trip, mode: "save" };
  const { data } = await apiPost<ApiTripRecord>(
    `${TRIPS_PATH}/${tripId}/steps/${step}`,
    body
  );
  return mapApiTripToTrip(data, trip as Trip);
}

export type AvailableTripResources = {
  vehicles: Array<{ id: number; vehicleNumber: string }>;
  drivers: Array<{ id: number; employeeName: string; department: string }>;
  supervisors: Array<{ id: number; employeeName: string; department: string }>;
  helpers: Array<{ id: number; employeeName: string; department: string }>;
  loaders: Array<{ id: number; employeeName: string; department: string }>;
};

export async function fetchAvailableResources(tripId?: number | null): Promise<AvailableTripResources> {
  const suffix = tripId && tripId > 0 ? `?tripId=${tripId}` : "";
  const { data } = await apiGet<AvailableTripResources>(`${TRIPS_PATH}/available-resources${suffix}`);
  return data;
}

/** GET /api/trips/vehicle/:vehicleId/last-meter — opening KM validation. */
export async function fetchLastClosingMeter(vehicleId: number): Promise<LastClosingMeter | null> {
  const { data } = await apiGet<LastClosingMeter | null>(
    `${TRIPS_PATH}/vehicle/${vehicleId}/last-meter`
  );
  if (!data || data.closingMeter == null) return null;
  return data;
}

/** PATCH /api/trips/:id/status — backend-authoritative status transition
 * (Pending -> Completed / Draft -> Pending). The backend enforces the state
 * machine and persists the change to PostgreSQL, so the Trip List / Recent
 * lifecycle survives refresh and is never stored in localStorage. */
export async function changeTripStatus(
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

/** DELETE /api/trips/:id — backend soft-delete. Reason is sent as a query
 * param (the backend route reads req.body.reason ?? req.query.reason). */
export async function deleteTripFromApi(id: number, reason?: string): Promise<{ id: number; deleted: boolean }> {
  const { data } = await apiDelete<{ id: number; deleted: boolean }>(`${TRIPS_PATH}/${id}`, {
    params: reason ? { reason } : undefined,
  });
  return data;
}

export { handleApiError };
