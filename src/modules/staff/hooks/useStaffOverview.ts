// src/modules/staff/hooks/useStaffOverview.ts
// Hook that wraps the staff overview loader with caching, dedupe and refresh.
// Mirrors the executive dashboard hook but staff-scoped: one load on mount
// probes the quarter sample API and merges live backend data.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStaffOverview, type StaffOverviewData } from "../services/staffOverviewService";

interface StaffOverviewState {
  data: StaffOverviewData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastRefreshed: string | null;
}

const CACHE_TTL = 45_000;
let cached: { value: StaffOverviewData; expiresAt: number } | null = null;
let inflight: Promise<StaffOverviewData> | null = null;

function sharedLoad(): Promise<StaffOverviewData> {
  if (cached && Date.now() <= cached.expiresAt) return Promise.resolve(cached.value);
  if (inflight) return inflight;
  inflight = loadStaffOverview()
    .then((value) => {
      cached = { value, expiresAt: Date.now() + CACHE_TTL };
      return value;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useStaffOverview(): StaffOverviewState {
  const [data, setData] = useState<StaffOverviewData | null>(cached?.value ?? null);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(cached ? new Date().toISOString() : null);
  const genRef = useRef(0);

  const load = useCallback(async (isRefresh: boolean) => {
    const gen = ++genRef.current;
    if (isRefresh) setRefreshing(true);
    else if (!cached) setLoading(true);
    setError(null);
    try {
      const value = await sharedLoad();
      if (gen !== genRef.current) return;
      setData(value);
      setLastRefreshed(new Date().toISOString());
    } catch (cause) {
      if (gen !== genRef.current) return;
      setError(cause instanceof Error ? cause.message : "Unable to load staff overview");
    } finally {
      if (gen !== genRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refetch = useCallback(async () => {
    cached = null;
    await load(true);
  }, [load]);

  const state = useMemo(
    () => ({ data, loading, refreshing, error, refetch, lastRefreshed }),
    [data, loading, refreshing, error, refetch, lastRefreshed],
  );

  return state;
}

export function clearStaffOverviewCache(): void {
  cached = null;
  inflight = null;
}
