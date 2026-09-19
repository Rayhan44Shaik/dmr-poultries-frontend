import { Hash } from "lucide-react";
import { useI18n } from "../../../../i18n";

/**
 * Compact trip-number chip shown on every wizard step header so the operator
 * always knows which trip they are editing (independent of sample remarks).
 */
export function TripNoBadge({
  tripNo,
  className = "",
  provisional = false,
}: {
  tripNo?: string | null;
  className?: string;
  /** Preview number before server assigns on Step 1 create. */
  provisional?: boolean;
}) {
  const { t } = useI18n();
  const value = String(tripNo || "").trim();
  if (!value) return null;

  const tone = provisional
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const iconTone = provisional ? "text-sky-600" : "text-emerald-600";
  const labelTone = provisional ? "text-sky-600" : "text-emerald-600";

  return (
    <span
      className={`inline-flex items-center gap-1 max-w-full rounded-full border ${tone} px-2.5 py-1 text-[11px] font-bold tabular-nums tracking-tight shadow-sm ${className}`}
      aria-label={`${provisional ? t("ops.trip.next_trip_no") : t("operations.trip_no")} ${value}`}
    >
      <Hash size={11} className={`shrink-0 ${iconTone}`} strokeWidth={2.5} />
      <span className={`${labelTone} font-semibold normal-case tracking-wide text-[10px]`}>
        {provisional ? t("ops.trip.next_trip_no") : t("operations.trip_no")}
      </span>
      <span className="truncate">{value}</span>
    </span>
  );
}
