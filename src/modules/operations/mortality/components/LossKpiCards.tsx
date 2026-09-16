// src/modules/operations/mortality/components/LossKpiCards.tsx
// KPI strip for the Mortality & Weight Loss Analysis page.
// Always summarises the exact FILTERED completed-trip dataset.
// Rendered only once the user has applied a filter/search — never on first load.
//
// SURFACE — the global KPI grid used by the Trip List, not a local card markup,
// so tone, icon tile, accent bar, hover lift and Indian-unit compaction are the
// same here as everywhere else. The strip is split into two evenly-filled rows
// (input/output flow, then loss) so neither row leaves an empty trailing cell:
//   6 cards → 2 / 3 / 6 columns and 5 cards → 2 / 3 / 5 columns.

import { Bird, Feather, Percent, Scale, ShoppingBag, TrendingDown, Truck } from "lucide-react";
import { compactKpiValue, KpiCardGrid, KpiMetricValue, type KpiCardItem } from "../../../../ui";
import type { LossKpis } from "../hooks/useTripLossAnalysis";
import { useI18n } from "../../../../i18n";

interface LossKpiCardsProps {
  kpis: LossKpis;
  loading?: boolean;
}

export default function LossKpiCards({ kpis, loading = false }: LossKpiCardsProps) {
  const { t } = useI18n();
  const pct = (value: number) => `${value.toFixed(2)}%`;
  const dash = "—";

  // Icons + tooltips carry the exact (uncompacted) figure, so nothing is lost
  // when a lakh-scale total renders as "2.18 L".
  const flowMetrics = {
    trips: compactKpiValue(kpis.totalTrips),
    farmBirds: compactKpiValue(kpis.farmBirds),
    farmWeight: compactKpiValue(kpis.farmWeight, 2),
    deliveryShops: compactKpiValue(kpis.deliveryShops),
    deliveredBirds: compactKpiValue(kpis.deliveredBirds),
    deliveredWeight: compactKpiValue(kpis.deliveredWeight, 2),
  };

  // Reading order follows the table: trips → what went in → what came out.
  const flowCards: KpiCardItem[] = [
    {
      id: "trips",
      label: t("ops.mortality.kpi.completed_trips"),
      value: loading ? dash : <KpiMetricValue metric={flowMetrics.trips} />,
      tooltip: `${t("ops.mortality.kpi.completed_trips")}: ${flowMetrics.trips.exact}`,
      Icon: Truck,
      tone: "blue",
    },
    {
      id: "farmBirds",
      label: t("ops.mortality.kpi.farm_birds"),
      value: loading ? dash : <KpiMetricValue metric={flowMetrics.farmBirds} />,
      tooltip: `${t("ops.mortality.kpi.farm_birds")}: ${flowMetrics.farmBirds.exact}`,
      Icon: Bird,
      tone: "emerald",
    },
    {
      id: "farmWeight",
      label: t("ops.mortality.kpi.farm_weight"),
      value: loading ? dash : <KpiMetricValue metric={flowMetrics.farmWeight} unit="KG" />,
      tooltip: `${t("ops.mortality.kpi.farm_weight")}: ${flowMetrics.farmWeight.exact} KG`,
      Icon: Scale,
      tone: "amber",
    },
    {
      id: "deliveryShops",
      label: t("ops.mortality.kpi.delivery_shops"),
      value: loading ? dash : <KpiMetricValue metric={flowMetrics.deliveryShops} />,
      tooltip: `${t("ops.mortality.kpi.delivery_shops")}: ${flowMetrics.deliveryShops.exact}`,
      Icon: ShoppingBag,
      tone: "cyan",
    },
    {
      id: "deliveredBirds",
      label: t("ops.mortality.kpi.delivered_birds"),
      value: loading ? dash : <KpiMetricValue metric={flowMetrics.deliveredBirds} />,
      tooltip: `${t("ops.mortality.kpi.delivered_birds")}: ${flowMetrics.deliveredBirds.exact}`,
      Icon: Bird,
      tone: "emerald",
    },
    {
      id: "deliveredWeight",
      label: t("ops.mortality.kpi.delivery_weight"),
      value: loading ? dash : <KpiMetricValue metric={flowMetrics.deliveredWeight} unit="KG" />,
      tooltip: `${t("ops.mortality.kpi.delivery_weight")}: ${flowMetrics.deliveredWeight.exact} KG`,
      Icon: Scale,
      tone: "amber",
    },
  ];

  const lossCards: KpiCardItem[] = [
    {
      id: "mortalityBirds",
      label: t("ops.mortality.kpi.mortality_birds"),
      value: loading ? dash : <KpiMetricValue metric={compactKpiValue(kpis.mortalityCount)} />,
      tooltip: `${t("ops.mortality.kpi.mortality_birds")}: ${compactKpiValue(kpis.mortalityCount).exact}`,
      Icon: Feather,
      tone: "rose",
    },
    {
      id: "mortalityWeight",
      label: t("ops.mortality.kpi.mortality_weight"),
      value: loading ? dash : <KpiMetricValue metric={compactKpiValue(kpis.mortalityWeight, 2)} unit="KG" />,
      tooltip: `${t("ops.mortality.kpi.mortality_weight")}: ${compactKpiValue(kpis.mortalityWeight, 2).exact} KG`,
      Icon: Scale,
      tone: "rose",
    },
    {
      id: "mortalityPct",
      label: t("ops.mortality.kpi.mortality_pct"),
      value: loading ? dash : pct(kpis.mortalityPercentage),
      tooltip: `${t("ops.mortality.kpi.mortality_pct")}: ${pct(kpis.mortalityPercentage)}`,
      Icon: Percent,
      tone: "rose",
    },
    {
      id: "weightLoss",
      label: t("ops.mortality.kpi.weight_loss"),
      value: loading ? dash : <KpiMetricValue metric={compactKpiValue(kpis.weightLoss, 2)} unit="KG" />,
      tooltip: `${t("ops.mortality.kpi.weight_loss")}: ${compactKpiValue(kpis.weightLoss, 2).exact} KG`,
      Icon: TrendingDown,
      tone: "violet",
    },
    {
      id: "weightLossPct",
      label: t("ops.mortality.kpi.weight_loss_pct"),
      value: loading ? dash : pct(kpis.weightLossPercentage),
      tooltip: `${t("ops.mortality.kpi.weight_loss_pct")}: ${pct(kpis.weightLossPercentage)}`,
      Icon: Percent,
      tone: "violet",
    },
  ];

  return (
    <div className="space-y-2.5">
      <KpiCardGrid items={flowCards} gridClassName="md:grid-cols-3 xl:grid-cols-6" ariaLabel={t("ops.mortality.kpi.filtered_summary")} />
      <KpiCardGrid items={lossCards} gridClassName="md:grid-cols-5" ariaLabel={t("ops.mortality.kpi.filtered_summary")} />
    </div>
  );
}
