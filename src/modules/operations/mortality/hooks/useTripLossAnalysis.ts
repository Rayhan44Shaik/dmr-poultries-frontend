// src/modules/operations/mortality/hooks/useTripLossAnalysis.ts
// MORTALITY & WEIGHT LOSS ANALYSIS — completed trips only.
//
// ARCHITECTURE
// ------------
// Every number on this page is produced by the backend
// (GET /api/operations/mortality-analysis). The frontend does NOT re-derive
// mortality %, weight loss, survival rate or any total: those live in SQL that
// is shared with Trip Entry / Shop Sales, so the page cannot drift from them.
//
// Filtering, sorting and pagination are all server-side. That removes the old
// N+1 (one detail request per trip, each inlining base64 DC photos) and means
// the page cost is one small request regardless of how many trips exist.
//
// FILTER MODEL
// ------------
//   DRAFT FILTERS (bound to controls): fromDate, toDate, sourceFarm, supervisor, search
//   APPLIED FILTERS (set only when user clicks Search): copy of draft filters at that moment
//
//   DEFAULT STATE (page load):
//     - Draft filters: all empty (no date, no farm, no supervisor, no search)
//     - Applied filters: all empty
//     - Table: shows ALL completed trips (no filter)
//     - KPI cards: HIDDEN
//     - Applied filters indicator: HIDDEN
//
//   AFTER SEARCH (user clicks Search):
//     - Applied filters := draft filters
//     - Table: shows trips matching applied filters (or all if no real filter)
//     - KPI cards: VISIBLE only if applied filters contain a real filter
//     - Applied filters indicator: VISIBLE only if applied filters contain a real filter
//     - Pagination: reset to page 1
//
//   RESET:
//     - Draft filters := empty defaults
//     - Applied filters := empty defaults
//     - KPI cards: HIDDEN
//     - Applied filters indicator: HIDDEN
//     - Table: shows ALL completed trips
//     - Pagination: reset to page 1
//     - Sort: reset to default
//
//   REFRESH:
//     - Re-fetches data preserving current applied filters and page

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatePickerUtils } from "../../../../components/common/DatePicker";
import {
  fetchMortalityAnalysis,
  fetchTripDeliveries,
  type MortalityDelivery,
  type MortalityFilterOptions,
  type MortalityKpis,
  type MortalityRow,
  type SortBy,
} from "../services/mortalityAnalysisApi";

const { startOfWeekMonday, endOfWeekSunday, toLocalISODate } = DatePickerUtils;

/** Row shape is the backend contract — re-exported so views stay decoupled. */
export type TripLossAnalysis = MortalityRow;
export type { MortalityDelivery as TripDelivery };

export interface LossFilters {
  fromDate: string;
  toDate: string;
  /** Farm NAME (the server filters on the name, matching the dropdown). */
  sourceFarm: string;
  /** Supervisor NAME. */
  supervisor: string;
  search: string;
}

export interface LossSort {
  key: SortBy;
  dir: "asc" | "desc";
}

export type LossKpis = MortalityKpis;

/** Current week, Monday-start — the project's Indian ERP week convention. */
export function currentWeekRange(): { fromDate: string; toDate: string } {
  const now = new Date();
  return {
    fromDate: toLocalISODate(startOfWeekMonday(now)),
    toDate: toLocalISODate(endOfWeekSunday(now)),
  };
}

/** Empty defaults — no automatic date filter, no farm, no supervisor, no search. */
export function defaultFilters(): LossFilters {
  return {
    fromDate: "",
    toDate: "",
    sourceFarm: "",
    supervisor: "",
    search: "",
  };
}

const DEFAULT_SORT: LossSort = { key: "tripDate", dir: "desc" };
export const DEFAULT_PAGE_SIZE = 10;

const EMPTY_OPTIONS: MortalityFilterOptions = { farms: [], supervisors: [] };

/**
 * A filter "counts" only when the user has set any non-empty filter value.
 * Empty strings / "All" selections do NOT make the KPI summary appear —
 * only a genuine filter does.
 */
function isRealFilter(f: LossFilters): boolean {
  const dateChanged = !!f.fromDate.trim() || !!f.toDate.trim();
  const farmChanged = !!f.sourceFarm.trim();
  const supervisorChanged = !!f.supervisor.trim();
  const searchChanged = !!f.search.trim();
  return dateChanged || farmChanged || supervisorChanged || searchChanged;
}

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "Unable to load mortality analysis";
}

export function useTripLossAnalysis() {
  const [response, setResponse] = useState<{
    data: MortalityRow[];
    total: number;
    totalPages: number;
    kpis: MortalityKpis;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Single filter state, bound directly to the controls. The TABLE always shows
   * every completed trip regardless, but this state is also what the user can
   * "apply" to the KPI summary (see `appliedFilters` below).
   */
  const [filters, setFilters] = useState<LossFilters>(defaultFilters);
  /**
   * The filter applied to the KPI summary. KPI cards appear only when a real
   * filter has been applied (handleApply), and they reflect exactly this subset.
   */
  const [appliedFilters, setAppliedFilters] = useState<LossFilters>(defaultFilters);
  /** KPI cards render only after the user applies a real filter. */
  const [kpisVisible, setKpisVisible] = useState(false);
  const [kpis, setKpis] = useState<MortalityKpis>({
    totalTrips: 0,
    farmBirds: 0,
    farmWeight: 0,
    deliveryShops: 0,
    deliveredBirds: 0,
    deliveredWeight: 0,
    mortalityCount: 0,
    mortalityWeight: 0,
    mortalityPercentage: 0,
    weightLoss: 0,
    weightLossPercentage: 0,
  });

  const [sort, setSort] = useState<LossSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  /** Dropdown values + "do any completed trips exist at all" — both unfiltered. */
  const [filterOptions, setFilterOptions] = useState<MortalityFilterOptions>(EMPTY_OPTIONS);
  const [hasTrips, setHasTrips] = useState(false);

  /** Bumped by Refresh / Retry to force a re-fetch of both queries. */
  const [reloadToken, setReloadToken] = useState(0);

  // Guards against a rejected/aborted older response overwriting a newer one.
  const requestIdRef = useRef(0);
  const kpiRequestIdRef = useRef(0);

  // ── TABLE query — shows all trips by default; filtered trips when a real
  // filter has been applied via Search. Uses appliedFilters (not draft filters).
  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    const tableFilterActive = isRealFilter(appliedFilters);

    // Debounce fast control changes; AbortController cancels any in-flight
    // request so only the final state ever lands (no out-of-order updates).
    const timer = setTimeout(() => {
      fetchMortalityAnalysis(
        {
          sortBy: sort.key,
          sortDir: sort.dir,
          page,
          limit: pageSize,
          ...(tableFilterActive
            ? {
                fromDate: appliedFilters.fromDate || undefined,
                toDate: appliedFilters.toDate || undefined,
                farm: appliedFilters.sourceFarm || undefined,
                supervisor: appliedFilters.supervisor || undefined,
                search: appliedFilters.search.trim() || undefined,
              }
            : {}),
        },
        controller.signal
      )
        .then((res) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setResponse({
            data: res.data,
            total: res.meta.total,
            totalPages: res.meta.totalPages,
            kpis: res.kpis,
          });
          setError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setError(messageOf(err));
        })
        .finally(() => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sort, page, pageSize, reloadToken, appliedFilters]);

  // ── KPI query — runs ONLY when a real filter is applied ───────────────────
  // Reflects the *applied* subset (date range and/or farm and/or supervisor and/or
  // search). The KPI cards appear once `kpisVisible` is true, which happens only
  // via applyFilters(). When nothing is applied the cards stay hidden and the
  // table above is the single source of truth.
  const filterActive = isRealFilter(appliedFilters);
  useEffect(() => {
    if (!filterActive) return; // no KPI cards until a filter is applied

    const controller = new AbortController();
    const kpiRequestId = ++kpiRequestIdRef.current;

    fetchMortalityAnalysis(
      {
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
        farm: appliedFilters.sourceFarm || undefined,
        supervisor: appliedFilters.supervisor || undefined,
        search: appliedFilters.search.trim() || undefined,
        // Page-size 1: we only need the aggregate `kpis`, not the rows.
        limit: 1,
      },
      controller.signal
    )
      .then((res) => {
        if (controller.signal.aborted || kpiRequestId !== kpiRequestIdRef.current) return;
        setKpis(res.kpis);
      })
      .catch(() => {
        // The table query already surfaces load errors; ignore KPI-only failures.
      });

    return () => controller.abort();
  }, [appliedFilters, filterActive, reloadToken]);

  // ── Unfiltered peek ───────────────────────────────────────────────────────
  // Supplies the dropdown options and tells us whether ANY completed trip
  // exists, which is what distinguishes "no trips at all" from "no trips match
  // your filters". `limit=1` keeps the payload tiny.
  useEffect(() => {
    const controller = new AbortController();

    fetchMortalityAnalysis({ limit: 1 }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setFilterOptions(res.filterOptions);
        setHasTrips(res.meta.total > 0);
      })
      .catch(() => {
        // Non-fatal: the table query surfaces its own error. Dropdowns may
        // simply be empty until a successful reload.
      });

    return () => controller.abort();
  }, [reloadToken]);

  const totalRecords = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 1;

  // Keep the page inside range whenever the result set shrinks (e.g. after a
  // narrowing search on a later page).
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  /** APPLY — commits the current controls to the KPI summary, filters the table,
   *  reveals the cards, and resets pagination to page 1. If no real filter is
   *  active the cards simply stay hidden and the table shows all trips. */
  const applyFilters = useCallback(() => {
    setAppliedFilters(filters);
    setKpisVisible(isRealFilter(filters));
    setPage(1);
  }, [filters]);

  /** RESET — clears all controls to empty defaults, hides the KPI summary,
   *  resets sort and pagination. */
  const resetFilters = useCallback(() => {
    const defaults = defaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setKpisVisible(false);
    setSort(DEFAULT_SORT);
    setPage(1);
  }, []);

  /** REFRESH — reload from the server, preserving the applied filter + page. */
  const refresh = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  return {
    loading,
    error,
    retry: refresh,
    refresh,
    /** Bumped by Refresh/Retry so sibling queries (charts) can reload too. */
    reloadToken,
    /** Filter state — bound to the controls. */
    filters,
    setFilters,
    /** The filter currently applied to the KPI summary. */
    appliedFilters,
    /** KPI cards appear only after a real filter is applied. */
    kpisVisible,
    applyFilters,
    resetFilters,
    sort,
    setSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalRecords,
    records: response?.data ?? [],
    kpis,
    farmOptions: filterOptions.farms,
    supervisorOptions: filterOptions.supervisors,
    /** Completed trips exist at all (used to choose the right empty state). */
    hasTrips,
  };
}

/**
 * Shop-level deliveries for ONE expanded row.
 *
 * Fetched lazily, only while a row is expanded: the table itself needs just the
 * shop COUNT, which already ships with every row. This is what keeps the page
 * to a single small request on load.
 */
export function useTripDeliveries(tripId: number | null) {
  const [deliveries, setDeliveries] = useState<MortalityDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tripId == null) {
      setDeliveries([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchTripDeliveries(tripId, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setDeliveries(rows);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setDeliveries([]);
        setError(messageOf(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [tripId]);

  return { deliveries, loading, error };
}
