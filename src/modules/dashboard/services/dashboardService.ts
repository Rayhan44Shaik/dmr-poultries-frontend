// src/modules/dashboard/services/dashboardService.ts
// -----------------------------------------------------------------------------
// Data aggregation for the executive dashboard. Reads exclusively from the
// existing services: localStorage-backed operations services + the PostgreSQL
// masters API (with legacy-key fallback when the local backend is offline).
// -----------------------------------------------------------------------------

import { apiClient, apiTryGet } from "../../../api";
import { getQuarterSampleInfo, type SampleQuarter } from "../../../sample/quarterSample";
import { tripService } from "../../operations/vehicle-trips/services/tripService";
import { collectionService } from "../../operations/collections/services/collectionService";
import { fuelExpenseService } from "../../operations/fuel-expenses/services/fuelExpenseService";
import type { Trip } from "../../operations/vehicle-trips/types/trip";
import type { Collection, PendingCollection } from "../../operations/collections/types/collection";
import type { ShopSale } from "../../operations/shop-sales/types/shopSale";
import type { FuelExpense } from "../../operations/fuel-expenses/types/fuelExpense";
import { isDemoDataActive } from "./demoData";

export interface ShopRow {
  id: number;
  name: string;
  owner: string;
  village: string;
  status: string;
}

export interface FarmRow {
  id: number;
  name: string;
  village: string;
  status: string;
}

export interface VehicleRow {
  id: number;
  number: string;
  type: string;
  status: string;
  insuranceExpiry: string;
  permitExpiry: string;
  fitnessExpiry: string;
}

export interface EmployeeRow {
  id: number;
  name: string;
  department: string;
  role: string;
  status: string;
}

export interface DashboardData {
  shops: ShopRow[];
  farms: FarmRow[];
  vehicles: VehicleRow[];
  employees: EmployeeRow[];
  trips: Trip[];
  collections: Collection[];
  pendingCollections: PendingCollection[];
  shopSales: ShopSale[];
  fuelExpenses: FuelExpense[];
  mastersFromApi: boolean;
  demoActive: boolean;
  /** Set only when the quarter sample API is the source of these rows. */
  sampleQuarter: SampleQuarter | null;
}

/* ------------------------------------------------------------------ */
/*  Quarter sample API — trips + fuel for the Executive dashboard       */
/* ------------------------------------------------------------------ */
/** Trips/fuel are read this many days back; enough for every 7-day series. */
const SAMPLE_WINDOW_DAYS = 120;
const SAMPLE_ROW_LIMIT = 500;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sampleWindow(): { fromDate: string; toDate: string; page: 1; limit: number } {
  return {
    fromDate: isoDaysAgo(SAMPLE_WINDOW_DAYS),
    toDate: isoDaysAgo(0),
    page: 1,
    limit: SAMPLE_ROW_LIMIT,
  };
}

/** GET /api/operations/trip-list — real vehicle trips for the last 30 days. */
async function fetchSampleTrips(): Promise<Trip[]> {
  try {
    const { data } = await apiClient.get<{ data?: Trip[] } | Trip[]>("/operations/trip-list", {
      params: sampleWindow(),
      timeout: 10_000,
    });
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Map the backend fuel contract onto the UI's FuelExpense shape. */
function toFuelExpense(row: Record<string, unknown>): FuelExpense {
  const status = String(row.status ?? "Approved");
  return {
    id: String(row.id ?? ""),
    billNo: String(row.billNo ?? ""),
    date: String(row.billDate ?? ""),
    sourceType: row.sourceType === "MANUAL" ? "MANUAL" : "TRIP",
    vehicleId: Number(row.vehicleId ?? 0),
    vehicleNo: String(row.vehicleNo ?? ""),
    driverId: Number(row.driverId ?? 0),
    driverName: String(row.driverName ?? ""),
    supervisorId: Number(row.supervisorId ?? 0),
    supervisorName: String(row.supervisorName ?? ""),
    tripId: row.tripId == null ? null : Number(row.tripId),
    tripNo: row.tripNo == null ? null : String(row.tripNo),
    meterReading: Number(row.currentMeter ?? 0),
    amount: Number(row.amount ?? 0),
    rate: Number(row.fuelRate ?? 0),
    litres: Number(row.liters ?? 0),
    petrolBunk: String(row.pumpName ?? ""),
    remarks: row.remarks == null ? undefined : String(row.remarks),
    status: status === "Pending" ? "Pending" : status === "Rejected" ? "Rejected" : "Approved",
    createdDate: String(row.createdAt ?? row.billDate ?? ""),
    createdBy: String(row.createdBy ?? ""),
    approvedDate: row.approvedAt ? String(row.approvedAt) : undefined,
    approvedBy: row.approvedBy ? String(row.approvedBy) : undefined,
  };
}

/** GET /api/operations/fuel-expenses — the same window as the trips read. */
async function fetchSampleFuel(): Promise<FuelExpense[]> {
  try {
    const { data } = await apiClient.get<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>(
      "/operations/fuel-expenses",
      { params: sampleWindow(), timeout: 10_000 }
    );
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return (Array.isArray(rows) ? rows : []).map(toFuelExpense);
  } catch {
    return [];
  }
}

async function fetchSampleCollections(): Promise<Collection[]> {
  try {
    const { data } = await apiClient.get<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>("/operations/collections/entry", {
      params: sampleWindow(),
      timeout: 10_000,
    });
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return (Array.isArray(rows) ? rows : []).map(row => ({
      id: String(row.id ?? ""),
      collectionNo: String(row.collectionNo ?? ""),
      collectionDate: String(row.collectionDate ?? ""),
      shopName: String(row.shopName ?? ""),
      collectorName: String(row.collector ?? ""),
      paymentModeName: String(row.paymentMode ?? ""),
      referenceNo: String(row.referenceNo ?? ""),
      amount: Number(row.amount ?? row.amountCollected ?? 0),
      remarks: String(row.remarks ?? ""),
      status: (String(row.status) === "Approved" ? "Approved" : "Pending") as any,
      createdDate: String(row.createdAt ?? row.collectionDate ?? ""),
      createdBy: String(row.createdBy ?? "Admin"),
      numericId: Number(row.id),
      numericShopId: Number(row.shopId),
    }));
  } catch {
    return [];
  }
}

async function fetchSamplePendingCollections(): Promise<PendingCollection[]> {
  try {
    const { data } = await apiClient.get<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>("/operations/collections/pending", {
      params: sampleWindow(),
      timeout: 10_000,
    });
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return (Array.isArray(rows) ? rows : []).map(row => ({
      shopId: Number(row.shopId ?? 0),
      shopName: String(row.shopName ?? ""),
      totalSales: Number(row.totalSales ?? 0),
      totalCollections: Number(row.totalCollections ?? 0),
      currentPending: Number(row.currentPending ?? 0),
      overdueDays: Number(row.overdueDays ?? 0),
      lastCollectionDate: String(row.lastCollectionDate ?? ""),
    }));
  } catch {
    return [];
  }
}

async function fetchSampleShopSales(): Promise<ShopSale[]> {
  try {
    const { data } = await apiClient.get<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>("/operations/shop-sales", {
      params: sampleWindow(),
      timeout: 10_000,
    });
    const rows = Array.isArray(data) ? data : (data?.data ?? []);
    return (Array.isArray(rows) ? rows : []).map(row => ({
      id: String(row.id ?? ""),
      tripId: String(row.tripId ?? ""),
      tripNo: String(row.tripNo ?? ""),
      tripDate: String(row.saleDate ?? row.tripDate ?? ""),
      shopId: String(row.shopId ?? ""),
      shopName: String(row.shopName ?? ""),
      birdType: String(row.birdType ?? ""),
      totalBirds: Number(row.birds ?? 0),
      totalWeight: Number(row.weight ?? 0),
      rate: row.rate == null ? null : Number(row.rate),
      amount: Number(row.amount ?? 0),
      remark: String(row.remarks ?? row.remark ?? ""),
      status: "Completed",
      numericId: Number(row.id),
      numericTripId: Number(row.tripId),
      numericShopId: Number(row.shopId),
    }));
  } catch {
    return [];
  }
}

/** Backend rows win; anything only held locally is kept. */
function mergeById<T extends { id?: unknown; shopId?: unknown; numericId?: unknown }>(primary: T[], secondary: T[]): T[] {
  const getId = (row: T) => String(row.id ?? row.shopId ?? row.numericId ?? "");
  const seen = new Set(primary.map(getId));
  return [...primary, ...secondary.filter((row) => !seen.has(getId(row)))];
}

/* ------------------------------------------------------------------ */
/*  Safe localStorage reads                                            */
/* ------------------------------------------------------------------ */
function readKey<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function normStatus(value: unknown): string {
  return value === "Active" ? "Active" : value === "Inactive" ? "Inactive" : String(value ?? "Active");
}

/* ------------------------------------------------------------------ */
/*  Masters — API first, legacy keys as offline fallback               */
/* ------------------------------------------------------------------ */
function toShops(rows: unknown[]): ShopRow[] {
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row.id ?? row.shopNo ?? 0),
        name: String(row.shopName ?? row.name ?? ""),
        owner: String(row.ownerName ?? ""),
        village: String(row.village ?? ""),
        status: normStatus(row.status),
      };
    })
    .filter((s) => s.name);
}

function toFarms(rows: unknown[]): FarmRow[] {
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row.id ?? row.farmNo ?? 0),
        name: String(row.farmName ?? row.name ?? ""),
        village: String(row.village ?? ""),
        status: normStatus(row.status),
      };
    })
    .filter((f) => f.name);
}

function toVehicles(rows: unknown[]): VehicleRow[] {
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row.id ?? row.vehicleNo ?? 0),
        number: String(row.vehicleNumber ?? row.number ?? ""),
        type: String(row.vehicleType ?? "Vehicle"),
        status: normStatus(row.status),
        insuranceExpiry: String(row.insuranceExpiry ?? ""),
        permitExpiry: String(row.permitExpiry ?? ""),
        fitnessExpiry: String(row.fitnessExpiry ?? ""),
      };
    })
    .filter((v) => v.number);
}

function toEmployees(rows: unknown[]): EmployeeRow[] {
  return rows
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: Number(row.id ?? row.employeeNo ?? 0),
        name: String(row.employeeName ?? row.name ?? ""),
        department: String(row.department ?? ""),
        role: String(row.role ?? ""),
        status: normStatus(row.status),
      };
    })
    .filter((e) => e.name);
}

const LEGACY_KEYS = {
  shops: ["dmr-shops", "masters_shops", "dmr_poultries_shops_master_data"],
  farms: ["dmr-farms", "masters_farms"],
  vehicles: ["dmr-vehicles", "masters_vehicles"],
  employees: ["dmr-employees", "masters_employees"],
} as const;

async function loadMasters(): Promise<Pick<DashboardData, "shops" | "farms" | "vehicles" | "employees" | "mastersFromApi">> {
  // Short timeout so the dashboard stays snappy when the local backend is off.
  const opts = { timeout: 2500 };

  const [apiShops, apiFarms, apiVehicles, apiEmployees] = await Promise.all([
    apiTryGet<unknown[]>("/masters/shops", opts),
    apiTryGet<unknown[]>("/masters/farms", opts),
    apiTryGet<unknown[]>("/masters/vehicles", opts),
    apiTryGet<unknown[]>("/masters/employees", opts),
  ]);

  const fromApi = Boolean(apiShops || apiFarms || apiVehicles || apiEmployees);

  const fallback = (keys: readonly string[]): unknown[] => {
    for (const key of keys) {
      const rows = readKey<unknown>(key);
      if (rows.length > 0) return rows;
    }
    return [];
  };

  return {
    shops: apiShops?.length ? toShops(apiShops) : toShops(fallback(LEGACY_KEYS.shops)),
    farms: apiFarms?.length ? toFarms(apiFarms) : toFarms(fallback(LEGACY_KEYS.farms)),
    vehicles: apiVehicles?.length ? toVehicles(apiVehicles) : toVehicles(fallback(LEGACY_KEYS.vehicles)),
    employees: apiEmployees?.length ? toEmployees(apiEmployees) : toEmployees(fallback(LEGACY_KEYS.employees)),
    mastersFromApi: fromApi,
  };
}

/* ------------------------------------------------------------------ */
/*  Main loader                                                        */
/* ------------------------------------------------------------------ */
export async function loadDashboardData(): Promise<DashboardData> {
  const masters = await loadMasters();

  let trips: Trip[] = [];
  let collections: Collection[] = [];
  let pendingCollections: PendingCollection[] = [];
  let shopSales: ShopSale[] = [];
  let fuelExpenses: FuelExpense[] = [];
  try {
    trips = tripService.getAll();
    collections = collectionService.getCollections();
    pendingCollections = collectionService.getPendingCollections();
    shopSales = collectionService.getShopSales();
    fuelExpenses = fuelExpenseService.getAll();
  } catch (error) {
    console.warn("Dashboard: unable to read operations data", error);
  }

  // Trips and fuel live in localStorage services (the Trip Entry flow writes
  // there), so with the quarter sample API running they would stay empty while
  // every API-backed module is populated. When the sample server identifies
  // itself, read the same window it generated and merge it in. Production is
  // untouched: the probe resolves to null outside dev/preview.
  const sampleQuarter = (await getQuarterSampleInfo())?.quarter ?? null;
  if (sampleQuarter) {
    const [apiTrips, apiFuel, apiCollections, apiPendingCollections, apiShopSales] = await Promise.all([
      fetchSampleTrips(),
      fetchSampleFuel(),
      fetchSampleCollections(),
      fetchSamplePendingCollections(),
      fetchSampleShopSales()
    ]);
    trips = mergeById(apiTrips, trips);
    fuelExpenses = mergeById(apiFuel, fuelExpenses);
    collections = mergeById(apiCollections, collections);
    pendingCollections = mergeById(apiPendingCollections, pendingCollections);
    shopSales = mergeById(apiShopSales, shopSales);
  }

  return {
    ...masters,
    trips,
    collections,
    pendingCollections,
    shopSales,
    fuelExpenses,
    demoActive: isDemoDataActive(),
    sampleQuarter,
  };
}

/** Re-exported so the dashboard page can refresh after seeding. */
export { seedDemoData, clearDemoData, isDemoDataActive } from "./demoData";
