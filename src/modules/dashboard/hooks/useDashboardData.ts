// src/modules/dashboard/hooks/useDashboardData.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "date-fns";
import {
  handleApiError,
  loadOperationsDashboard,
  type DashboardData,
} from "../services/dashboardService";
import { fetchTrendBirds } from "../services/operationalTrends";

export type { DashboardData };

function filterForRange(
  data: DashboardData,
  from: Date | null,
  to: Date | null,
): DashboardData {
  if (!from || !to || data.trendData.length === 0) return data;
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const trendData = data.trendData.filter((point) => {
    const date = new Date(`${point.date}T12:00:00`);
    return date >= start && date <= end;
  });
  if (trendData.length === 0)
    return { ...data, trendData: [], mortalityData: [] };
  const sourceTrips =
    data.trendData.reduce((sum, point) => sum + point.trips, 0) || 1;
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
    mortalityData: data.mortalityData.filter((point) =>
      trendData.some((item) => item.date === point.date),
    ),
  };
}

const toBusinessDateLocal = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

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
  collectionPerformanceByShop: [],
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
  _comparisonPeriod: "7d" | "15d" | "30d",
  /** Gate the first load: callers that need to pin the analysis window first
   *  (e.g. waiting on the sample quarter's business date) hold this false so
   *  the dashboard loads ONCE with the final dates instead of loading a
   *  browser-clock window and immediately throwing it away. */
  _ready = true,
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
    const fromDate = _fromDate ?? new Date();
    const toDate = _toDate ?? new Date();
    if (!hasLoadedRef.current) setIsLoading(true);
    setError((current) => (current === null ? current : null));
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

    /* Birds are not in the dashboard payload — they come from the completed-trip
       aggregates, one tiny request per window (the totals cover the whole
       filtered set, so a single row is enough). */
    const withBirds = async (window: {
      from: Date;
      to: Date;
    }): Promise<Pick<DashboardData, "totalBirds"> | null> => {
      try {
        const birds = await fetchTrendBirds({
          fromDate: toBusinessDateLocal(window.from),
          toDate: toBusinessDateLocal(window.to),
        });
        return { totalBirds: birds.farmBirds };
      } catch {
        return null;
      }
    };

    const currentBirds = await withBirds({ from: fromDate, to: toDate });
    if (requestId !== requestRef.current) return;
    if (currentBirds) setData((current) => ({ ...current, ...currentBirds }));

    // The baseline is a separate request for the window just before this one,
    // so the two never race: a late answer is dropped on the floor.
    if (!previousWindow) {
      setPreviousData(null);
      return;
    }
    try {
      const [baseline, baselineBirds] = await Promise.all([
        // The comparison window feeds only KPI deltas — it never renders the
        // span rosters, so skip the trip-list pulls (no background duplication).
        loadOperationsDashboard(previousWindow.from, previousWindow.to, {
          withSpanFleet: false,
        }),
        withBirds(previousWindow),
      ]);
      if (requestId !== requestRef.current) return;
      setPreviousData({
        ...(import.meta.env.DEV
          ? baseline
          : filterForRange(baseline, previousWindow.from, previousWindow.to)),
        ...baselineBirds,
      });
    } catch {
      if (requestId !== requestRef.current) return;
      setPreviousData(null);
    }
  }, [_fromDate, _toDate, previousWindow]);

  useEffect(() => {
    if (!_ready) return;
    // Kick the load from a task, not the effect body: the effect itself never
    // writes state, and a range change that is undone within the same frame
    // never fires a wasted request.
    const handle = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(handle);
  }, [loadData, _ready]);

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
