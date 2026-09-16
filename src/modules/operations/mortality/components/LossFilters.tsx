// src/modules/operations/mortality/components/LossFilters.tsx
// GLOBAL FILTER BAR — the Trip List surface, reused verbatim for
// Weight Loss / Mortality: FROM · TO · FARM · SUPERVISOR on the first row, then
// SORT BY · SEARCH · actions (Search / Reset / Refresh) on the second.
//
// Every control is the shared one, never a hand-rolled native element:
//   · DatePicker      — the project calendar (Monday-start week convention)
//   · MasterDropdown  — the searchable, clearable reference picker used by the
//                       Trip List for Farm / Supervisor (a plain <select> could
//                       not be searched, so a 150-name list was unusable)
//   · BrandRefreshButton — the hen, the app's one refresh treatment
//
// These controls modify DRAFT filters only. Changing them does NOT affect the table.
// Clicking SEARCH copies draft → applied filters, which then:
//   - Filters the completed-trips table
//   - Shows the cumulative summary BELOW the table (if a real filter was set)
//   - Shows the Applied Filters indicator above the table
// Reset clears draft + applied filters, hides the indicator and the summary, and
// restores the table to ALL trips.
//
// Both calendars follow the page language, so a Telugu page gets a Telugu calendar.
// Sort BY applies immediately (it is a view control, not a data filter).

import { ArrowUpDown, Calendar, RotateCcw, Search, UserCog, Warehouse, X } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../../masters/components/MasterDropdown";
import type { LossFilters as Filters, LossSort } from "../hooks/useTripLossAnalysis";
import type { SortBy } from "../services/mortalityAnalysisApi";
import { useI18n } from "../../../../i18n";

interface LossFiltersProps {
  filters: Filters;
  setFilters: (updater: (prev: Filters) => Filters) => void;
  /** The filter the table + cumulative summary are running with. Comparing it with
   *  the draft controls is what tells the operator that Search is still to be
   *  pressed — otherwise an edited dropdown looks like a broken filter. */
  appliedFilters: Filters;
  farmOptions: string[];
  supervisorOptions: string[];
  /** Current server-side sort (also driven by the table headers). */
  sort: LossSort;
  setSort: (next: LossSort) => void;
  onApply: () => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

/** Three ordering vocabularies, matching the Trip List: names sort A→Z, the
 *  day sorts by recency (never "Z to A"), and every measured column sorts by
 *  magnitude. */
const TEXT_SORT_KEYS = new Set<SortBy>(["tripNo", "sourceFarm", "supervisorName"]);
const DATE_SORT_KEYS = new Set<SortBy>(["tripDate"]);

const SORT_FIELDS: { key: SortBy; labelKey: string }[] = [
  { key: "tripNo", labelKey: "operations.trip_no" },
  { key: "tripDate", labelKey: "ops.trip.day" },
  { key: "sourceFarm", labelKey: "ops.trip.source_farm" },
  { key: "supervisorName", labelKey: "common.supervisor" },
  { key: "farmBirds", labelKey: "ops.mortality.kpi.farm_birds" },
  { key: "farmWeight", labelKey: "ops.mortality.kpi.farm_weight" },
  { key: "deliveryShops", labelKey: "ops.mortality.kpi.delivery_shops" },
  { key: "deliveredBirds", labelKey: "ops.mortality.kpi.delivered_birds" },
  { key: "deliveredWeight", labelKey: "ops.mortality.kpi.delivery_weight" },
  { key: "mortalityCount", labelKey: "ops.mortality.kpi.mortality_birds" },
  { key: "mortalityWeight", labelKey: "ops.mortality.kpi.mortality_weight" },
  { key: "mortalityPercentage", labelKey: "ops.mortality.kpi.mortality_pct" },
  { key: "weightLoss", labelKey: "ops.mortality.kpi.weight_loss" },
  { key: "weightLossPercentage", labelKey: "ops.mortality.kpi.weight_loss_pct" },
];

export default function LossFilters({
  filters,
  setFilters,
  appliedFilters,
  farmOptions,
  supervisorOptions,
  sort,
  setSort,
  onApply,
  onReset,
  onRefresh,
  refreshing = false,
}: LossFiltersProps) {
  const { t, language } = useI18n();
  const patch = (partial: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...partial }));

  // Draft vs applied: any difference means the operator still has to press
  // Search, so the button announces it instead of leaving the table silent.
  const pendingChanges = (Object.keys(filters) as Array<keyof Filters>).filter(
    (key) => (filters[key] ?? "").trim() !== (appliedFilters[key] ?? "").trim()
  ).length;
  const hasPendingChanges = pendingChanges > 0;

  // "All …" is the empty value, so the dropdown shows its placeholder and the
  // clear affordance behaves exactly like the Trip List filters.
  const farmDropdownOptions: MasterDropdownOption[] = farmOptions.map((farm) => ({
    value: farm,
    label: farm,
    searchText: farm,
  }));
  const supervisorDropdownOptions: MasterDropdownOption[] = supervisorOptions.map((name) => ({
    value: name,
    label: name,
    searchText: name,
  }));

  // Field + direction, both translated, so a Telugu session never reads an
  // English ordering label.
  const sortOptions: MasterDropdownOption[] = SORT_FIELDS.flatMap(({ key, labelKey }) => {
    const label = t(labelKey);
    const [low, high] = DATE_SORT_KEYS.has(key)
      ? [t("ops.trip.sort_oldest_first"), t("ops.trip.sort_latest_first")]
      : TEXT_SORT_KEYS.has(key)
        ? [t("ops.trip.sort_az"), t("ops.trip.sort_za")]
        : [t("ops.trip.sort_low_high"), t("ops.trip.sort_high_low")];
    return [
      { value: `${key}:asc`, label: `${label} — ${low}`, searchText: `${label} ${low}` },
      { value: `${key}:desc`, label: `${label} — ${high}`, searchText: `${label} ${high}` },
    ];
  });
  const sortValue = `${sort.key}:${sort.dir}`;
  const setSortValue = (value: string) => {
    if (!value) return;
    const separator = value.lastIndexOf(":");
    const key = value.slice(0, separator) as SortBy;
    const direction = value.slice(separator + 1) === "asc" ? "asc" : "desc";
    if (!SORT_FIELDS.some((field) => field.key === key)) return;
    setSort({ key, dir: direction });
  };

  return (
    <div className={opsFilterCardClass}>
      {/* ── ROW 1 — FROM · TO · FARM · SUPERVISOR ───────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* FROM */}
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="flex-shrink-0 text-emerald-500" />
            <span>{t("common.from")}</span>
          </label>
          <DatePicker
            value={filters.fromDate}
            onChange={(fromDate) => patch({ fromDate })}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
            name="mortality-from-date"
            language={language}
          />
        </div>

        {/* TO */}
        <div>
          <label className={opsFilterLabelClass}>
            <Calendar size={17} className="flex-shrink-0 text-emerald-500" />
            <span>{t("common.to")}</span>
          </label>
          <DatePicker
            value={filters.toDate}
            onChange={(toDate) => patch({ toDate })}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
            name="mortality-to-date"
            language={language}
          />
        </div>

        {/* SOURCE FARM */}
        <div>
          <label className={opsFilterLabelClass}>
            <Warehouse size={17} className="flex-shrink-0 text-amber-500" />
            <span>{t("ops.trip.source_farm")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("ops.trip.source_farm")}
            value={filters.sourceFarm}
            options={farmDropdownOptions}
            onChange={(next) => patch({ sourceFarm: next })}
            placeholder={t("ops.mortality.filter.all_farms")}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        {/* SUPERVISOR */}
        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={17} className="flex-shrink-0 text-emerald-500" />
            <span>{t("common.supervisor")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("common.supervisor")}
            value={filters.supervisor}
            options={supervisorDropdownOptions}
            onChange={(next) => patch({ supervisor: next })}
            placeholder={t("ops.mortality.filter.all_supervisors")}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      {/* ── ROW 2 — SORT BY · SEARCH · ACTIONS ──────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 pt-1 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-3">
          <label className={opsFilterLabelClass}>
            <ArrowUpDown size={17} className="flex-shrink-0 text-violet-500" />
            <span>{t("ops.trip.sort_by")}</span>
          </label>
          <MasterDropdown
            hideLabel
            label={t("ops.trip.sort_by")}
            value={sortValue}
            options={sortOptions}
            onChange={setSortValue}
            placeholder={t("ops.trip.no_sorting")}
            searchable
            className="w-full"
          />
        </div>

        <div className="lg:col-span-5">
          <label className={opsFilterLabelClass}>
            <Search size={17} className="flex-shrink-0 text-slate-400" />
            <span>{t("common.search")}</span>
          </label>
          {/* The field and the magnifier share one focus state, so clicking the
              input plays the search animation on the glyph and lights the ring. */}
          <div className="group relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-600 motion-safe:group-focus-within:animate-[var(--animate-action-search)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => patch({ search: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") onApply();
              }}
              placeholder={t("ops.mortality.filter.search_placeholder")}
              className={`${opsInputClass} pl-10 pr-9`}
              aria-label={t("common.search")}
            />
            {filters.search.trim() !== "" && (
              <button
                type="button"
                onClick={() => patch({ search: "" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label={t("common.clear")}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-4">
          <button
            type="button"
            onClick={onApply}
            className={`group relative ${opsPrimaryButtonClass} ${
              hasPendingChanges ? "ring-2 ring-emerald-300/70 ring-offset-1" : ""
            }`}
            aria-label={t("common.search")}
            title={hasPendingChanges ? t("ops.mortality.filter.pending_changes", { count: pendingChanges }) : t("common.search")}
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-search)]">
              <Search size={15} />
            </span>
            {t("common.search")}
            {hasPendingChanges && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold tabular-nums">
                {pendingChanges}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t("common.reset")}
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]">
              <RotateCcw size={14} />
            </span>
            {t("common.reset")}
          </button>
          <BrandRefreshButton onClick={onRefresh} loading={refreshing} />
        </div>
      </div>
    </div>
  );
}
