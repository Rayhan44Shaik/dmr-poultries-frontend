// src/modules/operations/mortality/components/analysis/TripAnalysisPanel.tsx
// Trip Analysis — the chart section of the Weight Loss / Mortality page.
//
// Layout: HEADER -> SUMMARY STRIP -> TABS -> CHART.
//
// The summary strip carries the five details the page is about (trips, farm
// weight, delivered weight, mortality, weight loss) straight from the server
// aggregates, then three views dig into them:
//
//   Trend       — all five metrics over time, absolute or as a loss share
//   Weight flow — waterfall from farm weight down to delivered weight
//   Trip risk   — one bubble per trip, mortality vs shrinkage against average

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, GitCompareArrows, Radar } from "lucide-react";
import { useI18n } from "../../../../../i18n";
import { formatNumber } from "../../../../../utils/format";
import type {
  MortalitySeries,
  SeriesGranularity,
} from "../../services/mortalitySeries";
import type { TripRiskPoint } from "../../hooks/useMortalitySeries";
import LossTrendChart from "./LossTrendChart";
import LossWaterfallChart from "./LossWaterfallChart";
import TripRiskChart from "./TripRiskChart";
import { formatKg, formatPct, SERIES_COLORS } from "./chartFormat";

type Tab = "trend" | "flow" | "risk";

interface TripAnalysisPanelProps {
  series: MortalitySeries | null;
  riskPoints: TripRiskPoint[];
  loading: boolean;
  error: string | null;
  /** True when a filter/search is applied — only changes the subtitle. */
  filtered: boolean;
}

const GRANULARITY_KEY: Record<SeriesGranularity, string> = {
  day: "ops.mortality.analysis.granularity.day",
  week: "ops.mortality.analysis.granularity.week",
  month: "ops.mortality.analysis.granularity.month",
};

function SummaryStat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate text-[15px] font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </span>
      {hint ? (
        <span className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}

export default function TripAnalysisPanel({
  series,
  riskPoints,
  loading,
  error,
  filtered,
}: TripAnalysisPanelProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("trend");

  const kpis = series?.kpis;
  const points = series?.points ?? [];

  // Averages for the risk quadrants — over every trip in view, not just the
  // capped set that gets plotted.
  const averages = useMemo(() => {
    if (!series || series.rows.length === 0) return { mortality: 0, loss: 0 };
    const mortality =
      series.rows.reduce((acc, row) => acc + (Number(row.mortalityPercentage) || 0), 0) / series.rows.length;
    const loss =
      series.rows.reduce((acc, row) => acc + (Number(row.weightLossPercentage) || 0), 0) / series.rows.length;
    return { mortality, loss };
  }, [series]);

  const tabs: { id: Tab; labelKey: string; icon: typeof BarChart3 }[] = [
    { id: "trend", labelKey: "ops.mortality.analysis.tab.trend", icon: BarChart3 },
    { id: "flow", labelKey: "ops.mortality.analysis.tab.flow", icon: GitCompareArrows },
    { id: "risk", labelKey: "ops.mortality.analysis.tab.risk", icon: Radar },
  ];

  const isEmpty = !loading && !error && points.length === 0;

  return (
    <section className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
            <Activity size={15} />
          </span>
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              {t("ops.mortality.analysis.title")}
            </h3>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {t(
                filtered
                  ? "ops.mortality.analysis.subtitle_filtered"
                  : "ops.mortality.analysis.subtitle"
              )}
            </p>
          </div>
        </div>

        {series ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {t(GRANULARITY_KEY[series.granularity])}
            {series.points.length > 0
              ? ` · ${t("ops.mortality.analysis.buckets", { count: series.points.length })}`
              : ""}
          </span>
        ) : null}
      </div>

      {/* ── Summary strip — the five details, from the server aggregates ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryStat
          label={t("ops.mortality.kpi.completed_trips")}
          value={kpis ? formatNumber(kpis.totalTrips) : "—"}
          hint={kpis ? `${formatNumber(kpis.deliveryShops)} ${t("ops.mortality.kpi.delivery_shops").toLowerCase()}` : undefined}
          color={SERIES_COLORS.trips}
        />
        <SummaryStat
          label={t("ops.mortality.kpi.farm_weight")}
          value={kpis ? formatKg(kpis.farmWeight) : "—"}
          hint={kpis ? `${formatNumber(kpis.farmBirds)} birds` : undefined}
          color={SERIES_COLORS.farmWeight}
        />
        <SummaryStat
          label={t("ops.mortality.kpi.delivery_weight")}
          value={kpis ? formatKg(kpis.deliveredWeight) : "—"}
          hint={kpis ? t("ops.mortality.analysis.of_farm", { value: (100 - kpis.mortalityPercentage - kpis.weightLossPercentage).toFixed(2) }) : undefined}
          color={SERIES_COLORS.deliveredWeight}
        />
        <SummaryStat
          label={t("ops.mortality.kpi.mortality_weight")}
          value={kpis ? formatKg(kpis.mortalityWeight) : "—"}
          hint={kpis ? `${formatPct(kpis.mortalityPercentage)} · ${formatNumber(kpis.mortalityCount)} birds` : undefined}
          color={SERIES_COLORS.mortality}
        />
        <SummaryStat
          label={t("ops.mortality.kpi.weight_loss")}
          value={kpis ? formatKg(kpis.weightLoss) : "—"}
          hint={kpis ? formatPct(kpis.weightLossPercentage) : undefined}
          color={SERIES_COLORS.weightLoss}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={14} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        {tab === "risk" && series ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {t("ops.mortality.analysis.risk.top", { count: riskPoints.length, total: series.totalTrips })}
          </p>
        ) : null}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        {loading ? (
          <div className="flex h-[320px] w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-sky-500" />
          </div>
        ) : error ? (
          <div className="flex h-[320px] w-full flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle size={18} className="text-rose-500" />
            <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{error}</p>
          </div>
        ) : isEmpty ? (
          <div className="flex h-[320px] w-full items-center justify-center">
            <p className="text-[13px] font-medium text-slate-400">{t("ops.mortality.analysis.empty")}</p>
          </div>
        ) : tab === "trend" ? (
          <LossTrendChart points={points} granularity={series?.granularity ?? "week"} />
        ) : tab === "flow" && kpis ? (
          <div className="space-y-2">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {t("ops.mortality.analysis.flow.caption")}
            </p>
            <LossWaterfallChart
              input={{
                farmWeight: kpis.farmWeight,
                mortalityWeight: kpis.mortalityWeight,
                weightLoss: kpis.weightLoss,
                deliveredWeight: kpis.deliveredWeight,
              }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {t("ops.mortality.analysis.risk.caption")}
            </p>
            <TripRiskChart
              points={riskPoints}
              avgMortalityPct={averages.mortality}
              avgWeightLossPct={averages.loss}
            />
          </div>
        )}
      </div>

      {series?.truncated ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {t("ops.mortality.analysis.truncated", { count: series.countedTrips })}
        </p>
      ) : null}
    </section>
  );
}
