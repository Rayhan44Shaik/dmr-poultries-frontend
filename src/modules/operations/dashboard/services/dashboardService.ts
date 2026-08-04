/**
 * Operations Dashboard — PostgreSQL via shared Axios helpers.
 * KPIs come only from GET /api/operations/dashboard.
 */

import { apiGet, handleApiError } from "../../../../api";

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
    totalExpenses: fuelExpenses,
    fuelExpense: fuelExpenses,
    tripExpense: 0,
    todaysTrips: toNumber(raw?.todaysTrips),
    weeklyTrips: toNumber(raw?.weeklyTrips),
    monthlyTrips: toNumber(raw?.monthlyTrips),
    // Chart/table sections stay empty until those APIs are wired
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

/** GET /api/operations/dashboard */
export async function loadOperationsDashboard(): Promise<DashboardData> {
  const { data } = await apiGet<OperationsDashboardApiResponse>(DASHBOARD_PATH);
  return mapDashboardResponse(data);
}

export { handleApiError };
