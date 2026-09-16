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
// The endpoint only ever returns COMPLETED trips (the server filters on the
// completed set and stamps `status: "Completed"`), and the client keeps that
// promise: one row per trip, never twice (see `uniqueTrips`).
//
// Filtering, sorting and pagination are all server-side, and ONE request
// carries everything a screen needs — rows, the totals for the whole filtered
// set, and the dropdown masters. There is no second "totals" call and no
// separate "unfiltered peek" call: the response already holds both.
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
//   RESET — instant, and it must never read as "the page refreshed":
//     - Draft filters, applied filters, sort and pagination all return to their
//       defaults in one state update, so the controls, the indicator and the
//       summary clear on the same frame as the click
//     - The grid for the default query is served from the query cache, so the
//       unfiltered rows are on screen on the next tick instead of behind a
//       network wait: no skeleton, no spinner, no blank table, no scroll jump.
//       A fresh cache entry skips the network entirely; a stale one revalidates
//       in the background behind the rows the operator is already reading
//
//   REFRESH:
//     - Drops the cache and re-reads the server, preserving applied filters + page
//
// EVERY OTHER QUERY (sort, page, page size, filter) follows the same rule: the
// grid keeps its rows while the next page loads, and only the very first load of
// the screen — when there is nothing to keep — shows the skeleton.

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

/** Identity of a filter set — the cache key for "these exact filters". */
function signatureOf(f: LossFilters): string {
  return [f.fromDate, f.toDate, f.sourceFarm, f.supervisor, f.search.trim()].join("\u0001");
}

const EMPTY_SIGNATURE = signatureOf(defaultFilters());

const DEFAULT_SORT: LossSort = { key: "tripDate", dir: "desc" };
export const DEFAULT_PAGE_SIZE = 10;

/** Runs a burst of sort/page clicks together; a committed Search or Reset skips it. */
const COALESCE_MS = 120;
/** A cached screen this young is trusted as-is — no request, no flicker. */
const CACHE_FRESH_MS = 15_000;
/** Upper bound on remembered screens (each one is a page of ~20 small rows). */
const CACHE_LIMIT = 24;

/**
 * Does this screen need the server at all?
 *
 * A screen already in the cache is painted immediately; whether it is then
 * re-read depends on this answer. A fresh entry is trusted — that is what makes
 * Reset (and stepping back through pages) instant AND quiet: no request, no
 * spinner, nothing that could read as a page refresh. An explicit Refresh always
 * re-reads. Exported so the harness can pin the rule.
 */
export function shouldRevalidate(cachedAt: number | undefined, forced: boolean, now = Date.now()): boolean {
  if (forced) return true;
  if (cachedAt === undefined) return true;
  return now - cachedAt >= CACHE_FRESH_MS;
}

const EMPTY_KPIS: MortalityKpis = {
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
};

const EMPTY_OPTIONS: MortalityFilterOptions = { farms: [], supervisors: [] };

/** One screen's worth of analysis: rows + totals for the whole filtered set. */
interface AnalysisScreen {
  data: MortalityRow[];
  total: number;
  totalPages: number;
  kpis: MortalityKpis;
}

interface CacheEntry {
  at: number;
  screen: AnalysisScreen;
  signature: string;
}

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

/**
 * ONE ROW PER TRIP. The server already returns unique completed trips; this keeps
 * the grid honest even if a response ever repeated one (a join fan-out, a retry
 * that merged two payloads), because a duplicated trip must never appear twice on
 * the page — the count, the totals and the reader all depend on that.
 *
 * Exported so the page's harness can prove the guarantee directly.
 */
export function uniqueTrips(rows: MortalityRow[]): MortalityRow[] {
  const seen = new Set<number>();
  const unique: MortalityRow[] = [];
  for (const row of rows) {
    if (seen.has(row.tripId)) continue;
    seen.add(row.tripId);
    unique.push(row);
  }
  return unique;
}

export function useTripLossAnalysis() {
  const [screen, setScreen] = useState<AnalysisScreen | null>(null);
  /** Filter signature the screen above was fetched for. */
  const [screenSignature, setScreenSignature] = useState<string | null>(null);

  /** True only while the FIRST load of the screen is in flight (skeletons). */
  const [loading, setLoading] = useState(true);
  /** True while a later query is in flight behind rows already on screen. */
  const [reloading, setReloading] = useState(false);
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

  const [sort, setSort] = useState<LossSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  /** Dropdown values + "do any completed trips exist at all" — both unfiltered. */
  const [filterOptions, setFilterOptions] = useState<MortalityFilterOptions>(EMPTY_OPTIONS);
  const [hasTrips, setHasTrips] = useState(false);

  /** Bumped by Refresh / Retry to force a re-fetch. */
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Every screen already seen, keyed by filters + sort + page + page size. This
   * is what makes Reset (and stepping back through pages) instant: the previous
   * screen is painted from memory instead of being re-fetched behind a spinner.
   */
  const cacheRef = useRef(new Map<string, CacheEntry>());
  /** Mirror of `screen` for the effect, which must not re-run when it changes. */
  const screenRef = useRef<AnalysisScreen | null>(null);
  /** Set by Search / Reset: the user committed, so skip the coalescing delay. */
  const immediateRef = useRef(false);
  /** Set by Refresh: the payload must be re-read and any failure surfaced. */
  const forceRef = useRef(false);

  // Guards against a rejected/aborted older response overwriting a newer one.
  const requestIdRef = useRef(0);

  /**
   * Callers waiting on `refresh()`. The query settles in an effect, so Refresh
   * cannot be a fire-and-forget spinner: the BrandRefreshButton keeps its hen
   * dancing and its toast honest only if the returned promise resolves when the
   * reload has actually finished. Each resolver is settled from the query's own
   * `finally`, so it inherits the abort/stale guards.
   */
  const refreshResolversRef = useRef<Array<() => void>>([]);
  const settleRefresh = useCallback(() => {
    const pending = refreshResolversRef.current;
    refreshResolversRef.current = [];
    for (const resolve of pending) resolve();
  }, []);

  const totalRecords = screen?.total ?? 0;
  const totalPages = screen?.totalPages ?? 1;

  /**
   * The page the screen can actually show. A narrowing filter can leave the
   * stored page beyond the last one; clamping here — during render — keeps the
   * query on a real page without an extra state write and the cascading render
   * that comes with it. The stored page is left alone, so relaxing the filter
   * again returns the operator to where they were.
   */
  const effectivePage = Math.min(Math.max(1, page), totalPages);

  // ── THE QUERY — one request per screen. Shows all completed trips by default;
  // filtered trips when a real filter has been applied via Search.
  useEffect(() => {
    const signature = signatureOf(appliedFilters);
    const key = `${signature}\u0002${sort.key}:${sort.dir}\u0002${effectivePage}\u0002${pageSize}`;
    const cached = cacheRef.current.get(key);
    const forced = forceRef.current;
    const immediate = immediateRef.current;
    forceRef.current = false;
    immediateRef.current = false;

    // 1. PAINT FROM MEMORY FIRST. Reset, back-navigation and a repeated search
    //    land on a screen that was already fetched, so its rows go up on this
    //    frame: no skeleton, no spinner, no blank grid, nothing that could read
    //    as "the page refreshed".
    if (cached) {
      screenRef.current = cached.screen;
      setScreen(cached.screen);
      setScreenSignature(cached.signature);
      setError(null);
      setLoading(false);
    }

    // 2. A screen this fresh needs no request at all — the most efficient reset
    //    is the one that never leaves the browser.
    if (cached && !shouldRevalidate(cached.at, forced)) {
      setReloading(false);
      settleRefresh();
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    // With rows already on screen this is a background refresh: the grid stays,
    // and only a first load (nothing to keep) is allowed to show skeletons.
    const hasRows = screenRef.current !== null;
    if (hasRows) setReloading(true);
    else setLoading(true);
    setError(null);

    const filterActive = isRealFilter(appliedFilters);

    const timer = setTimeout(() => {
      fetchMortalityAnalysis(
        {
          sortBy: sort.key,
          sortDir: sort.dir,
          page: effectivePage,
          limit: pageSize,
          ...(filterActive
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
          const next: AnalysisScreen = {
            data: uniqueTrips(res.data),
            total: res.meta.total,
            totalPages: res.meta.totalPages,
            kpis: res.kpis,
          };
          cacheRef.current.set(key, { at: Date.now(), screen: next, signature });
          // Bound the memory: drop the oldest screens once there are too many.
          while (cacheRef.current.size > CACHE_LIMIT) {
            const oldest = cacheRef.current.keys().next().value;
            if (oldest === undefined) break;
            cacheRef.current.delete(oldest);
          }
          screenRef.current = next;
          setScreen(next);
          setScreenSignature(signature);
          setError(null);
          // The dropdown masters always describe the FULL completed-trip set, so
          // they can be taken from any response. "Do any trips exist at all"
          // must only ever be answered by an unfiltered one.
          setFilterOptions(res.filterOptions);
          if (signature === EMPTY_SIGNATURE) setHasTrips(res.meta.total > 0);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          // A background query never blanks a grid that already has rows: the
          // operator keeps reading what is on screen. Only a first load — or an
          // explicit Refresh, which the button promised to report on — surfaces
          // the failure.
          if (!screenRef.current || forced) setError(messageOf(err));
        })
        .finally(() => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setLoading(false);
          setReloading(false);
          // Release anyone awaiting refresh() only after this query has settled.
          settleRefresh();
        });
    }, immediate ? 0 : COALESCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      // A superseded request must never leave a Refresh spinner hanging: the
      // replacement query settles and resolves the same waiters.
    };
  }, [sort, effectivePage, pageSize, reloadToken, appliedFilters, settleRefresh]);

  /** APPLY — commits the current controls to the cumulative summary, filters the table,
   *  reveals the summary, and resets pagination to page 1. If no real filter is
   *  active the summary simply stays hidden and the table shows all trips. */
  const applyFilters = useCallback(() => {
    immediateRef.current = true;
    setAppliedFilters(filters);
    setSummaryVisible(isRealFilter(filters));
    setPage(1);
  }, [filters]);

  /** RESET — one state update back to the defaults: controls, applied filters,
   *  sort, pagination and the summary all clear together, and the unfiltered grid
   *  comes straight from the query cache — no network wait, so the click reads as
   *  instantaneous and the page never reloads, blanks or freezes. */
  const resetFilters = useCallback(() => {
    const defaults = defaultFilters();
    immediateRef.current = true;
    setFilters(defaults);
    setAppliedFilters(defaults);
    setSummaryVisible(false);
    setSort(DEFAULT_SORT);
    setPage(1);
  }, []);

  /** REFRESH — drop what we remember and re-read the server, preserving the
   *  applied filter + page. Resolves once the reload has settled, so callers can
   *  bind a real spinner (and a success/failure toast) to it. */
  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        refreshResolversRef.current.push(resolve);
        forceRef.current = true;
        cacheRef.current.clear();
        setReloadToken((t) => t + 1);
      }),
    []
  );

  // The totals belong to the applied filter: until the screen for EXACTLY these
  // filters is in hand the summary stays back, so a number from the previous
  // subset can never be read as this one's.
  const totalsReady = screenSignature !== null && screenSignature === signatureOf(appliedFilters);

  return {
    loading,
    reloading,
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
    /** …and only once its own totals have arrived. */
    summaryReady: summaryVisible && totalsReady,
    applyFilters,
    resetFilters,
    sort,
    setSort,
    /** The page actually shown — never beyond the last page of the result set. */
    page: effectivePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalRecords,
    records: screen?.data ?? [],
    kpis: summaryVisible && totalsReady && screen ? screen.kpis : EMPTY_KPIS,
    farmOptions: filterOptions.farms,
    supervisorOptions: filterOptions.supervisors,
    /** Completed trips exist at all (used to choose the right empty state). */
    hasTrips,
  };
}
