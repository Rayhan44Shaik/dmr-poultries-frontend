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
  const cards = [
    {
      title: t("ops.trip.total_trips"),
      value: totalTrips.toLocaleString(),
      Icon: Truck,
      valueClass: "text-blue-700",
      iconClass: "border-blue-200 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200/70",
      glowClass: "bg-blue-100/80",
      accentClass: "bg-blue-500",
    },
    {
      title: t("ops.trip.total_birds"),
      value: totalBirds.toLocaleString(),
      Icon: Bird,
      valueClass: "text-emerald-700",
      iconClass: "border-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-200/70",
      glowClass: "bg-emerald-100/80",
      accentClass: "bg-emerald-500",
    },
    {
      title: t("ops.trip.total_weight_kg"),
      value: totalWeight.toFixed(2),
      Icon: Scale,
      valueClass: "text-violet-700",
      iconClass: "border-violet-200 bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-200/70",
      glowClass: "bg-violet-100/80",
      accentClass: "bg-violet-500",
    },
    {
      title: t("operations.total_mortality"),
      value: totalMortality.toLocaleString(),
      Icon: HeartPulse,
      valueClass: "text-rose-700",
      iconClass: "border-rose-200 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-200/70",
      glowClass: "bg-rose-100/80",
      accentClass: "bg-rose-500",
    },
    {
      title: t("ops.trip.total_shops"),
      value: totalShops.toLocaleString(),
      Icon: Store,
      valueClass: "text-amber-700",
      iconClass: "border-amber-200 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-200/70",
      glowClass: "bg-amber-100/80",
      accentClass: "bg-amber-500",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-live="polite">
      {cards.map(({ title, value, Icon, valueClass, iconClass, glowClass, accentClass }) => (
        <div
          key={title}
          className="group relative isolate min-h-[108px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
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
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-md transition-transform duration-200 group-hover:scale-105 ${iconClass}`}
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
