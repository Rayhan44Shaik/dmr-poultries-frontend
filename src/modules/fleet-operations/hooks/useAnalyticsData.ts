import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { getQuarterSampleRange } from '../../../sample/quarterSample';
import { useFleetVehicles } from './useFleetVehicles';
import { handleApiError, isCanceledError } from '../../../api/errors';
import analyticsApi from '../services/analyticsApi';
import { fleetCacheGet, fleetCacheInvalidate, fleetSharedGet } from '../services/fleetSessionCache';
import type {
  AnalyticsCostCenter,
  AnalyticsHighestExpense,
  AnalyticsKpis,
  AnalyticsTopPerformer,
  AnalyticsVehicleStat,
  AnalyticsWeeklyPoint,
  FleetAnalyticsResponse,
} from '../types/analytics';

const dateString = (date: Date) => format(date, 'yyyy-MM-dd');

const getCurrentWeekRange = () => {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  return { start, end };
};

type AnalyticsView = {
  kpis: AnalyticsKpis;
  weekly: AnalyticsWeeklyPoint[];
  costCenters: AnalyticsCostCenter[];
  topPerformers: AnalyticsTopPerformer[];
  highestExpense: AnalyticsHighestExpense[];
  vehicleStats: AnalyticsVehicleStat[];
};

const EMPTY: AnalyticsView = {
  kpis: {
    totalTrips: 0,
    totalDistance: 0,
    averageMileage: 0,
    totalFuelLitres: 0,
    fuelCost: 0,
    maintenanceCost: 0,
    emiDue: 0,
    tollCost: 0,
    otherCost: 0,
    totalExpense: 0,
    costPerKm: 0,
  },
  weekly: [],
  costCenters: [],
  topPerformers: [],
  highestExpense: [],
  vehicleStats: [],
};

function filterKey(fromDate: string, toDate: string, vehicleId: number | null) {
  return `analytics:${fromDate}|${toDate}|${vehicleId ?? ''}`;
}

function toView(payload: FleetAnalyticsResponse): AnalyticsView {
  const weeklyMileage = payload.weeklyMileage ?? [];
  const expenses = payload.highestExpense ?? [];
  const performers = payload.topPerformers ?? [];
  const expenseByVehicle = new Map(expenses.map((row) => [row.vehicleId, row]));
  // The backend already ships the full per-vehicle rollup (every vehicle, with
  // its trip count and EMI share for the selected range). Render it as-is —
  // rebuilding the table from the top-5 list dropped 19 vehicles and showed
  // 0 trips / 0 EMI for the rows that remained. Payloads without the rollup
  // keep working through the top-5 fallback.
  const vehicleStats = payload.vehicleStats?.length
    ? payload.vehicleStats.map((row) => ({ ...row }))
    : performers.map((row) => {
        const expense = expenseByVehicle.get(row.vehicleId);
        return {
          vehicleId: row.vehicleId,
          vehicleNumber: row.vehicleNumber,
          trips: row.trips ?? 0,
          distance: row.distance,
          fuelLitres: row.fuelLitres,
          fuelCost: expense?.fuelCost ?? 0,
          maintenanceCost: expense?.maintenanceCost ?? 0,
          emiCost: expense?.emiCost ?? 0,
          tollCost: expense?.tollCost ?? 0,
          otherCost: expense?.otherCost ?? 0,
          totalExpense: expense?.totalExpense ?? 0,
          mileage: row.mileage,
        };
      });
  return {
    kpis: {
      ...EMPTY.kpis,
      ...payload.kpis,
    },
    weekly: weeklyMileage.map((row) => ({
      week: row.week,
      weekLabel: row.weekLabel,
      fuel: row.litres,
      distance: row.distance,
      mileage: row.mileage,
    })),
    costCenters: payload.costCenters ?? [],
    // Vehicle-level figures come straight from the payload (trips / trips cost /
    // EMI share included) — never zeroed out at the mapping layer.
    topPerformers: performers.map((row) => ({ ...row })),
    highestExpense: expenses.map((row) => ({ ...row })),
    vehicleStats,
  };
}

export function useAnalyticsData(active = true) {
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
  const [fromDate, setFromDateState] = useState(() => dateString(weekStart));
  const [toDate, setToDateState] = useState(() => dateString(weekEnd));
  const [selectedVehicleId, setSelectedVehicleIdState] = useState<number | null>(null);
  const [sampleRange, setSampleRange] = useState<{ fromDate: string; toDate: string; today: string } | null>(null);
  const [rangeReady, setRangeReady] = useState(false);
  const dateEdited = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getQuarterSampleRange().then((range) => {
      if (cancelled) return;
      setSampleRange(range);
      if (range && !dateEdited.current) {
        setFromDateState(range.fromDate);
        setToDateState(range.toDate);
      }
      setRangeReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const initialKey = filterKey(fromDate, toDate, selectedVehicleId);
  const cached = fleetCacheGet<FleetAnalyticsResponse>(initialKey);

  const [data, setData] = useState<AnalyticsView>(cached ? toView(cached) : EMPTY);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(cached ? new Date().toISOString() : null);

  const loadGen = useRef(0);
  const mounted = useRef(true);
  const hasData = useRef(Boolean(cached));
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setFromDate = useCallback((value: string) => {
    if (!value) return;
    dateEdited.current = true;
    setFromDateState((current) => (current === value ? current : value));
    setToDateState((currentTo) => (value > currentTo ? value : currentTo));
  }, []);

  const setToDate = useCallback((value: string) => {
    if (!value) return;
    dateEdited.current = true;
    setToDateState((current) => (current === value ? current : value));
    setFromDateState((currentFrom) => (value < currentFrom ? value : currentFrom));
  }, []);

  const setSelectedVehicleId = useCallback((value: number | null) => {
    setSelectedVehicleIdState((current) => (current === value ? current : value));
  }, []);

  const clearFilters = useCallback(() => {
    const { start, end } = getCurrentWeekRange();
    setSelectedVehicleIdState(null);
    dateEdited.current = true;
    setFromDateState(sampleRange?.fromDate ?? dateString(start));
    setToDateState(sampleRange?.toDate ?? dateString(end));
  }, [sampleRange]);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    fleetCacheInvalidate('analytics:');
    setRefreshNonce((n) => n + 1);
    setRefreshTrigger((t) => t + 1);
  }, []);

  // Tabs stay mounted. Re-entering Analytics must re-read server rollups after
  // maintenance / EMI edits rather than display the previous tab's snapshot.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) refresh();
    wasActive.current = active;
  }, [active, refresh]);

  useEffect(() => {
    if (!rangeReady || !active) return;
    const key = filterKey(fromDate, toDate, selectedVehicleId);
    const hit = refreshNonce === 0 ? fleetCacheGet<FleetAnalyticsResponse>(key) : undefined;
    if (hit) {
      const snapshot = hit;
      void Promise.resolve().then(() => {
        if (!mounted.current) return;
        setData(toView(snapshot));
        setError(null);
        setLoading(false);
        setRefreshing(false);
        hasData.current = true;
      });
      return;
    }

    const gen = ++loadGen.current;
    inFlight.current = true;
    void Promise.resolve().then(() => {
      if (!mounted.current || gen !== loadGen.current) return;
      setError(null);
      if (hasData.current) setRefreshing(true);
      else setLoading(true);
    });

    void fleetSharedGet(key, () =>
      analyticsApi.get({ fromDate, toDate, vehicleId: selectedVehicleId })
    )
      .then((payload) => {
        if (!mounted.current || gen !== loadGen.current) return;
        hasData.current = true;
        setData(toView(payload));
        setLastRefreshed(new Date().toISOString());
        setError(null);
      })
      .catch((cause) => {
        if (!mounted.current || isCanceledError(cause) || gen !== loadGen.current) return;
        if (!hasData.current) setData(EMPTY);
        setError(handleApiError(cause));
      })
      .finally(() => {
        if (!mounted.current || gen !== loadGen.current) return;
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      loadGen.current = gen + 1;
      inFlight.current = false;
    };
  }, [fromDate, toDate, selectedVehicleId, refreshNonce, rangeReady, active]);

  const kpis = data.kpis;
  const stats = useMemo(
    () => ({
      totalTrips: kpis.totalTrips,
      totalDistance: kpis.totalDistance,
      totalFuelLitres: kpis.totalFuelLitres,
      fuelCost: kpis.fuelCost,
      maintenanceCost: kpis.maintenanceCost,
      emiDue: kpis.emiDue,
      tollCost: kpis.tollCost,
      otherCost: kpis.otherCost,
      totalExpense: kpis.totalExpense,
      averageMileage: kpis.averageMileage,
      costPerKm: kpis.costPerKm,
    }),
    [kpis]
  );

  const vehicleOptions = useMemo(
    () =>
      (vehicles || []).map((vehicle) => ({
        value: vehicle.id,
        label: vehicle.vehicleNumber || String(vehicle.vehicleNo),
      })),
    [vehicles]
  );

  const vehicleStatusById = useMemo(() => {
    const map = new Map<number, string>();
    (vehicles || []).forEach((vehicle) => {
      map.set(Number(vehicle.id), vehicle.status || 'Active');
    });
    return map;
  }, [vehicles]);

  return {
    stats,
    sampleRange,
    weeklyData: data.weekly,
    expenseBreakdown: data.costCenters,
    topPerformers: data.topPerformers,
    highestExpense: data.highestExpense,
    vehicleStats: data.vehicleStats,
    vehicleStatusById,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    selectedVehicleId,
    setSelectedVehicleId,
    vehicleOptions,
    vehiclesLoading,
    clearFilters,
    loading,
    refreshing,
    error,
    refresh,
    lastRefreshed,
    refreshTrigger,
  };
}
