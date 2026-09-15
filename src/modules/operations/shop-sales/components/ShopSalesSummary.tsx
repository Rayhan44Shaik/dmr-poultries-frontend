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

  // Never briefly display a previous filter's figures while this page is
  // waiting for its new server-backed result set.
  if (isLoading) return null;

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

  const cards: KpiCardItem[] = [
    { id: "shops", label: t("ops.shop_sales.kpi.total_shops"), value: <KpiMetricValue metric={shops} />, tooltip: `${t("ops.shop_sales.kpi.total_shops")}: ${shops.exact}`, Icon: Store, tone: "blue" },
    { id: "birds", label: t("ops.shop_sales.kpi.total_birds"), value: <KpiMetricValue metric={birds} />, tooltip: `${t("ops.shop_sales.kpi.total_birds")}: ${birds.exact}`, Icon: Bird, tone: "emerald" },
    { id: "weight", label: t("ops.shop_sales.kpi.total_weight"), value: <KpiMetricValue metric={weight} unit="KG" />, tooltip: `${t("ops.shop_sales.kpi.total_weight")}: ${weight.exact} KG`, Icon: Scale, tone: "amber" },
    { id: "amount", label: t("ops.shop_sales.kpi.total_amount"), value: <KpiMetricValue metric={amount} prefix="₹" />, tooltip: `${t("ops.shop_sales.kpi.total_amount")}: ₹${amount.exact}`, Icon: IndianRupee, tone: "emerald" },
    { id: "rate", label: t("ops.shop_sales.kpi.average_rate"), value: <KpiMetricValue metric={averageRate} prefix="₹" />, tooltip: `${t("ops.shop_sales.kpi.average_rate")}: ₹${averageRate.exact}`, Icon: TrendingUp, tone: "violet" },
    { id: "weight-per-bird", label: t("ops.shop_sales.kpi.average_weight_per_bird"), value: <KpiMetricValue metric={averageWeight} unit="KG" />, tooltip: `${t("ops.shop_sales.kpi.average_weight_per_bird")}: ${averageWeight.exact} KG`, Icon: Activity, tone: "cyan" },
  ];

  return <KpiCardGrid items={cards} gridClassName="lg:grid-cols-6" ariaLabel={t("ops.shop_sales.title")} />;
}

export default React.memo(ShopSalesSummary);
