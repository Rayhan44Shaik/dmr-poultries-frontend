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

import { memo, useCallback, useMemo, useState } from "react";
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

import { useI18n } from "../../../i18n";
import { useStaffPerformance } from "../hooks/useStaffPerformance";
import { useStaffDirectory } from "../hooks/useStaffDirectory";
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
import PerformanceDrawer from "../components/performance/PerformanceDrawer";
import RecentTripsTable from "../components/performance/RecentTripsTable";
import Pagination from "../components/common/Pagination";
import RefreshToast from "../components/common/RefreshToast";
import { EmptyState, TableSkeleton } from "../../../ui";
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

  // Re-seed the draft + reset pagination when the applied set changes
  // (Search / Clear). Render-phase adjustment pattern — `applied` identity
  // changes exactly once per apply/clear, never while typing.
  const [currentPage, setCurrentPage] = useState(1);
  const [lastApplied, setLastApplied] = useState(applied);
  if (lastApplied !== applied) {
    setLastApplied(applied);
    setDraft({
      fromDate: applied.fromDate,
      toDate: applied.toDate,
      personId: applied.personId,
      search: applied.search,
    });
    setCurrentPage(1);
  }

  const updateDraft = useCallback((patch: Partial<PerformanceDraftFilters>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (next.fromDate && next.toDate && next.fromDate > next.toDate) {
        if (patch.fromDate) next.toDate = next.fromDate;
        else next.fromDate = next.toDate;
      }
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    perf.applyFilters({
      fromDate: draft.fromDate,
      toDate: draft.toDate,
      personId: draft.personId,
      search: draft.search,
    });
  }, [perf, draft]);

  const handleClear = useCallback(() => {
    perf.clearFilters();
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

  const totalPages = Math.max(1, Math.ceil(rowsView.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(
    () => sortedRowsView.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [sortedRowsView, safePage],
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
  // Visual hierarchy: the Birds bar carries the weekly volume (left axis,
  // tens of thousands); Weight is a trend line on the same scale, while
  // Mortality and Weight-loss are loss trends on the compact right axis —
  // lines can never visually overpower the volume they belong to.
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
        key: "weight",
        label: t("staff.perf.weekly.weight"),
        color: "#f59e0b",
        axis: "left",
        kind: "line",
        format: (value) => `${formatCount(value)} kg`,
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

  /* --------------------------- drawer state ----------------------------- */

  const selectedEntry = useMemo(
    () =>
      perf.selectedId != null
        ? rowsView.find((entry) => entry.row.supervisorId === perf.selectedId) ?? null
        : null,
    [rowsView, perf.selectedId],
  );

  const closeDrawer = useCallback(() => perf.selectRow(null), [perf]);

  const drawerSummary = useMemo(() => {
    if (!selectedEntry) return [];
    const row = selectedEntry.row;
    return [
      { label: t("staff.perf.drawer.shops"), value: formatCount(row.shops) },
      { label: t("staff.perf.drawer.trips"), value: formatCount(row.trips) },
      { label: t("staff.perf.drawer.birds"), value: formatCount(row.birds) },
      { label: t("staff.perf.drawer.weight"), value: `${formatCount(row.weight)} kg` },
      { label: t("staff.perf.drawer.mortality"), value: formatCount(row.mortality) },
      { label: t("staff.perf.drawer.mortality_rate"), value: formatPercent(row.mortalityRate) },
      { label: t("staff.perf.drawer.weight_loss"), value: formatKg(row.weightLoss) },
    ];
  }, [selectedEntry, t]);

  const drawerFactors = useMemo(
    () => (selectedEntry?.assessment ? buildDrawerFactors(selectedEntry.assessment, t) : []),
    [selectedEntry, t],
  );
  const drawerImprovements = useMemo(
    () => (selectedEntry?.assessment ? buildDrawerImprovements(selectedEntry.assessment, t) : []),
    [selectedEntry, t],
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
          <h2 className="text-[13px] font-bold tracking-tight text-slate-800">
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
            emptyText={t("staff.perf.weekly.empty")}
            loading={initialLoading}
            ariaLabel={t("staff.perf.weekly.aria_supervisor", { range: appliedRangeLabel })}
          />
        </div>
      </section>

      {/* Supervisor Performance table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <header className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-[13px] font-bold tracking-tight text-slate-800">
            {t("staff.perf.supervisor_title")}
          </h2>
          <span className="min-w-0 text-[11px] font-medium text-slate-500">
            <span aria-hidden="true">—&nbsp;</span>
            {summaryLine}
          </span>
        </header>

        {showTableSkeleton ? (
          <div className="p-4 sm:p-5">
            <TableSkeleton rows={6} columns={6} label={t("common.loading")} />
          </div>
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
                    <th scope="col" className={`${uiTableThClass} w-12 text-left`}>
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
                        aria-label={t("staff.perf.table.row_aria", { name: row.supervisorName })}
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
                        <td className={`${uiTableTdClass} text-center text-xs font-bold tabular-nums text-slate-500`}>
                          {rank}
                        </td>
                        <td className={`${uiTableTdClass} whitespace-nowrap text-[13px] font-semibold text-slate-900`}>
                          {row.supervisorName}
                        </td>
                        <td className={`${uiTableTdClass} whitespace-nowrap text-xs text-slate-500`}>
                          {row.employeeStatus}
                        </td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatCount(row.trips)}</td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatCount(row.shops)}</td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatCount(row.birds)}</td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatCount(row.weight)}</td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatCount(row.mortality)}</td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatPercent(row.mortalityRate)}</td>
                        <td className={`${uiTableTdNumericClass} whitespace-nowrap`}>{formatDecimal(row.weightLoss, 1)}</td>
                        <td className={`${uiTableTdClass} text-center`}>
                          {grade == null ? (
                            <span
                              title={t("staff.perf.grade.unranked")}
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
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </section>

      {/* Details drawer — opens from a row; no API calls, no page remount */}
      <PerformanceDrawer
        open={selectedEntry != null}
        onClose={closeDrawer}
        title={selectedEntry?.row.supervisorName ?? ""}
        subtitle={`${t("staff.perf.drawer.period")}: ${appliedRangeLabel}`}
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
            ? t("staff.perf.grade.unscored", { entity_l: t("staff.perf.entity_l.supervisors") })
            : undefined
        }
        summary={drawerSummary}
        factors={drawerFactors}
        improvements={drawerImprovements}
        labels={{
          summarySection: t("staff.perf.drawer.summary"),
          whySection: t("staff.perf.drawer.why"),
          improveSection: t("staff.perf.drawer.improve"),
          improveNone: t("staff.perf.drawer.improve_none"),
          recommendSection: t("staff.perf.drawer.recommend"),
          recommendSustain: t("staff.perf.drawer.recommend_sustain"),
          close: t("staff.perf.drawer.close"),
        }}
      >
        {selectedEntry && data.detail && (
          <section aria-label={t("staff.perf.drawer.recent_trips")}>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {t("staff.perf.drawer.recent_trips")}
            </h3>
            <RecentTripsTable trips={data.detail.recentTrips} />
          </section>
        )}
      </PerformanceDrawer>
    </div>
  );
};

export default memo(SupervisorPerformancePage);
