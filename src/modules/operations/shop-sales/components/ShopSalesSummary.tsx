import React from "react";
import { Store, Bird, Scale, IndianRupee, TrendingUp, Activity } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { KpiCardGrid, type KpiCardItem } from "../../../../ui";
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

  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(summary.totalAmount);

  const cards: KpiCardItem[] = [
    { id: "shops", label: t("ops.shop_sales.kpi.total_shops"), value: summary.totalShops.toLocaleString(), Icon: Store, tone: "blue" },
    { id: "birds", label: t("ops.shop_sales.kpi.total_birds"), value: summary.totalBirds.toLocaleString(), Icon: Bird, tone: "emerald" },
    { id: "weight", label: t("ops.shop_sales.kpi.total_weight"), value: `${summary.totalWeight.toFixed(2)} KG`, Icon: Scale, tone: "amber" },
    { id: "amount", label: t("ops.shop_sales.kpi.total_amount"), value: `₹ ${amount}`, Icon: IndianRupee, tone: "emerald" },
    { id: "rate", label: t("ops.shop_sales.kpi.average_rate"), value: `₹ ${summary.averageRate.toFixed(2)}`, Icon: TrendingUp, tone: "violet" },
    { id: "weight-per-bird", label: t("ops.shop_sales.kpi.average_weight_per_bird"), value: `${summary.averageWeightPerBird.toFixed(2)} KG`, Icon: Activity, tone: "cyan" },
  ];

  return <KpiCardGrid items={cards} gridClassName="lg:grid-cols-6" ariaLabel={t("ops.shop_sales.title")} />;
}

export default React.memo(ShopSalesSummary);
