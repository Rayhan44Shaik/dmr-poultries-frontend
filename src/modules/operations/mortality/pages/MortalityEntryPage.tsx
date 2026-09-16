// src/modules/operations/mortality/pages/MortalityEntryPage.tsx
// MORTALITY & WEIGHT LOSS ANALYSIS
//
// A pure analysis page driven by COMPLETED TRIPS. One row = one completed trip.
// Farm input -> delivery output -> mortality -> weight loss.
//
// There is no manual mortality entry form and no mortality register on this
// page — mortality figures come from the Trip model itself.
//
// LAYOUT ORDER (fixed): FILTER BAR -> APPLIED FILTERS INDICATOR -> COMPLETED TRIPS
// TABLE -> CUMULATIVE SUMMARY.
//
// The table of completed trips is ALWAYS visible. By default it shows ALL completed
// trips. When a real filter is Applied via Search, the table shows ONLY filtered
// trips, an Applied Filters indicator appears above it, and the CUMULATIVE SUMMARY
// appears BELOW it — the totals for the whole filtered set, identical on every page,
// never a page-by-page breakdown and never a row of KPI cards.
// Changing filter controls does NOT affect the table until Search is clicked.
// Reset clears all filters, hides the indicator and the summary, and restores the
// table to ALL trips.

import { useCallback, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import LossFilters from "../components/LossFilters";
import CumulativeSummary from "../components/CumulativeSummary";
import TripLossTable from "../components/TripLossTable";
import AppliedFiltersIndicator from "../components/AppliedFiltersIndicator";
import { useTripLossAnalysis } from "../hooks/useTripLossAnalysis";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { opsPageClass } from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";

// The unit on every weight figure. It is domain vocabulary for the floor, so it
// reads in Telugu whatever the interface language — a weight never prints the
// Latin "Kg" on this page. Change it here once and every figure follows.
export const MORTALITY_WEIGHT_UNIT = "కేజీ";

export default function MortalityEntryPage() {
  const analysis = useTripLossAnalysis();
  const { showNotification } = useSafeNotification();
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);

  // APPLY — commit the current controls, filter the table, reveal the cumulative
  // summary and the applied-filters indicator, and reset pagination to page 1.
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
        appliedFilters={analysis.appliedFilters}
        farmOptions={analysis.farmOptions}
        supervisorOptions={analysis.supervisorOptions}
        sort={analysis.sort}
        setSort={analysis.setSort}
        onApply={handleApply}
        onReset={handleReset}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* ── Applied filters indicator (only after Search with real filter) ────────── */}
      {analysis.summaryVisible && (
        <AppliedFiltersIndicator
          appliedFilters={analysis.appliedFilters}
          onClear={handleReset}
        />
      )}

      {/* ── 2. COMPLETED TRIPS — always visible. The card carries its own
             header bar (glyph + title + count), exactly like the Trip List, so
             no duplicate heading is rendered above it. ───────────────── */}
      <section>
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
            reloading={analysis.reloading}
            emptyAll={showEmptyAll}
            filtersApplied={analysis.summaryVisible}
            onReset={handleReset}
            weightUnit={MORTALITY_WEIGHT_UNIT}
          />
        )}
      </section>

      {/* ── 3. CUMULATIVE SUMMARY — below the table, only after a Search with a
             real filter, and always the totals for EVERY page of the filtered
             set (the server aggregates before paging). ─────────────────── */}
      {analysis.summaryReady && !analysis.error && analysis.totalRecords > 0 && (
        <CumulativeSummary
          kpis={analysis.kpis}
          totalRecords={analysis.totalRecords}
          pageSize={analysis.pageSize}
          weightUnit={MORTALITY_WEIGHT_UNIT}
        />
      )}
    </div>
  );
}
