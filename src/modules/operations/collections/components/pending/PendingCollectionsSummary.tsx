import React from "react";
import { IndianRupee, ShoppingBag, CreditCard, TrendingUp } from "lucide-react";
import { useI18n } from "../../../../../i18n";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

interface Props {
  totalOutstanding: number;
  weeklySales: number;
  weeklyCollections: number;
  weeklyRecovery: number;
  fromDate: string;
  toDate: string;
  shopName: string;
  isLoading?: boolean;
}

function PendingCollectionsSummary({
  totalOutstanding,
  weeklySales,
  weeklyCollections,
  weeklyRecovery,
  fromDate,
  toDate,
  shopName,
  isLoading = false,
}: Props) {
  const { t } = useI18n();
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center text-slate-400">
        {t("ops.collection.loading_summary")}
      </div>
    );
  }

  const cards = [
    {
      title: t("ops.collection.total_outstanding"),
      value: formatCurrency(totalOutstanding),
      icon: <IndianRupee size={18} />,
      bg: "bg-red-50",
      text: "text-red-700",
    },
    {
      title: t("ops.collection.this_week_sales"),
      value: formatCurrency(weeklySales),
      icon: <ShoppingBag size={18} />,
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    {
      title: t("ops.collection.this_week_collections"),
      value: formatCurrency(weeklyCollections),
      icon: <CreditCard size={18} />,
      bg: "bg-green-50",
      text: "text-green-700",
    },
    {
      title: t("ops.collection.recovery_pct"),
      value: `${weeklyRecovery.toFixed(2)}%`,
      icon: <TrendingUp size={18} />,
      bg: "bg-purple-50",
      text: "text-purple-700",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`${card.bg} rounded-lg border border-slate-200 px-2.5 py-2 flex items-center justify-between hover:shadow-sm transition-all`}
          >
            <div>
              <div className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">{card.title}</div>
              <div className={`text-sm font-bold mt-0.5 ${card.text}`}>{card.value}</div>
            </div>
            <div className={`h-7 w-7 rounded-full flex items-center justify-center ${card.bg} ${card.text}`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(PendingCollectionsSummary);