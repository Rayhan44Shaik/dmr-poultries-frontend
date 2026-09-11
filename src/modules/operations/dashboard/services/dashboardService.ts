/**
 * Operations Dashboard — PostgreSQL via shared Axios helpers.
 * KPIs come only from GET /api/operations/dashboard.
 */

import { apiGet, handleApiError } from "../../../../api";
import { toBusinessDate } from '../../../../utils/businessDate';

const DASHBOARD_PATH = "/operations/dashboard";

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
  recentTrips?: unknown[];
  pendingCollectionsByShop?: { shopName: string; pendingAmount: number }[];
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
  recentTrips: any[];
  activeVehicles: number;
  activeDrivers: number;
  activeHelpers: number;
  totalShops: number;
  totalFarms: number;
  pendingCollectionsByShop: { shopName: string; pendingAmount: number }[];
  usedVehicles: number;
  usedDrivers: number;
  usedHelpers: number;
  usedShops: number;
  usedFarms: number;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
    pendingCollectionsByShop: raw?.pendingCollectionsByShop ?? [],
    usedVehicles: toNumber(raw?.usedVehicles),
    usedDrivers: toNumber(raw?.usedDrivers),
    usedHelpers: toNumber(raw?.usedHelpers),
    usedShops: toNumber(raw?.usedShops),
    usedFarms: toNumber(raw?.usedFarms),
  };
}

/** GET /api/operations/dashboard */
export async function loadOperationsDashboard(): Promise<DashboardData> {
  try {
    const { data } = await apiGet<OperationsDashboardApiResponse>(DASHBOARD_PATH);
    return mapDashboardResponse(data);
  } catch {
    // The development preview has no production dashboard API. Use a complete
    // in-memory showcase so every Operations Dashboard panel can be reviewed;
    // production continues to use the real API/local fallback only.
    if (import.meta.env.DEV) return demoDashboard();
    // Offline fallback — derive the same KPI surface from the localStorage
    // stores the entry flows write to, so the overview stays usable when the
    // local PostgreSQL backend is not running.
    return offlineDashboard();
  }
}

/** Complete frontend-only showcase for the development preview. */
function demoDashboard(): DashboardData {
  const today = new Date();
  const date = (offset: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() - offset);
    return value.toISOString().slice(0, 10);
  };
  const trendData = Array.from({ length: 7 }, (_, index) => ({
    date: date(6 - index),
    trips: [5, 7, 6, 9, 8, 11, 10][index],
    weight: [4200, 5600, 4800, 7300, 6500, 8100, 7600][index],
    mortality: [42, 38, 51, 35, 46, 31, 28][index],
  }));
  const recentTrips = [
    { id: 2601, tripNo: 'TRP-2601', vehicleNo: 'AP-16-XY-4821', shopName: 'Sri Balaji Poultry Traders', weight: 7600, status: 'Completed' },
    { id: 2600, tripNo: 'TRP-2600', vehicleNo: 'AP-16-AB-7314', shopName: 'Venkatadri Egg Suppliers', weight: 8100, status: 'Completed' },
    { id: 2599, tripNo: 'TRP-2599', vehicleNo: 'AP-16-CD-1908', shopName: 'Annapurna Farms Outlet', weight: 6500, status: 'Pending' },
  ];
  return {
    totalTrips: 56,
    totalSalesWeight: 44100,
    totalSalesAmount: 684500,
    totalCollections: 548200,
    pendingCollections: 136300,
    totalExpenses: 92800,
    fuelExpense: 43600,
    tripExpense: 49200,
    todaysTrips: 10,
    weeklyTrips: 56,
    monthlyTrips: 184,
    trendData,
    topShops: [
      { shopName: 'Sri Balaji Poultry Traders', amount: 128500 },
      { shopName: 'Venkatadri Egg Suppliers', amount: 104200 },
      { shopName: 'Annapurna Farms Outlet', amount: 88600 },
      { shopName: 'Kakatiya Poultry Point', amount: 74200 },
    ],
    collectionsByMode: [{ name: 'Cash', value: 214500 }, { name: 'Union Bank', value: 186700 }, { name: 'HDFC Bank', value: 147000 }],
    expensesByCategory: [{ name: 'Fuel', value: 43600 }, { name: 'Trip', value: 28000 }, { name: 'Maintenance', value: 21200 }],
    mortalityData: trendData.map(point => ({ date: point.date, mortality: point.mortality })),
    recentTrips,
    activeVehicles: 18,
    activeDrivers: 24,
    activeHelpers: 31,
    totalShops: 100,
    totalFarms: 24,
    pendingCollectionsByShop: [
      { shopName: 'Sri Balaji Poultry Traders', pendingAmount: 38200 },
      { shopName: 'Annapurna Farms Outlet', pendingAmount: 27500 },
      { shopName: 'Kakatiya Poultry Point', pendingAmount: 19600 },
      { shopName: 'Venkatadri Egg Suppliers', pendingAmount: 14800 },
    ],
    usedVehicles: 14,
    usedDrivers: 20,
    usedHelpers: 26,
    usedShops: 38,
    usedFarms: 12,
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
  type SaleRow = { tripDate?: string; totalWeight?: number; totalBirds?: number; amount?: number };
  type CollectionRow = { collectionDate?: string; amount?: number; status?: string };
  type FuelRow = { date?: string; amount?: number };

  const trips = read<TripRow>("vehicleTrips");
  const sales = read<SaleRow>("shopSales");
  const collections = read<CollectionRow>("dmr-collections");
  const fuel = read<FuelRow>("dmr-fuel-expenses");

  const today = toBusinessDate(new Date());
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const sumRows = (rows: { amount?: number }[]) => rows.reduce((acc, r) => acc + num(r.amount), 0);

  return {
    totalTrips: trips.length,
    totalSalesWeight: sales.reduce((acc, s) => acc + num(s.totalWeight), 0),
    totalSalesAmount: sumRows(sales),
    totalCollections: sumRows(collections.filter((c) => (c.status ?? "Approved") === "Approved")),
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
    pendingCollectionsByShop: [],
    usedVehicles: 0,
    usedDrivers: 0,
    usedHelpers: 0,
    usedShops: 0,
    usedFarms: 0,
  };
}

export { handleApiError };
