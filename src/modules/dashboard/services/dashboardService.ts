/**
 * Operations Dashboard — PostgreSQL via shared Axios helpers.
 * KPIs come only from GET /api/operations/dashboard.
 */

import { apiGet, handleApiError } from "../../../api";
import { toBusinessDate } from "../../../utils/businessDate";
import type { SampleQuarter } from "../../../sample/quarterSample";
import type { CollectionPerformanceDatum } from "../utils/collectionPerformance";

const DASHBOARD_PATH = "/operations/dashboard";

export interface DashboardRecentTrip {
  id: number;
  tripNo: string;
  vehicleNo: string;
  shopName: string;
  weight: number;
  status: string;
}

/** Raw contract from GET /api/operations/dashboard */
export type OperationsDashboardApiResponse = {
  totalTrips?: number;
  totalWeight?: number;
  totalSales?: number;
  totalCollections?: number;
  pendingCollections?: number;
  fuelExpenses?: number;
  todaysTrips?: number;
  weeklyTrips?: number;
  monthlyTrips?: number;
  /** Optional panel/chart series. Passed through when the API supplies them. */
  totalExpenses?: number;
  tripExpense?: number;
  trendData?: {
    date: string;
    trips: number;
    weight: number;
    mortality: number;
  }[];
  topShops?: { shopName: string; amount: number }[];
  collectionsByMode?: { name: string; value: number }[];
  expensesByCategory?: { name: string; value: number }[];
  mortalityData?: { date: string; mortality: number }[];
  recentTrips?: DashboardRecentTrip[];
  pendingCollectionsByShop?: { shopName: string; pendingAmount: number }[];
  /** Exact selected-period sales/collection recovery for the overview chart. */
  collectionPerformanceByShop?: CollectionPerformanceDatum[];
  /** Present only on the quarter sample API (scripts/quarter-sample-data.mjs). */
  sample?: boolean;
  today?: string;
  quarter?: SampleQuarter | null;
  activeVehicles?: number;
  activeDrivers?: number;
  activeHelpers?: number;
  totalShops?: number;
  totalFarms?: number;
  usedVehicles?: number;
  usedDrivers?: number;
  usedHelpers?: number;
  usedShops?: number;
  usedFarms?: number;
};

/** UI shape used by Operations Dashboard components. */
export interface DashboardData {
  totalTrips: number;
  totalSalesWeight: number;
  totalSalesAmount: number;
  /** Birds loaded at the farm across the window (completed trips). */
  totalBirds?: number;
  totalCollections: number;
  pendingCollections: number;
  totalExpenses: number;
  fuelExpense: number;
  tripExpense: number;
  todaysTrips: number;
  weeklyTrips: number;
  monthlyTrips: number;
  trendData: {
    date: string;
    trips: number;
    weight: number;
    mortality: number;
  }[];
  topShops: { shopName: string; amount: number }[];
  collectionsByMode: { name: string; value: number }[];
  expensesByCategory: { name: string; value: number }[];
  mortalityData: { date: string; mortality: number }[];
  recentTrips: DashboardRecentTrip[];
  activeVehicles: number;
  activeDrivers: number;
  activeHelpers: number;
  totalShops: number;
  totalFarms: number;
  collectionPerformanceByShop: CollectionPerformanceDatum[];
  usedVehicles: number;
  usedDrivers: number;
  usedHelpers: number;
  usedShops: number;
  usedFarms: number;
  /**
   * Who actually RAN during the selected span, per register (vehicles,
   * drivers, supervisors, helpers, loaders — no shops). Present whenever the
   * trip-list API answered; the panel falls back to the dashboard API's own
   * in-window counters when it did not.
   */
  spanFleet?: DashboardSpanFleet;
  /** Non-null only when these numbers came from the quarter sample API. */
  sampleQuarter: SampleQuarter | null;
}

export interface CollectionRecoverySnapshot {
  rows: CollectionPerformanceDatum[];
  totalSales: number;
  totalCollections: number;
  totalPending: number;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface DashboardShopLookupRow {
  id?: number;
  shopName: string;
  shopStatus?: "Active" | "Inactive" | string;
  currentBalance?: number;
  /** Register identifiers shown in the tile tooltip's inactive list. */
  shopNumber?: string;
  city?: string;
  village?: string;
}

interface DashboardPendingLookupRow {
  shopId?: number;
  shopName: string;
  currentPending: number;
}

/* ------------------------------------------------------------------ */
/*  Active Fleet — who actually RAN during the selected span            */
/* ------------------------------------------------------------------ */

/**
 * One person/vehicle that ran at least one trip inside the selected span.
 * The per-participant counters come straight off the trip rows, never from
 * the masters register, so a narrow window never claims all-time activity.
 */
export interface SpanFleetParticipant {
  name: string;
  trips: number;
  /** Distinct shops delivered to in the span (vehicles, drivers). */
  shops?: number;
  /** Distinct farms covered in the span (supervisors). */
  farms?: number;
  /** Delivered weight in the span, kg (vehicles). */
  weightKg?: number;
}

/**
 * One ACTIVE register member that ran NO trip in the selected span — shown
 * when a tile is selected ("select the tile again and it goes"). Register-
 * Inactive (out-of-service) members are excluded on purpose: they are not
 * part of the tile's "X / Y" denominator either, so a tile reading 29 / 29
 * can never surprise the reader with an idle row (worked and idle always
 * add up to exactly the active register size).
 */
export interface SpanIdleItem {
  name: string;
  /** Vehicle type label (vehicles only), e.g. "Mahindra Bolero Pickup". */
  type?: string;
  /**
   * Most recent trip date this member EVER worked (YYYY-MM-DD), read across
   * the full trip feed — the idle line answers "when did they last work?",
   * which the joining date could never say for a span they were absent in.
   */
  lastTripDate?: string;
}

/**
 * One register's span roster: the people/vehicles that ran trips in the
 * selected window plus the register members that did NOT. The active register
 * size rides along as a small "of N active" denominator — it is never what
 * the headline counts.
 */
export interface SpanFleetRoster {
  /** Distinct participants who ran ≥1 trip in the span. */
  worked: number;
  /** Active register size (window-independent context). */
  activeTotal: number;
  /** The participants themselves, busiest first (overlay list, capped). */
  items: SpanFleetParticipant[];
  /** Participants beyond the cap (overlay "+N more"). */
  overflow: number;
  /** Register members (any status) that ran no trip in the span, a–z. */
  idle: SpanIdleItem[];
  /** Idle members beyond the cap. */
  idleOverflow: number;
}

/**
 * The Active Fleet panel's truth table — span-scoped on purpose. Trips (from
 * /operations/trip-list, windowed exactly like the dashboard itself) are the
 * only source of "who was there": vehicles, drivers, supervisors, helpers
 * and loaders that ran the window's trips. Shops are deliberately excluded.
 */
export interface DashboardSpanFleet {
  vehicles: SpanFleetRoster;
  drivers: SpanFleetRoster;
  supervisors: SpanFleetRoster;
  helpers: SpanFleetRoster;
  loaders: SpanFleetRoster;
  /** Trips inside the span these rosters were read from. */
  tripCount: number;
}

/** Cap so even a busy range's tooltip stays readable. */
const TOOLTIP_ITEM_LIMIT = 30;
/** The quarter sample never approaches this many trips per window. */
const TRIP_ROW_LIMIT = 1500;
/** Whole-feed pull for "last worked" dates — comfortably above a quarter. */
const TRIP_ALL_ROW_LIMIT = 5000;

/** What one trip row contributes to the span rosters. */
interface SpanTripRow {
  tripDate: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  helpers: string[];
  loaders: string[];
  sourceFarm: string;
  shops: string[];
  deliveredWeightKg: number;
}

function mapSpanTripRow(raw: Record<string, unknown>): SpanTripRow {
  const names = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [];
  const deliveries = Array.isArray(raw.deliveries)
    ? (raw.deliveries as Record<string, unknown>[])
    : [];
  const shops = deliveries
    .map((d) => String(d.shopName ?? d.shop_name ?? "").trim())
    .filter(Boolean);
  const deliveredWeightKg =
    deliveries.length > 0
      ? deliveries.reduce((acc, d) => acc + toNumber(d.weight), 0)
      : toNumber(raw.totalDeliveredWeight ?? raw.deliveredWeight);
  return {
    tripDate: String(raw.tripDate ?? raw.trip_date ?? "").slice(0, 10),
    vehicleNo: String(raw.vehicleNo ?? raw.vehicle_no ?? "").trim(),
    driverName: String(raw.driverName ?? raw.driver_name ?? "").trim(),
    supervisorName: String(
      raw.supervisorName ?? raw.supervisor_name ?? "",
    ).trim(),
    helpers: names(raw.helpers),
    loaders: names(raw.loaders),
    sourceFarm: String(raw.sourceFarm ?? raw.source_farm ?? "").trim(),
    shops,
    deliveredWeightKg,
  };
}

interface ParticipantBucket {
  name: string;
  trips: number;
  shops: Set<string>;
  farms: Set<string>;
  weightKg: number;
}

/** Count one trip for `name`, creating its bucket on first sight. */
function bumpParticipant(
  map: Map<string, ParticipantBucket>,
  name: string,
): ParticipantBucket | null {
  if (!name) return null;
  const existing = map.get(name) ?? {
    name,
    trips: 0,
    shops: new Set<string>(),
    farms: new Set<string>(),
    weightKg: 0,
  };
  existing.trips += 1;
  map.set(name, existing);
  return existing;
}

/** Busiest first, then alphabetical, so the overlay reads like a leaderboard; the idle half sorts a–z. */
function buildRoster(
  items: SpanFleetParticipant[],
  activeTotal: number,
  idleAll: SpanIdleItem[],
): SpanFleetRoster {
  const sorted = [...items].sort(
    (a, b) => b.trips - a.trips || a.name.localeCompare(b.name, "en-IN"),
  );
  const idleSorted = [...idleAll].sort((a, b) =>
    a.name.localeCompare(b.name, "en-IN"),
  );
  return {
    worked: sorted.length,
    activeTotal,
    items: sorted.slice(0, TOOLTIP_ITEM_LIMIT),
    overflow: Math.max(0, sorted.length - TOOLTIP_ITEM_LIMIT),
    idle: idleSorted.slice(0, TOOLTIP_ITEM_LIMIT),
    idleOverflow: Math.max(0, idleSorted.length - TOOLTIP_ITEM_LIMIT),
  };
}

/** Crew rows of one department from the employee master ("Driver"/"Drivers" either way). */
function crewDeptRows(
  employees: readonly Record<string, unknown>[],
  department: string,
): Record<string, unknown>[] {
  const want = department.toLowerCase();
  return employees.filter((row) => {
    const dept = String(row.department ?? row.role ?? "")
      .trim()
      .toLowerCase();
    return dept === want || `${dept}s` === want || dept === `${want}s`;
  });
}

/** Active register size for one crew department. */
function activeCrewCount(
  employees: readonly Record<string, unknown>[],
  department: string,
): number {
  return crewDeptRows(employees, department).filter(
    (row) => row.status === "Active",
  ).length;
}

/** Aggregate the span's trip rows into the five on-trip rosters. */
function buildSpanFleet(
  trips: readonly Record<string, unknown>[],
  vehicles: readonly Record<string, unknown>[],
  employees: readonly Record<string, unknown>[],
  allTrips: readonly Record<string, unknown>[],
): DashboardSpanFleet {
  const vehiclesByName = new Map<string, ParticipantBucket>();
  const driversByName = new Map<string, ParticipantBucket>();
  const supervisorsByName = new Map<string, ParticipantBucket>();
  const helpersByName = new Map<string, ParticipantBucket>();
  const loadersByName = new Map<string, ParticipantBucket>();

  for (const raw of trips) {
    const trip = mapSpanTripRow(raw);
    const vehicle = bumpParticipant(vehiclesByName, trip.vehicleNo);
    if (vehicle) {
      trip.shops.forEach((s) => vehicle.shops.add(s));
      vehicle.weightKg += trip.deliveredWeightKg;
    }
    const driver = bumpParticipant(driversByName, trip.driverName);
    if (driver) trip.shops.forEach((s) => driver.shops.add(s));
    const supervisor = bumpParticipant(supervisorsByName, trip.supervisorName);
    if (supervisor && trip.sourceFarm) supervisor.farms.add(trip.sourceFarm);
    for (const name of trip.helpers) bumpParticipant(helpersByName, name);
    for (const name of trip.loaders) bumpParticipant(loadersByName, name);
  }

  // Every name from the FULL trip feed → its most recent trip date. The idle
  // line shows "last worked" from this, never the joining date: the question
  // a reader has about someone missing from the span is when they ran last.
  // YYYY-MM-DD strings compare correctly, so a max-scan is enough.
  const lastTripByName = new Map<string, string>();
  const rememberLastTrip = (name: string, tripDate: string): void => {
    if (!name || !tripDate) return;
    const current = lastTripByName.get(name);
    if (!current || current < tripDate) lastTripByName.set(name, tripDate);
  };
  for (const raw of allTrips) {
    const trip = mapSpanTripRow(raw);
    rememberLastTrip(trip.vehicleNo, trip.tripDate);
    rememberLastTrip(trip.driverName, trip.tripDate);
    rememberLastTrip(trip.supervisorName, trip.tripDate);
    for (const name of trip.helpers) rememberLastTrip(name, trip.tripDate);
    for (const name of trip.loaders) rememberLastTrip(name, trip.tripDate);
  }

  // ACTIVE register members that ran NO trip in the span — the "did not run
  // in this range" line shown when a tile is selected. Register-Inactive
  // (out-of-service) members are excluded entirely: they sit outside the
  // tile's denominator, so worked + idle always equals the active total.
  const vehiclesIdle: SpanIdleItem[] = vehicles.flatMap((row) => {
    if (row.status !== "Active") return [];
    const name = String(row.vehicleNumber ?? row.number ?? "").trim();
    if (!name || vehiclesByName.has(name)) return [];
    const type = String(row.vehicleType ?? "").trim();
    return [
      { name, type: type || undefined, lastTripDate: lastTripByName.get(name) },
    ];
  });
  const crewIdle = (
    department: string,
    participants: Map<string, ParticipantBucket>,
  ): SpanIdleItem[] =>
    crewDeptRows(employees, department).flatMap((row) => {
      if (row.status !== "Active") return [];
      const name = String(row.employeeName ?? "").trim();
      if (!name || participants.has(name)) return [];
      return [{ name, lastTripDate: lastTripByName.get(name) }];
    });

  return {
    vehicles: buildRoster(
      [...vehiclesByName.values()].map((p) => ({
        name: p.name,
        trips: p.trips,
        shops: p.shops.size,
        weightKg: Math.round(p.weightKg),
      })),
      vehicles.filter((v) => v.status === "Active").length,
      vehiclesIdle,
    ),
    drivers: buildRoster(
      [...driversByName.values()].map((p) => ({
        name: p.name,
        trips: p.trips,
        shops: p.shops.size,
      })),
      activeCrewCount(employees, "Driver"),
      crewIdle("Driver", driversByName),
    ),
    supervisors: buildRoster(
      [...supervisorsByName.values()].map((p) => ({
        name: p.name,
        trips: p.trips,
        farms: p.farms.size,
      })),
      activeCrewCount(employees, "Supervisor"),
      crewIdle("Supervisor", supervisorsByName),
    ),
    helpers: buildRoster(
      [...helpersByName.values()].map((p) => ({
        name: p.name,
        trips: p.trips,
      })),
      activeCrewCount(employees, "Helper"),
      crewIdle("Helper", helpersByName),
    ),
    loaders: buildRoster(
      [...loadersByName.values()].map((p) => ({
        name: p.name,
        trips: p.trips,
      })),
      activeCrewCount(employees, "Loader"),
      crewIdle("Loader", loadersByName),
    ),
    tripCount: trips.length,
  };
}

/**
 * Trips inside the dashboard window — the same endpoint the Trip List page
 * reads, windowed exactly like the dashboard itself. Returns null when the
 * API is unreachable so the panel can fall back to the dashboard's own
 * in-window counters; an empty array still means "nobody ran in this range".
 */
async function fetchSpanTrips(
  fromDate?: string,
  toDate?: string,
): Promise<Record<string, unknown>[] | null> {
  try {
    const params: Record<string, string | number> = { limit: TRIP_ROW_LIMIT };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const { data } = await apiGet<
      Record<string, unknown> | Record<string, unknown>[]
    >("/operations/trip-list", { params });
    if (Array.isArray(data)) return data;
    const rows = (data as { data?: unknown } | null)?.data;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  } catch {
    return null;
  }
}

/**
 * The whole trip feed (no window) — only the idle line reads it, to pin the
 * "last worked" date of register members missing from the selected span.
 * Returns null on failure like fetchSpanTrips; the builder degrades to
 * "no trips recorded" when a date cannot be found.
 */
async function fetchAllTrips(): Promise<Record<string, unknown>[] | null> {
  try {
    const { data } = await apiGet<
      Record<string, unknown> | Record<string, unknown>[]
    >("/operations/trip-list", {
      params: {
        limit: TRIP_ALL_ROW_LIMIT,
        sortBy: "tripDate",
        sortDir: "desc",
      },
    });
    if (Array.isArray(data)) return data;
    const rows = (data as { data?: unknown } | null)?.data;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  } catch {
    return null;
  }
}

/** Raw vehicle master rows (only `status` matters for the register split). */
async function fetchDashboardVehicles(): Promise<Record<string, unknown>[]> {
  try {
    const { data } =
      await apiGet<Record<string, unknown>[]>("/masters/vehicles");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Raw employee master rows (`department` + `status` drive the crew counts). */
async function fetchDashboardEmployees(): Promise<Record<string, unknown>[]> {
  try {
    const { data } =
      await apiGet<Record<string, unknown>[]>("/masters/employees");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const shopLookupKey = (shopName: string): string =>
  shopName.trim().toLocaleLowerCase("en-IN");

function normalizeShopStatus(status: unknown): "Active" | "Inactive" {
  return status === "Active" ? "Active" : "Inactive";
}

function mapDashboardShopLookup(
  raw: Record<string, unknown>,
): DashboardShopLookupRow | null {
  const shopName = String(raw.shopName ?? raw.shop_name ?? "").trim();
  if (!shopName) return null;
  const shopNumber = String(raw.shopNumber ?? raw.shop_number ?? "").trim();
  const city = String(raw.city ?? "").trim();
  const village = String(raw.village ?? "").trim();
  return {
    id: raw.id != null ? Number(raw.id) : undefined,
    shopName,
    shopStatus: normalizeShopStatus(raw.status),
    currentBalance: toNumber(raw.currentBalance ?? raw.current_balance),
    shopNumber: shopNumber || undefined,
    city: city || undefined,
    village: village || undefined,
  };
}

function mapDashboardPendingLookup(
  raw: Record<string, unknown>,
): DashboardPendingLookupRow | null {
  const shopName = String(raw.shopName ?? raw.shop_name ?? "").trim();
  if (!shopName) return null;
  return {
    shopId:
      raw.shopId != null
        ? Number(raw.shopId)
        : raw.shop_id != null
          ? Number(raw.shop_id)
          : undefined,
    shopName,
    currentPending: Math.max(
      0,
      toNumber(
        raw.currentPending ??
          raw.current_pending ??
          raw.pendingAmount ??
          raw.pending_amount,
      ),
    ),
  };
}

async function fetchDashboardShops(): Promise<DashboardShopLookupRow[]> {
  try {
    const { data } = await apiGet<Record<string, unknown>[]>("/masters/shops");
    return (Array.isArray(data) ? data : []).flatMap((row) => {
      const mapped = mapDashboardShopLookup(row);
      return mapped ? [mapped] : [];
    });
  } catch {
    return [];
  }
}

async function fetchDashboardPendingCollections(): Promise<
  DashboardPendingLookupRow[]
> {
  try {
    const { data } = await apiGet<Record<string, unknown>[]>(
      "/operations/collections/pending",
    );
    return (Array.isArray(data) ? data : []).flatMap((row) => {
      const mapped = mapDashboardPendingLookup(row);
      return mapped ? [mapped] : [];
    });
  } catch {
    return [];
  }
}

function enrichCollectionPerformanceRows(
  rows: readonly CollectionPerformanceDatum[],
  shops: readonly DashboardShopLookupRow[],
  pendingRows: readonly DashboardPendingLookupRow[],
): CollectionPerformanceDatum[] {
  if (shops.length === 0 && pendingRows.length === 0) return [...rows];

  const byShop = new Map<string, CollectionPerformanceDatum>();
  const ensure = (shopName: string): CollectionPerformanceDatum => {
    const key = shopLookupKey(shopName);
    const current = byShop.get(key);
    if (current) return current;
    const created: CollectionPerformanceDatum = {
      shopName,
      salesAmount: 0,
      collectionAmount: 0,
      outstandingAmount: 0,
    };
    byShop.set(key, created);
    return created;
  };

  for (const row of rows) {
    const shopName = String(row.shopName ?? "").trim();
    if (!shopName) continue;
    const current = ensure(shopName);
    current.salesAmount += Math.max(0, toNumber(row.salesAmount));
    current.collectionAmount += Math.max(0, toNumber(row.collectionAmount));
    current.outstandingAmount += Math.max(0, toNumber(row.outstandingAmount));
    current.shopId ??= row.shopId;
    current.shopStatus ??= row.shopStatus;
  }

  for (const shop of shops) {
    const current = ensure(shop.shopName);
    current.shopId ??= shop.id;
    current.shopStatus = shop.shopStatus;
    // Inactive shops are selectable for pending follow-up, but they should not
    // inherit old sales into the selected-period recovery chart.
    if (shop.shopStatus === "Inactive") current.salesAmount = 0;
    if (
      shop.currentBalance &&
      shop.currentBalance > current.outstandingAmount
    ) {
      current.outstandingAmount = Math.max(0, shop.currentBalance);
    }
  }

  for (const pending of pendingRows) {
    const current = ensure(pending.shopName);
    current.shopId ??= pending.shopId;
    current.outstandingAmount = Math.max(0, pending.currentPending);
  }

  return [...byShop.values()].sort((a, b) =>
    a.shopName.localeCompare(b.shopName, "en-IN"),
  );
}

async function enrichOperationsDashboardData(
  data: DashboardData,
  fromDate?: string,
  toDate?: string,
  withSpanFleet = true,
): Promise<DashboardData> {
  const [shops, pendingRows, vehicles, employees, spanTrips, allTrips] =
    await Promise.all([
      fetchDashboardShops(),
      fetchDashboardPendingCollections(),
      fetchDashboardVehicles(),
      fetchDashboardEmployees(),
      // Span rosters only where they are rendered — a collection-card refresh
      // or the previous-window comparison load never shows them, so those
      // paths skip the two trip-list pulls entirely (no background duplication).
      withSpanFleet ? fetchSpanTrips(fromDate, toDate) : Promise.resolve(null),
      withSpanFleet ? fetchAllTrips() : Promise.resolve(null),
    ]);

  if (
    shops.length === 0 &&
    pendingRows.length === 0 &&
    vehicles.length === 0 &&
    employees.length === 0 &&
    spanTrips === null
  )
    return data;

  return {
    ...data,
    collectionPerformanceByShop: enrichCollectionPerformanceRows(
      data.collectionPerformanceByShop,
      shops,
      pendingRows,
    ),
    // The Active Fleet panel is span-scoped: only the people and vehicles
    // that ran a trip inside the selected window are counted, with the
    // active masters register riding along as the small denominator. The
    // whole feed is not counted — it only pins idle members' last-worked day.
    ...(spanTrips
      ? {
          spanFleet: buildSpanFleet(
            spanTrips,
            vehicles,
            employees,
            allTrips ?? [],
          ),
        }
      : {}),
  };
}

/**
 * Older dashboard APIs expose only top sales and live pending lists. Keep the
 * new chart useful against that contract while preferring the exact-period
 * collectionPerformanceByShop series whenever the API supplies it.
 */
function deriveLegacyCollectionPerformance(
  raw: OperationsDashboardApiResponse | null | undefined,
): CollectionPerformanceDatum[] {
  const byShop = new Map<string, CollectionPerformanceDatum>();
  for (const sale of raw?.topShops ?? []) {
    const shopName = String(sale.shopName ?? "").trim();
    if (!shopName) continue;
    byShop.set(shopName.toLocaleLowerCase("en-IN"), {
      shopName,
      salesAmount: toNumber(sale.amount),
      collectionAmount: 0,
      outstandingAmount: 0,
    });
  }
  for (const pending of raw?.pendingCollectionsByShop ?? []) {
    const shopName = String(pending.shopName ?? "").trim();
    if (!shopName) continue;
    const key = shopName.toLocaleLowerCase("en-IN");
    const current = byShop.get(key) ?? {
      shopName,
      salesAmount: 0,
      collectionAmount: 0,
      outstandingAmount: 0,
    };
    current.outstandingAmount += toNumber(pending.pendingAmount);
    byShop.set(key, current);
  }
  return [...byShop.values()];
}

/** Map API fields onto the existing dashboard UI shape. */
export function mapDashboardResponse(
  raw: OperationsDashboardApiResponse | null | undefined,
): DashboardData {
  const totalTrips = toNumber(raw?.totalTrips);
  const totalWeight = toNumber(raw?.totalWeight);
  const totalSales = toNumber(raw?.totalSales);
  const totalCollections = toNumber(raw?.totalCollections);
  const pendingCollections = toNumber(raw?.pendingCollections);
  const fuelExpenses = toNumber(raw?.fuelExpenses);

  return {
    totalTrips,
    // UI labels: Total Weight / Total Sales Amount
    totalSalesWeight: totalWeight,
    totalSalesAmount: totalSales,
    totalCollections,
    pendingCollections,
    // Expenses card uses totalExpenses + fuel breakdown
    totalExpenses:
      raw?.totalExpenses != null ? toNumber(raw.totalExpenses) : fuelExpenses,
    fuelExpense: fuelExpenses,
    tripExpense: toNumber(raw?.tripExpense),
    todaysTrips: toNumber(raw?.todaysTrips),
    weeklyTrips: toNumber(raw?.weeklyTrips),
    monthlyTrips: toNumber(raw?.monthlyTrips),
    // Chart/table sections render whatever the API supplies; a backend that
    // returns only KPIs still yields the previous empty-panel behaviour.
    trendData: raw?.trendData ?? [],
    topShops: raw?.topShops ?? [],
    collectionsByMode: raw?.collectionsByMode ?? [],
    expensesByCategory: raw?.expensesByCategory ?? [],
    mortalityData: raw?.mortalityData ?? [],
    recentTrips: raw?.recentTrips ?? [],
    activeVehicles: toNumber(raw?.activeVehicles),
    activeDrivers: toNumber(raw?.activeDrivers),
    activeHelpers: toNumber(raw?.activeHelpers),
    totalShops: toNumber(raw?.totalShops),
    totalFarms: toNumber(raw?.totalFarms),
    collectionPerformanceByShop:
      raw?.collectionPerformanceByShop ??
      deriveLegacyCollectionPerformance(raw),
    usedVehicles: toNumber(raw?.usedVehicles),
    usedDrivers: toNumber(raw?.usedDrivers),
    usedHelpers: toNumber(raw?.usedHelpers),
    usedShops: toNumber(raw?.usedShops),
    usedFarms: toNumber(raw?.usedFarms),
    // Only the sample server flags itself; a real backend leaves this null so
    // no "sample data" badge is ever shown against production numbers.
    sampleQuarter: raw?.sample === true && raw?.quarter ? raw.quarter : null,
  };
}

/** GET /api/operations/dashboard — live backend/database only. */
export async function loadOperationsDashboard(
  from?: Date | null,
  to?: Date | null,
  options?: { withSpanFleet?: boolean },
): Promise<DashboardData> {
  // Business dates (local calendar days, never toISOString) so the backend
  // aggregates exactly the window the user picked.
  const params: Record<string, string> = {};
  const fromDate = from ? toBusinessDate(from) : "";
  const toDate = to ? toBusinessDate(to) : "";
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const { data } = await apiGet<OperationsDashboardApiResponse>(
    DASHBOARD_PATH,
    {
      params: Object.keys(params).length > 0 ? params : undefined,
    },
  );
  return enrichOperationsDashboardData(
    mapDashboardResponse(data),
    fromDate || undefined,
    toDate || undefined,
    options?.withSpanFleet ?? true,
  );
}

function dashboardDateParams(
  fromDate?: string,
  toDate?: string,
): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  return Object.keys(params).length > 0 ? params : undefined;
}

function toCollectionRecoverySnapshot(
  data: DashboardData,
): CollectionRecoverySnapshot {
  return {
    rows: data.collectionPerformanceByShop,
    totalSales: data.totalSalesAmount,
    totalCollections: data.totalCollections,
    totalPending: data.pendingCollections,
  };
}

/** Refreshes only the Collection Recovery card data. */
export async function loadCollectionRecoveryData(
  fromDate?: string,
  toDate?: string,
): Promise<CollectionRecoverySnapshot> {
  const { data } = await apiGet<OperationsDashboardApiResponse>(
    DASHBOARD_PATH,
    {
      params: dashboardDateParams(fromDate, toDate),
    },
  );
  return toCollectionRecoverySnapshot(
    // The recovery card refreshes only its own rows — skip the two span
    // trip fetches it would otherwise duplicate in the background.
    await enrichOperationsDashboardData(
      mapDashboardResponse(data),
      fromDate,
      toDate,
      false,
    ),
  );
}

export { handleApiError };


