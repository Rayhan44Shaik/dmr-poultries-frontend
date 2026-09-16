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
//     - Cumulative summary: HIDDEN
//     - Applied filters indicator: HIDDEN
//
//   AFTER SEARCH (user clicks Search):
//     - Applied filters := draft filters
//     - Table: shows trips matching applied filters (or all if no real filter)
//     - Cumulative summary: VISIBLE only if applied filters contain a real filter
//     - Applied filters indicator: VISIBLE only if applied filters contain a real filter
//     - Pagination: reset to page 1
//
//   RESET:
//     - Draft filters := empty defaults
//     - Applied filters := empty defaults
//     - Cumulative summary: HIDDEN
//     - Applied filters indicator: HIDDEN
//     - Table: shows ALL completed trips
//     - Pagination: reset to page 1
//     - Sort: reset to default
//
//   REFRESH:
//     - Re-fetches data preserving current applied filters and page

import { useCallback, useEffect, useRef, useState } from "react";
import { DatePickerUtils } from "../../../../components/common/DatePicker";
import {
  fetchMortalityAnalysis,
  type MortalityFilterOptions,
  type MortalityKpis,
  type MortalityRow,
  type SortBy,
} from "../services/mortalityAnalysisApi";

const { startOfWeekMonday, endOfWeekSunday, toLocalISODate } = DatePickerUtils;

/** Row shape is the backend contract — re-exported so views stay decoupled. */
export type TripLossAnalysis = MortalityRow;

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
 * Empty strings / "All" selections do NOT make the cumulative summary appear —
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
   * "apply" to the cumulative summary (see `appliedFilters` below).
   */
  const [filters, setFilters] = useState<LossFilters>(defaultFilters);
  /**
   * The filter applied to the cumulative summary. It appears only when a real
   * filter has been applied (handleApply), and they reflect exactly this subset.
   */
  const [appliedFilters, setAppliedFilters] = useState<LossFilters>(defaultFilters);
  /** The cumulative summary renders only after the user applies a real filter. */
  const [summaryVisible, setSummaryVisible] = useState(false);
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
  /**
   * Callers waiting on `refresh()`. The table query settles in an effect, so
   * Refresh cannot be a fire-and-forget spinner: the BrandRefreshButton keeps
   * its hen dancing and its toast honest only if the returned promise resolves
   * when the reload has actually finished. Each resolver is settled from the
   * query's own `finally`, so it inherits the abort/stale guards.
   */
  const refreshResolversRef = useRef<Array<() => void>>([]);
  const settleRefresh = useCallback(() => {
    const pending = refreshResolversRef.current;
    refreshResolversRef.current = [];
    for (const resolve of pending) resolve();
  }, []);

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
          // Release anyone awaiting refresh() only after this query — the last
          // one to run — has fully settled.
          settleRefresh();
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
      // A superseded request must never leave a Refresh spinner hanging: the
      // replacement query settles and resolves the same waiters.
    };
  }, [sort, page, pageSize, reloadToken, appliedFilters, settleRefresh]);

  // ── Cumulative query — runs ONLY when a real filter is applied ───────────
  // Reflects the *applied* subset (date range and/or farm and/or supervisor and/or
  // search). The cumulative summary appears once `summaryVisible` is true, which happens only
  // via applyFilters(). When nothing is applied the cards stay hidden and the
  // table above is the single source of truth.
  const filterActive = isRealFilter(appliedFilters);
  useEffect(() => {
    if (!filterActive) return; // no cumulative summary until a filter is applied

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
        // The table query already surfaces load errors; ignore total-only failures.
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

  /** APPLY — commits the current controls to the cumulative summary, filters the table,
   *  reveals the cards, and resets pagination to page 1. If no real filter is
   *  active the cards simply stay hidden and the table shows all trips. */
  const applyFilters = useCallback(() => {
    setAppliedFilters(filters);
    setSummaryVisible(isRealFilter(filters));
    setPage(1);
  }, [filters]);

  /** RESET — clears all controls to empty defaults, hides the cumulative summary,
   *  resets sort and pagination. */
  const resetFilters = useCallback(() => {
    const defaults = defaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setSummaryVisible(false);
    setSort(DEFAULT_SORT);
    setPage(1);
  }, []);

  /** REFRESH — reload from the server, preserving the applied filter + page.
   *  Resolves once the reload has settled, so callers can bind a real spinner
   *  (and a success/failure toast) to it instead of guessing a delay. */
  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        refreshResolversRef.current.push(resolve);
        setReloadToken((t) => t + 1);
      }),
    []
  );

  return {
    loading,
    error,
    retry: refresh,
    refresh,
    /** Filter state — bound to the controls. */
    filters,
    setFilters,
    /** The filter currently applied to the cumulative summary. */
    appliedFilters,
    /** The summary appears only after a real filter is applied. */
    summaryVisible,
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
