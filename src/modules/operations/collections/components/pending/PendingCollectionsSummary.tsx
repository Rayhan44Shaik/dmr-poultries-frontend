import React from "react";
import { CreditCard, IndianRupee, ShoppingBag, TrendingUp } from "lucide-react";
import { useI18n } from "../../../../../i18n";
import { KpiCardGrid, type KpiCardItem } from "../../../../../ui";

interface Props {
  totalOutstanding: number;
  weeklySales: number;
  weeklyCollections: number;
  weeklyRecovery: number;
  isLoading?: boolean;
}

/**
 * Pending Collections KPI strip — the Trip List KPI surface, tone for tone.
 *
 * Rendered through the shared `KpiCardGrid`, so the cards are the same object
 * here as on the Trip List: pastel tone, icon tile, coloured value, accent bar
 * and the exact figure on hover. Money reads as the full rupee figure in the
 * Indian grouping (`₹1,48,74,969.98`) — digits and ₹ only, so the strip stays
 * readable in Telugu too.
 */
function PendingCollectionsSummary({
  totalOutstanding,
  weeklySales,
  weeklyCollections,
  weeklyRecovery,
  isLoading = false,
}: Props) {
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center text-sm font-medium text-slate-400">
        {t("ops.collection.loading_summary")}
      </div>
    );
  }

  const inr = (value: number) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const outstanding = inr(totalOutstanding);
  const sales = inr(weeklySales);
  const collections = inr(weeklyCollections);
  const recovery = `${Number(weeklyRecovery || 0).toFixed(2)}%`;

  const cards: KpiCardItem[] = [
    {
      id: "outstanding",
      label: t("ops.collection.total_outstanding"),
      value: <span className="tabular-nums">{outstanding}</span>,
      tooltip: `${t("ops.collection.total_outstanding")}: ${outstanding}`,
      Icon: IndianRupee,
      tone: "rose",
    },
    {
      id: "sales",
      label: t("ops.collection.this_week_sales"),
      value: <span className="tabular-nums">{sales}</span>,
      tooltip: `${t("ops.collection.this_week_sales")}: ${sales}`,
      Icon: ShoppingBag,
      tone: "blue",
    },
    {
      id: "collections",
      label: t("ops.collection.this_week_collections"),
      value: <span className="tabular-nums">{collections}</span>,
      tooltip: `${t("ops.collection.this_week_collections")}: ${collections}`,
      Icon: CreditCard,
      tone: "emerald",
    },
    {
      id: "recovery",
      label: t("ops.collection.recovery_pct"),
      value: <span className="tabular-nums">{recovery}</span>,
      tooltip: `${t("ops.collection.recovery_pct")}: ${recovery}`,
      Icon: TrendingUp,
      tone: "violet",
    },
  ];

  return (
    <KpiCardGrid
      items={cards}
      gridClassName="lg:grid-cols-4"
      ariaLabel={t("operations.pending_collections")}
    />
  );
}

export default React.memo(PendingCollectionsSummary);
