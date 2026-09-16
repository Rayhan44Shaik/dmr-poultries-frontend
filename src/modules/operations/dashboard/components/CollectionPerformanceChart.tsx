import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, IndianRupee, TrendingUp, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../../i18n";
import { formatINR, formatINRCompact } from "../../../../utils/format";
import {
  collectionRecoveryPercentage,
  normalizeCollectionPerformance,
  sortCollectionPerformance,
  type CollectionPerformanceDatum,
  type CollectionPerformanceSort,
} from "../utils/collectionPerformance";

interface CollectionPerformanceChartProps {
  data: CollectionPerformanceDatum[];
  totalSales: number;
  totalCollections: number;
  fromDate: string;
  toDate: string;
}

const MAX_VISIBLE_SHOPS = 10;

const safeAmount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const formatPeriod = (fromDate: string, toDate: string, language: string): string => {
  const locale = language === "te" ? "te-IN" : "en-IN";
  const format = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };
  return `${format(fromDate)} – ${format(toDate)}`;
};

const PENDING_COLLECTIONS_URL = "/operations?tab=pending-collections";

export default function CollectionPerformanceChart({
  data,
  totalSales,
  totalCollections,
  fromDate,
  toDate,
}: CollectionPerformanceChartProps) {
  const { t, language } = useI18n();
  const [sortBy, setSortBy] = useState<CollectionPerformanceSort>("outstanding");

  const rows = useMemo(() => normalizeCollectionPerformance(data), [data]);
  const visibleRows = useMemo(
    () => sortCollectionPerformance(rows, sortBy).slice(0, MAX_VISIBLE_SHOPS),
    [rows, sortBy],
  );

  const sales = safeAmount(totalSales);
  const collections = safeAmount(totalCollections);
  const periodGap = Math.max(0, sales - collections);
  const recovery = sales > 0 ? (collections / sales) * 100 : 0;
  const recoveryWidth = Math.min(100, Math.max(0, recovery));
  const rangeLabel = formatPeriod(fromDate, toDate, language);

  const summary = [
    {
      label: t("ops.dashboard.collection_performance.sales"),
      value: sales,
      icon: IndianRupee,
      tone: "bg-sky-50 text-sky-700 ring-sky-100",
    },
    {
      label: t("ops.dashboard.collection_performance.collected"),
      value: collections,
      icon: WalletCards,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    {
      label: t("ops.dashboard.collection_performance.gap"),
      value: periodGap,
      icon: BarChart3,
      tone: "bg-rose-50 text-rose-700 ring-rose-100",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white via-emerald-50/35 to-sky-50/45 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">
              {t("ops.dashboard.collection_performance.eyebrow")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-base font-black tracking-tight text-slate-900 sm:text-lg">
                {t("ops.dashboard.collection_performance.title")}
              </h2>
              <span className="rounded-full bg-white/90 px-2 py-1 text-[9.5px] font-bold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200">
                {rangeLabel}
              </span>
            </div>
            <p className="mt-1.5 max-w-3xl text-[11.5px] font-medium leading-relaxed text-slate-500">
              {t("ops.dashboard.collection_performance.description")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400">
                {t("ops.dashboard.collection_performance.sort_label")}
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as CollectionPerformanceSort)}
                className="min-w-[11rem] cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold text-slate-700 outline-none"
                aria-label={t("ops.dashboard.collection_performance.sort_label")}
              >
                <option value="outstanding">{t("ops.dashboard.collection_performance.sort_outstanding")}</option>
                <option value="sales">{t("ops.dashboard.collection_performance.sort_sales")}</option>
                <option value="collections">{t("ops.dashboard.collection_performance.sort_collections")}</option>
                <option value="recoveryHigh">{t("ops.dashboard.collection_performance.sort_recovery_high")}</option>
                <option value="recoveryLow">{t("ops.dashboard.collection_performance.sort_recovery_low")}</option>
                <option value="shop">{t("ops.dashboard.collection_performance.sort_shop")}</option>
              </select>
            </label>
            <Link
              to={PENDING_COLLECTIONS_URL}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              {t("ops.dashboard.collection_performance.open_pending")}
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {summary.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}>
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold text-slate-400">{label}</span>
              </div>
              <strong className="mt-2 block text-lg font-black tabular-nums tracking-tight text-slate-800" title={formatINR(value)}>
                {formatINRCompact(value)}
              </strong>
            </div>
          ))}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <TrendingUp size={14} aria-hidden="true" />
              </span>
              <span className="text-[10px] font-bold text-emerald-700">
                {t("ops.dashboard.collection_performance.recovery")}
              </span>
            </div>
            <strong className="mt-2 block text-lg font-black tabular-nums tracking-tight text-emerald-800">
              {recovery.toFixed(1)}%
            </strong>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/90 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold">
            <span className="text-slate-500">{t("ops.dashboard.collection_performance.sales_baseline")}</span>
            <span className="tabular-nums text-emerald-700">
              {t("ops.dashboard.collection_performance.collected_share", { value: recovery.toFixed(1) })}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-rose-100 ring-1 ring-inset ring-rose-200/70" role="img" aria-label={t("ops.dashboard.collection_performance.overall_aria", { value: recovery.toFixed(1) })}>
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${recoveryWidth}%` }} />
          </div>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <BarChart3 size={20} aria-hidden="true" />
          </span>
          <p className="text-sm font-bold text-slate-600">
            {t("ops.dashboard.collection_performance.no_data")}
          </p>
          <Link to={PENDING_COLLECTIONS_URL} className="text-xs font-bold text-emerald-700 hover:underline">
            {t("ops.dashboard.collection_performance.open_pending")} →
          </Link>
        </div>
      ) : (
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-2 hidden grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)_minmax(0,1.35fr)_1.5rem] gap-4 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400 md:grid">
            <span>{t("ops.dashboard.collection_performance.shop")}</span>
            <span>{t("ops.dashboard.collection_performance.sales_vs_collection")}</span>
            <span className="text-right">{t("ops.dashboard.collection_performance.amount_details")}</span>
            <span aria-hidden="true" />
          </div>

          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80">
            {visibleRows.map((row, index) => {
              const rowRecovery = collectionRecoveryPercentage(row);
              const width = Math.min(100, Math.max(0, rowRecovery));
              return (
                <Link
                  key={row.shopName}
                  to={PENDING_COLLECTIONS_URL}
                  title={t("ops.dashboard.collection_performance.open_pending")}
                  className="group grid min-w-0 gap-3 bg-white px-3 py-3 transition-colors hover:bg-emerald-50/40 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 md:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)_minmax(0,1.35fr)_1.5rem] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black tabular-nums text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-700">
                      {index + 1}
                    </span>
                    <span className="truncate text-[11.5px] font-bold text-slate-700 group-hover:text-emerald-800">
                      {row.shopName}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[9.5px] font-bold">
                      <span className="text-slate-400">
                        {t("ops.dashboard.collection_performance.sales_100")}
                      </span>
                      <span className="tabular-nums text-emerald-700">{rowRecovery.toFixed(1)}%</span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-rose-100 ring-1 ring-inset ring-rose-200/60"
                      role="img"
                      aria-label={t("ops.dashboard.collection_performance.row_aria", {
                        shop: row.shopName,
                        value: rowRecovery.toFixed(1),
                      })}
                    >
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-right">
                    <div className="min-w-0">
                      <span className="block text-[8.5px] font-bold uppercase tracking-wide text-slate-400">
                        {t("ops.dashboard.collection_performance.sales")}
                      </span>
                      <strong className="block truncate text-[10.5px] font-black tabular-nums text-slate-700" title={formatINR(row.salesAmount)}>
                        {formatINRCompact(row.salesAmount)}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[8.5px] font-bold uppercase tracking-wide text-slate-400">
                        {t("ops.dashboard.collection_performance.collected")}
                      </span>
                      <strong className="block truncate text-[10.5px] font-black tabular-nums text-emerald-700" title={formatINR(row.collectionAmount)}>
                        {formatINRCompact(row.collectionAmount)}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[8.5px] font-bold uppercase tracking-wide text-slate-400">
                        {t("ops.dashboard.collection_performance.gap")}
                      </span>
                      <strong className="block truncate text-[10.5px] font-black tabular-nums text-rose-700" title={formatINR(row.outstandingAmount)}>
                        {formatINRCompact(row.outstandingAmount)}
                      </strong>
                    </div>
                  </div>

                  <ArrowUpRight size={14} className="hidden text-slate-300 transition-colors group-hover:text-emerald-600 md:block" aria-hidden="true" />
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-400">
            <span>
              <span className="mr-3 inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />{t("ops.dashboard.collection_performance.collected")}</span>
              <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-rose-200" />{t("ops.dashboard.collection_performance.gap")}</span>
            </span>
            <span className="tabular-nums">
              {t("ops.dashboard.collection_performance.showing", {
                shown: visibleRows.length,
                total: rows.length,
              })}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
