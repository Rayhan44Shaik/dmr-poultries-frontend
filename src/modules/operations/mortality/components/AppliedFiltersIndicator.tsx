// src/modules/operations/mortality/components/AppliedFiltersIndicator.tsx
// Compact professional indication of currently applied filters.
// Only renders when a real filter has been applied via Search.

import { Filter, X } from "lucide-react";
import type { LossFilters } from "../hooks/useTripLossAnalysis";
import { useI18n } from "../../../../i18n";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";

interface AppliedFiltersIndicatorProps {
  appliedFilters: LossFilters;
  onClear: () => void;
}

export default function AppliedFiltersIndicator({
  appliedFilters,
  onClear,
}: AppliedFiltersIndicatorProps) {
  const { t, language } = useI18n();

  const parts: { label: string; value: string }[] = [];

  if (appliedFilters.fromDate.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.from"), value: appliedFilters.fromDate });
  }
  if (appliedFilters.toDate.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.to"), value: appliedFilters.toDate });
  }
  if (appliedFilters.sourceFarm.trim()) {
    // Farm and supervisor names read in Telugu script, exactly as they do in the
    // table below — a pill that stayed in Latin would be the last English on the page.
    parts.push({ label: t("ops.mortality.applied_filters.farm"), value: localizeTripViewText(appliedFilters.sourceFarm, language) });
  }
  if (appliedFilters.supervisor.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.supervisor"), value: localizeTripViewText(appliedFilters.supervisor, language) });
  }
  if (appliedFilters.search.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.search"), value: appliedFilters.search });
  }

  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
      <Filter size={14} className="flex-shrink-0 text-amber-600" />
      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
        {t("ops.mortality.applied_filters.label")}
      </span>
      {/* One pill per active filter — the value is the loud part, the field name
          the quiet one, so a long date range never reads as one run-on line. */}
      <span className="flex flex-wrap items-center gap-1.5">
        {parts.map((part) => (
          <span
            key={part.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/80 px-2.5 py-0.5 text-[11px] leading-5 text-amber-800"
          >
            <span className="font-medium text-amber-600">{part.label}</span>
            <span className="font-semibold tabular-nums">{part.value}</span>
          </span>
        ))}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="group ml-auto flex-shrink-0 rounded-md p-1 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
        aria-label={t("common.clear")}
        title={t("common.clear")}
      >
        <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]">
          <X size={13} strokeWidth={2.5} />
        </span>
      </button>
    </div>
  );
}