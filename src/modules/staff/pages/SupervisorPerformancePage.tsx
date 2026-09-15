// src/modules/staff/pages/SupervisorPerformancePage.tsx
//
// ============================================================================
// SUPERVISOR PERFORMANCE — production rebuild (frontend only)
// ============================================================================
// Data: the existing real endpoint GET /api/staff/performance/supervisors via
// `useStaffPerformance` — no sample data, no changed contracts.
//
// BEHAVIOUR (mirrors the Driver Performance page — shared components)
//   • Explicit search: dates / supervisor / search text are DRAFTS; exactly
//     one request runs on Search (or Enter). Clear restores the default
//     period (last four Mon–Sat weeks, ~1 month) and re-applies once.
//   • Refresh: single-flight, icon-only, keeps the loaded dataset on screen.
//   • Weekly chart renders the API's weekly buckets (birds / delivered
//     weight; trips in the tooltip). Mortality per week is NOT fabricated —
//     the weekly API payload does not carry it.
//   • Row click / Enter / Space opens the details drawer (no extra requests).
//   • Grades (Outstanding / Excellent / Good) come from the shared
//     deterministic presentation scorer in `utils/performanceGrading`.
// ============================================================================

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Scale,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { te as teDateLocale } from "date-fns/locale";
import type { Locale } from "date-fns";

import { makeT, translateStatus, useI18n, type Language } from "../../../i18n";
import { useStaffPerformance } from "../hooks/useStaffPerformance";
import { useStaffDirectory } from "../hooks/useStaffDirectory";
import { usePerformanceDetail } from "../hooks/usePerformanceDetail";
import { rankSupervisorRows } from "../utils/performanceGrading";
import SortableHeader, {
  type SortState,
} from "../components/performance/PerformanceSortableHeader";
import {
  formatBusinessDate,
  formatPeriodLabel,
  periodsForRange,
  toWeeklyAxisRows,
} from "../utils/performancePeriods";
import {
  buildDrawerFactors,
  buildDrawerImprovements,
  recentTripsForWeek,
  formatCount,
  formatDecimal,
  formatKg,
  formatMetric,
  formatPercent,
  gradeBadgeClass,
  translateGrade,
} from "../utils/performanceView";
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
} from "../../../shared/ui/uiTokens";

/** Typing pause before the search reaches the API (Leave page parity). */
const SEARCH_DEBOUNCE_MS = 300;

const ITEMS_PER_PAGE = 10;

const SupervisorPerformancePage = () => {
  const { t, language } = useI18n();
  const dateLocale: Locale | undefined = language === "te" ? teDateLocale : undefined;

  const perf = useStaffPerformance("supervisors");
  const directory = useStaffDirectory("Supervisor");
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
     list). Render-phase adjustment pattern — `applied` identity changes once
     per apply. The draft is NOT re-seeded from the applied set: it is what we
     just sent, and copying it back would overwrite characters typed while the
     request was in flight. */
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
   * A date or a supervisor is a discrete choice, so it goes to the API at once;
   * typing waits out the same 300 ms pause the Leave page uses (one request per
   * typing burst, never one per character). `applyFilters` ignores an identical
   * set, so an immediate apply plus the trailing debounce cannot duplicate a
   * request.
   */
  const updateDraft = useCallback(
    (patch: Partial<PerformanceDraftFilters>) => {
      const next = { ...draftRef.current, ...patch };
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
    /* Reset restores the draft as well, so a person picked but not yet applied
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
          ? t("staff.perf.toast.supervisor_refresh_failed")
          : t("staff.perf.toast.supervisor_refreshed"),
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
  const rowsView = useMemo(() => rankSupervisorRows(rows), [rows]);

  /* ------------------------------- sorting ------------------------------- */

  // Click cycle per column: preferred dir → reversed → cleared (award order).
  // Sorting reorders the loaded rows only — grades and awards never change.
  const [sort, setSort] = useState<SortState | null>(null);
  const handleSortChange = useCallback((next: SortState | null) => {
    setSort(next);
    setCurrentPage(1);
  }, []);

  const supervisorSortAccessors = useMemo<
    Record<string, (entry: (typeof rowsView)[number]) => number | string>
  >(
    () => ({
      supervisor: (entry) => entry.row.supervisorName,
      status: (entry) => entry.row.employeeStatus,
      trips: (entry) => entry.row.trips,
      shops: (entry) => entry.row.shops,
      birds: (entry) => entry.row.birds,
      weight: (entry) => entry.row.weight,
      mortality: (entry) => entry.row.mortality,
      mortality_rate: (entry) => entry.row.mortalityRate,
      weight_loss: (entry) => entry.row.weightLoss,
      grade: (entry) => entry.assessment?.awardRank ?? Number.MAX_SAFE_INTEGER,
    }),
    [],
  );

  const sortedRowsView = useMemo(() => {
    if (!sort) return rowsView;
    const accessor = supervisorSortAccessors[sort.key];
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
  }, [rowsView, sort, supervisorSortAccessors]);

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
        label: t("staff.perf.kpi.active_supervisors"),
        value: initialLoading ? null : formatCount(kpis.supervisors),
        sub: t("staff.perf.kpi.sub.participating"),
        icon: <Users size={14} />,
      },
      {
        label: t("staff.perf.kpi.shops_delivered"),
        value: initialLoading ? null : formatCount(kpis.shops),
        sub: t("staff.perf.kpi.sub.shops"),
        icon: <Store size={14} />,
      },
      {
        label: t("staff.perf.kpi.total_birds"),
        value: initialLoading ? null : formatCount(kpis.birds),
        sub: t("staff.perf.kpi.sub.birds"),
        icon: <ClipboardCheck size={14} />,
      },
      {
        label: t("staff.perf.kpi.mortality_rate"),
        value: initialLoading
          ? null
          : formatMetric("mortalityRate", kpis.mortalityRate),
        sub: t("staff.perf.kpi.sub.mortality"),
        icon: <Scale size={14} />,
      },
      {
        label: t("staff.perf.kpi.weight_loss"),
        value: initialLoading ? null : formatKg(kpis.weightLoss),
        sub: t("staff.perf.kpi.sub.weight_loss"),
        icon: <TrendingUp size={14} />,
      },
    ],
    [t, kpis, initialLoading],
  );

  /* ------------------------------- chart -------------------------------- */

  const chartRows = useMemo(
    () => toWeeklyAxisRows(data.weekly, dateLocale),
    [data.weekly, dateLocale],
  );
  // Three metrics, three panels: the Birds bars carry the weekly volume;
  // Mortality and Weight-loss are the two loss trends. Each panel owns its
  // scale, so a red line can never be squashed against a 5,000-bird bar.
  // (Delivered weight remains in the KPIs, the table and the tooltip's derived
  // average — it is only dropped as a chart series.)
  const chartSeries = useMemo<WeeklyChartSeries[]>(
    () => [
      {
        key: "birds",
        label: t("staff.perf.weekly.birds"),
        color: "#10b981",
        axis: "left",
        kind: "bar",
        format: (value) => formatCount(value),
      },
      {
        key: "mortality",
        label: t("staff.perf.weekly.mortality"),
        color: "#ef4444",
        axis: "right",
        kind: "line",
        format: (value) => formatCount(value),
      },
      {
        key: "weightLoss",
        label: t("staff.perf.weekly.weight_loss"),
        color: "#8b5cf6",
        axis: "right",
        kind: "line",
        format: (value) => `${formatDecimal(value, 1)} kg`,
      },
    ],
    [t],
  );
  const chartTooltipExtras = useCallback(
    (point: WeeklyChartPoint) => {
      const extraRows: Array<{ label: string; value: string }> = [
        { label: t("staff.perf.weekly.trips"), value: formatCount(Number(point.trips ?? 0)) },
      ];
      // Derived from the same real values — never fabricated.
      const birds = Number(point.birds ?? 0);
      const weight = Number(point.weight ?? 0);
      if (birds > 0 && weight > 0) {
        extraRows.push({
          label: t("staff.perf.weekly.avg_weight_per_bird"),
          value: `${formatDecimal(weight / birds, 2)} kg`,
        });
      }
      return extraRows;
    },
    [t],
  );

  // Respective trip details for the chart tooltip: the API's own recent
  // trips (loaded only with a person filter) mapped into their Mon–Sat
  // buckets. Empty when no detail is loaded — never fabricated.
  const chartWeekTrips = useCallback(
    (point: WeeklyChartPoint) =>
      recentTripsForWeek(point.week, data.detail?.recentTrips ?? [], "supervisors"),
    [data.detail],
  );

  /* --------------------------- drawer state ----------------------------- */

  const selectedEntry = useMemo(
    () =>
      perf.selectedId != null
        ? rowsView.find((entry) => entry.row.supervisorId === perf.selectedId) ?? null
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

  // Per-person detail for the pop-up (recent trips): fetched separately from
  // the list query, so navigating with the ‹ › arrows never shrinks or
  // reshuffles the loaded ranking. Same read-only GET, cached.
  const detailQuery = usePerformanceDetail(
    "supervisors",
    perf.selectedId,
    { fromDate: applied.fromDate, toDate: applied.toDate },
    perf.refreshNonce,
  );
  const personDetail = detailQuery.detail;

  // ‹ › traversal across the award-ordered rows (rank literal order).
  const drawerNavigation = useMemo(() => {
    if (!selectedEntry) return undefined;
    const index = rowsView.findIndex((entry) => entry.row.supervisorId === selectedEntry.row.supervisorId);
    if (index < 0 || rowsView.length <= 1) return undefined;
    return {
      index,
      total: rowsView.length,
      onPrev: () => {
        const prev = rowsView[index - 1];
        if (prev) perf.selectRow(prev.row.supervisorId);
      },
      onNext: () => {
        const next = rowsView[index + 1];
        if (next) perf.selectRow(next.row.supervisorId);
      },
      prevLabel: drawerT("staff.perf.drawer.prev"),
      nextLabel: drawerT("staff.perf.drawer.next"),
    };
  }, [selectedEntry, rowsView, perf, drawerT]);



  const drawerSummary = useMemo(() => {
    if (!selectedEntry) return [];
    const row = selectedEntry.row;
    return [
      { label: drawerT("staff.perf.drawer.shops"), value: formatCount(row.shops) },
      { label: drawerT("staff.perf.drawer.trips"), value: formatCount(row.trips) },
      { label: drawerT("staff.perf.drawer.birds"), value: formatCount(row.birds) },
      { label: drawerT("staff.perf.drawer.weight"), value: `${formatCount(row.weight)} kg` },
      { label: drawerT("staff.perf.drawer.mortality"), value: formatCount(row.mortality) },
      { label: drawerT("staff.perf.drawer.mortality_rate"), value: formatPercent(row.mortalityRate) },
      { label: drawerT("staff.perf.drawer.weight_loss"), value: formatKg(row.weightLoss) },
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

  const selectedSupervisorName = useMemo(() => {
    if (applied.personId == null) return null;
    return (
      directory.options.find((option) => option.id === applied.personId)?.name ??
      `#${applied.personId}`
    );
  }, [applied.personId, directory.options]);

  const summaryLine = useMemo(() => {
    const parts = [
      appliedRangeLabel,
      selectedSupervisorName ?? t("staff.perf.filter.all_supervisors"),
    ];
    if (applied.search.trim()) {
      parts.push(`${t("staff.perf.summary.search_prefix")} “${applied.search.trim()}”`);
    }
    return parts.join("  ·  ");
  }, [appliedRangeLabel, applied.search, selectedSupervisorName, t]);

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
        kind="supervisors"
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

      {/* Supervisor Weekly Performance */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            {t("staff.perf.weekly.supervisor_header")}
          </h2>
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
            variant="panels"
            ariaLabel={t("staff.perf.weekly.aria_supervisor", { range: appliedRangeLabel })}
          />
        </div>
      </section>

      {/* Supervisor Performance table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            {t("staff.perf.supervisor_title")}
          </h2>
          <span className="min-w-0 text-[11px] font-medium text-slate-500">
            <span aria-hidden="true">—&nbsp;</span>
            {summaryLine}
          </span>
        </header>

        {showTableSkeleton ? (
          <TableLoading label={t("staff.table.loading.supervisor_perf")} />
        ) : showNoMatch ? (
          <EmptyState
            variant="no-search"
            title={t("staff.perf.table.no_match_title", {
              entity_l: t("staff.perf.entity_l.supervisors"),
            })}
            description={t("staff.perf.table.no_match_desc", {
              entity_l: t("staff.perf.entity_l.supervisors"),
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
            title={t("staff.perf.table.empty_supervisor_title")}
            description={t("staff.perf.table.empty_supervisor_desc")}
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
                      label={t("staff.perf.table.supervisor")}
                      sortKey="supervisor"
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
                    <SortableHeader label={t("staff.perf.table.shops")} sortKey="shops" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.birds")} sortKey="birds" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.weight")} sortKey="weight" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.mortality")} sortKey="mortality" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.mortality_rate")} sortKey="mortality_rate" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.weight_loss")} sortKey="weight_loss" sort={sort} onSortChange={handleSortChange} align="right" />
                    <SortableHeader label={t("staff.perf.table.grade")} sortKey="grade" sort={sort} onSortChange={handleSortChange} align="center" firstDir="asc" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedRows.map(({ row, rank, assessment }) => {
                    const selected = row.supervisorId === perf.selectedId;
                    const grade = assessment?.grade ?? null;
                    const toggle = () => perf.selectRow(selected ? null : row.supervisorId);
                    return (
                      <tr
                        key={row.supervisorId}
                        tabIndex={0}
                        aria-label={t("staff.perf.table.row_aria", {
                          name: personNameLabel(t, language, row.supervisorName),
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
                          {personNameLabel(t, language, row.supervisorName)}
                        </td>
                        <td className={`${perfTdClass} whitespace-nowrap text-xs text-slate-500`}>
                          {translateStatus(t, row.employeeStatus)}
                        </td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.trips)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.shops)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.birds)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.weight)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatCount(row.mortality)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatPercent(row.mortalityRate)}</td>
                        <td className={`${perfTdNumericClass} whitespace-nowrap`}>{formatDecimal(row.weightLoss, 1)}</td>
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
        title={personNameLabel(t, language, selectedEntry?.row.supervisorName ?? "")}
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
            ? drawerT("staff.perf.grade.unscored", { entity_single: drawerT("staff.perf.entity_single.supervisors") })
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
          <section aria-label={drawerT("staff.perf.drawer.recent_trips")}>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {drawerT("staff.perf.drawer.recent_trips")}
            </h3>
            <RecentTripsTable
              trips={personDetail.recentTrips}
              paceRow={selectedEntry?.row}
              paceKind="supervisors"
            />
          </section>
        )}
      </PerformanceDrawer>
    </div>
  );
};

export default memo(SupervisorPerformancePage);
