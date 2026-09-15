// src/modules/operations/vehicle-trips/components/TripKPICards.tsx
//
// ============================================================================
// TRIP LIST KPI CARDS — the global KPI card language
// ============================================================================
// White card, quiet uppercase label, big tone-coloured figure, icon chip in
// the top-right corner and one small tone-coloured bar along the bottom edge.
// The weight card carries its unit as a small muted suffix ("21,261.21 KG"),
// exactly like the rest of the strip wears the unit in the label.
// ============================================================================

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

type Tone = "emerald" | "amber" | "violet" | "rose";

const TONE_CLASS: Record<Tone, { value: string; chip: string; bar: string }> = {
  emerald: {
    value: "text-emerald-600",
    chip: "border-emerald-100 bg-emerald-50 text-emerald-600",
    bar: "bg-emerald-500",
  },
  amber: {
    value: "text-amber-600",
    chip: "border-amber-100 bg-amber-50 text-amber-600",
    bar: "bg-amber-500",
  },
  violet: {
    value: "text-violet-600",
    chip: "border-violet-100 bg-violet-50 text-violet-600",
    bar: "bg-violet-500",
  },
  rose: {
    value: "text-rose-600",
    chip: "border-rose-100 bg-rose-50 text-rose-600",
    bar: "bg-rose-500",
  },
};

function TripKPICards({ totalTrips, totalBirds, totalWeight, totalMortality, totalShops }: Props) {
  const { t } = useI18n();
  const cards: Array<{
    title: string;
    value: string;
    suffix?: string;
    icon: React.ReactNode;
    tone: Tone;
  }> = [
    {
      title: t("ops.trip.total_trips"),
      value: totalTrips.toLocaleString("en-IN"),
      icon: <Truck size={18} />,
      tone: "emerald",
    },
    {
      title: t("ops.trip.total_shops"),
      value: totalShops.toLocaleString("en-IN"),
      icon: <Store size={18} />,
      tone: "amber",
    },
    {
      title: t("ops.trip.total_birds"),
      value: totalBirds.toLocaleString("en-IN"),
      icon: <Bird size={18} />,
      tone: "emerald",
    },
    {
      title: t("ops.trip.total_weight_kg"),
      value: totalWeight.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      suffix: "KG",
      icon: <Scale size={18} />,
      tone: "violet",
    },
    {
      title: t("operations.total_mortality"),
      value: totalMortality.toLocaleString("en-IN"),
      icon: <HeartPulse size={18} />,
      tone: "rose",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const tone = TONE_CLASS[card.tone];
        return (
          <div
            key={card.title}
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-card-lg"
          >
            <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-3.5">
              <div className="min-w-0">
                <p className="truncate text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  {card.title}
                </p>
                <p
                  className={`mt-1.5 truncate text-[22px] font-bold leading-none tracking-tight tabular-nums ${tone.value}`}
                >
                  {card.value}
                  {card.suffix && (
                    <span className="ml-1 text-[11px] font-bold tracking-normal text-slate-400">
                      {card.suffix}
                    </span>
                  )}
                </p>
              </div>
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone.chip}`}
              >
                {card.icon}
              </span>
            </div>
            <span
              aria-hidden="true"
              className={`absolute inset-x-3 bottom-0 h-1 rounded-full ${tone.bar}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(TripKPICards);
