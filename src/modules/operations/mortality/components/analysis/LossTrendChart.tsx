// src/modules/operations/mortality/components/analysis/LossTrendChart.tsx
// The ONE chart that carries every detail: trips, farm weight, delivered
// weight, mortality and weight loss.
//
// Two modes, because the numbers live on wildly different scales — farm weight
// is ~5,20,000 kg for a quarter while mortality is ~13,000 kg and shrinkage
// ~770 kg, so a single absolute axis flattens the loss to invisible slivers:
//
//   Weight & trips — bars stacked to the farm weight: delivered + mortality +
//                    shrinkage, with the trip count as a line on a right axis.
//   Loss share     — the same composition as a 100% stack, so buckets of very
//                    different sizes can be compared by shape.
//
// Either way the tooltip lists all five metrics with both absolute weight and
// its share of farm weight, so nothing is hidden by the chosen scale.

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "../../../../../i18n";
import type { MortalitySeriesPoint, SeriesGranularity } from "../../services/mortalitySeries";
import { TooltipRow, TooltipShell } from "./chartBits";
import {
  asTooltipProps,
  formatKg,
  formatKgTick,
  formatPct,
  SERIES_COLORS,
  type TooltipEntry,
} from "./chartFormat";

type Mode = "weight" | "share";

interface LossTrendChartProps {
  points: MortalitySeriesPoint[];
  granularity: SeriesGranularity;
}

function pointFromPayload(entry: TooltipEntry | undefined): MortalitySeriesPoint | undefined {
  return entry?.payload as MortalitySeriesPoint | undefined;
}

export default function LossTrendChart({ points, granularity }: LossTrendChartProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("weight");

  const renderTooltip = (props: unknown) => {
    const { active, payload } = asTooltipProps(props);
    if (!active || !payload || payload.length === 0) return null;
    const point = pointFromPayload(payload[0]);
    if (!point) return null;

    return (
      <TooltipShell title={point.label}>
        <TooltipRow
          color={SERIES_COLORS.trips}
          label={t("ops.mortality.analysis.series.trips")}
          value={String(point.trips)}
        />
        <TooltipRow
          color={SERIES_COLORS.farmWeight}
          label={t("ops.mortality.analysis.series.farm_weight")}
          value={formatKg(point.farmWeight)}
        />
        <TooltipRow
          color={SERIES_COLORS.deliveredWeight}
          label={t("ops.mortality.analysis.series.delivered_weight")}
          value={formatKg(point.deliveredWeight)}
          hint={`· ${formatPct(point.deliveredPct)}`}
        />
        <TooltipRow
          color={SERIES_COLORS.mortality}
          label={t("ops.mortality.analysis.series.mortality_weight")}
          value={formatKg(point.mortalityWeight)}
          hint={`· ${formatPct(point.mortalityPct)}`}
        />
        <TooltipRow
          color={SERIES_COLORS.weightLoss}
          label={t("ops.mortality.analysis.series.weight_loss")}
          value={formatKg(point.weightLoss)}
          hint={`· ${formatPct(point.weightLossPct)}`}
        />
        <TooltipRow
          label={t("ops.mortality.kpi.mortality_pct")}
          value={formatPct(point.mortalityBirdPct)}
          hint={`· ${t("ops.mortality.kpi.farm_birds")}`}
        />
      </TooltipShell>
    );
  };

  // Ticks: with weekly/monthly buckets the axis stays readable without rotation.
  const interval = granularity === "day" && points.length > 14 ? Math.ceil(points.length / 12) : 0;

  // Weight mode stacks the three outcomes, so a bucket that gained weight is
  // clamped to a zero-height segment (its true value stays in the tooltip).
  const data = useMemo(() => {
    if (mode !== "weight") return points;
    return points.map((point) => ({ ...point, lossBar: Math.max(point.weightLoss, 0) }));
  }, [mode, points]);

  // Share mode must not clip at 100%: a bucket that gained weight pushes
  // delivered + mortality above it, and a bucket that shrank puts the loss
  // sliver below zero.
  const shareDomain = useMemo<[number, number] | [number, "auto"]>(() => {
    if (mode !== "share") return [0, "auto"];
    const tops = points.map((p) => p.deliveredPct + p.mortalityPct + Math.max(p.weightLossPct, 0));
    const lows = points.map((p) => Math.min(0, p.weightLossPct));
    return [Math.min(...lows, 0) * 1.15, Math.max(...tops, 100) * 1.008];
  }, [mode, points]);

  return (
    <div className="space-y-3">
      {/* Mode switch — the two scales the same five metrics can be read on. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
          {(["weight", "share"] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`rounded-[6px] px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                mode === value
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t(value === "weight" ? "ops.mortality.analysis.mode.weight" : "ops.mortality.analysis.mode.share")}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {t(
            mode === "weight"
              ? "ops.mortality.analysis.mode.weight_hint"
              : "ops.mortality.analysis.mode.share_hint"
          )}
        </p>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
            <XAxis
              dataKey="label"
              interval={interval}
              tick={{ fontSize: 11 }}
              className="text-slate-400 dark:text-slate-500"
              stroke="currentColor"
            />
            <YAxis
              yAxisId="kg"
              tick={{ fontSize: 11 }}
              className="text-slate-400 dark:text-slate-500"
              stroke="currentColor"
              domain={shareDomain}
              tickFormatter={(value: number) => (mode === "share" ? String(value) : formatKgTick(value))}
              width={64}
            />
            <YAxis
              yAxisId="trips"
              orientation="right"
              tick={{ fontSize: 11 }}
              className="text-slate-400 dark:text-slate-500"
              stroke="currentColor"
              width={38}
              allowDecimals={false}
            />
            <Tooltip content={(props) => renderTooltip(props)} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              iconType="circle"
              iconSize={8}
            />

            {mode === "weight" ? (
              <>
                {/* The three segments sum to the farm weight, so the bar's
                    height IS the farm weight and the loss is still readable. */}
                <Bar
                  yAxisId="kg"
                  dataKey="deliveredWeight"
                  stackId="wt"
                  name={t("ops.mortality.analysis.series.delivered_weight")}
                  fill={SERIES_COLORS.deliveredWeight}
                  maxBarSize={30}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="kg"
                  dataKey="mortalityWeight"
                  stackId="wt"
                  name={t("ops.mortality.analysis.series.mortality_weight")}
                  fill={SERIES_COLORS.mortality}
                  maxBarSize={30}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="kg"
                  dataKey="lossBar"
                  stackId="wt"
                  name={t("ops.mortality.analysis.series.weight_loss")}
                  fill={SERIES_COLORS.weightLoss}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={30}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <>
                <Bar
                  yAxisId="kg"
                  dataKey="deliveredPct"
                  stackId="share"
                  name={t("ops.mortality.analysis.series.delivered_share")}
                  fill={SERIES_COLORS.deliveredWeight}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="kg"
                  dataKey="mortalityPct"
                  stackId="share"
                  name={t("ops.mortality.analysis.series.mortality_share")}
                  fill={SERIES_COLORS.mortality}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="kg"
                  dataKey="weightLossPct"
                  stackId="share"
                  name={t("ops.mortality.analysis.series.loss_share")}
                  fill={SERIES_COLORS.weightLoss}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
              </>
            )}

            <Line
              yAxisId="trips"
              type="monotone"
              dataKey="trips"
              name={t("ops.mortality.analysis.series.trips")}
              stroke={SERIES_COLORS.trips}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0, fill: SERIES_COLORS.trips }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
