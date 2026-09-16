import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../../i18n";
import { formatINR, formatINRCompact } from "../../../../utils/format";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
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

const clampPct = (value: number): number => Math.min(100, Math.max(0, value));

const recoveryColor = (value: number): string => {
  if (value >= 85) return "#10b981";
  if (value >= 60) return "#22c55e";
  if (value >= 35) return "#f59e0b";
  return "#fb923c";
};

function RecoveryRing({ value, size = 46 }: { value: number; size?: number }) {
  const pct = clampPct(value);
  const color = recoveryColor(pct);
  const radius = 20.4;
  const strokeWidth = 4.1;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const roundedPct = Math.round(pct);
  const isFullRecovery = roundedPct >= 100;
  const numberFontSize = Math.max(13, Math.round(size * (isFullRecovery ? 0.27 : 0.31) * 10) / 10);
  const percentFontSize = Math.max(9, Math.round(size * (isFullRecovery ? 0.17 : 0.2) * 10) / 10);

  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-inset ring-slate-200/80"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg className="absolute inset-0" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={pct >= 99.5 ? "butt" : "round"}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="relative flex max-w-[78%] items-center justify-center overflow-visible whitespace-nowrap font-black leading-none tabular-nums tracking-[-0.08em] text-slate-800">
        <span style={{ fontSize: numberFontSize, lineHeight: 1 }}>{roundedPct}</span>
        <span className="ml-px tracking-normal" style={{ fontSize: percentFontSize, lineHeight: 1 }}>%</span>
      </span>
    </span>
  );
}

export default function CollectionPerformanceChart({
  data,
  totalSales,
  totalCollections,
  fromDate,
  toDate,
}: CollectionPerformanceChartProps) {
  const { t, language } = useI18n();
  const [sortBy, setSortBy] = useState<CollectionPerformanceSort>("outstanding");

  const sortOptions = useMemo<MasterDropdownOption[]>(
    () => [
      {
        value: "outstanding",
        label: t("ops.dashboard.collection_performance.sort_outstanding"),
        keywords: "gap pending outstanding high",
      },
      {
        value: "recoveryLow",
        label: t("ops.dashboard.collection_performance.sort_recovery_low"),
        keywords: "weak recovery low",
      },
      {
        value: "recoveryHigh",
        label: t("ops.dashboard.collection_performance.sort_recovery_high"),
        keywords: "best recovery high",
      },
      {
        value: "sales",
        label: t("ops.dashboard.collection_performance.sort_sales"),
        keywords: "sales high",
      },
      {
        value: "collections",
        label: t("ops.dashboard.collection_performance.sort_collections"),
        keywords: "collections collected high",
      },
      {
        value: "collectionsLow",
        label: t("ops.dashboard.collection_performance.sort_collections_low"),
        keywords: "collections collected low",
      },
      {
        value: "shop",
        label: t("ops.dashboard.collection_performance.sort_shop"),
        keywords: "shop name alphabet",
      },
    ],
    [t],
  );
  const rows = useMemo(() => normalizeCollectionPerformance(data), [data]);
  const visibleRows = useMemo(
    () => sortCollectionPerformance(rows, sortBy).slice(0, MAX_VISIBLE_SHOPS),
    [rows, sortBy],
  );

  const sales = safeAmount(totalSales);
  const collections = safeAmount(totalCollections);
  const gap = Math.max(0, sales - collections);
  const recovery = sales > 0 ? (collections / sales) * 100 : 0;

  const setSortValue = (value: string) => {
    if (!value) {
      setSortBy("outstanding");
      return;
    }
    if (!sortOptions.some((option) => option.value === value)) return;
    setSortBy(value as CollectionPerformanceSort);
  };

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={PENDING_COLLECTIONS_URL}
              className="group/title inline-flex min-w-0 items-center gap-1.5"
            >
              <h2 className="truncate text-base font-black tracking-tight text-slate-900 transition-colors group-hover/title:text-emerald-700">
                {t("ops.dashboard.collection_performance.title")}
              </h2>
              <ArrowUpRight size={13} className="shrink-0 text-slate-300 group-hover/title:text-emerald-600" aria-hidden="true" />
            </Link>
            <span aria-hidden="true" className="mt-1.5 block h-0.5 w-10 rounded-full bg-emerald-400" />
            <p className="mt-1.5 truncate text-[10.5px] font-semibold tabular-nums text-slate-400">
              {formatPeriod(fromDate, toDate, language)}
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <MasterDropdown
              hideLabel
              label={t("ops.dashboard.collection_performance.sort_label")}
              value={sortBy}
              options={sortOptions}
              onChange={setSortValue}
              placeholder={t("ops.dashboard.collection_performance.sort_outstanding")}
              searchable
              allowClear
              className="w-full sm:w-48 lg:w-52"
              triggerClassName="h-9 rounded-xl border-slate-200 bg-white/95 px-3 text-[11.5px] font-semibold shadow-xs"
            />
            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/65 px-2.5 py-1.5">
              <RecoveryRing value={recovery} size={66} />
              <div className="leading-tight">
                <p className="text-[9px] font-black uppercase tracking-wide text-emerald-700">
                  {t("ops.dashboard.collection_performance.recovery")}
                </p>
                <p className="text-lg font-black tabular-nums text-slate-900">{recovery.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            [t("ops.dashboard.collection_performance.sales"), sales, "border-slate-200 bg-slate-50/80 text-slate-700"],
            [t("ops.dashboard.collection_performance.collected"), collections, "border-emerald-200 bg-emerald-50/75 text-emerald-700"],
            [t("ops.dashboard.collection_performance.gap"), gap, "border-orange-200 bg-orange-50/80 text-orange-700"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`min-w-0 rounded-lg border px-2 py-1.5 text-center ${tone}`}>
              <span className="block truncate text-[8.5px] font-black uppercase tracking-wide opacity-60">
                {label}
              </span>
              <strong
                className="block truncate text-[12.5px] font-black tabular-nums"
                title={formatINR(Number(value))}
              >
                {formatINRCompact(Number(value))}
              </strong>
            </div>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <BarChart3 size={19} aria-hidden="true" />
            <p className="text-[10px] font-bold">
              {t("ops.dashboard.collection_performance.no_data")}
            </p>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {visibleRows.map((row, index) => {
              const rowRecovery = collectionRecoveryPercentage(row);
              return (
                <article
                  key={row.shopName}
                  className="group min-w-0 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-2.5 py-1.5 shadow-xs transition-colors duration-150 hover:from-emerald-50/35 hover:to-white"
                  title={`${row.shopName}\n${t("ops.dashboard.collection_performance.sales")}: ${formatINR(row.salesAmount)}\n${t("ops.dashboard.collection_performance.collected")}: ${formatINR(row.collectionAmount)}\n${t("ops.dashboard.collection_performance.gap")}: ${formatINR(row.outstandingAmount)}`}
                >
                  <div className="grid min-w-0 grid-cols-[1.35rem_3.65rem_minmax(0,1fr)_auto] items-center gap-1.5">
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[9.5px] font-black tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-100">
                      {index + 1}
                    </span>
                    <RecoveryRing value={rowRecovery} size={56} />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium leading-tight text-slate-700 transition-colors group-hover:text-slate-900">
                        {row.shopName}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold tabular-nums text-slate-500">
                        {formatINRCompact(row.collectionAmount)} / {formatINRCompact(row.salesAmount)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right leading-tight">
                      <span
                        className="block rounded-full bg-orange-50 px-1.5 py-1 text-[10.5px] font-black tabular-nums text-orange-700 ring-1 ring-inset ring-orange-100"
                        title={`${t("ops.dashboard.collection_performance.gap")}: ${formatINR(row.outstandingAmount)}`}
                      >
                        {formatINRCompact(row.outstandingAmount)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[9px] font-semibold text-slate-400">
          <span className="truncate tabular-nums">
            {visibleRows.length} / {rows.length} shops
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
