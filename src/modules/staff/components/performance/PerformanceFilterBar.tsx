// src/modules/staff/components/performance/PerformanceFilterBar.tsx
//
// ============================================================================
// PERFORMANCE FILTER BAR — Driver / Supervisor Performance filter card
// ============================================================================
// ONE shared bar for both performance pages. The box and every field inside it
// are the Trip List's: the same card surface and padding, the same 11px
// uppercase labels with their 17px glyphs, the same 40px date / search fields
// (shared <DatePicker> + `opsInputClass`), the same Reset button and the same
// hen pill. Only the page-level wording differs (Driver / Supervisor).
//
//   [From date] [To date] [Driver / Supervisor] [Search ………………] [Reset] [Refresh]
//      ▲            ▲             ▲                  ▲
//      └── every filter NAME is clickable: pressing it opens the field it
//          belongs to (date calendar, dropdown, or the search box).
//
// APPLYING FILTERS — no Search button
//   • A date or a driver is a discrete choice, so it applies the moment it is
//     picked (`onChange` → the page patches the draft AND runs the query).
//   • Typing applies after the same 300 ms pause the Leave page uses, so a
//     fast typist sends one request instead of one per character.
//   • Enter applies immediately.
//   • Applying identical filters is a no-op inside the hook, so the debounce
//     that follows an immediate apply cannot duplicate a request.
// ============================================================================

import {
  memo,
  useCallback,
  useId,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Calendar, Search, UserRound } from "lucide-react";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { DatePicker } from "../../../../components/common/DatePicker";
import { BrandRefreshButton, FilterResetButton } from "../../../../ui";
import { useI18n } from "../../../../i18n";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
} from "../../../../shared/ui/operationsStyles";
import { personNameLabel } from "../../utils/leaveDisplay";
import type { StaffPersonOption } from "../../hooks/useStaffDirectory";
import type { StaffPerformanceKind } from "../../types/performance";

/** Draft (not yet applied) filter values owned by the page. */
export interface PerformanceDraftFilters {
  fromDate: string;
  toDate: string;
  personId: number | null;
  search: string;
}

interface PerformanceFilterBarProps {
  kind: StaffPerformanceKind;
  /** Draft values (controlled). */
  value: PerformanceDraftFilters;
  /** Merge a patch into the draft — the page applies it (see APPLYING above). */
  onChange: (patch: Partial<PerformanceDraftFilters>) => void;
  /** Apply the draft right now (Enter in the search field). */
  onApply: () => void;
  /** Restore defaults and apply them. */
  onClear: () => void;
  /** Facets away from their defaults — drives the badge on Reset. */
  activeFilterCount?: number;
  /** Refresh the applied query. */
  onRefresh: () => void;
  /** Person options from the real employees master. */
  personOptions: StaffPersonOption[];
  personOptionsLoading: boolean;
  personOptionsError: string | null;
  /** Initial load in progress. */
  busy: boolean;
  /** Background refresh in progress (the hen dances while true). */
  refreshing: boolean;
}

function PerformanceFilterBarImpl({
  kind,
  value,
  onChange,
  onApply,
  onClear,
  activeFilterCount = 0,
  onRefresh,
  personOptions,
  personOptionsError,
  busy,
  refreshing,
}: PerformanceFilterBarProps) {
  const { t, language } = useI18n();
  const isDriver = kind === "drivers";
  const fieldId = useId();
  // The dropdown owns its trigger id so the label can point straight at it —
  // that is what makes a click on the filter NAME open the list.
  const personFieldId = `${fieldId}-person`;

  const personLabel = isDriver
    ? t("staff.perf.filter.driver")
    : t("staff.perf.filter.supervisor");
  const allLabel = isDriver
    ? t("staff.perf.filter.all_drivers")
    : t("staff.perf.filter.all_supervisors");
  const searchPlaceholder = isDriver
    ? t("staff.perf.filter.search_driver")
    : t("staff.perf.filter.search_supervisor");
  const listError = isDriver
    ? t("staff.perf.filter.drivers_unavailable")
    : t("staff.perf.filter.supervisors_unavailable");

  /* Memoized: typing re-renders this bar, and rebuilding the whole driver list
     on every keystroke is exactly the stall the Leave page had. */
  const personItems = useMemo(
    () =>
      personOptions.map((option) => ({
        value: String(option.id),
        label: personNameLabel(t, language, option.name),
        // Telugu label, English search: typing "anil" still finds Anil Kumar.
        keywords: option.name,
      })),
    [personOptions, t, language],
  );

  const handleSubmit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      onApply();
    },
    [onApply],
  );

  // Enter inside the search field applies at once (the debounce then no-ops).
  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onApply();
      }
    },
    [onApply],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={opsFilterCardClass}
      aria-busy={busy || refreshing || undefined}
    >
      {/* ONE line: dates, person, search, then the actions. It wraps only when
          the screen is genuinely too narrow for the row. */}
      <div className="flex flex-wrap items-end gap-3.5">
        <div className="w-[14.8rem] shrink-0">
          <label htmlFor={`${fieldId}-from`} className={`${opsFilterLabelClass} cursor-pointer`}>
            <Calendar size={17} className="shrink-0 text-emerald-500" />
            <span>{t("staff.perf.filter.from_date")}</span>
          </label>
          <DatePicker
            id={`${fieldId}-from`}
            value={value.fromDate}
            onChange={(date) => onChange({ fromDate: date })}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
          />
        </div>

        <div className="w-[14.8rem] shrink-0">
          <label htmlFor={`${fieldId}-to`} className={`${opsFilterLabelClass} cursor-pointer`}>
            <Calendar size={17} className="shrink-0 text-emerald-500" />
            <span>{t("staff.perf.filter.to_date")}</span>
          </label>
          <DatePicker
            id={`${fieldId}-to`}
            value={value.toDate}
            onChange={(date) => onChange({ toDate: date })}
            placeholder={t("placeholder.enter_date")}
            className="w-full text-xs font-medium"
          />
        </div>

        {/* The label points at the dropdown trigger (`htmlFor` → button id), so
            clicking "Driver" opens the list, exactly like the date labels open
            their calendars. */}
        <div className="w-[14.8rem] shrink-0">
          <label
            htmlFor={personFieldId}
            className={`${opsFilterLabelClass} cursor-pointer`}
          >
            <UserRound size={17} className="shrink-0 text-emerald-500" />
            <span>{personLabel}</span>
          </label>
          <MasterDropdown
            hideLabel
            triggerId={personFieldId}
            label={personLabel}
            value={value.personId != null ? String(value.personId) : ""}
            options={personItems}
            onChange={(next) => onChange({ personId: next ? Number(next) : null })}
            placeholder={allLabel}
            searchable
            allowClear
            className="w-full"
            error={personOptionsError ? listError : undefined}
          />
        </div>

        <div
          className="min-w-[13rem] flex-1 basis-[15rem]"
          onKeyDown={handleSearchKeyDown}
        >
          {/* No Search button here (by design): the term applies as it is
              typed after the 300 ms pause, exactly like Leave. */}
          <label htmlFor={fieldId} className={`${opsFilterLabelClass} cursor-pointer`}>
            <Search size={17} className="shrink-0 text-slate-400" />
            <span>{t("staff.perf.filter.search_label")}</span>
          </label>
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id={fieldId}
              type="text"
              aria-label={t("staff.perf.filter.search_label")}
              value={value.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder={searchPlaceholder}
              className={`${opsInputClass} pl-10`}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Reset is the Trip List's secondary action, verbatim. */}
          <FilterResetButton
            count={activeFilterCount}
            onClick={onClear}
            aria-label={t("staff.perf.filter.clear_action")}
          />

          {/* The hen pill: identical to the Trip List, so "reload this page"
              looks the same everywhere. It dances while the data refreshes. */}
          <BrandRefreshButton
            type="button"
            loading={refreshing}
            onClick={onRefresh}
            ariaLabel={t("staff.perf.filter.refresh_action")}
          >
            {t("common.refresh")}
          </BrandRefreshButton>
        </div>
      </div>

      {personOptionsError && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-rose-600">
          {listError}
        </p>
      )}
    </form>
  );
}

/**
 * Render-stability: the bar re-renders only when its own props change. The
 * page keeps every callback stable, so typing in the search field re-renders
 * just this subtree — never the table or chart.
 */
const PerformanceFilterBar = memo(PerformanceFilterBarImpl);
export default PerformanceFilterBar;
