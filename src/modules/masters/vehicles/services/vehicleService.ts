/**
 * Vehicles master — PostgreSQL ONLY via shared Axios helpers.
 * Static/mock arrays and localStorage are not used as a data source.
 */

import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  handleApiError,
} from "../../../../api";
import type { Vehicle } from "../types/vehicle";

const VEHICLES_PATH = "/masters/vehicles";
export const VEHICLES_CHANGED_EVENT = "dmr:vehicles-changed";
let vehiclesRevision = 0;
export const getVehiclesRevision = () => vehiclesRevision;

function notifyVehiclesChanged(): void {
  ++vehiclesRevision;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VEHICLES_CHANGED_EVENT));
}

/** Legacy browser keys that previously held mock vehicle lists. */
const LEGACY_STORAGE_KEYS = [
  "dmr-vehicles",
  "dmr_poultries_vehicles_master_data",
] as const;

/** Cache filled exclusively by GET /api/masters/vehicles. */
let vehiclesCache: Vehicle[] = [];

export type VehicleInput = Omit<Vehicle, "id" | "vehicleNo"> & {
  vehicleNo?: number;
  emiDay?: number;
  totalEMIs?: number;
};

function clearLegacyVehicleStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore storage access errors */
  }
}

function normalizeStatus(status: unknown): Vehicle["status"] {
  if (status === "Active" || status === "Inactive") return status;
  throw new Error("Invalid Vehicle Master status in API response.");
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "number" && typeof value !== "string") throw new Error("Invalid numeric Vehicle Master field.");
  if (typeof value === "string" && value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Invalid numeric Vehicle Master field.");
  return n;
}

/**
 * API DATE columns usually arrive as plain "YYYY-MM-DD", but some drivers and
 * the legacy mock respond with a full timestamp ("2024-05-15T00:00:00.000Z").
 * The shared DatePicker only accepts YYYY-MM-DD and renders a blank field for
 * anything else, so RC Date / Purchase Date silently came back empty in the
 * vehicle form. Keep the calendar part and drop any time suffix.
 */
function toDateOnly(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  const dateOnly = s.split("T")[0].split(" ")[0].trim();
  return dateOnly || undefined;
}

export function mapVehicle(raw: Record<string, unknown>): Vehicle {
  const registration = raw.vehicleNumber ?? raw.vehicle_number;
  if (registration != null && typeof registration !== "string") throw new Error("Vehicle registration response must be text.");
  const id = Number(raw.id);
  const vehicleNo = Number(raw.vehicleNo ?? raw.vehicle_no);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(vehicleNo) || vehicleNo <= 0) {
    throw new Error("Invalid Vehicle Master identity in API response.");
  }
  const mapped: Vehicle & { emiDay?: number; totalEMIs?: number } = {
    id,
    vehicleNo,
    vehicleNumber: String(raw.vehicleNumber ?? raw.vehicle_number ?? ""),
    vehicleType: String(raw.vehicleType ?? raw.vehicle_type ?? ""),
    noOfBoxes: Number(raw.noOfBoxes ?? raw.no_of_boxes ?? 0),
    birdCapacity: Number(raw.birdCapacity ?? raw.bird_capacity ?? 0),
    capacityKg: Number(raw.capacityKg ?? raw.capacity_kg ?? 0),
    trackingId: String(raw.trackingId ?? raw.tracking_id ?? ""),
    fastagBank: String(raw.fastagBank ?? raw.fastag_bank ?? ""),
    engineNumber: String(raw.engineNumber ?? raw.engine_number ?? ""),
    chassisNumber: String(raw.chassisNumber ?? raw.chassis_number ?? ""),
    insuranceExpiry: toDateOnly(raw.insuranceExpiry ?? raw.insurance_expiry) ?? "",
    permitExpiry: toDateOnly(raw.permitExpiry ?? raw.permit_expiry) ?? "",
    fitnessExpiry: toDateOnly(raw.fitnessExpiry ?? raw.fitness_expiry) ?? "",
    purchaseDate: toDateOnly(raw.purchaseDate ?? raw.purchase_date),
    purchaseAmount: toOptionalNumber(raw.purchaseAmount ?? raw.purchase_amount),
    emiStartDate: toDateOnly(raw.emiStartDate ?? raw.emi_start_date),
    rcDate: toDateOnly(raw.rcDate ?? raw.rc_date),
    status: normalizeStatus(raw.status),
  };

  const emiDay = toOptionalNumber(raw.emiDay ?? raw.emi_day);
  const totalEMIs = toOptionalNumber(raw.totalEMIs ?? raw.total_emis);
  if (emiDay !== undefined) mapped.emiDay = emiDay;
  if (totalEMIs !== undefined) mapped.totalEMIs = totalEMIs;

  return mapped;
}

function toPayload(input: VehicleInput | Partial<Vehicle> & { emiDay?: number; totalEMIs?: number }): Record<string, unknown> {
  return {
    vehicleNo: input.vehicleNo,
    vehicleNumber: input.vehicleNumber?.trim(),
    vehicleType: input.vehicleType?.trim() ?? "",
    noOfBoxes: Number(input.noOfBoxes ?? 0),
    birdCapacity: Number(input.birdCapacity ?? 0),
    capacityKg: Number(input.capacityKg ?? 0),
    trackingId: input.trackingId?.trim() ?? "",
    fastagBank: input.fastagBank?.trim() ?? "",
    engineNumber: input.engineNumber?.trim() ?? "",
    chassisNumber: input.chassisNumber?.trim() ?? "",
    insuranceExpiry: input.insuranceExpiry ?? "",
    permitExpiry: input.permitExpiry ?? "",
    fitnessExpiry: input.fitnessExpiry ?? "",
    purchaseDate: input.purchaseDate ?? "",
    purchaseAmount: input.purchaseAmount,
    emiStartDate: input.emiStartDate ?? "",
    emiDay: (input as { emiDay?: number }).emiDay,
    totalEMIs: (input as { totalEMIs?: number }).totalEMIs,
    rcDate: input.rcDate ?? "",
    status: input.status ?? "Active",
  };
}

function setCacheFromApi(rows: Record<string, unknown>[] | null | undefined): Vehicle[] {
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Vehicle list response must be an array of records.");
  }
  vehiclesCache = rows.map(mapVehicle);
  return vehiclesCache;
}

/** Sync snapshot for other modules — reflects last successful API load only. */
export function getVehicles(): Vehicle[] {
  return vehiclesCache;
}

/**
 * @deprecated Do not use for Vehicles UI. Mutations must go through API helpers.
 */
export function saveVehicles(_vehicles: Vehicle[]): void {
  // Intentionally no-op. Cache is API-owned.
  void _vehicles;
}

/** GET /api/masters/vehicles — sole source of truth for the Vehicles table. */
export async function loadVehicles(): Promise<Vehicle[]> {
  clearLegacyVehicleStorage();
  const { data } = await apiGet<Record<string, unknown>[]>(VEHICLES_PATH);
  return setCacheFromApi(data);
}

/** POST /api/masters/vehicles */
export async function createVehicle(input: VehicleInput): Promise<Vehicle> {
  clearLegacyVehicleStorage();
  const { data } = await apiPost<Record<string, unknown>>(
    VEHICLES_PATH,
    toPayload(input)
  );
  notifyVehiclesChanged();
  return mapVehicle(data);
}

/** POST /api/masters/vehicles/bulk — Upload multiple vehicles from Excel */
export async function bulkCreateVehicles(inputs: VehicleInput[]): Promise<Vehicle[]> {
  clearLegacyVehicleStorage();
  const payload = inputs.map(toPayload);
  const { data } = await apiPost<{ created: Record<string, unknown>[] }>(
    `${VEHICLES_PATH}/bulk`,
    payload
  );
  notifyVehiclesChanged();
  return data.created.map(mapVehicle);
}

/** PUT /api/masters/vehicles/:id */
export async function updateVehicle(
  id: number,
  input: VehicleInput | Partial<Vehicle>
): Promise<Vehicle> {
  clearLegacyVehicleStorage();
  const { data } = await apiPut<Record<string, unknown>>(
    `${VEHICLES_PATH}/${id}`,
    toPayload({ ...(input as VehicleInput), vehicleNo: input.vehicleNo })
  );
  notifyVehiclesChanged();
  return mapVehicle(data);
}

/** DELETE /api/masters/vehicles/:id */
export async function deleteVehicle(id: number): Promise<void> {
  clearLegacyVehicleStorage();
  await apiDelete(`${VEHICLES_PATH}/${id}`);
  notifyVehiclesChanged();
}

/** Always re-fetch from PostgreSQL. */
export async function refreshVehicles(): Promise<Vehicle[]> {
  return loadVehicles();
}

export { handleApiError };
