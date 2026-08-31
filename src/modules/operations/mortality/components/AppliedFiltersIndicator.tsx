// src/modules/operations/mortality/components/AppliedFiltersIndicator.tsx
// Compact professional indication of currently applied filters.
// Only renders when a real filter has been applied via Search.

import { Filter, X } from "lucide-react";
import type { LossFilters } from "../hooks/useTripLossAnalysis";
import { useI18n } from "../../../../i18n";

interface AppliedFiltersIndicatorProps {
  appliedFilters: LossFilters;
  onClear: () => void;
}

export default function AppliedFiltersIndicator({
  appliedFilters,
  onClear,
}: AppliedFiltersIndicatorProps) {
  const { t } = useI18n();

  const parts: { label: string; value: string }[] = [];

  if (appliedFilters.fromDate.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.from"), value: appliedFilters.fromDate });
  }
  if (appliedFilters.toDate.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.to"), value: appliedFilters.toDate });
  }
  if (appliedFilters.sourceFarm.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.farm"), value: appliedFilters.sourceFarm });
  }
  if (appliedFilters.supervisor.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.supervisor"), value: appliedFilters.supervisor });
  }
  if (appliedFilters.search.trim()) {
    parts.push({ label: t("ops.mortality.applied_filters.search"), value: appliedFilters.search });
  }

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
      <Filter size={14} className="flex-shrink-0 text-amber-600" />
      <span className="text-[11px] font-semibold text-amber-700">{t("ops.mortality.applied_filters.label")}:</span>
      <span className="flex items-center gap-1.5 text-[11px] text-amber-700">
        {parts.map((part, i) => (
          <span key={part.label} className="flex items-center gap-1">
            {i > 0 && <span className="text-amber-400">·</span>}
            <span className="font-medium">{part.label}:</span>
            <span className="font-mono">{part.value}</span>
          </span>
        ))}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="flex-shrink-0 ml-1 rounded-md p-1 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
        aria-label={t("common.clear")}
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}