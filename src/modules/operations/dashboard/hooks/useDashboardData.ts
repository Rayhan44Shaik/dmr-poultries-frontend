// src/modules/operations/dashboard/hooks/useDashboardData.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
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
  sampleQuarter: null,
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
  /* The comparison window: the equal-length stretch immediately BEFORE the one
     on screen. This is what every KPI on the page is measured against. */
  const [previousData, setPreviousData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the very first load shows the full-page spinner; later range changes
  // keep the previous dashboard on screen while the new window aggregates.
  const hasLoadedRef = useRef(false);
  const requestRef = useRef(0);

  const previousWindow = useMemo(() => {
    if (!_fromDate || !_toDate) return null;
    const start = new Date(_fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(_toDate);
    end.setHours(0, 0, 0, 0);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days <= 0) return null;
    return { from: addDays(start, -days), to: addDays(start, -1), days };
  }, [_fromDate, _toDate]);

  const loadData = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!hasLoadedRef.current) setIsLoading(true);
    setError(null);
    try {
      const dashboard = await loadOperationsDashboard(_fromDate, _toDate);
      if (requestId !== requestRef.current) return;
      // The dev demo is already aggregated for the exact [from,to] window;
      // real API payloads are trimmed/scaled client-side to match the range.
      const scoped = import.meta.env.DEV
        ? dashboard
        : filterForRange(dashboard, _fromDate, _toDate);
      setData(scoped);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(handleApiError(err));
      setData(initialData);
    } finally {
      if (requestId === requestRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }

    // The baseline is a separate request for the window just before this one,
    // so the two never race: a late answer is dropped on the floor.
    if (!previousWindow) {
      setPreviousData(null);
      return;
    }
    try {
      const baseline = await loadOperationsDashboard(previousWindow.from, previousWindow.to);
      if (requestId !== requestRef.current) return;
      setPreviousData(
        import.meta.env.DEV
          ? baseline
          : filterForRange(baseline, previousWindow.from, previousWindow.to)
      );
    } catch {
      if (requestId !== requestRef.current) return;
      setPreviousData(null);
    }
  }, [_fromDate, _toDate, previousWindow]);

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
