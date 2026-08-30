// src/modules/operations/mortality/components/LossKpiCards.tsx
// KPI strip for the Mortality & Weight Loss Analysis page.
// Always summarises the exact FILTERED completed-trip dataset.
// Rendered only once the user has applied a filter/search — never on first load.

import {
  Bird,
  Feather,
  Package,
  Percent,
  Scale,
  Store,
  TrendingDown,
  Truck,
  Weight,
} from "lucide-react";
import { formatNumber, formatWeight } from "../../../../utils/format";
import type { LossKpis } from "../hooks/useTripLossAnalysis";
import { useI18n } from "../../../../i18n";

interface LossKpiCardsProps {
  kpis: LossKpis;
  loading?: boolean;
}

type Tone = "neutral" | "indigo" | "amber" | "sky" | "orange" | "rose";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  indigo: "bg-indigo-50 text-indigo-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-orange-600",
  rose: "bg-rose-50 text-rose-600",
};

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export default function LossKpiCards({ kpis, loading = false }: LossKpiCardsProps) {
  const { t } = useI18n();
  const cards: {
    labelKey: string;
    value: string;
    icon: typeof Truck;
    tone: Tone;
  }[] = [
    {
      labelKey: "ops.mortality.kpi.completed_trips",
      value: formatNumber(kpis.totalTrips),
      icon: Truck,
      tone: "neutral",
    },
    {
      labelKey: "ops.mortality.kpi.farm_birds",
      value: formatNumber(kpis.farmBirds),
      icon: Bird,
      tone: "indigo",
    },
    {
      labelKey: "ops.mortality.kpi.farm_weight",
      value: formatWeight(kpis.farmWeight),
      icon: Weight,
      tone: "amber",
    },
    {
      labelKey: "ops.mortality.kpi.delivery_shops",
      value: formatNumber(kpis.deliveryShops),
      icon: Store,
      tone: "sky",
    },
    {
      labelKey: "ops.mortality.kpi.delivered_birds",
      value: formatNumber(kpis.deliveredBirds),
      icon: Bird,
      tone: "sky",
    },
    {
      labelKey: "ops.mortality.kpi.delivery_weight",
      value: formatWeight(kpis.deliveredWeight),
      icon: Package,
      tone: "sky",
    },
    {
      labelKey: "ops.mortality.kpi.mortality_birds",
      value: formatNumber(kpis.mortalityCount),
      icon: Feather,
      tone: "orange",
    },
    {
      labelKey: "ops.mortality.kpi.mortality_weight",
      value: formatWeight(kpis.mortalityWeight),
      icon: Feather,
      tone: "orange",
    },
    {
      labelKey: "ops.mortality.kpi.mortality_pct",
      value: pct(kpis.mortalityPercentage),
      icon: Percent,
      tone: "orange",
    },
    {
      labelKey: "ops.mortality.kpi.weight_loss",
      value: formatWeight(kpis.weightLoss),
      icon: TrendingDown,
      tone: "rose",
    },
    {
      labelKey: "ops.mortality.kpi.weight_loss_pct",
      value: pct(kpis.weightLossPercentage),
      icon: Scale,
      tone: "rose",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.labelKey}
          className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-card"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[card.tone]}`}
          >
            <card.icon size={15} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t(card.labelKey)}
            </span>
            <span className="block truncate text-[15px] font-bold tabular-nums text-slate-800">
              {loading ? "—" : card.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
