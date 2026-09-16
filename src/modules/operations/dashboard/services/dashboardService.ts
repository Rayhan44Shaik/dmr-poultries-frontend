/**
 * Operations Dashboard — PostgreSQL via shared Axios helpers.
 * KPIs come only from GET /api/operations/dashboard.
 */

import { apiGet, handleApiError } from "../../../../api";
import { toBusinessDate } from '../../../../utils/businessDate';
import type { SampleQuarter } from "../../../../sample/quarterSample";
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
  trendData?: { date: string; trips: number; weight: number; mortality: number }[];
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
  trendData: { date: string; trips: number; weight: number; mortality: number }[];
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
}

interface DashboardPendingLookupRow {
  shopId?: number;
  shopName: string;
  currentPending: number;
}

const shopLookupKey = (shopName: string): string => shopName.trim().toLocaleLowerCase("en-IN");

function normalizeShopStatus(status: unknown): "Active" | "Inactive" {
  return status === "Active" ? "Active" : "Inactive";
}

function mapDashboardShopLookup(raw: Record<string, unknown>): DashboardShopLookupRow | null {
  const shopName = String(raw.shopName ?? raw.shop_name ?? "").trim();
  if (!shopName) return null;
  return {
    id: raw.id != null ? Number(raw.id) : undefined,
    shopName,
    shopStatus: normalizeShopStatus(raw.status),
    currentBalance: toNumber(raw.currentBalance ?? raw.current_balance),
  };
}

function mapDashboardPendingLookup(raw: Record<string, unknown>): DashboardPendingLookupRow | null {
  const shopName = String(raw.shopName ?? raw.shop_name ?? "").trim();
  if (!shopName) return null;
  return {
    shopId: raw.shopId != null ? Number(raw.shopId) : raw.shop_id != null ? Number(raw.shop_id) : undefined,
    shopName,
    currentPending: Math.max(0, toNumber(raw.currentPending ?? raw.current_pending ?? raw.pendingAmount ?? raw.pending_amount)),
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

async function fetchDashboardPendingCollections(): Promise<DashboardPendingLookupRow[]> {
  try {
    const { data } = await apiGet<Record<string, unknown>[]>("/operations/collections/pending");
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
    if (shop.currentBalance && shop.currentBalance > current.outstandingAmount) {
      current.outstandingAmount = Math.max(0, shop.currentBalance);
    }
  }

  for (const pending of pendingRows) {
    const current = ensure(pending.shopName);
    current.shopId ??= pending.shopId;
    current.outstandingAmount = Math.max(0, pending.currentPending);
  }

  return [...byShop.values()].sort((a, b) => a.shopName.localeCompare(b.shopName, "en-IN"));
}

async function enrichOperationsDashboardData(data: DashboardData): Promise<DashboardData> {
  const [shops, pendingRows] = await Promise.all([
    fetchDashboardShops(),
    fetchDashboardPendingCollections(),
  ]);

  if (shops.length === 0 && pendingRows.length === 0) return data;

  return {
    ...data,
    collectionPerformanceByShop: enrichCollectionPerformanceRows(
      data.collectionPerformanceByShop,
      shops,
      pendingRows,
    ),
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
  raw: OperationsDashboardApiResponse | null | undefined
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
    totalExpenses: raw?.totalExpenses != null ? toNumber(raw.totalExpenses) : fuelExpenses,
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
      raw?.collectionPerformanceByShop ?? deriveLegacyCollectionPerformance(raw),
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

/** GET /api/operations/dashboard.
 *  In the dev preview the demo dataset is aggregated for the exact
 *  start/end window selected, so every KPI/chart/panel matches the range. */
export async function loadOperationsDashboard(
  from?: Date | null,
  to?: Date | null
): Promise<DashboardData> {
  // Business dates (local calendar days, never toISOString) so the backend
  // aggregates exactly the window the user picked.
  const params: Record<string, string> = {};
  const fromDate = from ? toBusinessDate(from) : "";
  const toDate = to ? toBusinessDate(to) : "";
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  try {
    const { data } = await apiGet<OperationsDashboardApiResponse>(DASHBOARD_PATH, {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return enrichOperationsDashboardData(mapDashboardResponse(data));
  } catch {
    // The development preview has no production dashboard API. Use a complete
    // in-memory showcase so every Operations Dashboard panel can be reviewed;
    // production continues to use the real API/local fallback only.
    if (import.meta.env.DEV) return demoDashboard(from ?? null, to ?? null);
    // Offline fallback — derive the same KPI surface from the localStorage
    // stores the entry flows write to, so the overview stays usable when the
    // local PostgreSQL backend is not running.
    return offlineDashboard();
  }
}

function dashboardDateParams(fromDate?: string, toDate?: string): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  return Object.keys(params).length > 0 ? params : undefined;
}

function parseDashboardDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toCollectionRecoverySnapshot(data: DashboardData): CollectionRecoverySnapshot {
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
  try {
    const { data } = await apiGet<OperationsDashboardApiResponse>(DASHBOARD_PATH, {
      params: dashboardDateParams(fromDate, toDate),
    });
    return toCollectionRecoverySnapshot(
      await enrichOperationsDashboardData(mapDashboardResponse(data)),
    );
  } catch {
    if (import.meta.env.DEV) {
      return toCollectionRecoverySnapshot(
        demoDashboard(parseDashboardDate(fromDate), parseDashboardDate(toDate)),
      );
    }
    throw new Error("Unable to refresh collection recovery data");
  }
}

// ── Dev-only showcase: deterministic 180-day ledger ─────────────────────────
// Every day is a self-contained record (trips, weight, sales, collections,
// expenses and per-shop / per-payment-mode splits). A dashboard for any range
// is a pure aggregation of the days inside that window, so the numbers always
// match the selected start/end dates — 7D, 15D, 1M, QTR or a custom range.

const DEMO_SHOPS = [
  'Sri Balaji Poultry Traders',
  'Venkatadri Egg Suppliers',
  'Annapurna Farms Outlet',
  'Kakatiya Poultry Point',
];
const DEMO_VEHICLES = ['AP-16-XY-4821', 'AP-16-AB-7314', 'AP-16-CD-1908', 'AP-16-FG-5527', 'AP-16-HJ-8840'];
const DEMO_DAYS = 180;

interface DemoDay {
  date: string;
  trips: number;
  weight: number;
  sales: number;
  collections: number;
  pending: number;
  fuel: number;
  tripCost: number;
  maintenance: number;
  mortality: number;
  cash: number;
  union: number;
  hdfc: number;
  shopSales: number[];
  shopPending: number[];
  topShop: number;
}

/** Stable pseudo-random in [0,1) from an integer seed (no day-to-day drift). */
const seeded = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const demoDateKey = (offset: number): string => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - offset);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const round100 = (n: number) => Math.round(n / 100) * 100;

let demoTimelineCache: DemoDay[] | null = null;

function getDemoTimeline(): DemoDay[] {
  if (demoTimelineCache) return demoTimelineCache;
  const days: DemoDay[] = [];
  // Index 0 is today, so slice(0, n) always means "last n days".
  for (let i = 0; i < DEMO_DAYS; i += 1) {
    const r = (k: number) => seeded(i * 17 + k * 7 + 3);
    // Weekends run slightly lighter; trips land between 4 and 11.
    const dateValue = new Date();
    dateValue.setDate(dateValue.getDate() - i);
    const weekend = dateValue.getDay() === 0 ? 0.72 : dateValue.getDay() === 6 ? 0.82 : 1;
    const trips = Math.max(3, Math.round((5 + r(1) * 6) * weekend));
    const weight = Math.round(trips * (740 + r(2) * 240));
    const sales = round100(weight * (15.1 + r(3) * 1.1));
    const collections = round100(sales * (0.76 + r(4) * 0.12));
    const pending = sales - collections;
    const fuel = round100(trips * (700 + r(5) * 280));
    const tripCost = round100(trips * (540 + r(6) * 240));
    const maintenance = r(7) < 0.32 ? round100(1600 + r(8) * 3400) : 0;
    const mortality = trips * (3 + Math.floor(r(9) * 4));
    // Payment-mode split of the day's collections.
    const cashShare = 0.36 + r(10) * 0.1;
    const unionShare = 0.3 + r(11) * 0.08;
    const cash = round100(collections * cashShare);
    const union = round100(collections * unionShare);
    const hdfc = Math.max(0, collections - cash - union);
    // Shop split: 4 weighted shares, normalised to the day's sales/pending.
    const rawShares = [0.3 + r(12) * 0.08, 0.24 + r(13) * 0.08, 0.2 + r(14) * 0.07, 0];
    rawShares[3] = Math.max(0.08, 1 - rawShares[0] - rawShares[1] - rawShares[2]);
    const shopSales = rawShares.map((share) => round100(sales * share));
    const shopPending = rawShares.map((share) => Math.round(pending * share));
    // Reconcile rounding onto the largest share so totals stay exact.
    const salesDelta = sales - shopSales.reduce((a, b) => a + b, 0);
    const pendingDelta = pending - shopPending.reduce((a, b) => a + b, 0);
    let topShop = 0;
    rawShares.forEach((share, idx) => {
      if (share > rawShares[topShop]) topShop = idx;
    });
    shopSales[topShop] += salesDelta;
    shopPending[topShop] += pendingDelta;
    days.push({
      date: demoDateKey(i), trips, weight, sales, collections, pending,
      fuel, tripCost, maintenance, mortality,
      cash, union, hdfc, shopSales, shopPending, topShop,
    });
  }
  demoTimelineCache = days;
  return days;
}

/** Aggregate the demo ledger for [from, to] (inclusive, local midnight). */
function demoDashboard(from: Date | null, to: Date | null): DashboardData {
  const timeline = getDemoTimeline();
  const keyOf = (d: Date) => {
    const v = new Date(d);
    v.setHours(0, 0, 0, 0);
    // floor (not round): today's midnight is a positive fraction of a day ago.
    return demoDateKey(Math.floor((Date.now() - v.getTime()) / 86_400_000));
  };
  // Default window is the last 7 days when no range is selected.
  const fromKey = from ? keyOf(from) : timeline[6].date;
  const toKey = to ? keyOf(to) : timeline[0].date;
  // Timeline is today-first; charts and tables want oldest-first.
  const days = timeline
    .filter((d) => d.date >= fromKey && d.date <= toKey)
    .reverse();

  const sum = (pick: (d: DemoDay) => number) => days.reduce((acc, d) => acc + pick(d), 0);
  const empty: DashboardData = {
    totalTrips: 0, totalSalesWeight: 0, totalSalesAmount: 0, totalBirds: 0, totalCollections: 0,
    pendingCollections: 0, totalExpenses: 0, fuelExpense: 0, tripExpense: 0,
    todaysTrips: 0, weeklyTrips: 0, monthlyTrips: 0, trendData: [], topShops: [],
    collectionsByMode: [], expensesByCategory: [], mortalityData: [], recentTrips: [],
    activeVehicles: 18, activeDrivers: 24, activeHelpers: 31, totalShops: 100, totalFarms: 24,
    collectionPerformanceByShop: [], usedVehicles: 14, usedDrivers: 20, usedHelpers: 26,
    usedShops: 38, usedFarms: 12, sampleQuarter: null,
  };
  if (days.length === 0) return empty;

  // Fixed-semantics counters (independent of the chosen window).
  const todaysTrips = timeline[0].trips;
  const weeklyTrips = timeline.slice(0, 7).reduce((acc, d) => acc + d.trips, 0);
  const monthStartKey = demoDateKey(0).slice(0, 8) + '01';
  const monthlyTrips = timeline
    .filter((d) => d.date >= monthStartKey)
    .reduce((acc, d) => acc + d.trips, 0);

  // Recent trips: one row per most-recent day in the window, with trip numbers
  // derived from absolute trip counts so they are stable across ranges.
  const recentDays = days.slice(-3).reverse();
  const recentTrips = recentDays.map((d) => {
    const offsetFromToday = timeline.findIndex((p) => p.date === d.date);
    const tripsNewer = timeline.slice(0, offsetFromToday).reduce((a, p) => a + p.trips, 0);
    // Number the day's last trip; stable across windows because it is derived
    // only from absolute trip counts.
    const tripId = 2601 - tripsNewer - (d.trips - 1);
    return {
      id: tripId,
      tripNo: `TRP-${tripId}`,
      vehicleNo: DEMO_VEHICLES[Math.floor(seeded(offsetFromToday * 31 + 5) * DEMO_VEHICLES.length)],
      shopName: DEMO_SHOPS[d.topShop],
      weight: Math.round(d.weight / d.trips),
      status: offsetFromToday === 0 ? 'Pending' : 'Completed',
    };
  });

  const fuel = sum((d) => d.fuel);
  const tripCost = sum((d) => d.tripCost);
  const maintenance = sum((d) => d.maintenance);
  const shopSalesTotals = DEMO_SHOPS.map((_, idx) => sum((d) => d.shopSales[idx]));
  const shopPendingTotals = DEMO_SHOPS.map((_, idx) => sum((d) => d.shopPending[idx]));

  return {
    totalTrips: sum((d) => d.trips),
    totalSalesWeight: sum((d) => d.weight),
    totalSalesAmount: sum((d) => d.sales),
    totalCollections: sum((d) => d.collections),
    pendingCollections: sum((d) => d.pending),
    totalExpenses: fuel + tripCost + maintenance,
    fuelExpense: fuel,
    tripExpense: tripCost,
    todaysTrips,
    weeklyTrips,
    monthlyTrips,
    trendData: days.map((d) => ({ date: d.date, trips: d.trips, weight: d.weight, mortality: d.mortality })),
    topShops: DEMO_SHOPS
      .map((shopName, idx) => ({ shopName, amount: shopSalesTotals[idx] }))
      .sort((a, b) => b.amount - a.amount),
    collectionsByMode: [
      { name: 'Cash', value: sum((d) => d.cash) },
      { name: 'Union Bank', value: sum((d) => d.union) },
      { name: 'HDFC Bank', value: sum((d) => d.hdfc) },
    ],
    expensesByCategory: [
      { name: 'Fuel', value: fuel },
      { name: 'Trip', value: tripCost },
      { name: 'Maintenance', value: maintenance },
    ],
    mortalityData: days.map((d) => ({ date: d.date, mortality: d.mortality })),
    recentTrips,
    activeVehicles: 18,
    activeDrivers: 24,
    activeHelpers: 31,
    totalShops: 100,
    totalFarms: 24,
    collectionPerformanceByShop: DEMO_SHOPS.map((shopName, idx) => ({
      shopName,
      salesAmount: shopSalesTotals[idx],
      collectionAmount: Math.max(0, shopSalesTotals[idx] - shopPendingTotals[idx]),
      outstandingAmount: shopPendingTotals[idx],
    })),
    usedVehicles: 14,
    usedDrivers: 20,
    usedHelpers: 26,
    usedShops: 38,
    usedFarms: 12,
    sampleQuarter: null,
  };
}

/** LocalStorage-derived fallback for GET /api/operations/dashboard. */
function offlineDashboard(): DashboardData {
  const read = <T,>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  };
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  type TripRow = { tripDate?: string; status?: string; totalWeight?: number; totalDeliveredWeight?: number; totalBirds?: number };
  type SaleRow = { tripDate?: string; shopName?: string; totalWeight?: number; totalBirds?: number; amount?: number };
  type CollectionRow = { collectionDate?: string; shopName?: string; amount?: number; status?: string };
  type FuelRow = { date?: string; amount?: number };

  const trips = read<TripRow>("vehicleTrips");
  const sales = read<SaleRow>("shopSales");
  const collections = read<CollectionRow>("dmr-collections");
  const fuel = read<FuelRow>("dmr-fuel-expenses");

  const today = toBusinessDate(new Date());
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const sumRows = (rows: { amount?: number }[]) => rows.reduce((acc, r) => acc + num(r.amount), 0);
  const approvedCollections = collections.filter((c) => (c.status ?? "Approved") === "Approved");
  const shopNames = new Set([
    ...sales.map((row) => String(row.shopName ?? "").trim()),
    ...approvedCollections.map((row) => String(row.shopName ?? "").trim()),
  ]);
  shopNames.delete("");
  const collectionPerformanceByShop = [...shopNames].map((shopName) => {
    const salesAmount = sumRows(sales.filter((row) => row.shopName === shopName));
    const collectionAmount = sumRows(approvedCollections.filter((row) => row.shopName === shopName));
    return {
      shopName,
      salesAmount,
      collectionAmount,
      outstandingAmount: Math.max(0, salesAmount - collectionAmount),
    };
  });

  return {
    totalTrips: trips.length,
    totalSalesWeight: sales.reduce((acc, s) => acc + num(s.totalWeight), 0),
    totalSalesAmount: sumRows(sales),
    totalCollections: sumRows(approvedCollections),
    pendingCollections: sumRows(collections.filter((c) => c.status === "Pending")),
    totalExpenses: sumRows(fuel),
    fuelExpense: sumRows(fuel),
    tripExpense: trips.reduce((acc, t) => acc + num((t as { expense?: number }).expense), 0),
    todaysTrips: trips.filter((t) => t.tripDate === today).length,
    weeklyTrips: trips.filter((t) => t.tripDate && t.tripDate >= weekAgo).length,
    monthlyTrips: trips.filter((t) => t.tripDate && t.tripDate >= monthStart).length,
    trendData: [],
    topShops: [],
    collectionsByMode: [],
    expensesByCategory: [],
    mortalityData: [],
    recentTrips: [],
    activeVehicles: 0,
    activeDrivers: 0,
    activeHelpers: 0,
    totalShops: 0,
    totalFarms: 0,
    collectionPerformanceByShop,
    usedVehicles: 0,
    usedDrivers: 0,
    usedHelpers: 0,
    usedShops: 0,
    usedFarms: 0,
    sampleQuarter: null,
  };
}

export { handleApiError };
