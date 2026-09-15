import React from "react";
import { Truck, Bird, Scale, HeartPulse, Store } from "lucide-react";
import { useI18n } from "../../../../i18n";

interface Props {
  totalTrips: number;
  totalBirds: number;
  totalWeight: number;
  totalMortality: number;
  totalShops: number;
}

/**
 * Filter-result summary for Trip List. Values are supplied only after the
 * current filter request succeeds, so these cards never display a stale total
 * while the table is loading its next result set.
 */
function TripKPICards({ totalTrips, totalBirds, totalWeight, totalMortality, totalShops }: Props) {
  const { t } = useI18n();
  // Keep the operational reading order consistent with the Trip List table:
  // trips → shops → birds → weight → mortality.
  const cards = [
    {
      title: t("ops.trip.total_trips"),
      value: totalTrips.toLocaleString(),
      Icon: Truck,
      valueClass: "text-blue-600",
      iconClass: "border-blue-100 bg-blue-50 text-blue-500 shadow-blue-100/60",
      glowClass: "bg-blue-50",
      accentClass: "bg-blue-300",
    },
    {
      title: t("ops.trip.total_shops"),
      value: totalShops.toLocaleString(),
      Icon: Store,
      valueClass: "text-amber-600",
      iconClass: "border-amber-100 bg-amber-50 text-amber-500 shadow-amber-100/60",
      glowClass: "bg-amber-50",
      accentClass: "bg-amber-300",
    },
    {
      title: t("ops.trip.total_birds"),
      value: totalBirds.toLocaleString(),
      Icon: Bird,
      valueClass: "text-emerald-600",
      iconClass: "border-emerald-100 bg-emerald-50 text-emerald-500 shadow-emerald-100/60",
      glowClass: "bg-emerald-50",
      accentClass: "bg-emerald-300",
    },
    {
      title: t("ops.trip.total_weight_kg"),
      value: totalWeight.toFixed(2),
      Icon: Scale,
      valueClass: "text-violet-600",
      iconClass: "border-violet-100 bg-violet-50 text-violet-500 shadow-violet-100/60",
      glowClass: "bg-violet-50",
      accentClass: "bg-violet-300",
    },
    {
      title: t("operations.total_mortality"),
      value: totalMortality.toLocaleString(),
      Icon: HeartPulse,
      valueClass: "text-rose-600",
      iconClass: "border-rose-100 bg-rose-50 text-rose-500 shadow-rose-100/60",
      glowClass: "bg-rose-50",
      accentClass: "bg-rose-300",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-live="polite">
      {cards.map(({ title, value, Icon, valueClass, iconClass, glowClass, accentClass }) => (
        <div
          key={title}
          className="group relative isolate min-h-[108px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <span className={`pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full ${glowClass}`} aria-hidden="true" />
          <span className={`absolute inset-x-0 bottom-0 h-1 ${accentClass}`} aria-hidden="true" />
          <div className="relative flex h-full items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
              <p className={`mt-2 text-2xl font-extrabold leading-none tracking-tight tabular-nums ${valueClass}`}>
                {value}
              </p>
            </div>
            <span
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 group-hover:scale-105 ${iconClass}`}
              aria-hidden="true"
            >
              <Icon size={22} strokeWidth={2.25} />
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

export default React.memo(TripKPICards);
