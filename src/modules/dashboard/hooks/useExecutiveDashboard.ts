// src/modules/dashboard/hooks/useExecutiveDashboard.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  clearDemoData,
  loadDashboardData,
  seedDemoData,
  type DashboardData,
} from "../services/dashboardService";
import { deriveDashboard, type DerivedDashboard } from "../utils/dashboardDerive";
import { useI18n } from "../../../i18n";
import { PeriodId } from "../components/DashboardFilters";

interface ExecutiveDashboardState {
  data: DashboardData | null;
  derived: DerivedDashboard | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadDemo: () => Promise<void>;
  clearDemo: () => Promise<void>;
  demoBusy: boolean;
  period: PeriodId;
  setPeriod: (period: PeriodId) => void;
  comparePrevious: boolean;
  setComparePrevious: (val: boolean) => void;
  customStart: string;
  setCustomStart: (val: string) => void;
  customEnd: string;
  setCustomEnd: (val: string) => void;
}

export function useExecutiveDashboard(): ExecutiveDashboardState {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const [period, setPeriodState] = useState<PeriodId>(() => (searchParams.get('period') as PeriodId) || 'week');
  const [comparePrevious, setComparePreviousState] = useState(() => searchParams.get('compare') === 'true');
  const [customStart, setCustomStartState] = useState(() => searchParams.get('start') || '');
  const [customEnd, setCustomEndState] = useState(() => searchParams.get('end') || '');

  const setPeriod = useCallback((val: PeriodId) => {
    setPeriodState(val);
    setSearchParams(p => { p.set('period', val); return p; });
  }, [setSearchParams]);
  const setComparePrevious = useCallback((val: boolean) => {
    setComparePreviousState(val);
    setSearchParams(p => { p.set('compare', val ? 'true' : 'false'); return p; });
  }, [setSearchParams]);
  const setCustomStart = useCallback((val: string) => {
    setCustomStartState(val);
    setSearchParams(p => { p.set('start', val); return p; });
  }, [setSearchParams]);
  const setCustomEnd = useCallback((val: string) => {
    setCustomEndState(val);
    setSearchParams(p => { p.set('end', val); return p; });
  }, [setSearchParams]);

  // Initial load — runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadDashboardData();
        if (!cancelled) setData(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Manual refresh (event handlers only).
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadDashboardData();
      setData(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    return deriveDashboard(data, t, {
      period,
      comparePrevious,
      customStart,
      customEnd
    });
  }, [data, t, period, comparePrevious, customStart, customEnd]);

  const loadDemo = useCallback(async () => {
    setDemoBusy(true);
    try {
      seedDemoData();
      await refetch();
    } finally {
      setDemoBusy(false);
    }
  }, [refetch]);

  const clearDemo = useCallback(async () => {
    setDemoBusy(true);
    try {
      clearDemoData();
      await refetch();
    } finally {
      setDemoBusy(false);
    }
  }, [refetch]);

  return {
    data,
    derived,
    loading,
    error,
    refetch,
    loadDemo,
    clearDemo,
    demoBusy,
    period,
    setPeriod,
    comparePrevious,
    setComparePrevious,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd
  };
}
