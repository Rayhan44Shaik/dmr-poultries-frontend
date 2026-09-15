// src/modules/staff/components/performance/PerformanceFilterBar.tsx
//
// ============================================================================
// PERFORMANCE FILTER BAR — Driver / Supervisor Performance filter card
// ============================================================================
// ONE shared bar for both performance pages, built from the same global pieces
// as the Leave page's filter card and the Trip List's action row, and laid out
// as a SINGLE LINE on a desktop:
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
//
// DESIGN SOURCES (all global — no page-specific chrome)
//   • Card       → `uiCardClass`; labels are `uiFilterLabelClass` (11px
//                  uppercase, 13px glyph) like Leave and the Trip List.
//   • Dates      → the shared <DatePicker> (opens on focus, so a label click
//                  opens the calendar).
//   • Dropdown   → the shared <MasterDropdown> (`keywords` keeps English
//                  search working under Telugu labels).
//   • Search     → the global 44px filter field (`uiFilterSearchFieldClass`).
//   • Actions    → Reset (`uiFilterResetButtonClass`) and the Trip List's
//                  <BrandRefreshButton> hen pill, whose dance IS the loading
//                  animation.
// ============================================================================

import {
  memo,
  useCallback,
  useId,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Calendar, CalendarCheck, RotateCcw, Search, UserRound } from "lucide-react";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { DatePicker } from "../../../../components/common/DatePicker";
import { BrandRefreshButton } from "../../../../ui";
import { useI18n } from "../../../../i18n";
import {
  uiCardClass,
  uiFilterLabelClass,
  uiFilterResetButtonClass,
  uiFilterSearchFieldClass,
} from "../../../../shared/ui/uiTokens";
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

/** Reset icon with its own "rewind" hover animation, like the Trip List. */
function AnimatedResetIcon() {
  return (
    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)] motion-safe:group-focus-visible:animate-[var(--animate-action-reset)]">
      <RotateCcw size={14} aria-hidden="true" />
    </span>
  );
}

function PerformanceFilterBarImpl({
  kind,
  value,
  onChange,
  onApply,
  onClear,
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
      className={`${uiCardClass} p-4 md:p-5`}
      aria-busy={busy || refreshing || undefined}
    >
      {/* ONE line: dates, person, search, then the actions. It wraps only when
          the screen is genuinely too narrow for the row. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[9.5rem] flex-1 basis-[9.5rem]">
          <label htmlFor={`${fieldId}-from`} className={`${uiFilterLabelClass} cursor-pointer`}>
            <Calendar size={13} className="shrink-0 text-emerald-500" />
            <span>{t("staff.perf.filter.start_date")}</span>
          </label>
          <DatePicker
            id={`${fieldId}-from`}
            value={value.fromDate}
            onChange={(date) => onChange({ fromDate: date })}
            placeholder={t("placeholder.enter_date")}
            className="w-full"
          />
        </div>

        <div className="min-w-[9.5rem] flex-1 basis-[9.5rem]">
          <label htmlFor={`${fieldId}-to`} className={`${uiFilterLabelClass} cursor-pointer`}>
            <CalendarCheck size={13} className="shrink-0 text-emerald-500" />
            <span>{t("staff.perf.filter.end_date")}</span>
          </label>
          <DatePicker
            id={`${fieldId}-to`}
            value={value.toDate}
            onChange={(date) => onChange({ toDate: date })}
            placeholder={t("placeholder.enter_date")}
            className="w-full"
          />
        </div>

        {/* The label points at the dropdown trigger (`htmlFor` → button id), so
            clicking "Driver" opens the list, exactly like the date labels open
            their calendars. */}
        <div className="min-w-[11rem] flex-1 basis-[11rem]">
          <label
            htmlFor={personFieldId}
            className={`${uiFilterLabelClass} cursor-pointer`}
          >
            <UserRound size={13} className="shrink-0 text-emerald-500" />
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
          className="min-w-[14rem] flex-[1.7] basis-[16rem]"
          onKeyDown={handleSearchKeyDown}
        >
          <label htmlFor={fieldId} className={`${uiFilterLabelClass} cursor-pointer`}>
            <Search size={17} className="shrink-0 text-slate-400" />
            <span>{t("staff.perf.filter.search_label")}</span>
            {/* No Search button: the term applies as it is typed, and the label
                says so instead of leaving people hunting for a button. */}
            <span className="text-[11px] font-normal text-slate-400">
              {' · '}
              {t("staff.perf.filter.search_live")}
            </span>
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
              className={uiFilterSearchFieldClass}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Reset shares the Leave page's action styling; the accessible name
              keeps the longer "clear filters" phrasing. */}
          <button
            type="button"
            onClick={onClear}
            className={uiFilterResetButtonClass}
            aria-label={t("staff.perf.filter.clear_action")}
          >
            <AnimatedResetIcon />
            {t("common.reset")}
          </button>

          {/* The hen pill: identical to the Trip List, so "reload this page"
              looks the same everywhere. It dances while the data refreshes. */}
          <BrandRefreshButton
            type="button"
            size="lg"
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
