import React from "react";
import { Store, Bird, Scale, IndianRupee, TrendingUp, Activity } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { compactKpiValue, KpiCardGrid, KpiMetricValue, type KpiCardItem } from "../../../../ui";
import type { ShopSaleSummary } from "../types/shopSale";

interface Props {
  summary: ShopSaleSummary;
  isLoading?: boolean;
}

/**
 * Shop Sales' result KPIs use the shared global card surface so the visual
 * language, light colour treatment and icon hierarchy remain consistent with
 * Trip List and future operational summaries.
 */
function ShopSalesSummary({ summary, isLoading = false }: Props) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label={t("ops.shop_sales.title")} aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[6.75rem] animate-pulse rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="h-3 w-20 rounded bg-slate-100" /><div className="mt-4 h-7 w-24 rounded bg-slate-100" /></div>)}
      </section>
    );
  }

  const hasData =
    summary.totalShops > 0 ||
    summary.totalBirds > 0 ||
    summary.totalWeight > 0 ||
    summary.totalAmount > 0;
  if (!hasData) return null;

  const shops = compactKpiValue(summary.totalShops);
  const birds = compactKpiValue(summary.totalBirds);
  const weight = compactKpiValue(summary.totalWeight, 2);
  const amount = compactKpiValue(summary.totalAmount, 2);
  const averageRate = compactKpiValue(summary.averageRate, 2);
  const averageWeight = compactKpiValue(summary.averageWeightPerBird, 2);
  const tooltip = (label: string, value: string) => (
    <>
      <span className="block border-b border-slate-100 pb-2 text-xs font-bold text-slate-800">{label}</span>
      <span className="mt-2 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-2 py-2">
        <span className="text-slate-500">Total</span>
        <span className="font-extrabold tabular-nums text-slate-900">{value}</span>
      </span>
    </>
  );

  const cards: KpiCardItem[] = [
    { id: "shops", label: t("ops.shop_sales.kpi.total_shops"), value: <KpiMetricValue metric={shops} />, tooltipContent: tooltip(t("ops.shop_sales.kpi.total_shops"), shops.exact), Icon: Store, tone: "blue" },
    { id: "birds", label: t("ops.shop_sales.kpi.total_birds"), value: <KpiMetricValue metric={birds} />, tooltipContent: tooltip(t("ops.shop_sales.kpi.total_birds"), birds.exact), Icon: Bird, tone: "emerald" },
    { id: "weight", label: t("ops.shop_sales.kpi.total_weight"), value: <KpiMetricValue metric={weight} unit="KG" />, tooltipContent: tooltip(t("ops.shop_sales.kpi.total_weight"), `${weight.exact} KG`), Icon: Scale, tone: "amber" },
    { id: "amount", label: t("ops.shop_sales.kpi.total_amount"), value: <KpiMetricValue metric={amount} prefix="₹" />, tooltipContent: tooltip(t("ops.shop_sales.kpi.total_amount"), `₹${amount.exact}`), Icon: IndianRupee, tone: "emerald" },
    { id: "rate", label: t("ops.shop_sales.kpi.average_rate"), value: <KpiMetricValue metric={averageRate} prefix="₹" />, tooltipContent: tooltip(t("ops.shop_sales.kpi.average_rate"), `₹${averageRate.exact}`), Icon: TrendingUp, tone: "violet" },
    { id: "weight-per-bird", label: t("ops.shop_sales.kpi.average_weight_per_bird"), value: <KpiMetricValue metric={averageWeight} unit="KG" />, tooltipContent: tooltip(t("ops.shop_sales.kpi.average_weight_per_bird"), `${averageWeight.exact} KG`), Icon: Activity, tone: "cyan" },
  ];

  return <KpiCardGrid items={cards} gridClassName="lg:grid-cols-3 xl:grid-cols-6" ariaLabel={t("ops.shop_sales.title")} />;
}

export default React.memo(ShopSalesSummary);
