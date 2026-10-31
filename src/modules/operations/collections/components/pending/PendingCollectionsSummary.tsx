import React from "react";
import { CreditCard, IndianRupee, ShoppingBag, TrendingUp } from "lucide-react";
import { useI18n } from "../../../../../i18n";
import { KpiCardGrid, type KpiCardItem } from "../../../../../ui";

interface Props {
  totalOutstanding: number;
  weeklySales: number;
  weeklyCollections: number;
  /** Approved collections ÷ sales, as a percentage (the figure in `weeklyCollections`
   *  over the figure in `weeklySales` — never an average of per-shop percentages). */
  recoveryPercentage: number;
  isLoading?: boolean;
}

/**
 * Pending Collections KPI strip — the Trip List KPI surface, tone for tone.
 *
 * Rendered through the shared `KpiCardGrid`, so the cards are the same object
 * here as on the Trip List: pastel tone, icon tile, coloured value and accent
 * bar. Money reads as the full rupee figure in the Indian grouping
 * (`₹1,48,74,969.98`) — digits and ₹ only, so the strip stays readable in
 * Telugu too.
 *
 * Each card exposes one consistent, total-only tooltip. There are no Load 1 /
 * Load 2 rows: the hover value is exactly the metric represented by the card.
 */
function PendingCollectionsSummary({
  totalOutstanding,
  weeklySales,
  weeklyCollections,
  recoveryPercentage,
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
  // No sales this week → no base to recover against, so the card says so with
  // a dash rather than printing a 0.00 % that claims nothing came in.
  const recovery = weeklySales > 0 ? `${Number(recoveryPercentage || 0).toFixed(2)}%` : "—";
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
    {
      id: "outstanding",
      label: t("ops.collection.total_outstanding"),
      value: <span className="tabular-nums">{outstanding}</span>,
      tooltipContent: tooltip(t("ops.collection.total_outstanding"), outstanding),
      Icon: IndianRupee,
      tone: "rose",
    },
    {
      id: "sales",
      label: t("ops.collection.this_week_sales"),
      value: <span className="tabular-nums">{sales}</span>,
      tooltipContent: tooltip(t("ops.collection.this_week_sales"), sales),
      Icon: ShoppingBag,
      tone: "blue",
    },
    {
      id: "collections",
      label: t("ops.collection.this_week_collections"),
      value: <span className="tabular-nums">{collections}</span>,
      tooltipContent: tooltip(t("ops.collection.this_week_collections"), collections),
      Icon: CreditCard,
      tone: "emerald",
    },
    {
      id: "recovery",
      label: t("ops.collection.recovery_formula"),
      value: <span className="tabular-nums">{recovery}</span>,
      tooltipContent: tooltip(t("ops.collection.recovery_formula"), recovery),
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
