// src/modules/operations/mortality/pages/MortalityEntryPage.tsx
// MORTALITY & WEIGHT LOSS ANALYSIS
//
// A pure analysis page driven by COMPLETED TRIPS. One row = one completed trip.
// Farm input -> delivery output -> mortality -> weight loss.
//
// There is no manual mortality entry form and no mortality register on this
// page — mortality figures come from the Trip model itself.
//
// LAYOUT ORDER (fixed): FILTER BAR -> KPI CARDS -> COMPLETED TRIPS TABLE.
// The table of completed trips is ALWAYS visible (every trip, regardless of the
// filter controls). The KPI cards appear only when a real filter is Applied, and
// they summarise that applied subset (e.g. a date range, or a single supervisor).

import { useCallback, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import LossFilters from "../components/LossFilters";
import LossKpiCards from "../components/LossKpiCards";
import TripLossTable from "../components/TripLossTable";
import { useTripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { opsPageClass } from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";

export default function MortalityEntryPage() {
  const analysis = useTripLossAnalysis();
  const { showNotification } = useSafeNotification();
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);

  // APPLY — commit the current controls to the KPI summary. The table is
  // unaffected; it keeps showing every completed trip.
  const handleApply = useCallback(() => {
    analysis.applyFilters();
    showNotification(
      t(
        analysis.totalRecords === 1
          ? "ops.mortality.toast.search_result_one"
          : "ops.mortality.toast.search_result",
        { count: analysis.totalRecords }
      ),
      "success"
    );
  }, [analysis, showNotification, t]);

  // Refresh: reload completed trips, preserving the current page.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await analysis.refresh();
      showNotification(t("ops.mortality.toast.refreshed"), "success");
    } catch {
      showNotification(t("ops.mortality.toast.refresh_failed"), "error");
    } finally {
      setRefreshing(false);
    }
  }, [analysis, showNotification, t]);

  const handleReset = useCallback(() => {
    analysis.resetFilters();
    showNotification(t("ops.mortality.toast.reset"), "info");
  }, [analysis, showNotification, t]);

  // Generic empty state: no completed trips exist at all.
  const showEmptyAll = !analysis.hasTrips;

  return (
    <div className={opsPageClass}>
      {/* ── 1. GLOBAL FILTER BAR ─────────────────────────────────── */}
      <LossFilters
        filters={analysis.filters}
        setFilters={analysis.setFilters}
        farmOptions={analysis.farmOptions}
        supervisorOptions={analysis.supervisorOptions}
        onApply={handleApply}
        onReset={handleReset}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ── 2. KPIs — only when a real filter is Applied ────────── */}
      {analysis.kpisVisible && !analysis.error && (
        <section className="space-y-2">
          <p className="text-[12px] font-medium text-slate-500">
            {t("ops.mortality.kpi.filtered_summary")}
          </p>
          <LossKpiCards kpis={analysis.kpis} loading={analysis.loading} />
        </section>
      )}

      {/* ── 3. COMPLETED TRIPS — always visible ───────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-700">
            {t("ops.mortality.section.completed_trips")}
          </h3>
        </div>

        {analysis.error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle size={18} />
            </span>
            <p className="text-[13px] font-semibold text-slate-700">
              {t("ops.mortality.error.title")}
            </p>
            <p className="max-w-md text-xs text-slate-500">{analysis.error}</p>
            <button
              type="button"
              onClick={analysis.retry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <RotateCcw size={14} />
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <TripLossTable
            records={analysis.records}
            sort={analysis.sort}
            setSort={analysis.setSort}
            page={analysis.page}
            totalPages={analysis.totalPages}
            totalRecords={analysis.totalRecords}
            pageSize={analysis.pageSize}
            onPageChange={analysis.setPage}
            onPageSizeChange={analysis.setPageSize}
            loading={analysis.loading}
            emptyAll={showEmptyAll}
            onReset={handleReset}
          />
        )}
      </section>
    </div>
  );
}
