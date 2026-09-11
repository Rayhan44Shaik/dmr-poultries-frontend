import { Hash } from "lucide-react";
import { useI18n } from "../../../../i18n";

/**
 * Compact trip-number chip shown on every wizard step header so the operator
 * always knows which trip they are editing (independent of sample remarks).
 */
export function TripNoBadge({
  tripNo,
  className = "",
}: {
  tripNo?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const value = String(tripNo || "").trim();
  if (!value) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 max-w-full rounded-full border border-indigo-100 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-bold text-indigo-500 tabular-nums tracking-tight shadow-sm ${className}`}
      title={`${t("operations.trip_no")}: ${value}`}
      aria-label={`${t("operations.trip_no")} ${value}`}
    >
      <Hash size={11} className="shrink-0 text-indigo-500" strokeWidth={2.5} />
      <span className="text-indigo-500/90 font-semibold normal-case tracking-wide text-[10px]">
        {t("operations.trip_no")}
      </span>
      <span className="truncate">{value}</span>
    </span>
  );
}
