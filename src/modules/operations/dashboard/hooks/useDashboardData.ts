// src/modules/operations/dashboard/hooks/useDashboardData.ts

import { useCallback, useEffect, useState } from "react";
import {
  handleApiError,
  loadOperationsDashboard,
  type DashboardData,
} from "../services/dashboardService";

export type { DashboardData };

function filterForRange(data: DashboardData, from: Date | null, to: Date | null): DashboardData {
  if (!from || !to || data.trendData.length === 0) return data;
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const end = new Date(to); end.setHours(23, 59, 59, 999);
  const trendData = data.trendData.filter((point) => {
    const date = new Date(`${point.date}T12:00:00`);
    return date >= start && date <= end;
  });
  if (trendData.length === 0) return { ...data, trendData: [], mortalityData: [] };
  const sourceTrips = data.trendData.reduce((sum, point) => sum + point.trips, 0) || 1;
  const selectedTrips = trendData.reduce((sum, point) => sum + point.trips, 0);
  const factor = selectedTrips / sourceTrips;
  const scale = (value: number) => Math.round(value * factor);
  return {
    ...data,
    totalTrips: selectedTrips,
    totalSalesWeight: Math.round(data.totalSalesWeight * factor),
    totalSalesAmount: scale(data.totalSalesAmount),
    totalCollections: scale(data.totalCollections),
    pendingCollections: scale(data.pendingCollections),
    totalExpenses: scale(data.totalExpenses),
    fuelExpense: scale(data.fuelExpense),
    tripExpense: scale(data.tripExpense),
    trendData,
    mortalityData: data.mortalityData.filter((point) => trendData.some((item) => item.date === point.date)),
  };
}

const initialData: DashboardData = {
  totalTrips: 0,
  totalSalesWeight: 0,
  totalSalesAmount: 0,
  totalCollections: 0,
  pendingCollections: 0,
  totalExpenses: 0,
  fuelExpense: 0,
  tripExpense: 0,
  todaysTrips: 0,
  weeklyTrips: 0,
  monthlyTrips: 0,
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

/**
 * Operations Dashboard hook — KPIs from GET /api/operations/dashboard only.
 * Date-range args are retained for call-site compatibility; the API is the source of truth.
 */
export function useDashboardData(
  _fromDate: Date | null,
  _toDate: Date | null,
  _comparisonPeriod: "7d" | "15d" | "30d"
) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [previousData] = useState<DashboardData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dashboard = await loadOperationsDashboard();
      setData(filterForRange(dashboard, _fromDate, _toDate));
    } catch (err) {
      setError(handleApiError(err));
      setData(initialData);
    } finally {
      setIsLoading(false);
    }
  }, [_fromDate, _toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refetch = useCallback(() => {
    void loadData();
  }, [loadData]);

  return {
    data,
    previousData,
    isLoading,
    error,
    refetch,
  };
}
