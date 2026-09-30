import { Hash, Truck, UserRound, UserRoundCog } from "lucide-react";
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

/** Compact, read-only trip identity used consistently in every step header. */
export function TripContextBadges({
  tripNo,
  vehicleNo,
  supervisorName,
  driverName,
  provisional = false,
}: {
  tripNo?: string | null;
  vehicleNo?: string | null;
  supervisorName?: string | null;
  driverName?: string | null;
  provisional?: boolean;
}) {
  const { t } = useI18n();
  const details = [
    { label: t("operations.vehicle_no"), value: vehicleNo, Icon: Truck },
    { label: t("operations.supervisor_name"), value: supervisorName, Icon: UserRoundCog },
    { label: t("operations.driver_name"), value: driverName, Icon: UserRound },
  ];

  return (
    <span className="contents">
      <TripNoBadge tripNo={tripNo} provisional={provisional} />
      {details.map(({ label, value, Icon }) => {
        const text = String(value || "").trim();
        if (!text) return null;
        return (
          <span
            key={label}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm"
            aria-label={`${label} ${text}`}
          >
            <Icon size={11} className="shrink-0 text-slate-500" strokeWidth={2.5} />
            <span className="text-[10px] font-semibold text-slate-500">{label}</span>
            <span className="max-w-36 truncate">{text}</span>
          </span>
        );
      })}
    </span>
  );
}
