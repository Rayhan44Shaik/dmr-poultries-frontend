// src/modules/dashboard/services/dashboardService.ts
// -----------------------------------------------------------------------------
// Data aggregation for the executive dashboard.
//
// Sources, in order of precedence:
//   1. the quarter sample API (`scripts/quarter-sample-data.mjs`, booted by
//      `npm run dev`) whenever it identifies itself via GET /api/quarter-summary
//      — masters, trips, fuel, shop sales, collections, pending collections and
//      fleet maintenance, all read from the SAME dataset every other module and
//      page renders, so the dashboard can never disagree with them;
//   2. the existing localStorage-backed operations services (Trip Entry, Fuel)
//      and the collection service cache, merged underneath so anything recorded
//      locally in this browser is still counted;
//   3. legacy localStorage master keys, as the offline fallback.
//
// Against a real PostgreSQL backend — and in any production build — the sample
// probe resolves to null, none of the sample reads run, and the behaviour is
// exactly what it was before.
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

/** Fleet maintenance job — only the fields the dashboard renders. */
export interface MaintenanceRow {
  id: string;
  vehicleId: string;
  vehicleNo: string;
  /** ISO date or date-time of the job, as the fleet API reports it. */
  date: string;
  nextServiceKM: number;
  totalCost: number;
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
  /** Fleet maintenance jobs behind the fleet card notes + activity timeline. */
  maintenance: MaintenanceRow[];
  mastersFromApi: boolean;
  demoActive: boolean;
  /** Set only when the quarter sample API is the source of these rows. */
  sampleQuarter: SampleQuarter | null;
}

/* ------------------------------------------------------------------ */
/*  Quarter sample API — every business row the dashboard renders       */
/* ------------------------------------------------------------------ */
/** Trips/fuel are read this many days back — the fleet card needs each
 *  vehicle's *latest* trip and last fuel bill, not just this week's. */
const SAMPLE_WINDOW_DAYS = 30;
/** Shop sales/collections only feed the today / yesterday KPIs and the 7-day
 *  series, so a tight window keeps the payload small while still returning
 *  every row the dashboard can display. */
const SAMPLE_SERIES_WINDOW_DAYS = 10;
const SAMPLE_ROW_LIMIT = 500;
/** Hard stop so a mis-reported `totalPages` can never loop forever. */
const SAMPLE_MAX_PAGES = 40;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Inclusive `fromDate`/`toDate` window ending today, `days` back. */
function sampleRange(days: number): { fromDate: string; toDate: string } {
  return { fromDate: isoDaysAgo(days), toDate: isoDaysAgo(0) };
}

/* ---- row-level helpers (the two servers spell some fields differently) ---- */
const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const str = (value: unknown, fallback = ""): string =>
  value == null ? fallback : String(value);
/** Value of the first key present (and non-empty) in `row`. */
function firstOf(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value !== "") return value;
  }
  return undefined;
}

/**
 * GET one sample-server list endpoint.
 *
 * These endpoints answer with a bare array when no paging params are sent and
 * with a `{ data, meta }` envelope when they are. Paging is followed to the
 * end so a windowed read is never silently truncated to page 1 — a naive
 * "first 500 rows" read drops the *newest* rows on endpoints that answer in
 * chronological order, which is exactly what the dashboard must not lose.
 */
async function fetchSampleRows(
  path: string,
  params: Record<string, string | number>
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= SAMPLE_MAX_PAGES; page += 1) {
    const { data } = await apiClient.get<unknown>(path, {
      params: { ...params, page, limit: SAMPLE_ROW_LIMIT },
      timeout: 10_000,
    });
    if (Array.isArray(data)) {
      rows.push(...(data as Record<string, unknown>[]));
      break;
    }
    const envelope = data as { data?: unknown[]; meta?: { totalPages?: number } } | null;
    const chunk = Array.isArray(envelope?.data)
      ? (envelope!.data as Record<string, unknown>[])
      : [];
    rows.push(...chunk);
    if (chunk.length === 0 || page >= num(envelope?.meta?.totalPages, 1)) break;
  }
  return rows;
}

/** GET /api/operations/trip-list — real vehicle trips for the last 30 days. */
async function fetchSampleTrips(): Promise<Trip[]> {
  try {
    const rows = await fetchSampleRows("/operations/trip-list", {
      ...sampleRange(SAMPLE_WINDOW_DAYS),
      // `latestTrips` renders the head of this array, so ask the endpoint for
      // newest-first (sortBy/sortDir are part of the documented trip-list
      // contract) instead of relying on the server's insertion order.
      sortBy: "tripDate",
      sortDir: "desc",
    });
    return rows as unknown as Trip[];
  } catch {
    return [];
  }
}

/** Map the backend fuel contract onto the UI's FuelExpense shape. */
function toFuelExpense(row: Record<string, unknown>): FuelExpense {
  const status = str(row.status, "Approved");
  return {
    id: str(row.id),
    billNo: str(row.billNo ?? row.bill_no),
    date: str(row.billDate ?? row.bill_date),
    sourceType: row.sourceType === "MANUAL" ? "MANUAL" : "TRIP",
    vehicleId: num(row.vehicleId ?? row.vehicle_id),
    vehicleNo: str(row.vehicleNo ?? row.vehicle_no),
    driverId: num(row.driverId ?? row.driver_id),
    driverName: str(row.driverName ?? row.driver_name),
    supervisorId: num(row.supervisorId ?? row.supervisor_id),
    supervisorName: str(row.supervisorName ?? row.supervisor_name),
    tripId: row.tripId == null ? null : num(row.tripId),
    tripNo: row.tripNo == null ? null : str(row.tripNo),
    meterReading: num(row.currentMeter ?? row.meterReading),
    amount: num(row.amount),
    rate: num(row.fuelRate ?? row.rate),
    litres: num(row.liters ?? row.litres),
    petrolBunk: str(row.pumpName ?? row.petrolBunk),
    remarks: row.remarks == null ? undefined : str(row.remarks),
    status: status === "Pending" ? "Pending" : status === "Rejected" ? "Rejected" : "Approved",
    createdDate: str(row.createdAt ?? row.billDate),
    createdBy: str(row.createdBy),
    approvedDate: row.approvedAt ? str(row.approvedAt) : undefined,
    approvedBy: row.approvedBy ? str(row.approvedBy) : undefined,
  };
}

/** GET /api/operations/fuel-expenses — the same window as the trips read. */
async function fetchSampleFuel(): Promise<FuelExpense[]> {
  try {
    const rows = await fetchSampleRows("/operations/fuel-expenses", sampleRange(SAMPLE_WINDOW_DAYS));
    return rows.map(toFuelExpense);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Shop sales · collections · pending collections                      */
/* ------------------------------------------------------------------ */
/** Shop Sales statuses that are NOT yet a booked sale. */
const PENDING_SALE_STATUSES = new Set(["pending", "draft", "pending approval"]);

/**
 * Map a Shop Sale row onto the UI's ShopSale shape.
 *
 * Tolerates both spellings in the wild — the PostgreSQL contract sends
 * `saleDate`/`birds`/`weight`/`remarks`, the quarter sample server sends
 * `tripDate`/`totalBirds`/`totalWeight`/`remark`. Reading only one of the two
 * pairs is what made the Delivery Volume chart and the today's birds/weight
 * totals read as zero while every other module showed the same rows.
 */
function toShopSale(row: Record<string, unknown>): ShopSale {
  const tripId = firstOf(row, ["tripId", "trip_id"]);
  const shopId = firstOf(row, ["shopId", "shop_id"]);
  return {
    id: str(row.id),
    saleNo: str(firstOf(row, ["saleNo", "sale_no"])),
    tripId: tripId == null ? "" : str(tripId),
    tripNo: str(firstOf(row, ["tripNo", "trip_no"])),
    tripDate: str(firstOf(row, ["tripDate", "saleDate", "trip_date", "sale_date"])),
    shopNo: str(firstOf(row, ["shopNo", "shop_no"])),
    shopId: shopId == null ? "" : str(shopId),
    shopName: str(firstOf(row, ["shopName", "shop_name"])),
    birdType: str(firstOf(row, ["birdType", "bird_type"])),
    totalBirds: num(firstOf(row, ["totalBirds", "birds", "total_birds"])),
    totalWeight: num(firstOf(row, ["totalWeight", "weight", "total_weight"])),
    rate: row.rate == null ? null : num(row.rate),
    amount: num(row.amount),
    remark: str(firstOf(row, ["remark", "remarks"])),
    status: PENDING_SALE_STATUSES.has(str(row.status).toLowerCase()) ? "Pending" : "Completed",
    numericId: row.id == null ? undefined : num(row.id),
    numericTripId: tripId == null ? null : num(tripId),
    numericShopId: shopId == null ? null : num(shopId),
    mortality: num(row.mortality),
    birdTypeId: row.birdTypeId == null ? null : num(row.birdTypeId),
  };
}

/** GET /api/operations/shop-sales — delivery lines behind the sales KPIs. */
async function fetchSampleShopSales(): Promise<ShopSale[]> {
  try {
    const rows = await fetchSampleRows(
      "/operations/shop-sales",
      sampleRange(SAMPLE_SERIES_WINDOW_DAYS)
    );
    return rows.map(toShopSale).filter((s) => s.tripDate);
  } catch {
    return [];
  }
}

/**
 * Map a collection row onto the legacy `Collection` view the dashboard reads,
 * mirroring collectionService.mapEntryToCollection (status collapses to the
 * 2-state legacy enum; soft-deleted rows are dropped by the caller).
 */
function toCollection(row: Record<string, unknown>): Collection {
  const status = str(row.status);
  const collectionDate = str(firstOf(row, ["collectionDate", "collection_date"]));
  const createdAt = str(firstOf(row, ["createdAt", "created_at"]));
  const approvedAt = firstOf(row, ["approvedAt", "approved_at"]);
  const approvedBy = firstOf(row, ["approvedBy", "approved_by"]);
  const shopId = firstOf(row, ["shopId", "shop_id"]);
  return {
    id: str(row.id),
    collectionNo: str(firstOf(row, ["collectionNo", "collection_no"])),
    collectionDate,
    shopName: str(firstOf(row, ["shopName", "shop_name"])),
    collectorName: str(firstOf(row, ["collectorName", "collector"])),
    paymentModeName: str(firstOf(row, ["paymentModeName", "paymentMode", "payment_mode"]), "Cash"),
    referenceNo: str(firstOf(row, ["referenceNo", "reference_no"])),
    amount: num(firstOf(row, ["amount", "amountCollected", "amount_collected"])),
    remarks: str(row.remarks),
    status: status === "Approved" ? "Approved" : "Pending",
    createdDate: createdAt || collectionDate,
    createdBy: str(firstOf(row, ["createdBy", "created_by"])),
    approvedDate: approvedAt == null ? undefined : str(approvedAt),
    approvedBy: approvedBy == null ? undefined : str(approvedBy),
    numericId: row.id == null ? undefined : num(row.id),
    numericShopId: shopId == null ? null : num(shopId),
  };
}

/** GET /api/operations/collection-entry — the collections register. */
async function fetchSampleCollections(): Promise<Collection[]> {
  try {
    const rows = await fetchSampleRows("/operations/collection-entry", {
      ...sampleRange(SAMPLE_SERIES_WINDOW_DAYS),
      includeDeleted: "false",
    });
    return rows
      .filter((row) => row.deleted !== true && str(firstOf(row, ["collectionDate", "collection_date"])))
      .map(toCollection);
  } catch {
    return [];
  }
}

/** Map a per-shop outstanding row onto the UI's PendingCollection shape. */
function toPendingCollection(row: Record<string, unknown>): PendingCollection {
  const shopId = firstOf(row, ["shopId", "shop_id"]);
  return {
    shopId: shopId == null ? undefined : num(shopId),
    shopName: str(firstOf(row, ["shopName", "shop_name"])),
    totalSales: num(firstOf(row, ["totalSales", "total_sales"])),
    totalCollections: num(firstOf(row, ["totalCollections", "total_collections"])),
    currentPending: num(firstOf(row, ["currentPending", "pendingAmount", "current_pending"])),
    overdueDays: num(firstOf(row, ["overdueDays", "overdue_days"])),
    lastCollectionDate: str(firstOf(row, ["lastCollectionDate", "last_collection_date"]), "-"),
  };
}

/**
 * GET /api/operations/collections/pending — outstanding per shop.
 * Quarter-wide by nature (opening balance + all sales − all collections), so
 * it is read WITHOUT a date window.
 */
async function fetchSamplePendingCollections(): Promise<PendingCollection[]> {
  try {
    const rows = await fetchSampleRows("/operations/collections/pending", {});
    return rows.map(toPendingCollection).filter((p) => p.shopName);
  } catch {
    return [];
  }
}

/** Backend rows win; anything only held locally is kept. */
function mergeById<T extends { id: unknown }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set(primary.map((row) => String(row.id)));
  return [...primary, ...secondary.filter((row) => !seen.has(String(row.id)))];
}

/** Same rule for the per-shop pending snapshot, keyed by shop instead of row id. */
function mergeByShopId(primary: PendingCollection[], secondary: PendingCollection[]): PendingCollection[] {
  const seen = new Set(primary.map((row) => String(row.shopId ?? row.shopName)));
  return [...primary, ...secondary.filter((row) => !seen.has(String(row.shopId ?? row.shopName)))];
}

/* ------------------------------------------------------------------ */
/*  Fleet maintenance                                                   */
/* ------------------------------------------------------------------ */
/** Map a fleet maintenance job onto the fields the dashboard renders. */
function toMaintenanceRow(row: Record<string, unknown>): MaintenanceRow {
  return {
    id: str(row.id),
    vehicleId: str(firstOf(row, ["vehicleId", "vehicle_id"])),
    vehicleNo: str(firstOf(row, ["vehicleNo", "vehicle_no"])),
    date: str(firstOf(row, ["date", "maintenanceDate", "jobDate"])),
    nextServiceKM: num(firstOf(row, ["nextServiceKM", "next_service_km"])),
    totalCost: num(firstOf(row, ["totalCost", "total_cost"])),
  };
}

/**
 * GET /api/fleet/maintenance — jobs for the same 30-day window as trips/fuel.
 * Feeds the fleet card's per-vehicle service note and the activity timeline;
 * without it every vehicle read "No open issues" while the Fleet module showed
 * 300+ jobs from the same dataset.
 */
async function fetchSampleMaintenance(): Promise<MaintenanceRow[]> {
  try {
    const rows = await fetchSampleRows("/fleet/maintenance", sampleRange(SAMPLE_WINDOW_DAYS));
    return rows
      .map(toMaintenanceRow)
      .filter((m) => m.date && (m.vehicleNo || m.vehicleId))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
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
  // Empty unless the sample API supplies jobs — deriveDashboard falls back to
  // its existing localStorage read (fleet storage) when this is empty, so a
  // production/real-backend render is untouched.
  let maintenance: MaintenanceRow[] = [];
  try {
    trips = tripService.getAll();
    collections = collectionService.getCollections();
    pendingCollections = collectionService.getPendingCollections();
    shopSales = collectionService.getShopSales();
    fuelExpenses = fuelExpenseService.getAll();
  } catch (error) {
    console.warn("Dashboard: unable to read operations data", error);
  }

  // The operations rows above come from synchronous service getters: trips and
  // fuel from localStorage (the Trip Entry flow writes there), collections /
  // shop sales / pending from a cache that a background warm-up fills *after*
  // this dashboard has usually already rendered. With the quarter sample API
  // running (`scripts/quarter-sample-data.mjs`, started by `npm run dev`) that
  // left the KPI tiles, the charts, the pending-collections card and the
  // activity timeline empty while every other page of every module was fully
  // populated from the same dataset.
  //
  // So when the sample server identifies itself, read the very rows it
  // generated for the window the dashboard renders and merge them in — API
  // rows first, so they always win over a stale/partial local cache, and any
  // locally-only row is still kept. Production is untouched: the probe
  // resolves to null outside dev/preview and against a real backend.
  const sampleQuarter = (await getQuarterSampleInfo())?.quarter ?? null;
  if (sampleQuarter) {
    const [apiTrips, apiFuel, apiShopSales, apiCollections, apiPending, apiMaintenance] =
      await Promise.all([
        fetchSampleTrips(),
        fetchSampleFuel(),
        fetchSampleShopSales(),
        fetchSampleCollections(),
        fetchSamplePendingCollections(),
        fetchSampleMaintenance(),
      ]);
    trips = mergeById(apiTrips, trips);
    fuelExpenses = mergeById(apiFuel, fuelExpenses);
    shopSales = mergeById(apiShopSales, shopSales);
    collections = mergeById(apiCollections, collections);
    pendingCollections = mergeByShopId(apiPending, pendingCollections);
    if (apiMaintenance.length > 0) maintenance = apiMaintenance;
  }

  return {
    ...masters,
    trips,
    collections,
    pendingCollections,
    shopSales,
    fuelExpenses,
    maintenance,
    demoActive: isDemoDataActive(),
    sampleQuarter,
  };
}

/** Re-exported so the dashboard page can refresh after seeding. */
export { seedDemoData, clearDemoData, isDemoDataActive } from "./demoData";
