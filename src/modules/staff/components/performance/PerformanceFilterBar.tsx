// src/modules/staff/components/performance/PerformanceFilterBar.tsx
//
// ============================================================================
// PERFORMANCE FILTER BAR — compact Driver/Supervisor Performance toolbar
// ============================================================================
// One shared toolbar for both performance pages. Order is fixed:
//   [Start date] → [End date] → [person dropdown] → [Search field]
//   → [Search icon] → [Clear icon] → [Refresh icon]
//
// DESIGN SOURCES (all global — no page-specific chrome)
//   • Dates      → the shared <DatePicker> (same as every filter bar).
//   • Dropdown   → the shared <MasterDropdown> (the register-page reference:
//                  searchable, portalled menu, ArrowUp/Down, Home/End, Enter,
//                  Escape, typeahead, 36px rows).
//   • Search     → the global <SearchInput> (40px, leading icon, clear button).
//   • Actions    → the global <Button> system: primary icon Search, ghost
//                  Reset/Refresh semantic actions — icon-only, each with a
//                  tooltip + aria-label.
//
// BEHAVIOUR
//   • Fully controlled: edits only touch DRAFT state. Nothing is applied until
//     Search (button, or Enter in the search field / form) — so editing a
//     filter can never fire a request on its own.
//   • Applying identical filters is a no-op inside the hook, so a double
//     click or Enter+click cannot duplicate a request.
//   • No "Date Range" heading; each field carries its own compact label and
//     every icon-only control has an accessible name.
// ============================================================================

import { memo, useCallback, useId, type FormEvent, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import { DatePicker } from "../../../../components/common/DatePicker";
import { Button, ResetButton, RefreshButton, SearchInput } from "../../../../ui";
import { useI18n } from "../../../../i18n";
import { uiFilterLabelClass } from "../../../../shared/ui/uiTokens";
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
  /** Background refresh in progress (Refresh shows its spinner while true). */
  refreshing: boolean;
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
  const { t } = useI18n();
  const isDriver = kind === "drivers";
  const searchFieldId = useId();

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

  const personItems = personOptions.map((option) => ({
    value: String(option.id),
    label: option.name,
  }));

  const handleApply = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      onApply();
    },
    [onApply],
  );

  // Enter inside the search field applies the draft once. SearchInput itself
  // preventDefaults Enter, so this handler is the ONLY activation path — the
  // form's onSubmit cannot also fire for the same keypress.
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
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-card sm:p-4"
      aria-busy={busy || refreshing || undefined}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[1_1_170px] sm:max-w-[230px]">
          <label htmlFor={`${searchFieldId}-from`} className={uiFilterLabelClass}>
            {t("staff.perf.filter.start_date")}
          </label>
          <DatePicker
            id={`${searchFieldId}-from`}
            value={value.fromDate}
            onChange={(date) => onChange({ fromDate: date })}
            placeholder="DD/MM/YYYY"
            hideToday={false}
            className="w-full"
          />
        </div>

        <div className="min-w-0 flex-[1_1_170px] sm:max-w-[230px]">
          <label htmlFor={`${searchFieldId}-to`} className={uiFilterLabelClass}>
            {t("staff.perf.filter.end_date")}
          </label>
          <DatePicker
            id={`${searchFieldId}-to`}
            value={value.toDate}
            onChange={(date) => onChange({ toDate: date })}
            placeholder="DD/MM/YYYY"
            className="w-full"
          />
        </div>

        <div className="min-w-0 flex-[1_1_190px] sm:max-w-[260px]">
          <MasterDropdown
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
          className="min-w-0 flex-[2_1_240px]"
          onKeyDown={handleSearchKeyDown}
        >
          <SearchInput
            id={searchFieldId}
            value={value.search}
            onChange={(next) => onChange({ search: next })}
            placeholder={searchPlaceholder}
            label={t("common.search")}
            wrapperClassName="w-full"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            iconOnly
            loading={busy}
            aria-label={t("staff.perf.filter.search_action")}
            title={t("staff.perf.filter.search_action")}
            icon={<Search aria-hidden="true" />}
          />

          <ResetButton
            type="button"
            size="lg"
            onClick={onClear}
            ariaLabel={t("staff.perf.filter.clear_action")}
          />

          <RefreshButton
            type="button"
            size="lg"
            loading={refreshing}
            onClick={onRefresh}
            ariaLabel={t("staff.perf.filter.refresh_action")}
          />

        </div>
      </div>

      {personOptionsError && !personOptionsLoading && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-rose-600">
          {listError}
        </p>
      )}
      {personOptionsLoading && personOptions.length === 0 && (
        <p className="mt-2 text-[11px] font-medium text-slate-400">
          {t("common.loading")}
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
