// src/modules/staff/components/performance/PerformanceFilterBar.tsx
//
// ============================================================================
// PERFORMANCE FILTER BAR — Driver / Supervisor Performance filter card
// ============================================================================
// ONE shared bar for both performance pages, built from the same global pieces
// as the Leave page's filter card and the Trip List's action row:
//
//   Row 1  [Start date]  [End date]  [Driver / Supervisor]
//   Row 2  [Search field .....................]   [Search] [Reset] [Refresh]
//
// DESIGN SOURCES (all global — no page-specific chrome)
//   • Card       → `uiCardClass`, the same white rounded card every list page
//                  uses; labels are `uiFilterLabelClass` at the same 11px
//                  uppercase weight as Leave, each with its 13px glyph.
//   • Dates      → the shared <DatePicker>.
//   • Dropdown   → the shared <MasterDropdown> (searchable, portalled menu,
//                  ArrowUp/Down, Home/End, Enter, Escape, typeahead).
//   • Search     → the global 44px filter field (`uiFilterSearchFieldClass`) —
//                  identical to the Leave page's search box.
//   • Actions    → Search (`uiFilterSearchButtonClass`) and Reset
//                  (`uiFilterResetButtonClass`), the two global filter
//                  actions, each with the hover animation + tooltip the Trip
//                  List and Leave page use.
//   • Refresh    → <BrandRefreshButton>: the orange hen pill whose dance IS
//                  the loading animation, exactly as on the Trip List.
//
// BEHAVIOUR
//   • Fully controlled: edits only touch DRAFT state. Nothing is applied until
//     Search (button, or Enter in the search field / form) — so editing a
//     filter can never fire a request on its own.
//   • Applying identical filters is a no-op inside the hook, so a double click
//     or Enter + click cannot duplicate a request.
//   • The person list is memoized on its real inputs: typing in the search box
//     re-renders only the field, never the driver list behind it.
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
  uiFilterSearchButtonClass,
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
  /** Merge a patch into the draft. */
  onChange: (patch: Partial<PerformanceDraftFilters>) => void;
  /** Apply the draft as ONE query (Search). */
  onApply: () => void;
  /** Restore defaults and apply them. */
  onClear: () => void;
  /** Refresh the applied query. */
  onRefresh: () => void;
  /** Person options from the real employees master. */
  personOptions: StaffPersonOption[];
  personOptionsLoading: boolean;
  personOptionsError: string | null;
  /** Initial load in progress (Search shows its spinner while true). */
  busy: boolean;
  /** Background refresh in progress (the hen dances while true). */
  refreshing: boolean;
}

/** Search icon that reacts to the button's hover/focus, like every action. */
function AnimatedSearchIcon() {
  return (
    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-search)] motion-safe:group-focus-visible:animate-[var(--animate-action-search)]">
      <Search size={15} aria-hidden="true" />
    </span>
  );
}

/** Reset icon with its own "rewind" hover animation. */
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
  personOptionsLoading,
  personOptionsError,
  busy,
  refreshing,
}: PerformanceFilterBarProps) {
  const { t, language } = useI18n();
  const isDriver = kind === "drivers";
  const fieldId = useId();

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

  /* Memoized: typing in the search box re-renders this bar, and rebuilding the
     whole driver list on every keystroke is exactly the stall the Leave page
     had. The list only changes when the master data does. */
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

  const handleApply = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      onApply();
    },
    [onApply],
  );

  // Enter inside the search field applies the draft once. The field is inside
  // the form, so the browser would submit anyway — preventDefault keeps this
  // the ONLY activation path (no double request).
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
      onSubmit={handleApply}
      className={`${uiCardClass} space-y-4 p-4 md:p-5`}
      aria-busy={busy || refreshing || undefined}
    >
      {/* Row 1 — the period, then the person */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor={`${fieldId}-from`} className={uiFilterLabelClass}>
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

        <div>
          <label htmlFor={`${fieldId}-to`} className={uiFilterLabelClass}>
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

        <div>
          <label className={uiFilterLabelClass}>
            <UserRound size={13} className="shrink-0 text-emerald-500" />
            <span>{personLabel}</span>
          </label>
          <MasterDropdown
            hideLabel
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
      </div>

      {/* Row 2 — search on the left, actions on the right (Leave page layout) */}
      <div className="grid grid-cols-1 items-end gap-3.5 lg:grid-cols-12">
        <div className="lg:col-span-5 2xl:col-span-4" onKeyDown={handleSearchKeyDown}>
          <label htmlFor={fieldId} className={uiFilterLabelClass}>
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
              className={uiFilterSearchFieldClass}
            />
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-2 lg:col-span-7 2xl:col-span-8">
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className={uiFilterSearchButtonClass}
            aria-label={t("staff.perf.filter.search_action")}
          >
            <AnimatedSearchIcon />
            {t("staff.perf.filter.search_action")}
          </button>

          {/* Reset carries the same word as the Leave page's reset button,
              with the longer "clear filters" phrasing as its accessible name. */}
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

      {personOptionsError && !personOptionsLoading && (
        <p role="alert" className="text-[11px] font-medium text-rose-600">
          {listError}
        </p>
      )}
      {personOptionsLoading && personOptions.length === 0 && (
        <p className="text-[11px] font-medium text-slate-400">{t("common.loading")}</p>
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
