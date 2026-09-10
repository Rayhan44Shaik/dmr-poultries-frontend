// src/modules/staff/hooks/useStaffPerformance.ts
//
// ============================================================================
// READ-ONLY DRIVER / SUPERVISOR PERFORMANCE HOOK
// ============================================================================
// One controlled list GET per APPLIED filter change — never per keystroke.
// The page owns DRAFT filter state (dates / driver / search text); nothing is
// sent to the API until the user presses Search (or Clear). Concurrency rules:
//
//   • EXPLICIT APPLY   `applyFilters()` is the only way to change the query.
//     Applying identical filters is a no-op, so double clicks / Enter+click
//     cannot duplicate a request.
//   • IN-FLIGHT DEDUPE + 60s TTL CACHE — identical queries share one request
//     (StrictMode double-mount safe) and repeated views are served from cache.
//   • STALE-RESPONSE GUARD — every load carries a generation number; a slow
//     response from an older generation can never overwrite newer data.
//   • SINGLE-FLIGHT REFRESH — `refresh()` is a no-op while a request is in
//     flight; it invalidates the cache and re-requests the applied filters.
//     The previous dataset stays on screen (`refreshing`, not `loading`).
//   • ROW SELECTION is pure UI state: it never reaches the query and never
//     triggers a request.
//
// Default period: the last four Monday→Saturday reporting weeks up to today
// (~one month), computed by `utils/performancePeriods` — never hard-coded.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { handleApiError, isCanceledError } from "../../../api/errors";
import {
  toBusinessDate,
  parseBusinessDate,
} from "../../../utils/businessDate";
import {
  defaultPerformancePeriod,
} from "../utils/performancePeriods";
import { getDriverPerformance, getSupervisorPerformance } from "../services/performanceService";
import type {
  DriverPerformanceResponse,
  StaffPerformanceKind,
  SupervisorPerformanceResponse,
} from "../types/performance";

/** Filters that actually reach the API — only via `applyFilters`. */
export interface PerformanceAppliedFilters {
  fromDate: string;
  toDate: string;
  /** Driver id / supervisor id filter (`null` = everyone). */
  personId: number | null;
  /** Free-text search (driver/supervisor name). */
  search: string;
}

type PerformanceResponse = DriverPerformanceResponse | SupervisorPerformanceResponse;

const EMPTY_DRIVER: DriverPerformanceResponse = {
  fromDate: "",
  toDate: "",
  kpis: {
    drivers: 0, trips: 0, distance: 0, avgDistancePerTrip: 0, fuelLitres: 0,
    fuelCost: 0, maintenanceCost: 0, tollCost: 0, otherCost: 0, totalCost: 0,
    costPerKm: 0, mileage: 0,
  },
  weekly: [],
  rows: [],
  detail: null,
};

const EMPTY_SUPERVISOR: SupervisorPerformanceResponse = {
  fromDate: "",
  toDate: "",
  kpis: {
    supervisors: 0, trips: 0, shops: 0, birds: 0, weight: 0,
    mortality: 0, mortalityRate: 0, weightLoss: 0,
  },
  weekly: [],
  rows: [],
  detail: null,
};

const emptyFor = (kind: StaffPerformanceKind): PerformanceResponse =>
  kind === "drivers" ? EMPTY_DRIVER : EMPTY_SUPERVISOR;

/* --------------------------------------------------------------------------
 * Session cache + in-flight dedupe (module-level, survives route switches)
 * ------------------------------------------------------------------------ */

const TTL_MS = 60_000;
const cacheStore = new Map<string, { value: PerformanceResponse; expiresAt: number }>();
const inflightStore = new Map<string, Promise<PerformanceResponse>>();

function cacheGet(key: string): PerformanceResponse | undefined {
  const entry = cacheStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheInvalidate(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
}

function sharedGet(key: string, loader: () => Promise<PerformanceResponse>): Promise<PerformanceResponse> {
  const existing = inflightStore.get(key);
  if (existing) return existing;
  const pending = loader()
    .then((value) => {
      cacheStore.set(key, { value, expiresAt: Date.now() + TTL_MS });
      return value;
    })
    .finally(() => {
      inflightStore.delete(key);
    });
  inflightStore.set(key, pending);
  return pending;
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

/** Keep only well-formed business dates; anything else falls back to defaults. */
function sanitizeRange(
  fromDate: string,
  toDate: string,
  fallback: PerformanceAppliedFilters,
): { fromDate: string; toDate: string } {
  const from = parseBusinessDate(fromDate);
  const to = parseBusinessDate(toDate);
  if (!from && !to) return { fromDate: fallback.fromDate, toDate: fallback.toDate };
  if (!from) return { fromDate: fallback.fromDate, toDate: to ? toBusinessDate(to) : fallback.toDate };
  if (!to) return { fromDate: toBusinessDate(from), toDate: fallback.toDate };
  // Enforce from ≤ to without silently discarding user input.
  return from.getTime() <= to.getTime()
    ? { fromDate: toBusinessDate(from), toDate: toBusinessDate(to) }
    : { fromDate: toBusinessDate(to), toDate: toBusinessDate(from) };
}

function filtersEqual(a: PerformanceAppliedFilters, b: PerformanceAppliedFilters): boolean {
  return (
    a.fromDate === b.fromDate &&
    a.toDate === b.toDate &&
    (a.personId ?? null) === (b.personId ?? null) &&
    a.search.trim() === b.search.trim()
  );
}

/** Public result, typed per page: `useStaffPerformance('drivers')` returns the
 *  driver response shape (no casts at the call sites). */
export interface UseStaffPerformanceResult<K extends StaffPerformanceKind> {
  /** Applied filters currently reflected by `data`. */
  filters: PerformanceAppliedFilters;
  /** Restore-to-defaults snapshot (initial period). */
  defaultFilters: PerformanceAppliedFilters;
  data: K extends "drivers" ? DriverPerformanceResponse : SupervisorPerformanceResponse;
  selectedId: number | null;
  selectRow: (id: number | null) => void;
  applyFilters: (next: PerformanceAppliedFilters) => void;
  clearFilters: () => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  lastRefreshed: string | null;
}

/** Default (initial + Clear) filters, snapshotted once per mount. */
function buildDefaultFilters(): PerformanceAppliedFilters {
  const period = defaultPerformancePeriod(4, new Date());
  return { fromDate: period.fromDate, toDate: period.toDate, personId: null, search: "" };
}

export function useStaffPerformance<K extends StaffPerformanceKind>(
  kind: K,
): UseStaffPerformanceResult<K> {
  return useStaffPerformanceImpl(kind) as UseStaffPerformanceResult<K>;
}

function useStaffPerformanceImpl(kind: StaffPerformanceKind) {
  // Default period snapshot: Clear restores exactly what the page loaded with,
  // even across midnight, and the initial load is computed only once.
  const [defaultFilters] = useState<PerformanceAppliedFilters>(buildDefaultFilters);
  const [filters, setFilters] = useState<PerformanceAppliedFilters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const initialKey = useMemo(
    () =>
      `staff-perf:${kind}:${filters.fromDate}|${filters.toDate}|${filters.search.trim()}|`,
    // Initial cache lookup only — filters are the source from here on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind],
  );
  const initialCached = refreshNonce === 0 ? cacheGet(initialKey) : undefined;

  const [data, setData] = useState<PerformanceResponse>(initialCached ?? emptyFor(kind));
  const [loading, setLoading] = useState(!initialCached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(
    initialCached ? new Date().toISOString() : null,
  );

  const loadGen = useRef(0);
  const mounted = useRef(true);
  const hasData = useRef(Boolean(initialCached));
  const inFlight = useRef(false);
  const appliedRef = useRef<PerformanceAppliedFilters>(filters);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Apply a complete filter set as ONE query. Identical applied filters are
   * ignored, so an accidental double Search (click + form submit) can never
   * issue a second request. Dates are sanitized/ordered defensively.
   */
  const applyFilters = useCallback(
    (next: PerformanceAppliedFilters) => {
      const range = sanitizeRange(next.fromDate, next.toDate, appliedRef.current);
      const candidate: PerformanceAppliedFilters = {
        fromDate: range.fromDate,
        toDate: range.toDate,
        personId: next.personId ?? null,
        search: next.search.trim(),
      };
      if (filtersEqual(appliedRef.current, candidate)) return;
      appliedRef.current = candidate;
      // Flags are set here (event handler), not in the fetch effect, so the
      // effect body itself never calls setState synchronously.
      if (hasData.current) setRefreshing(true);
      else setLoading(true);
      setFilters(candidate);
    },
    [],
  );

  /** Clear → default period, no driver, no search, and re-apply in one go. */
  const clearFilters = useCallback(() => {
    const restored: PerformanceAppliedFilters = { ...defaultFilters };
    if (filtersEqual(appliedRef.current, restored)) {
      // Already at defaults: still drop transient selection, no new request.
      setSelectedId(null);
      return;
    }
    appliedRef.current = restored;
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    setFilters(restored);
    setSelectedId(null);
  }, [defaultFilters]);

  /** Row selection for the drawer — pure UI state, never a query input. */
  const selectRow = useCallback((id: number | null) => {
    setSelectedId((current) => (current === id ? current : id));
  }, []);

  /** Single-flight refresh: invalidate cache, then re-request current filters. */
  const refresh = useCallback(() => {
    if (inFlight.current) return;
    cacheInvalidate("staff-perf:");
    // Set here (event handler) — the effect never sets state synchronously.
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    setRefreshNonce((nonce) => nonce + 1);
  }, []);

  const cacheKey = `staff-perf:${kind}:${filters.fromDate}|${filters.toDate}|${filters.search}|${filters.personId ?? ""}`;

  useEffect(() => {
    const hit = refreshNonce === 0 ? cacheGet(cacheKey) : undefined;
    if (hit) {
      const snapshot = hit;
      void Promise.resolve().then(() => {
        if (!mounted.current) return;
        setData(snapshot);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        hasData.current = true;
      });
      return;
    }

    const gen = ++loadGen.current;
    inFlight.current = true;

    void sharedGet(cacheKey, () =>
      kind === "drivers"
        ? getDriverPerformance({
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            search: filters.search || undefined,
            driverId: filters.personId,
          })
        : getSupervisorPerformance({
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            search: filters.search || undefined,
            supervisorId: filters.personId,
          })
    )
      .then((payload) => {
        if (!mounted.current || gen !== loadGen.current) return; // stale response — discard
        hasData.current = true;
        setData(payload);
        setLastRefreshed(new Date().toISOString());
        setError(null);
      })
      .catch((cause) => {
        if (!mounted.current || isCanceledError(cause) || gen !== loadGen.current) return;
        if (!hasData.current) setData(emptyFor(kind));
        setError(handleApiError(cause));
      })
      .finally(() => {
        if (!mounted.current || gen !== loadGen.current) return;
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      });
  }, [cacheKey, filters, refreshNonce, kind]);

  return {
    /** Applied filters currently reflected by `data`. */
    filters,
    /** Restore-to-defaults snapshot (initial period). */
    defaultFilters,
    data,
    selectedId,
    selectRow,
    applyFilters,
    clearFilters,
    loading,
    refreshing,
    error,
    refresh,
    lastRefreshed,
  };
}
