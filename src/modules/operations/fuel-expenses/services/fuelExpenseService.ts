import { apiDelete, apiGet, apiPost, apiPut, throwApiError } from "../../../../api";
import type { FuelExpense, FuelExpenseDraft, FuelTripLoad, FuelUiStatus } from "../types/fuelExpense";
import { resolveFuelGps } from "../utils/fuelGps";
import { summarizeFuelBills } from "../utils/fuelSummary";

const PATH = "/operations/fuel-expenses";

export interface FuelListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FuelListSummary {
  /** Totals over every filtered row, never only the visible page. */
  totalLitres: number;
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  totalDistance: number | null;
  avgMileage: number | null;
  recentTripMileage: number | null;
}

export interface FuelListResult {
  data: FuelExpense[];
  meta: FuelListMeta;
  summary: FuelListSummary;
}

export interface FuelListFilters {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  vehicleNo?: string;
  sourceType?: string;
  status?: string;
  tripNo?: string;
  billNo?: string;
  search?: string;
  includeDeleted?: boolean;
}

interface ApiFuelListResult {
  data: ApiFuel[];
  meta: FuelListMeta;
  summary?: Partial<FuelListSummary>;
}

interface ApiFuel {
  id: string;
  billNo: string;
  billDate: string;
  sourceType?: string;
  vehicleId: number | null;
  vehicleNo: string | null;
  driverId: number | null;
  driverName: string | null;
  supervisorId: number | null;
  supervisorName: string | null;    tripId?: number | null;
    tripNo?: string | null;
    tripFuelEntryIndex?: number | null;
    tripLoadCount?: number | null;
    tripLoads?: FuelTripLoad[];
    currentMeter: number;
  fuelRate: number;
  liters: number;
  amount: number;
  pumpName: string;
  bunkAddress?: string | null;
  remarks?: string | null;
  gpsLat?: number | null;
  gpsLon?: number | null;
  gpsAccuracy?: number | null;
  gpsCapturedAt?: string | null;
  status: string;
  travelDistance?: number | null;
  deleted?: boolean;
  imageData?: string | null;
  imageName?: string | null;
  createdAt?: string | null;
  createdBy?: string;
  approvedAt?: string | null;
  approvedBy?: string;
  updatedAt?: string | null;
}

function mapStatus(status: string): FuelUiStatus {
  if (status === "Approved") return "Approved";
  if (status === "Rejected") return "Rejected";
  return "Pending";
}

function mapRow(row: ApiFuel): FuelExpense {
  const isTrip = row.sourceType === "TRIP" || !!row.tripNo || !!row.tripId;
  const gps = resolveFuelGps(row.gpsLat, row.gpsLon, row.bunkAddress);
  return {
    id: row.id,
    billNo: row.billNo,
    date: row.billDate,
    sourceType: isTrip ? "TRIP" : "MANUAL",
    vehicleId: row.vehicleId ?? 0,
    vehicleNo: row.vehicleNo ?? "",
    driverId: row.driverId ?? 0,
    driverName: row.driverName ?? "",
    supervisorId: row.supervisorId ?? 0,
    supervisorName: row.supervisorName ?? "",
    tripId: row.tripId ?? null,
    tripNo: row.tripNo ?? null,
    tripFuelEntryIndex: row.tripFuelEntryIndex ?? null,
    tripLoadCount: row.tripLoadCount ?? null,
    tripLoads: Array.isArray(row.tripLoads) ? row.tripLoads : [],
    meterReading: Number(row.currentMeter ?? 0),
    amount: Number(row.amount ?? 0),
    rate: Number(row.fuelRate ?? 0),
    litres: Number(row.liters ?? 0),
    petrolBunk: row.pumpName ?? "",
    gpsAddress: gps.placeName || "",
    remarks: row.remarks ?? undefined,
    gpsLat: gps.lat,
    gpsLon: gps.lon,
    gpsAccuracy: row.gpsAccuracy ?? null,
    gpsCapturedAt: row.gpsCapturedAt ?? null,
    // Trip diesel bills are automatically approved on trip completion; only manual bills can be pending
    status: row.deleted ? "Deleted" : isTrip ? "Approved" : mapStatus(row.status),
    deleted: Boolean(row.deleted),
    createdDate: row.createdAt ?? "",
    createdBy: row.createdBy ?? "",
    approvedDate: row.approvedAt ?? undefined,
    travelDistance: row.travelDistance ?? null,
    approvedBy: isTrip ? "Trip Completion" : (row.approvedBy ?? undefined),
    updatedDate: row.updatedAt ?? undefined,
    image: row.imageData ?? undefined,
    imageName: row.imageName ?? undefined,
    synced: true,
  };
}

function summarizeRows(rows: FuelExpense[]): FuelListSummary {
  // Canonical filtered-set totals: the saved trip distance (deduplicated per
  // trip) and mileage as Total Distance ÷ Total Fuel Litres. Zero litres
  // yields null mileage (renders "—"). Shared with the page footer/KPIs.
  const summary = summarizeFuelBills(rows);
  return { ...summary, recentTripMileage: null };
}

function mapSummary(
  summary: Partial<FuelListSummary> | null | undefined,
  visibleRows: FuelExpense[]
): FuelListSummary {
  const fallback = summarizeRows(visibleRows);
  if (!summary) return fallback;
  const finite = (value: unknown, otherwise: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : otherwise;
  };
  const nullableFinite = (value: unknown): number | null => {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  // Mileage is always re-derived from the authoritative totals when the
  // backend summary omits it, so a zero-litres set can never show a stale
  // or invalid figure.
  const totalDistance = summary.totalDistance != null ? nullableFinite(summary.totalDistance) : fallback.totalDistance;
  const totalLitres = finite(summary.totalLitres, fallback.totalLitres);
  const derivedMileage =
    totalDistance != null && totalLitres > 0 ? Number((totalDistance / totalLitres).toFixed(2)) : null;
  return {
    totalLitres,
    totalAmount: finite(summary.totalAmount, fallback.totalAmount),
    pendingCount: finite(summary.pendingCount, fallback.pendingCount),
    approvedCount: finite(summary.approvedCount, fallback.approvedCount),
    totalDistance,
    avgMileage: summary.avgMileage != null ? nullableFinite(summary.avgMileage) : derivedMileage,
    recentTripMileage: nullableFinite(summary.recentTripMileage),
  };
}

function toBody(draft: FuelExpenseDraft | Partial<FuelExpense>) {
  return {
    billDate: draft.date,
    vehicleId: draft.vehicleId,
    vehicleNo: draft.vehicleNo,
    driverId: draft.driverId,
    driverName: draft.driverName,
    supervisorId: draft.supervisorId,
    supervisorName: draft.supervisorName,
    currentMeter: draft.meterReading,
    fuelRate: draft.rate,
    liters: draft.litres,
    pumpName: draft.petrolBunk,
    bunkAddress: draft.gpsAddress ?? null,
    imageData: draft.image ?? null,
    imageName: draft.imageName ?? null,
    gpsLat: draft.gpsLat ?? null,
    gpsLon: draft.gpsLon ?? null,
    gpsAccuracy: draft.gpsAccuracy ?? null,
    gpsCapturedAt: draft.gpsCapturedAt ?? null,
  };
}

let listCache: FuelExpense[] = [];

async function list(filters: FuelListFilters = {}): Promise<FuelListResult> {
  try {
    const { data } = await apiGet<ApiFuelListResult | ApiFuel[]>(PATH, {
      params: {
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        vehicleNo: filters.vehicleNo || undefined,
        sourceType: filters.sourceType || undefined,
        status: filters.status || undefined,
        tripNo: filters.tripNo || undefined,
        billNo: filters.billNo || undefined,
        search: filters.search || undefined,
        includeDeleted: filters.includeDeleted ? "true" : undefined,
      },
    });
    if (Array.isArray(data)) {
      const mapped = data.map(mapRow);
      listCache = mapped;
      return {
        data: mapped,
        meta: { total: mapped.length, page: 1, limit: mapped.length || 10, totalPages: 1 },
        summary: summarizeRows(mapped),
      };
    }
    const mapped = (data.data ?? []).map((row) => mapRow(row as unknown as ApiFuel));
    listCache = mapped;
    return {
      data: mapped,
      meta: data.meta,
      // Newer/sample APIs aggregate over the whole filtered register. Older
      // backends remain compatible: their visible page is used as a fallback.
      summary: mapSummary(data.summary, mapped),
    };
  } catch (err) {
    throwApiError(err);
  }
}

async function getById(id: string): Promise<FuelExpense> {
  try {
    const { data } = await apiGet<ApiFuel>(`${PATH}/${id}`);
    return mapRow(data);
  } catch (err) {
    throwApiError(err);
  }
}

async function save(expense: FuelExpenseDraft): Promise<FuelExpense> {
  try {
    const { data } = await apiPost<ApiFuel>(PATH, toBody(expense));
    return mapRow(data);
  } catch (err) {
    throwApiError(err);
  }
}

async function update(id: string, updates: Partial<FuelExpense>): Promise<FuelExpense> {
  try {
    const { data } = await apiPut<ApiFuel>(`${PATH}/${id}`, toBody(updates));
    return mapRow(data);
  } catch (err) {
    throwApiError(err);
  }
}

async function remove(id: string): Promise<void> {
  try {
    await apiDelete(`${PATH}/${id}`);
  } catch (err) {
    throwApiError(err);
  }
}

async function approve(id: string, approvedBy = "Admin"): Promise<FuelExpense> {
  try {
    const { data } = await apiPost<ApiFuel>(`${PATH}/${id}/approve`, { approvedBy });
    return mapRow(data);
  } catch (err) {
    throwApiError(err);
  }
}

async function reject(id: string, reason: string, rejectedBy = "Admin"): Promise<FuelExpense> {
  try {
    const { data } = await apiPost<ApiFuel>(`${PATH}/${id}/reject`, { reason, rejectedBy });
    return mapRow(data);
  } catch (err) {
    throwApiError(err);
  }
}

function getAll(): FuelExpense[] {
  return listCache;
}

export const fuelExpenseService = {
  list,
  getAll,
  getById,
  save,
  update,
  remove,
  approve,
  reject,
};