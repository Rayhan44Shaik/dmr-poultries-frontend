// src/modules/operations/mortality/components/LossFilters.tsx
// Global filter bar — FROM · TO · SOURCE FARM · SUPERVISOR  /  SEARCH FIELD · Search · Reset · Refresh.
//
// Reuses the project's global DatePicker (Monday-start week convention) and the
// shared Operations filter/button styling. No duplicate calendar implementation.
//
// These controls modify DRAFT filters only. Changing them does NOT affect the table.
// Clicking SEARCH copies draft → applied filters, which then:
//   - Filters the completed-trips table
//   - Shows KPI cards (if a real filter was set)
//   - Shows Applied Filters indicator
// Reset clears draft + applied filters, hides KPI/indicator, restores table to ALL trips.

import { RotateCcw, RefreshCw, Search, UserCheck, Warehouse } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSelectClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
  opsIconButtonClass,
} from "../../../../shared/ui/operationsStyles";
import type { LossFilters as Filters } from "../hooks/useTripLossAnalysis";
import { useI18n } from "../../../../i18n";

interface LossFiltersProps {
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  farmOptions: string[];
  supervisorOptions: string[];
  onApply: () => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export default function LossFilters({
  filters,
  setFilters,
  farmOptions,
  supervisorOptions,
  onApply,
  onReset,
  onRefresh,
  refreshing = false,
}: LossFiltersProps) {
  const { t } = useI18n();
  const patch = (partial: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...partial }));

  return (
    <div className={opsFilterCardClass}>
      {/* ── ROW 1 — FROM · TO · SOURCE FARM · SUPERVISOR ───────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* FROM */}
        <div>
          <label className={opsFilterLabelClass}>
            <span>{t("common.from")}</span>
          </label>
          <DatePicker
            value={filters.fromDate}
            onChange={(fromDate) => patch({ fromDate })}
            placeholder={t("common.from")}
            className="w-full text-xs font-medium"
            name="mortality-from-date"
          />
        </div>

        {/* TO */}
        <div>
          <label className={opsFilterLabelClass}>
            <span>{t("common.to")}</span>
          </label>
          <DatePicker
            value={filters.toDate}
            onChange={(toDate) => patch({ toDate })}
            placeholder={t("common.to")}
            className="w-full text-xs font-medium"
            name="mortality-to-date"
          />
        </div>

        {/* SOURCE FARM */}
        <div>
          <label className={opsFilterLabelClass}>
            <Warehouse size={13} className="flex-shrink-0 text-emerald-600" />
            <span>{t("ops.trip.source_farm")}</span>
          </label>
          <select
            value={filters.sourceFarm}
            onChange={(e) => patch({ sourceFarm: e.target.value })}
            className={opsSelectClass}
            aria-label={t("ops.trip.source_farm")}
          >
            <option value="">{t("ops.mortality.filter.all_farms")}</option>
            {farmOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* SUPERVISOR */}
        <div>
          <label className={opsFilterLabelClass}>
            <UserCheck size={13} className="flex-shrink-0 text-emerald-600" />
            <span>{t("common.supervisor")}</span>
          </label>
          <select
            value={filters.supervisor}
            onChange={(e) => patch({ supervisor: e.target.value })}
            className={opsSelectClass}
            aria-label={t("common.supervisor")}
          >
            <option value="">{t("ops.mortality.filter.all_supervisors")}</option>
            {supervisorOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── ROW 2 — SEARCH FIELD · RESET · REFRESH ────────── */}
      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className={opsFilterLabelClass}>
            <Search size={13} className="flex-shrink-0 text-emerald-600" />
            <span>{t("common.search")}</span>
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder={t("ops.mortality.filter.search_placeholder")}
              className={`${opsInputClass} pl-10`}
              aria-label={t("common.search")}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onApply} className={opsPrimaryButtonClass}>
            <Search size={14} />
            {t("common.search")}
          </button>
          <button type="button" onClick={onReset} className={opsSecondaryButtonClass}>
            <RotateCcw size={14} />
            {t("common.reset")}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={`${opsIconButtonClass} h-10 w-10 rounded-xl`}
            title={t("common.refresh")}
            aria-label={t("common.refresh")}
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
