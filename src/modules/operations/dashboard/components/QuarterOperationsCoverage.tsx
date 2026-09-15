import {
  Bird,
  ClipboardList,
  Fuel,
  IndianRupee,
  ReceiptText,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../../i18n";
import type {
  OperationsModuleCounts,
} from "../services/dashboardService";
import type { SampleQuarter } from "../../../../sample/quarterSample";

interface QuarterOperationsCoverageProps {
  quarter: SampleQuarter;
  counts: OperationsModuleCounts;
  fromDate: string;
  toDate: string;
}

const formatDate = (value: string, language: string): string => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * A compact, read-only map of the rolling sample quarter. The figures come
 * from the same Operations Dashboard response as the KPI row and each tile
 * opens the page represented by that count. It is sample-only: production API
 * responses have no sample quarter/count manifest, so this component is never
 * mounted there.
 */
export default function QuarterOperationsCoverage({
  quarter,
  counts,
  fromDate,
  toDate,
}: QuarterOperationsCoverageProps) {
  const { t, language } = useI18n();
  const rangeIsWholeQuarter =
    fromDate === quarter.fromDate && toDate === quarter.toDate;
  const rangeLabel = `${formatDate(fromDate, language)} – ${formatDate(toDate, language)}`;

  const modules = [
    {
      label: t("nav.vehicleTripHistory"),
      value: counts.tripRecords,
      unit: t("ops.dashboard.coverage.records"),
      to: "/operations?tab=trip-list",
      icon: Truck,
      iconClass: "bg-sky-50 text-sky-600 ring-sky-100",
      hoverClass: "hover:border-sky-200 hover:bg-sky-50/35",
    },
    {
      label: t("nav.rateEntry"),
      value: counts.rateEntries,
      unit: t("ops.dashboard.coverage.waiting"),
      to: "/operations?tab=rate-entry",
      icon: IndianRupee,
      iconClass: "bg-violet-50 text-violet-600 ring-violet-100",
      hoverClass: "hover:border-violet-200 hover:bg-violet-50/35",
    },
    {
      label: t("nav.shopSalesEntry"),
      value: counts.shopSales,
      unit: t("ops.dashboard.coverage.lines"),
      to: "/operations?tab=shop-sales",
      icon: ShoppingBag,
      iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
      hoverClass: "hover:border-emerald-200 hover:bg-emerald-50/35",
    },
    {
      label: t("nav.collectionEntry"),
      value: counts.collections,
      unit: t("ops.dashboard.coverage.receipts"),
      to: "/operations?tab=collection-report",
      icon: Wallet,
      iconClass: "bg-amber-50 text-amber-600 ring-amber-100",
      hoverClass: "hover:border-amber-200 hover:bg-amber-50/35",
    },
    {
      label: t("nav.pendingCollections"),
      value: counts.pendingShops,
      unit: t("ops.dashboard.coverage.shops"),
      to: "/operations?tab=pending-collections",
      icon: ReceiptText,
      iconClass: "bg-rose-50 text-rose-600 ring-rose-100",
      hoverClass: "hover:border-rose-200 hover:bg-rose-50/35",
    },
    {
      label: t("nav.mortalityEntry"),
      value: counts.mortalityTrips,
      unit: t("ops.dashboard.coverage.completed"),
      to: "/operations?tab=mortality",
      icon: Bird,
      iconClass: "bg-orange-50 text-orange-600 ring-orange-100",
      hoverClass: "hover:border-orange-200 hover:bg-orange-50/35",
    },
    {
      label: t("nav.fuelExpenses"),
      value: counts.fuelBills,
      unit: t("ops.dashboard.coverage.bills"),
      to: "/operations?tab=fuel-expenses",
      icon: Fuel,
      iconClass: "bg-cyan-50 text-cyan-600 ring-cyan-100",
      hoverClass: "hover:border-cyan-200 hover:bg-cyan-50/35",
    },
    {
      label: t("nav.orders"),
      value: counts.orders,
      unit: t("ops.dashboard.coverage.plans"),
      to: "/operations?tab=orders",
      icon: ClipboardList,
      iconClass: "bg-indigo-50 text-indigo-600 ring-indigo-100",
      hoverClass: "hover:border-indigo-200 hover:bg-indigo-50/35",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/40 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black tracking-tight text-slate-800">
              {t("ops.dashboard.coverage.title")}
            </h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {rangeIsWholeQuarter
                ? t("ops.dashboard.coverage.full_quarter")
                : t("ops.dashboard.coverage.selected_range")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10.5px] font-semibold text-slate-400">
            {quarter.label} · {rangeLabel}
          </p>
        </div>
        <p className="text-[10px] font-semibold text-slate-400">
          {t("ops.dashboard.coverage.hint")}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 xl:grid-cols-8 xl:divide-y-0">
        {modules.map(({ label, value, unit, to, icon: Icon, iconClass, hoverClass }) => (
          <Link
            key={to}
            to={to}
            title={t("ops.dashboard.coverage.open", { module: label })}
            className={`group flex min-w-0 items-center gap-2.5 px-3 py-3 transition-colors ${hoverClass} focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-emerald-500/50`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform group-hover:scale-105 ${iconClass}`}>
              <Icon size={15} strokeWidth={2.25} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-bold text-slate-500">
                {label}
              </span>
              <span className="mt-0.5 flex min-w-0 items-baseline gap-1">
                <strong className="text-base font-black tabular-nums tracking-tight text-slate-800">
                  {value.toLocaleString(language === "te" ? "te-IN" : "en-IN")}
                </strong>
                <span className="truncate text-[8.5px] font-semibold text-slate-400">
                  {unit}
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
