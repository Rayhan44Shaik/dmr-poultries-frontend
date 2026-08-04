/**
 * Trip Entry — PostgreSQL ONLY via shared Axios helpers.
 * localStorage (`vehicleTrips`) is cleared and is not a data source.
 *
 * API contract (Phase 1 trips):
 *   GET    /api/trips
 *   GET    /api/trips/:id
 *   POST   /api/trips
 *   PUT    /api/trips/:id
 *   POST   /api/trips/:id/steps/:step   (start|farm|pickup|deliveries|expenses)
 *   DELETE /api/trips/:id               (soft delete)
 *   GET    /api/trips/vehicle/:vehicleId/last-meter
 */

import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
} from "../../../../api";
import type { BoxDetail, ShopDelivery, Trip, TripStatus } from "../types/trip";

const TRIPS_PATH = "/trips";
const LEGACY_STORAGE_KEYS = ["vehicleTrips"] as const;

/** In-memory cache filled exclusively by API responses. */
let tripsCache: Trip[] = [];

export type TripStep = "start" | "farm" | "pickup" | "deliveries" | "expenses";

export type DieselEntry = {
  rowIndex: number;
  litres?: number | null;
  rate?: number | null;
  meter?: number | null;
  bunkName?: string | null;
  bunkGps?: string | null;
  imageData?: string | null;
  imageName?: string | null;
};

function clearLegacyTripStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function normalizeStatus(status: unknown): TripStatus {
  if (
    status === "Draft" ||
    status === "Pending" ||
    status === "Completed" ||
    status === "Deleted"
  ) {
    return status;
  }
  return "Draft";
}

function mapBox(raw: Record<string, unknown>): BoxDetail {
  return {
    boxNo: toNumber(raw.boxNo ?? raw.box_no),
    birds: toNumber(raw.birds),
    weight: toNumber(raw.weight),
  };
}

function mapDelivery(raw: Record<string, unknown>): ShopDelivery {
  return {
    id: toNumber(raw.id),
    serialNo: toOptionalNumber(raw.serialNo ?? raw.serial_no),
    boxNo: toNumber(raw.boxNo ?? raw.box_no),
    shopId: toNumber(raw.shopId ?? raw.shop_id),
    shopName: toString(raw.shopName ?? raw.shop_name),
    birdTypeId: toNumber(raw.birdTypeId ?? raw.bird_type_id),
    birdType: toString(raw.birdType ?? raw.bird_type),
    birds: toNumber(raw.birds),
    weight: toNumber(raw.weight),
    mortality: toNumber(raw.mortality),
    rate: raw.rate === null || raw.rate === undefined ? null : toNumber(raw.rate),
    amount: toNumber(raw.amount),
    remarks: toString(raw.remarks),
  };
}

function extractFlattenedDiesel(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      key.startsWith("dieselLtr") ||
      key.startsWith("dieselRate") ||
      key.startsWith("dieselMeter") ||
      key.startsWith("dieselBunk") ||
      key.startsWith("dieselImage")
    ) {
      out[key] = value;
    }
  }
  return out;
}

function mapTrip(raw: Record<string, unknown>): Trip {
  const helpersRaw = raw.helpers;
  const loadersRaw = raw.loaders;
  const boxesRaw = raw.boxDetails ?? raw.box_details;
  const deliveriesRaw = raw.deliveries;

  const trip: Trip = {
    id: toNumber(raw.id),
    tripNo: toString(raw.tripNo ?? raw.trip_no),
    tripDate: toString(raw.tripDate ?? raw.trip_date).slice(0, 10),
    startTime: toString(raw.startTime ?? raw.start_time),
    vehicleId: toNumber(raw.vehicleId ?? raw.vehicle_id),
    vehicleNo: toString(raw.vehicleNo ?? raw.vehicle_no),
    driverId: toNumber(raw.driverId ?? raw.driver_id),
    driverName: toString(raw.driverName ?? raw.driver_name),
    supervisorId: toNumber(raw.supervisorId ?? raw.supervisor_id),
    supervisorName: toString(raw.supervisorName ?? raw.supervisor_name),
    helpers: Array.isArray(helpersRaw) ? helpersRaw.map((h) => String(h)) : [],
    loaders: Array.isArray(loadersRaw) ? loadersRaw.map((l) => String(l)) : [],
    openingMeter: toNumber(raw.openingMeter ?? raw.opening_meter),
    advanceAmount: toNumber(raw.advanceAmount ?? raw.advance_amount),
    startStepSubmitted: Boolean(raw.startStepSubmitted ?? raw.start_step_submitted),
    sourceFarmId: toNumber(raw.sourceFarmId ?? raw.source_farm_id),
    sourceFarm: toString(raw.sourceFarm ?? raw.source_farm),
    reachedTime: toString(raw.reachedTime ?? raw.reached_time),
    destMeter: toNumber(raw.destMeter ?? raw.dest_meter),
    pickupTolls: toNumber(raw.pickupTolls ?? raw.pickup_tolls),
    farmStepSubmitted: Boolean(raw.farmStepSubmitted ?? raw.farm_step_submitted),
    farmAddress: toString(raw.farmAddress ?? raw.farm_address),
    dcWeight: toNumber(raw.dcWeight ?? raw.dc_weight),
    totalBirds: toNumber(raw.totalBirds ?? raw.total_birds),
    boxes: toNumber(raw.boxes),
    avgWeight: toNumber(raw.avgWeight ?? raw.avg_weight),
    pickupLoadTime: toString(raw.pickupLoadTime ?? raw.pickup_load_time),
    pickupStepSubmitted: Boolean(raw.pickupStepSubmitted ?? raw.pickup_step_submitted),
    boxNo: toNumber(raw.boxNo ?? raw.box_no),
    birds: toNumber(raw.birds),
    weight: toNumber(raw.weight),
    boxDetails: Array.isArray(boxesRaw)
      ? boxesRaw.map((b) => mapBox(b as Record<string, unknown>))
      : [],
    deliveries: Array.isArray(deliveriesRaw)
      ? deliveriesRaw.map((d) => mapDelivery(d as Record<string, unknown>))
      : [],
    deliveryStepSubmitted: Boolean(
      raw.deliveryStepSubmitted ?? raw.delivery_step_submitted
    ),
    closingMeter: toNumber(
      raw.closingMeter ?? raw.closing_meter ?? raw.endMeter ?? raw.end_meter
    ),
    endTime: toString(raw.endTime ?? raw.end_time),
    deliveryTolls: toNumber(
      raw.deliveryTolls ?? raw.delivery_tolls ?? raw.destinationTolls ?? raw.destination_tolls
    ),
    endStepSubmitted: Boolean(raw.endStepSubmitted ?? raw.end_step_submitted),
    expensesStepSubmitted: Boolean(
      raw.expensesStepSubmitted ?? raw.expenses_step_submitted
    ),
    totalKm: toNumber(raw.totalKm ?? raw.total_km),
    totalShops: toNumber(raw.totalShops ?? raw.total_shops),
    totalWeight: toNumber(raw.totalWeight ?? raw.total_weight),
    totalDeliveredWeight: toNumber(
      raw.totalDeliveredWeight ?? raw.total_delivered_weight
    ),
    totalBirdsDelivered: toNumber(
      raw.totalBirdsDelivered ?? raw.total_birds_delivered
    ),
    totalMortality: toNumber(raw.totalMortality ?? raw.total_mortality),
    totalMortalityCount: toNumber(
      raw.totalMortalityCount ?? raw.total_mortality_count
    ),
    totalMortalityWeight: toNumber(
      raw.totalMortalityWeight ?? raw.total_mortality_weight
    ),
    weightLoss: toNumber(raw.weightLoss ?? raw.weight_loss),
    survivalRate: toNumber(raw.survivalRate ?? raw.survival_rate),
    lastShop: toString(raw.lastShop ?? raw.last_shop),
    fuel: toNumber(raw.fuel),
    expense: toNumber(raw.expense),
    remarks: toString(raw.remarks),
    status: normalizeStatus(raw.status),
    rateCompleted: Boolean(raw.rateCompleted ?? raw.rate_completed),
    createdAt: toString(raw.createdAt ?? raw.created_at) || undefined,
    updatedAt: toString(raw.updatedAt ?? raw.updated_at) || undefined,
    deleted: Boolean(raw.deleted),
    deletedReason: toString(raw.deletedReason ?? raw.deleted_reason) || undefined,
    dcPhotoKey: toString(raw.dcPhotoKey ?? raw.dc_photo_key) || undefined,
    approvedBy: toString(raw.approvedBy ?? raw.approved_by) || undefined,
  };

  // Preserve flattened diesel fields + expense sheet extras used by StepEnd
  const extras = extractFlattenedDiesel(raw);
  const expenseExtras: Record<string, unknown> = {};
  for (const key of [
    "meals",
    "loading",
    "mealsTiffin",
    "vehicleMaintenance",
    "othersRC",
    "others1Amt",
    "others2Amt",
    "others3Amt",
    "others4Amt",
    "others5Amt",
    "destinationTolls",
    "endMeter",
    "advance",
    "avgBirdWeight",
    "farmRemarks",
    "dcPhotoData",
    "dcPhotoMime",
    "submittedAt",
    "submittedAtTimestamp",
  ]) {
    if (raw[key] !== undefined) expenseExtras[key] = raw[key];
  }

  return { ...trip, ...extras, ...expenseExtras } as Trip;
}

function setCache(trips: Trip[]): Trip[] {
  tripsCache = trips;
  return tripsCache;
}

function upsertCache(trip: Trip): Trip {
  const idx = tripsCache.findIndex((t) => t.id === trip.id);
  if (idx >= 0) tripsCache[idx] = trip;
  else tripsCache = [trip, ...tripsCache];
  return trip;
}

function removeFromCache(id: number): void {
  tripsCache = tripsCache.filter((t) => t.id !== id);
}

/** Sync snapshot for consumers — last successful API load only. */
export function getAll(): Trip[] {
  return [...tripsCache].sort(
    (a, b) => new Date(b.tripDate).getTime() - new Date(a.tripDate).getTime()
  );
}

export function getRecent(limit = 5): Trip[] {
  return getAll().slice(0, limit);
}

export function getById(id: number): Trip | undefined {
  return tripsCache.find((t) => t.id === id);
}

export function exists(tripNo: string): boolean {
  return tripsCache.some((t) => t.tripNo === tripNo);
}

export function count(): number {
  return tripsCache.length;
}

export function refresh(): Trip[] {
  return getAll();
}

/** GET /api/trips */
export async function loadTrips(filters?: {
  fromDate?: string;
  toDate?: string;
  status?: string;
  vehicleId?: number;
  includeDeleted?: boolean;
}): Promise<Trip[]> {
  clearLegacyTripStorage();
  const { data } = await apiGet<Record<string, unknown>[]>(TRIPS_PATH, {
    params: filters,
  });
  const mapped = Array.isArray(data) ? data.map(mapTrip) : [];
  return setCache(mapped);
}

/** GET /api/trips/:id */
export async function loadTripById(id: number): Promise<Trip> {
  clearLegacyTripStorage();
  const { data } = await apiGet<Record<string, unknown>>(`${TRIPS_PATH}/${id}`);
  return upsertCache(mapTrip(data));
}

/** Latest Draft trip for resume, if any. */
export async function loadLatestDraft(): Promise<Trip | null> {
  const drafts = await loadTrips({ status: "Draft" });
  const active = drafts
    .filter((t) => !t.deleted)
    .sort((a, b) => {
      const au = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bu = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bu - au;
    });
  return active[0] ?? null;
}

/**
 * POST /api/trips — create Draft (or full save without id).
 * Returns the created trip with PostgreSQL id.
 */
export async function createTrip(
  body: Partial<Trip> & Record<string, unknown> = {}
): Promise<Trip> {
  clearLegacyTripStorage();
  const { data } = await apiPost<Record<string, unknown>>(TRIPS_PATH, {
    ...body,
    status: body.status ?? "Draft",
  });
  return upsertCache(mapTrip(data));
}

/** PUT /api/trips/:id — autosave / update same trip. */
export async function saveTrip(
  id: number,
  body: Partial<Trip> | (Partial<Trip> & Record<string, unknown>)
): Promise<Trip> {
  clearLegacyTripStorage();
  const { data } = await apiPut<Record<string, unknown>>(`${TRIPS_PATH}/${id}`, {
    ...(body as Record<string, unknown>),
    id,
  });
  return upsertCache(mapTrip(data));
}

/**
 * Create or update. If id is missing/0 → POST, else PUT.
 * Always returns the same trip identity after Step 1.
 */
export async function upsertTrip(
  body: Partial<Trip> | (Partial<Trip> & Record<string, unknown>)
): Promise<Trip> {
  const id = Number((body as Trip).id);
  if (!id) {
    return createTrip(body as Partial<Trip> & Record<string, unknown>);
  }
  return saveTrip(id, body);
}

/** POST /api/trips/:id/steps/:step */
export async function submitTripStep(
  id: number,
  step: TripStep,
  body: Partial<Trip> | (Partial<Trip> & Record<string, unknown>) = {}
): Promise<Trip> {
  clearLegacyTripStorage();
  const { data } = await apiPost<Record<string, unknown>>(
    `${TRIPS_PATH}/${id}/steps/${step}`,
    body as Record<string, unknown>
  );
  return upsertCache(mapTrip(data));
}

/** DELETE /api/trips/:id — soft delete. */
export async function softDeleteTrip(id: number, reason?: string): Promise<void> {
  clearLegacyTripStorage();
  await apiDelete(`${TRIPS_PATH}/${id}`, {
    // helpers accept options; body via axios data is not in ApiRequestOptions —
    // send reason as query if needed. Prefer PUT-style payload through post fallback.
  } as never);
  // Some backends expect reason in body; use dedicated post if delete has no body.
  void reason;
  removeFromCache(id);
  // Re-fetch to stay consistent when soft-deleted rows remain with status Deleted
  try {
    await loadTrips({ includeDeleted: true });
  } catch {
    /* cache already updated */
  }
}

/** Soft-delete with reason body (preferred). */
export async function softDeleteTripWithReason(
  id: number,
  reason?: string
): Promise<void> {
  clearLegacyTripStorage();
  // Express DELETE may accept JSON body; use apiPost to status endpoint if needed.
  // Contract: DELETE /api/trips/:id with optional { reason }
  try {
    await apiDelete(`${TRIPS_PATH}/${id}`);
  } catch {
    // Fallback: mark deleted via PUT
    await saveTrip(id, {
      deleted: true,
      deletedReason: reason || "No reason provided",
      status: "Deleted",
    });
    return;
  }
  // Also persist reason when API supports body-less delete
  if (reason) {
    try {
      await saveTrip(id, {
        deleted: true,
        deletedReason: reason,
        status: "Deleted",
      });
    } catch {
      /* ignore if already deleted */
    }
  }
  removeFromCache(id);
}

/** GET /api/trips/vehicle/:vehicleId/last-meter */
export async function getLastClosingMeter(vehicleId: number): Promise<{
  closingMeter: number;
  tripNo: string;
  tripDate: string;
} | null> {
  const { data } = await apiGet<{
    closingMeter?: number;
    tripNo?: string;
    tripDate?: string;
  } | null>(`${TRIPS_PATH}/vehicle/${vehicleId}/last-meter`);
  if (!data) return null;
  return {
    closingMeter: toNumber(data.closingMeter),
    tripNo: toString(data.tripNo),
    tripDate: toString(data.tripDate),
  };
}

/**
 * Compatibility object matching the previous localStorage tripService shape.
 * Mutations are async under the hood; sync methods read the API cache only.
 */
export const tripService = {
  getAll,
  getRecent,
  getById,
  exists,
  count,
  refresh,
  clear: clearLegacyTripStorage,

  /** @deprecated Prefer createTrip / upsertTrip (async). Sync no-op for cache. */
  create(trip: Trip): Trip {
    upsertCache(trip);
    return trip;
  },

  /** @deprecated Prefer saveTrip / upsertTrip (async). Sync cache write only. */
  update(updatedTrip: Trip): Trip {
    return upsertCache(updatedTrip);
  },

  /** @deprecated Prefer softDeleteTripWithReason (async). */
  remove(id: number): void {
    removeFromCache(id);
  },

  loadTrips,
  loadTripById,
  loadLatestDraft,
  createTrip,
  saveTrip,
  upsertTrip,
  submitTripStep,
  softDeleteTripWithReason,
  getLastClosingMeter,
};

export { handleApiError };
