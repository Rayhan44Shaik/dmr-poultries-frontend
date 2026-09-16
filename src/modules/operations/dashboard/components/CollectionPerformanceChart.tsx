import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3 } from "lucide-react";
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

const MAX_VISIBLE_SHOPS = 4;
const PENDING_COLLECTIONS_URL = "/operations?tab=pending-collections";

const safeAmount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const formatPeriod = (fromDate: string, toDate: string, language: string): string => {
  const locale = language === "te" ? "te-IN" : "en-IN";
  const format = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(locale, { day: "numeric", month: "short" });
  };
  const year = new Date(`${toDate}T00:00:00`).getFullYear();
  return `${format(fromDate)} – ${format(toDate)}${Number.isFinite(year) ? ` ${year}` : ""}`;
};

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
  const gap = Math.max(0, sales - collections);
  const recovery = sales > 0 ? (collections / sales) * 100 : 0;
  const recoveryWidth = Math.min(100, Math.max(0, recovery));

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-emerald-50/60 px-4 py-3.5">
        <h2 className="truncate text-sm font-black tracking-tight text-slate-900">
          {t("ops.dashboard.collection_performance.title")}
        </h2>
        <span className="shrink-0 text-[8.5px] font-bold tabular-nums text-slate-400">
          {formatPeriod(fromDate, toDate, language)}
        </span>
      </header>

      <div className="flex flex-1 flex-col p-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/55 p-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold text-emerald-700">
                {t("ops.dashboard.collection_performance.recovery")}
              </p>
              <strong className="text-2xl font-black tabular-nums tracking-tight text-emerald-800">
                {recovery.toFixed(1)}%
              </strong>
            </div>
            <span className="pb-1 text-right text-[9px] font-bold text-slate-500">
              {t("ops.dashboard.collection_performance.sales_100")}
            </span>
          </div>

          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-rose-100 ring-1 ring-inset ring-rose-200/70"
            role="img"
            aria-label={t("ops.dashboard.collection_performance.overall_aria", {
              value: recovery.toFixed(1),
            })}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
              style={{ width: `${recoveryWidth}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-3 divide-x divide-emerald-100 text-center">
            {[
              [t("ops.dashboard.collection_performance.sales"), sales, "text-slate-700"],
              [t("ops.dashboard.collection_performance.collected"), collections, "text-emerald-700"],
              [t("ops.dashboard.collection_performance.gap"), gap, "text-rose-700"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="min-w-0 px-1">
                <span className="block truncate text-[8px] font-bold uppercase tracking-wide text-slate-400">
                  {label}
                </span>
                <strong
                  className={`block truncate text-[10.5px] font-black tabular-nums ${tone}`}
                  title={formatINR(Number(value))}
                >
                  {formatINRCompact(Number(value))}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <label className="mt-3 flex h-8 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5">
          <span className="text-[9px] font-bold text-slate-400">
            {t("ops.dashboard.collection_performance.sort_label")}
          </span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as CollectionPerformanceSort)}
            className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-right text-[9.5px] font-bold text-slate-700 outline-none"
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

        {visibleRows.length === 0 ? (
          <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <BarChart3 size={19} aria-hidden="true" />
            <p className="text-[10px] font-bold">
              {t("ops.dashboard.collection_performance.no_data")}
            </p>
          </div>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {visibleRows.map((row) => {
              const rowRecovery = collectionRecoveryPercentage(row);
              const width = Math.min(100, Math.max(0, rowRecovery));
              return (
                <div key={row.shopName} className="py-2">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-bold text-slate-700" title={row.shopName}>
                      {row.shopName}
                    </span>
                    <span className="shrink-0 text-[9.5px] font-black tabular-nums text-emerald-700">
                      {rowRecovery.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-rose-100"
                    role="img"
                    aria-label={t("ops.dashboard.collection_performance.row_aria", {
                      shop: row.shopName,
                      value: rowRecovery.toFixed(1),
                    })}
                  >
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                  </div>
                  <div className="mt-1 flex min-w-0 justify-between gap-2 text-[8px] font-bold tabular-nums text-slate-400">
                    <span className="truncate" title={`${t("ops.dashboard.collection_performance.sales")}: ${formatINR(row.salesAmount)}`}>
                      {t("ops.dashboard.collection_performance.sales")} {formatINRCompact(row.salesAmount)}
                    </span>
                    <span className="truncate text-emerald-600" title={`${t("ops.dashboard.collection_performance.collected")}: ${formatINR(row.collectionAmount)}`}>
                      {t("ops.dashboard.collection_performance.collected")} {formatINRCompact(row.collectionAmount)}
                    </span>
                    <span className="truncate text-rose-600" title={`${t("ops.dashboard.collection_performance.gap")}: ${formatINR(row.outstandingAmount)}`}>
                      {t("ops.dashboard.collection_performance.gap")} {formatINRCompact(row.outstandingAmount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[9px] font-semibold text-slate-400">
          <span className="truncate tabular-nums">
            {t("ops.dashboard.collection_performance.showing", {
              shown: visibleRows.length,
              total: rows.length,
            })}
          </span>
          <Link
            to={PENDING_COLLECTIONS_URL}
            className="inline-flex shrink-0 items-center gap-1 font-black text-emerald-700 hover:underline"
          >
            {t("ops.dashboard.collection_performance.open_pending")}
            <ArrowUpRight size={11} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </section>
  );
}
