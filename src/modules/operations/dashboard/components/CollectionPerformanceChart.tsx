import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, BarChart3, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../../i18n";
import { formatINR, formatINRCompact } from "../../../../utils/format";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, { type MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import { loadCollectionRecoveryData, type CollectionRecoverySnapshot } from "../services/dashboardService";
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
  totalPending?: number;
  fromDate: string;
  toDate: string;
  /** Bumped by the page-level refresh button so the chart replays its motion. */
  animationKey?: number;
}

const MAX_VISIBLE_SHOPS = 10;
const PENDING_COLLECTIONS_URL = "/operations?tab=pending-collections";

const safeAmount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

const shopKey = (shopName: string): string => shopName.trim().toLocaleLowerCase("en-IN");

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

interface ShopTooltipState {
  row: CollectionPerformanceDatum;
  recovery: number;
  left: number;
  top: number;
  placement: "top" | "bottom";
}

const COLLECTION_RECOVERY_ANIMATION_STYLES = `
@keyframes collection-recovery-card-in {
  0% { opacity: 0; transform: translateY(14px) scale(0.965); }
  55% { opacity: 1; transform: translateY(2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes collection-recovery-ring-draw {
  from { stroke-dashoffset: var(--collection-ring-circumference); }
  to { stroke-dashoffset: var(--collection-ring-dashoffset); }
}
@keyframes collection-recovery-digit-pop {
  0% { opacity: 0; transform: scale(0.72); }
  70% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes collection-recovery-tooltip-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.collection-recovery-shop-card {
  animation: collection-recovery-card-in 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.collection-recovery-ring-progress {
  animation: collection-recovery-ring-draw 1250ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.collection-recovery-value {
  animation: collection-recovery-digit-pop 780ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both;
  transform-origin: center;
}
.collection-recovery-tooltip {
  animation: collection-recovery-tooltip-in 160ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .collection-recovery-shop-card,
  .collection-recovery-ring-progress,
  .collection-recovery-value,
  .collection-recovery-tooltip {
    animation: none !important;
  }
}
`;

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
  const progressStyle = {
    strokeDasharray: circumference,
    strokeDashoffset: dashOffset,
    "--collection-ring-circumference": circumference,
    "--collection-ring-dashoffset": dashOffset,
  } as CSSProperties;

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
          className="collection-recovery-ring-progress"
          style={progressStyle}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="collection-recovery-value relative flex max-w-[78%] items-center justify-center overflow-visible whitespace-nowrap font-black leading-none tabular-nums tracking-[-0.08em] text-slate-800">
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
  totalPending,
  fromDate,
  toDate,
  animationKey = 0,
}: CollectionPerformanceChartProps) {
  const { t, language } = useI18n();
  const [sortBy, setSortBy] = useState<CollectionPerformanceSort>("outstanding");
  const [selectedShop, setSelectedShop] = useState("");
  const [sortAnimationId, setSortAnimationId] = useState(0);
  const [shopTooltip, setShopTooltip] = useState<ShopTooltipState | null>(null);
  const [localSnapshot, setLocalSnapshot] = useState<{ key: string; snapshot: CollectionRecoverySnapshot } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const chartRef = useRef<HTMLElement | null>(null);

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
  const propSnapshotKey = useMemo(() => {
    const firstShop = data[0]?.shopName ?? "";
    const lastShop = data.at(-1)?.shopName ?? "";
    return [fromDate, toDate, totalSales, totalCollections, totalPending, data.length, firstShop, lastShop].join("|");
  }, [data, fromDate, toDate, totalSales, totalCollections, totalPending]);
  const activeLocalSnapshot = localSnapshot?.key === propSnapshotKey ? localSnapshot.snapshot : null;
  const sourceRows = activeLocalSnapshot?.rows ?? data;
  const sourceTotalSales = activeLocalSnapshot?.totalSales ?? totalSales;
  const sourceTotalCollections = activeLocalSnapshot?.totalCollections ?? totalCollections;
  const sourceTotalPending = activeLocalSnapshot?.totalPending ?? totalPending;

  const rows = useMemo(() => normalizeCollectionPerformance(sourceRows), [sourceRows]);
  const shopOptions = useMemo<MasterDropdownOption[]>(
    () => rows
      .slice()
      .sort((a, b) => a.shopName.localeCompare(b.shopName, "en-IN"))
      .map((row) => {
        const inactive = row.shopStatus === "Inactive";
        return {
          value: shopKey(row.shopName),
          label: inactive ? `${row.shopName} · ${t("common.inactive")}` : row.shopName,
          searchText: row.shopName,
          keywords: `${row.shopStatus ?? "Active"} ${row.shopName}`,
        };
      }),
    [rows, t],
  );
  const sortedRows = useMemo(() => sortCollectionPerformance(rows, sortBy), [rows, sortBy]);
  const selectedRow = useMemo(
    () => rows.find((row) => shopKey(row.shopName) === selectedShop) ?? null,
    [rows, selectedShop],
  );
  const effectiveSelectedShop = selectedRow ? selectedShop : "";
  const visibleRows = useMemo(() => {
    if (!selectedRow) return sortedRows.slice(0, MAX_VISIBLE_SHOPS);
    return [
      selectedRow,
      ...sortedRows
        .filter((row) => shopKey(row.shopName) !== selectedShop)
        .slice(0, MAX_VISIBLE_SHOPS - 1),
    ];
  }, [selectedRow, selectedShop, sortedRows]);

  const rowSalesTotal = rows.reduce((total, row) => total + safeAmount(row.salesAmount), 0);
  const rowCollectionsTotal = rows.reduce((total, row) => total + safeAmount(row.collectionAmount), 0);
  const rowPendingTotal = rows.reduce((total, row) => total + safeAmount(row.outstandingAmount), 0);
  const sales = selectedRow ? safeAmount(selectedRow.salesAmount) : safeAmount(rowSalesTotal || sourceTotalSales);
  const collections = selectedRow ? safeAmount(selectedRow.collectionAmount) : safeAmount(rowCollectionsTotal || sourceTotalCollections);
  const pending = selectedRow
    ? safeAmount(selectedRow.outstandingAmount)
    : safeAmount(sourceTotalPending ?? rowPendingTotal);
  const recovery = sales > 0 ? (collections / sales) * 100 : collections > 0 ? 100 : 0;

  const setSortValue = (value: string) => {
    const nextSort = value ? value as CollectionPerformanceSort : "outstanding";
    if (!sortOptions.some((option) => option.value === nextSort)) return;
    if (nextSort === sortBy) return;
    setShopTooltip(null);
    setSortBy(nextSort);
    setSortAnimationId((current) => current + 1);
  };

  const setShopValue = (value: string) => {
    if (value && !shopOptions.some((option) => option.value === value)) return;
    if (value === selectedShop) return;
    setShopTooltip(null);
    setSelectedShop(value);
    setSortAnimationId((current) => current + 1);
  };

  const resetView = () => {
    if (!selectedShop && sortBy === "outstanding") return;
    setShopTooltip(null);
    setSelectedShop("");
    setSortBy("outstanding");
    setSortAnimationId((current) => current + 1);
  };
  const hasViewFilter = Boolean(effectiveSelectedShop) || sortBy !== "outstanding";

  const refreshChart = async () => {
    if (refreshing) return;
    setShopTooltip(null);
    setRefreshing(true);
    try {
      const nextSnapshot = await loadCollectionRecoveryData(fromDate, toDate);
      setLocalSnapshot({ key: propSnapshotKey, snapshot: nextSnapshot });
      if (selectedShop && !nextSnapshot.rows.some((row) => shopKey(row.shopName) === selectedShop)) {
        setSelectedShop("");
      }
      setSortAnimationId((current) => current + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const showShopTooltip = (
    row: CollectionPerformanceDatum,
    rowRecovery: number,
    target: HTMLElement,
  ) => {
    const chart = chartRef.current;
    if (!chart) return;
    const rect = target.getBoundingClientRect();
    const chartRect = chart.getBoundingClientRect();
    const tooltipWidth = 256;
    const tooltipHeight = 166;
    const inset = 10;
    const targetTop = rect.top - chartRect.top;
    const targetBottom = rect.bottom - chartRect.top;
    const centeredLeft = rect.left - chartRect.left + rect.width / 2;
    const left = Math.min(
      Math.max(centeredLeft, tooltipWidth / 2 + inset),
      chartRect.width - tooltipWidth / 2 - inset,
    );

    const bottomTop = targetBottom + 8;
    const topTop = targetTop - tooltipHeight - 8;
    const bottomFits = bottomTop + tooltipHeight <= chartRect.height - inset;
    const topFits = topTop >= inset;
    const placement: ShopTooltipState["placement"] = bottomFits || !topFits ? "bottom" : "top";
    const preferredTop = placement === "bottom" ? bottomTop : topTop;
    const top = Math.min(
      Math.max(preferredTop, inset),
      Math.max(inset, chartRect.height - tooltipHeight - inset),
    );

    setShopTooltip({ row, recovery: rowRecovery, left, top, placement });
  };

  return (
    <>
      <style>{COLLECTION_RECOVERY_ANIMATION_STYLES}</style>
      <section ref={chartRef} className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30 px-4 py-2.5">
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
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50/65 px-1.5 py-1">
              <RecoveryRing key={`summary-${animationKey}-${sortAnimationId}`} value={recovery} size={42} />
              <p className="text-[8px] font-black uppercase tracking-wide text-emerald-700">
                {t("ops.dashboard.collection_performance.recovery")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col p-2.5">
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)_auto_auto] gap-1.5">
          <MasterDropdown
            hideLabel
            label={t("ops.dashboard.collection_performance.shop_label")}
            value={effectiveSelectedShop}
            options={shopOptions}
            onChange={setShopValue}
            placeholder={t("ops.dashboard.collection_performance.all_shops")}
            searchable
            allowClear
            portal={false}
            className="min-w-0"
            triggerClassName="h-8 rounded-lg border-slate-200 bg-white/95 px-2 text-[9.5px] font-semibold shadow-xs"
          />
          <MasterDropdown
            hideLabel
            label={t("ops.dashboard.collection_performance.sort_label")}
            value={sortBy}
            options={sortOptions}
            onChange={setSortValue}
            placeholder={t("ops.dashboard.collection_performance.sort_outstanding")}
            searchable
            portal={false}
            className="min-w-0"
            triggerClassName="h-8 rounded-lg border-slate-200 bg-white/95 px-2 text-[9.5px] font-semibold shadow-xs"
          />
          <button
            type="button"
            onClick={resetView}
            disabled={!hasViewFilter}
            aria-label={t("common.reset")}
            className="group flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[9.5px] font-black text-slate-500 shadow-xs transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500"
          >
            <RotateCcw
              size={12}
              className={`shrink-0 ${hasViewFilter ? "motion-safe:group-hover:animate-[var(--animate-action-reset)]" : ""}`}
              aria-hidden="true"
            />
            <span>{t("common.reset")}</span>
          </button>
          <BrandRefreshButton
            loading={refreshing}
            onClick={refreshChart}
            ariaLabel={t("common.refresh")}
            className="!h-8 shrink-0 !gap-1 !pl-2 !pr-2 text-[9.5px] font-black"
          >
            {t("common.refresh")}
          </BrandRefreshButton>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            [t("ops.dashboard.collection_performance.sales"), sales, "border-slate-200 bg-slate-50/80 text-slate-700"],
            [t("ops.dashboard.collection_performance.collected"), collections, "border-emerald-200 bg-emerald-50/75 text-emerald-700"],
            [t("ops.dashboard.collection_performance.gap"), pending, "border-orange-200 bg-orange-50/80 text-orange-700"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`min-w-0 rounded-lg border px-2 py-1 text-center ${tone}`}>
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
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {visibleRows.map((row, index) => {
              const rowRecovery = collectionRecoveryPercentage(row);
              return (
                <article
                  key={`${animationKey}-${sortAnimationId}-${row.shopName}`}
                  tabIndex={0}
                  aria-label={`${row.shopName}, ${t("ops.dashboard.collection_performance.recovery")}: ${rowRecovery.toFixed(1)}%, ${t("ops.dashboard.collection_performance.gap")}: ${formatINR(row.outstandingAmount)}`}
                  className="collection-recovery-shop-card group relative min-w-0 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-2.5 py-1 shadow-xs transition-colors duration-150 hover:from-emerald-50/35 hover:to-white focus:bg-emerald-50/30"
                  style={{ animationDelay: `${index * 80}ms` }}
                  onFocus={(event) => showShopTooltip(row, rowRecovery, event.currentTarget)}
                  onBlur={() => setShopTooltip(null)}
                  onMouseEnter={(event) => showShopTooltip(row, rowRecovery, event.currentTarget)}
                  onMouseLeave={() => setShopTooltip(null)}
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

      </div>

      {shopTooltip ? (
      <div
        role="tooltip"
        className="collection-recovery-tooltip pointer-events-none absolute z-50 max-h-[10.375rem] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-[10px] text-slate-500 shadow-xl shadow-slate-900/12"
        style={{
          left: shopTooltip.left,
          top: shopTooltip.top,
          transform: "translateX(-50%)",
        }}
      >
        <span
          className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-slate-200 bg-white ${
            shopTooltip.placement === "top"
              ? "-bottom-1.5 border-b border-r"
              : "-top-1.5 border-l border-t"
          }`}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-100 pb-2">
            <p className="min-w-0 break-words text-[12px] font-bold leading-snug text-slate-800">
              {shopTooltip.row.shopName}
            </p>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-100">
              {shopTooltip.recovery.toFixed(1)}%
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <dt className="font-black uppercase tracking-wide text-slate-400">
                {t("ops.dashboard.collection_performance.sales")}
              </dt>
              <dd className="mt-0.5 font-bold tabular-nums text-slate-800">
                {formatINR(shopTooltip.row.salesAmount)}
              </dd>
            </div>
            <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
              <dt className="font-black uppercase tracking-wide text-emerald-500">
                {t("ops.dashboard.collection_performance.collected")}
              </dt>
              <dd className="mt-0.5 font-bold tabular-nums text-emerald-700">
                {formatINR(shopTooltip.row.collectionAmount)}
              </dd>
            </div>
          </dl>
          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-orange-50 px-2 py-1.5 text-orange-700 ring-1 ring-inset ring-orange-100">
            <span className="font-black uppercase tracking-wide text-orange-500">
              {t("ops.dashboard.collection_performance.gap")}
            </span>
            <strong className="text-[11px] tabular-nums">
              {formatINR(shopTooltip.row.outstandingAmount)}
            </strong>
          </div>
        </div>
      </div>
      ) : null}
    </section>
  </>
  );
}
