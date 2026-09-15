// src/modules/staff/pages/DriverPerformancePage.tsx
//
// ============================================================================
// DRIVER PERFORMANCE — production rebuild (frontend only)
// ============================================================================
// Data: the existing real endpoint GET /api/staff/performance/drivers via
// `useStaffPerformance` — no sample data, no changed contracts. The backend
// computes every figure; this page formats and explains it.
//
// BEHAVIOUR
//   • Explicit search: dates / driver / search text are DRAFTS; exactly one
//     request runs on Search (or Enter). Clear restores the default period
//     (last four Mon–Sat weeks, ~1 month) and re-applies in one request.
//   • Refresh: single-flight, icon-only, keeps the loaded dataset on screen.
//   • Weekly chart renders the API's weekly buckets with display-only Mon–Sat
//     labels; the driver table paginates with the shared staff pager.
//   • Row click / Enter / Space opens the details drawer (no extra requests).
//   • Grades (Outstanding / Excellent / Good) come from the isolated,
//     deterministic presentation scorer in `utils/performanceGrading`.
// ============================================================================

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Gauge,
  Route,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { te as teDateLocale } from "date-fns/locale";
import type { Locale } from "date-fns";

import { makeT, translateStatus, useI18n, type Language } from "../../../i18n";
import { useStaffPerformance } from "../hooks/useStaffPerformance";
import { usePerformanceDetail } from "../hooks/usePerformanceDetail";
import { useStaffDirectory } from "../hooks/useStaffDirectory";
import { rankDriverRows } from "../utils/performanceGrading";
import SortableHeader, {
  type SortState,
} from "../components/performance/PerformanceSortableHeader";
import {
  formatBusinessDate,
  formatPeriodLabel,
  inProgressWeekKey,
  periodsForRange,
  toWeeklyAxisRows,
} from "../utils/performancePeriods";
import {
  buildDrawerFactors,
  buildDrawerImprovements,
  recentTripsForWeek,
  formatCostPerKm,
  formatCount,
  formatDecimal,
  formatKm,
  formatLitres,
  formatMileage,
  formatMoney,
  gradeBadgeClass,
  isMeasurable,
  translateGrade,
} from "../utils/performanceView";
import PerformanceCardMark from "../components/performance/PerformanceCardMark";
import { CARD_HEADER_TONE } from "../components/performance/performanceCardTone";
import PerformanceFilterBar, {
  type PerformanceDraftFilters,
} from "../components/performance/PerformanceFilterBar";
import PerformanceKpiCards, {
  type PerformanceKpi,
} from "../components/performance/PerformanceKpiCards";
import WeeklyPerformanceChart, {
  type WeeklyChartPoint,
  type WeeklyChartSeries,
} from "../components/performance/WeeklyPerformanceChart";
import { personNameLabel } from "../utils/leaveDisplay";
import {
  perfTdClass,
  perfTdNumericClass,
  perfThClass,
} from "../components/performance/tableRhythm";
import PerformanceDrawer from "../components/performance/PerformanceDrawer";
import RecentTripsTable from "../components/performance/RecentTripsTable";
import Pagination from "../components/common/Pagination";
import RefreshToast from "../components/common/RefreshToast";
import { EmptyState } from "../../../ui";
import TableLoading from "../components/common/TableLoading";
import { cn } from "../../../utils/cn";
import {
  uiTableHeadClass,
  uiTableRowClass,
  uiTableRowFocusableClass,
  uiTableRowSelectedClass,
  uiTableTdClass,
  uiTableTdNumericClass,
  uiTableThClass,
} from "../../../shared/ui/uiTokens";

/** Typing pause before the search reaches the API (Leave page parity). */
const SEARCH_DEBOUNCE_MS = 300;

const ITEMS_PER_PAGE = 10;

const DriverPerformancePage = () => {
  const { t, language } = useI18n();
  const dateLocale: Locale | undefined = language === "te" ? teDateLocale : undefined;

  const perf = useStaffPerformance("drivers");
  const directory = useStaffDirectory("Driver");
  const data = perf.data;
  const applied = perf.filters;

  /* ---------------------- draft filters (explicit search) --------------- */

  const [draft, setDraft] = useState<PerformanceDraftFilters>(() => ({
    fromDate: applied.fromDate,
    toDate: applied.toDate,
    personId: applied.personId,
    search: applied.search,
  }));

  /* Reset to page 1 whenever a new query is applied (a filter change is a new
     list). Detected with the render-phase adjustment pattern — the official
     alternative to setState-in-effect. The draft is NOT re-seeded from the
     applied set: it is what we just sent, and copying it back would overwrite
     characters typed while the request was in flight. */
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [lastApplied, setLastApplied] = useState(applied);
  if (lastApplied !== applied) {
    setLastApplied(applied);
    setCurrentPage(1);
  }

  /** Always the freshest draft — the debounce below reads it without re-running. */
  const draftRef = useRef(draft);

  const runQuery = useCallback(
    (next: PerformanceDraftFilters) => {
      perf.applyFilters({
        fromDate: next.fromDate,
        toDate: next.toDate,
        personId: next.personId,
        search: next.search,
      });
    },
    [perf],
  );

  /**
   * Filters apply the moment they change — there is no Search button.
   * A date or a driver is a discrete choice, so it goes to the API at once;
   * typing waits out the same 300 ms pause the Leave page uses (one request
   * per typing burst, never one per character). `applyFilters` ignores an
   * identical set, so an immediate apply plus the trailing debounce cannot
   * duplicate a request.
   */
  const updateDraft = useCallback(
    (patch: Partial<PerformanceDraftFilters>) => {
      const next = { ...draftRef.current, ...patch };
      // Keep the range ordered while editing (the hook re-validates too).
      if (next.fromDate && next.toDate && next.fromDate > next.toDate) {
        if (patch.fromDate) next.toDate = next.fromDate;
        else next.fromDate = next.toDate;
      }
      draftRef.current = next;
      setDraft(next);
      if (!("search" in patch)) runQuery(next);
    },
    [runQuery],
  );

  // Typing: apply once the user pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => runQuery(draftRef.current), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft.search, runQuery]);

  /** Enter commits immediately (the trailing debounce then finds nothing to do). */
  const handleApply = useCallback(() => {
    runQuery(draftRef.current);
  }, [runQuery]);

  const handleClear = useCallback(() => {
    perf.clearFilters();
    /* Reset restores the draft as well, so a driver picked but not yet applied
       does not survive it. */
    const restored: PerformanceDraftFilters = {
      fromDate: perf.defaultFilters.fromDate,
      toDate: perf.defaultFilters.toDate,
      personId: perf.defaultFilters.personId,
      search: perf.defaultFilters.search,
    };
    draftRef.current = restored;
    setDraft(restored);
  }, [perf]);

  const handleRefresh = useCallback(() => {
    perf.refresh();
  }, [perf]);

  /* ---------------------------- refresh toast --------------------------- */

  const [refreshToast, setRefreshToast] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  // Fire exactly once per completed refresh (true → false transition),
  // detected with the render-phase adjustment pattern.
  const [prevRefreshing, setPrevRefreshing] = useState(perf.refreshing);
  if (prevRefreshing !== perf.refreshing) {
    setPrevRefreshing(perf.refreshing);
    if (!perf.refreshing) {
      setRefreshToast({
        message: perf.error
          ? t("staff.perf.toast.driver_refresh_failed")
          : t("staff.perf.toast.driver_refreshed"),
        isError: Boolean(perf.error),
      });
    }
  }

  /* ------------------------------ periods ------------------------------- */

  const periods = useMemo(
    () => periodsForRange(applied.fromDate, applied.toDate, 6),
    [applied.fromDate, applied.toDate],
  );
  const appliedRangeLabel = useMemo(
    () =>
      `${formatBusinessDate(applied.fromDate, "d MMM yyyy", dateLocale)} – ${formatBusinessDate(applied.toDate, "d MMM yyyy", dateLocale)}`,
    [applied.fromDate, applied.toDate, dateLocale],
  );
  const periodsLine = useMemo(
    () => periods.map((period) => formatPeriodLabel(period, dateLocale)).join("  ·  "),
    [periods, dateLocale],
  );

  /* --------------------------- rows + grading --------------------------- */

  const rows = data.rows;
  // Award-ordered view: ranks 1-3 hold the single Outstanding/Excellent/Good,
  // everything else follows by output (grade `null` → rendered as a dash).
  const rowsView = useMemo(() => rankDriverRows(rows), [rows]);

  /* ------------------------------- sorting ------------------------------- */

  // Click cycle per column: preferred dir → reversed → cleared (award order).
  // Sorting reorders the loaded rows only — grades and awards never change.
  const [sort, setSort] = useState<SortState | null>(null);
  const handleSortChange = useCallback((next: SortState | null) => {
    setSort(next);
    setCurrentPage(1);
  }, []);

  const driverSortAccessors = useMemo<
    Record<string, (entry: (typeof rowsView)[number]) => number | string>
  >(
    () => ({
      driver: (entry) => entry.row.driverName,
      status: (entry) => entry.row.employeeStatus,
      trips: (entry) => entry.row.trips,
      distance: (entry) => entry.row.distance,
      avg_per_trip: (entry) => entry.row.avgDistancePerTrip,
      vehicles: (entry) => entry.row.vehicles,
      fuel: (entry) => entry.row.fuelLitres,
      total_cost: (entry) => entry.row.totalCost,
      cost_per_km: (entry) => entry.row.costPerKm,
      mileage: (entry) => entry.row.mileage,
      grade: (entry) => entry.assessment?.awardRank ?? Number.MAX_SAFE_INTEGER,
    }),
    [],
  );

  const sortedRowsView = useMemo(() => {
    if (!sort) return rowsView;
    const accessor = driverSortAccessors[sort.key];
    if (!accessor) return rowsView;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rowsView].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === "string" || typeof bv === "string") {
        const cmp = String(av).localeCompare(String(bv), undefined, {
          sensitivity: "accent",
          numeric: true,
        });
        if (cmp !== 0) return cmp * dir;
      } else if (av !== bv) {
        return ((av as number) - (bv as number)) * dir;
      }
      return a.rank - b.rank; // award order as the stable tie-break
    });
  }, [rowsView, sort, driverSortAccessors]);

  /* ----------------------------- pagination ----------------------------- */

  const totalPages = Math.max(1, Math.ceil(rowsView.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(
    () => sortedRowsView.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRowsView, safePage, pageSize],
  );

  /* ------------------------------- KPIs --------------------------------- */

  const kpis = data.kpis;
  const initialLoading = perf.loading && rowsView.length === 0 && !perf.error;
  const kpiCards = useMemo<PerformanceKpi[]>(
    () => [
      {
        label: t("staff.perf.kpi.active_drivers"),
        value: initialLoading ? null : formatCount(kpis.drivers),
        sub: t("staff.perf.kpi.sub.participating"),
        icon: <Users size={14} />,
        tone: "sky",
      },
      {
        label: t("staff.perf.kpi.total_trips"),
        value: initialLoading ? null : formatCount(kpis.trips),
        sub: t("staff.perf.kpi.sub.trips"),
        icon: <Route size={14} />,
        tone: "emerald",
      },
      {
        label: t("staff.perf.kpi.total_distance"),
        value: initialLoading ? null : formatKm(kpis.distance),
        sub: t("staff.perf.kpi.sub.distance"),
        icon: <Truck size={14} />,
        tone: "indigo",
      },
      {
        label: t("staff.perf.kpi.avg_mileage"),
        value: initialLoading ? null : formatMileage(kpis.mileage),
        sub: t("staff.perf.kpi.sub.mileage"),
        icon: <Gauge size={14} />,
        tone: "amber",
      },
      {
        label: t("staff.perf.kpi.cost_per_km"),
        value: initialLoading ? null : formatCostPerKm(kpis.costPerKm),
        sub: t("staff.perf.kpi.sub.cost_per_km"),
        icon: <TrendingUp size={14} />,
        tone: "rose",
      },
    ],
    [t, kpis, initialLoading],
  );

  /* ------------------------------- chart -------------------------------- */

  const chartRows = useMemo(
    () =>
      toWeeklyAxisRows(data.weekly, dateLocale).map((row) => ({
        ...row,
        /* Weekly mileage = the week's real distance ÷ its real fuel (the same
           derivation the tooltip always used). A week without fuel stays blank
           instead of pretending to be 0 km/L. */
        mileage: row.fuelLitres > 0 ? row.distance / row.fuelLitres : undefined,
      })),
    [data.weekly, dateLocale],
  );
  /* The week that is still running (if the range reaches into it): drawn in a
     paler shade and called out under the plot. */
  const inProgressWeek = useMemo(() => inProgressWeekKey(data.weekly), [data.weekly]);
  const inProgressNote = useMemo(() => {
    if (inProgressWeek == null) return undefined;
    const row = chartRows.find((point) => String(point.week) === String(inProgressWeek));
    return t("staff.perf.weekly.in_progress", { week: row?.label ?? "" });
  }, [inProgressWeek, chartRows, t]);
  /* One chart, three series, three rulers: Distance + Fuel as grouped bars
     (each on its own axis so both volumes stay visible) and Mileage as a line.
     Bars keep 0 as their floor; mileage hugs its own range so a 4.24 → 4.36
     km/L week does not flat-line. */
  const chartSeries = useMemo<WeeklyChartSeries[]>(
    () => [
      {
        key: "distance",
        label: t("staff.perf.weekly.distance"),
        color: "#6366f1",
        kind: "bar",
        axis: "left",
        format: (value) => `${formatCount(value)} km`,
      },
      {
        key: "fuelLitres",
        label: t("staff.perf.weekly.fuel"),
        color: "#f59e0b",
        kind: "bar",
        axis: "right",
        format: (value) => formatLitres(value),
      },
      {
        key: "mileage",
        label: t("staff.perf.weekly.mileage"),
        color: "#10b981",
        kind: "line",
        axis: "third",
        zeroFloor: false,
        format: (value) => `${formatDecimal(value, 2)} km/L`,
      },
    ],
    [t],
  );
  /* Mileage is a series of its own now, so the tooltip only adds what the
     series cannot carry: the week's trip count. */
  const chartTooltipExtras = useCallback(
    (point: WeeklyChartPoint) => [
      { label: t("staff.perf.weekly.trips"), value: formatCount(Number(point.trips ?? 0)) },
    ],
    [t],
  );

  // Respective trip details for the chart tooltip (loaded person detail only).
  const chartWeekTrips = useCallback(
    (point: WeeklyChartPoint) =>
      recentTripsForWeek(point.week, data.detail?.recentTrips ?? [], "drivers"),
    [data.detail],
  );

  /* --------------------------- drawer state ----------------------------- */

  const selectedEntry = useMemo(
    () =>
      perf.selectedId != null
        ? rowsView.find((entry) => entry.row.driverId === perf.selectedId) ?? null
        : null,
    [rowsView, perf.selectedId],
  );

  const closeDrawer = useCallback(() => perf.selectRow(null), [perf]);

  // Pop-up language is SCOPED to the pop-up only: it re-syncs with the app
  // language when the pop-up opens, then the in-header EN/తెలుగు toggle
  // changes it locally. Nothing is written to the global store, so the page
  // behind and the rest of the project keep their language.
  const [drawerLang, setDrawerLang] = useState<Language>(language);
  const [prevDrawerOpen, setPrevDrawerOpen] = useState(false);
  const drawerOpen = selectedEntry != null;
  if (prevDrawerOpen !== drawerOpen) {
    setPrevDrawerOpen(drawerOpen);
    if (drawerOpen) setDrawerLang(language);
  }
  const drawerT = useMemo(() => makeT(drawerLang), [drawerLang]);
  const drawerDateLocale: Locale | undefined = drawerLang === "te" ? teDateLocale : undefined;
  const drawerRangeLabel = useMemo(
    () =>
      `${formatBusinessDate(applied.fromDate, "d MMM yyyy", drawerDateLocale)} – ${formatBusinessDate(applied.toDate, "d MMM yyyy", drawerDateLocale)}`,
    [applied.fromDate, applied.toDate, drawerDateLocale],
  );

  // Per-person detail for the pop-up (vehicles + recent trips): fetched
  // separately from the list query, so navigating with the ‹ › arrows never
  // shrinks or reshuffles the loaded ranking. Same read-only GET, cached.
  const detailQuery = usePerformanceDetail(
    "drivers",
    perf.selectedId,
    { fromDate: applied.fromDate, toDate: applied.toDate },
    perf.refreshNonce,
  );
  const personDetail = detailQuery.detail;

  // ‹ › traversal across the award-ordered rows (rank literal order).
  const drawerNavigation = useMemo(() => {
    if (!selectedEntry) return undefined;
    const index = rowsView.findIndex((entry) => entry.row.driverId === selectedEntry.row.driverId);
    if (index < 0 || rowsView.length <= 1) return undefined;
    return {
      index,
      total: rowsView.length,
      onPrev: () => {
        const prev = rowsView[index - 1];
        if (prev) perf.selectRow(prev.row.driverId);
      },
      onNext: () => {
        const next = rowsView[index + 1];
        if (next) perf.selectRow(next.row.driverId);
      },
      prevLabel: drawerT("staff.perf.drawer.prev"),
      nextLabel: drawerT("staff.perf.drawer.next"),
    };
  }, [selectedEntry, rowsView, perf, drawerT]);



  const drawerSummary = useMemo(() => {
    if (!selectedEntry) return [];
    const row = selectedEntry.row;
    return [
      { label: drawerT("staff.perf.drawer.trips"), value: formatCount(row.trips) },
      { label: drawerT("staff.perf.drawer.distance"), value: formatKm(row.distance) },
      { label: drawerT("staff.perf.drawer.fuel"), value: formatLitres(row.fuelLitres) },
      { label: drawerT("staff.perf.drawer.mileage"), value: formatMileage(row.mileage) },
      { label: drawerT("staff.perf.drawer.cost_per_km"), value: formatCostPerKm(row.costPerKm) },
      { label: drawerT("staff.perf.table.total_cost"), value: formatMoney(row.totalCost) },
    ];
  }, [selectedEntry, drawerT]);

  const drawerFactors = useMemo(
    () => (selectedEntry?.assessment ? buildDrawerFactors(selectedEntry.assessment, drawerT) : []),
    [selectedEntry, drawerT],
  );
  const drawerImprovements = useMemo(
    () => (selectedEntry?.assessment ? buildDrawerImprovements(selectedEntry.assessment, drawerT) : []),
    [selectedEntry, drawerT],
  );

  const selectedDriverName = useMemo(() => {
    if (applied.personId == null) return null;
    return (
      directory.options.find((option) => option.id === applied.personId)?.name ??
      `#${applied.personId}`
    );
  }, [applied.personId, directory.options]);

  const summaryLine = useMemo(() => {
    const parts = [
      appliedRangeLabel,
      selectedDriverName ?? t("staff.perf.filter.all_drivers"),
    ];
    if (applied.search.trim()) {
      parts.push(`${t("staff.perf.summary.search_prefix")} “${applied.search.trim()}”`);
    }
    return parts.join("  ·  ");
  }, [appliedRangeLabel, applied.search, selectedDriverName, t]);

  /* ---------------------------- empty states ---------------------------- */

  const hasNarrowingFilter =
    applied.personId != null || applied.search.trim().length > 0;
  const showTableSkeleton = perf.loading && rowsView.length === 0;
  const showNoMatch =
    !showTableSkeleton && rowsView.length === 0 && hasNarrowingFilter;
  const showNoData =
    !showTableSkeleton && rowsView.length === 0 && !hasNarrowingFilter;

  /* ------------------------------ render -------------------------------- */

  return (
    <div className="w-full space-y-4">
      <RefreshToast
        message={refreshToast?.message ?? ""}
        isVisible={refreshToast != null}
        onClose={() => setRefreshToast(null)}
        duration={5000}
        isError={refreshToast?.isError}
      />

      <PerformanceFilterBar
        kind="drivers"
        value={draft}
        onChange={updateDraft}
        onApply={handleApply}
        onClear={handleClear}
        onRefresh={handleRefresh}
        personOptions={directory.options}
        personOptionsLoading={directory.loading}
        personOptionsError={directory.error}
        busy={perf.loading}
        refreshing={perf.refreshing}
      />

      {/* Error — inline, actionable, raw API text never shown */}
      {perf.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-rose-700">
            <AlertTriangle size={16} aria-hidden="true" />
            {t("staff.perf.error.title")}
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-sm font-bold text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-800"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* KPI cards — reflect the applied dataset */}
      <PerformanceKpiCards kpis={kpiCards} columns={5} />

      {/* Driver Weekly Performance */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b px-4 py-3 sm:px-5 ${CARD_HEADER_TONE.orange}`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <PerformanceCardMark icon={Truck} tone="orange" />
            <h2 className="min-w-0 text-base font-bold text-slate-800 tracking-tight">
              {t("staff.perf.weekly.driver_header")}
            </h2>
          </div>
          <p className="text-[11px] font-medium tabular-nums text-slate-500">
            <span className="text-slate-400">{t("staff.perf.weekly.reporting_weeks")}: </span>
            {periodsLine || appliedRangeLabel}
          </p>
        </header>
        <div className="p-4 sm:p-5">
          <WeeklyPerformanceChart
            rows={chartRows}
            series={chartSeries}
            tooltipExtras={chartTooltipExtras}
            weekTrips={chartWeekTrips}
            emptyText={t("staff.perf.weekly.empty")}
            loading={initialLoading}
            ariaLabel={t("staff.perf.weekly.aria_driver", { range: appliedRangeLabel })}
            inProgressWeek={inProgressWeek}
            inProgressNote={inProgressNote}
          />
        </div>
      </section>

      {/* Driver Performance table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header
          className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b px-4 py-3 sm:px-5 ${CARD_HEADER_TONE.orange}`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <PerformanceCardMark icon={Truck} tone="orange" />
            <h2 className="min-w-0 text-base font-bold text-slate-800 tracking-tight">
              {t("staff.perf.driver_title")}
            </h2>
          </div>
          <span className="min-w-0 text-[11px] font-medium text-slate-500">
            <span aria-hidden="true">—&nbsp;</span>
            {summaryLine}
          </span>
        </header>

        {showTableSkeleton ? (
          <TableLoading label={t("staff.table.loading.driver_perf")} />
        ) : showNoMatch ? (
          <EmptyState
            variant="no-search"
            title={t("staff.perf.table.no_match_title", {
              entity_l: t("staff.perf.entity_l.drivers"),
            })}
            description={t("staff.perf.table.no_match_desc", {
              entity_l: t("staff.perf.entity_l.drivers"),
            })}
            action={
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
              >
                {t("staff.perf.filter.clear_action")}
              </button>
            }
          />
        ) : showNoData ? (
          <EmptyState
            variant="no-data"
            title={t("staff.perf.table.empty_title")}
            description={t("staff.perf.table.empty_desc")}
          />
        ) : (
          <>
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="min-w-full border-collapse text-left">
                <thead className={uiTableHeadClass}>
                  <tr>
                    <th scope="col" className={`${perfThClass} w-12 text-left`}>
                      {t("staff.perf.table.rank")}
                    </th>
                    <SortableHeader
                      label={t("staff.perf.table.driver")}
                      sortKey="driver"
                      sort={sort}
                      onSortChange={handleSortChange}
                      firstDir="asc"
                      className="min-w-[150px]"
                    />
                    <SortableHeader
                      label={t("staff.perf.table.status")}
                      sortKey="status"
                      sort={sort}
                      onSortChange={handleSortChange}
                      firstDir="asc"
                    />
                    <SortableHeader label={t("staff.perf.table.trips")} sortKey="trips" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.distance")} sortKey="distance" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.avg_per_trip")} sortKey="avg_per_trip" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.vehicles")} sortKey="vehicles" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.fuel")} sortKey="fuel" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.total_cost")} sortKey="total_cost" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.cost_per_km")} sortKey="cost_per_km" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.mileage")} sortKey="mileage" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.grade")} sortKey="grade" sort={sort} onSortChange={handleSortChange} align="center" firstDir="asc" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedRows.map(({ row, rank, assessment }) => {
                    const selected = row.driverId === perf.selectedId;
                    const grade = assessment?.grade ?? null;
                    const toggle = () => perf.selectRow(selected ? null : row.driverId);
                    return (
                      <tr
                        key={row.driverId}
                        tabIndex={0}
                        aria-label={t("staff.perf.table.row_aria", {
                          name: personNameLabel(t, language, row.driverName),
                        })}
                        onClick={toggle}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault(); // exactly one activation
                            toggle();
                          }
                        }}
                        className={cn(
                          "cursor-pointer",
                          uiTableRowClass,
                          uiTableRowFocusableClass,
                          selected && uiTableRowSelectedClass,
                        )}
                      >
                        <td className={`${perfTdClass} text-center text-xs font-bold tabular-nums text-slate-500`}>
                          {rank}
                        </td>
                        <td className={`${perfTdClass} whitespace-nowrap text-[13px] font-semibold text-slate-900`}>
                          {personNameLabel(t, language, row.driverName)}
                        </td>
                        <td className={`${perfTdClass} whitespace-nowrap text-xs text-slate-500`}>
                          {translateStatus(t, row.employeeStatus)}
                        </td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.trips)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.distance)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatDecimal(row.avgDistancePerTrip, 1)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.vehicles)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatDecimal(row.fuelLitres, 1)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap font-bold`}>{formatMoney(row.totalCost)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>
                          {isMeasurable(row.costPerKm) ? formatDecimal(row.costPerKm, 1) : "—"}
                        </td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatMileage(row.mileage)}</td>
                        <td className={`${perfTdClass} text-center`}>
                          {grade == null ? (
                            <span
                              className="text-xs font-semibold text-slate-300"
                            >
                              —
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${gradeBadgeClass(grade)}`}
                            >
                              {translateGrade(grade, t)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={rowsView.length}
              itemsPerPage={pageSize}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </>
        )}
      </section>

      {/* Details drawer — opens from a row; no API calls, no page remount */}
      <PerformanceDrawer
        open={selectedEntry != null}
        onClose={closeDrawer}
        title={personNameLabel(t, language, selectedEntry?.row.driverName ?? "")}
        subtitle={`${drawerT("staff.perf.drawer.period")}: ${drawerRangeLabel}`}
        rankBadge={
          selectedEntry ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600">
              {drawerT("staff.perf.drawer.rank_of", { rank: selectedEntry.rank, total: rowsView.length })}
            </span>
          ) : null
        }
        navigation={drawerNavigation}
        language={drawerLang}
        onLanguageChange={setDrawerLang}
        gradeBadge={
          selectedEntry ? (
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${gradeBadgeClass(
                selectedEntry.assessment.grade,
              )}`}
            >
              {translateGrade(selectedEntry.assessment.grade, t)}
            </span>
          ) : null
        }
        unscoredNote={
          selectedEntry?.assessment.grade == null
            ? drawerT("staff.perf.grade.unscored", { entity_single: drawerT("staff.perf.entity_single.drivers") })
            : undefined
        }
        summary={drawerSummary}
        factors={drawerFactors}
        improvements={drawerImprovements}
        labels={{
          summarySection: drawerT("staff.perf.drawer.summary"),
          whySection: drawerT("staff.perf.drawer.why"),
          improveSection: drawerT("staff.perf.drawer.improve"),
          improveNone: drawerT("staff.perf.drawer.improve_none"),
          recommendSection: drawerT("staff.perf.drawer.recommend"),
          recommendSustain: drawerT("staff.perf.drawer.recommend_sustain"),
          close: drawerT("staff.perf.drawer.close"),
        }}
      >
        {selectedEntry && detailQuery.loading && (
          <div className="space-y-3" aria-busy="true">
            <p className="sr-only">{drawerT("staff.perf.drawer.detail_loading")}</p>
            {/* Static blocks: the drawer shows its shape without pulsing. */}
            <div className="h-16 rounded-xl bg-slate-100" />
            <div className="h-40 rounded-xl bg-slate-100" />
          </div>
        )}
        {selectedEntry && detailQuery.error && !personDetail && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-rose-700">{drawerT("staff.perf.drawer.detail_error")}</p>
            <button
              type="button"
              onClick={detailQuery.reload}
              className="text-xs font-bold text-rose-700 underline decoration-rose-300 underline-offset-2 hover:text-rose-800"
            >
              {drawerT("common.retry")}
            </button>
          </div>
        )}
        {selectedEntry && personDetail && (
          <div className="space-y-5">
            <section aria-label={drawerT("staff.perf.drawer.vehicles")}>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {drawerT("staff.perf.drawer.vehicles")}
              </h3>
              {personDetail.vehicles.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs font-medium text-slate-400">
                  {drawerT("staff.perf.vehicle.empty")}
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>
                          {drawerT("staff.perf.vehicle.col.vehicle_no")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.trips")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.distance")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.avg_per_trip")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.fuel")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.fuel_cost")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.maintenance_cost")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.total_cost")}
                        </th>
                        <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>
                          {drawerT("staff.perf.vehicle.col.mileage")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {personDetail.vehicles.map((vehicle) => (
                        <tr key={vehicle.vehicleNo} className="transition-colors hover:bg-slate-50/70">
                          <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-xs font-bold text-slate-800`}>
                            {vehicle.vehicleNo}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatCount(vehicle.trips)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatCount(vehicle.distance)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatDecimal(vehicle.avgDistancePerTrip, 1)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatDecimal(vehicle.fuelLitres, 1)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatMoney(vehicle.fuelCost)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatMoney(vehicle.maintenanceCost)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs font-bold`}>
                            {formatMoney(vehicle.totalCost)}
                          </td>
                          <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>
                            {formatMileage(vehicle.mileage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-label={drawerT("staff.perf.drawer.recent_trips")}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {drawerT("staff.perf.drawer.recent_trips")}
              </h3>
              <RecentTripsTable
                trips={personDetail.recentTrips}
                paceRow={selectedEntry?.row}
                paceKind="drivers"
              />
            </section>
          </div>
        )}
      </PerformanceDrawer>
    </div>
  );
};

export default memo(DriverPerformancePage);
