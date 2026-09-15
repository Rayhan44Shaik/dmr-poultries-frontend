// src/modules/operations/dashboard/components/OperationalTrendsChart.tsx
// OPERATIONAL TRENDS — the dashboard's main analytical chart.
//
// What it shows, all in one plot:
//   • Trips            → indigo line, right axis
//   • Farm weight      → the height of the stacked weight flow (kg)
//   • Delivered weight → blue layer of that flow
//   • Mortality        → rose layer of that flow
//   • Weight loss      → amber layer of that flow
//
// Because farm weight = delivered + mortality + loss holds for every trip, the
// three layers stack to exactly the farm weight — one smooth flow carries all
// four weight numbers at once. The footer carries the totals, so the plot stays
// in kilos and needs no mode toggle.
//
// The range comes from the dashboard's global calendar; the bucket (per day /
// week / month) is chosen by the Today / Week / Month chips in the card header
// and defaults to whatever the calendar's own length implies, so a reload
// always lands on the calendar's view. Trips,
// farm weight, delivered weight, mortality and weight loss are all summed from
// the completed-trips API — the same endpoint the Weight Loss / Mortality page
// reads — so the two can never disagree.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "../../../../i18n";
import type { OperationalTrends } from "../services/operationalTrends";
import {
  aggregateOperational,
  compactKg,
  formatBucket,
  formatBucketLong,
  plain,
  previousBySortKey,
  summariseOperational,
  tickKg,
  type Granularity,
  type OperationalBucket,
} from "../utils/trendSeries";

interface OperationalTrendsChartProps {
  trends: OperationalTrends | null;
  /** Bucket to draw: today (per day), week or month. Owned by the header chips. */
  granularity: Granularity;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const COLOR = {
  trips: "#4338ca",
  // Neutral slate keeps the farm-weight reference calm while the series below
  // use a clear blue / rose / amber palette instead of competing greens.
  farmWeight: "#64748b",
  delivered: "#2563eb",
  mortality: "#e11d48",
  weightLoss: "#f59e0b",
} as const;



const signed = (current: number, earlier: number | undefined): string | null => {
  if (earlier == null || earlier === 0) return null;
  const change = ((current - earlier) / earlier) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
};

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

function ChartTooltip({
  point,
  label,
  previous,
  t,
  locale,
}: {
  point: OperationalBucket;
  label: string;
  previous: OperationalBucket | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
}) {
  const tripsDelta = signed(point.trips, previous?.trips);
  const farmDelta = signed(point.farmWeight, previous?.farmWeight);

  return (
    <div className="min-w-[236px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
      <p className="mb-2 border-b border-slate-100 pb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
        {formatBucketLong(label, locale)}
      </p>

      <div className="space-y-1.5">
        <Row color={COLOR.trips} label={t("ops.dashboard.trips")} value={plain(point.trips, 0, locale)} delta={tripsDelta} />
        <Row
          color={COLOR.farmWeight}
          label={t("ops.dashboard.trend.farm_weight")}
          value={`${plain(point.farmWeight, 2, locale)} kg`}
          delta={farmDelta}
        />
        <Row
          color={COLOR.delivered}
          label={t("ops.dashboard.trend.delivered_weight")}
          value={`${plain(point.deliveredWeight, 2, locale)} kg`}
          delta={`${point.deliveredPct.toFixed(2)}%`}
        />
        <Row
          color={COLOR.weightLoss}
          label={t("ops.dashboard.trend.weight_loss")}
          value={`${plain(point.weightLoss, 2, locale)} kg`}
          delta={`${point.weightLossPct.toFixed(2)}%`}
        />

        {/* Birds, not weights: picked up at the farm and handed to the shops. */}
        <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5 text-slate-400">
          <Row label={t("ops.dashboard.trend.birds_picked_up")} value={plain(point.farmBirds, 0, locale)} />
          <Row label={t("ops.dashboard.trend.birds_delivered")} value={plain(point.deliveredBirds, 0, locale)} />
          <Row
            label={t("ops.dashboard.mortality_birds")}
            value={plain(point.mortalityCount, 0, locale)}
            delta={`${point.mortalityBirdPct.toFixed(2)}%`}
          />
        </div>
      </div>
    </div>
  );
}

function Row({
  color,
  label,
  value,
  delta,
  muted,
}: {
  color?: string;
  label: string;
  value: string;
  delta?: string | null;
  muted?: boolean;
}) {
  const arrow = delta && /^[+-]/.test(delta);
  const up = delta?.startsWith("+");
  return (
    <div className="flex items-baseline justify-between gap-4 text-[12px]">
      <span className={`flex items-center gap-1.5 ${muted ? "text-slate-400" : "text-slate-500"}`}>
        {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-bold tabular-nums ${muted ? "text-slate-500" : "text-slate-800"}`}>{value}</span>
        {delta ? (
          <span
            className={`text-[10.5px] font-bold tabular-nums ${
              arrow ? (up ? "text-emerald-600" : "text-rose-500") : "text-slate-400"
            }`}
          >
            {arrow ? `${up ? "▲" : "▼"} ${delta.replace(/^[+-]/, "")}` : delta}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Eases a figure from its old value to the new one, so switching windows reads
 * as movement instead of a jump. Honours prefers-reduced-motion by finishing on
 * the first frame (a zero-length animation).
 */
function useAnimatedNumber(value: number, duration = 520): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;

    const reduced =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 0 : duration;
    let frame = 0;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - progress) ** 3;
      const next = progress >= 1 ? value : from + (value - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

/**
 * The average marker's caption, on its own plate: a rounded white chip hung
 * just above the dashed line at the right-hand edge, so it can never print
 * across an area or the axis.
 */
function AverageLabel({
  viewBox,
  text,
}: {
  viewBox?: { x?: number; y?: number; width?: number };
  text: string;
}) {
  const width = 64;
  const height = 16;
  if (!viewBox?.width) return null;
  const x = (viewBox.x ?? 0) + viewBox.width - width;
  const y = (viewBox.y ?? 0) - height - 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill="#ffffff"
        fillOpacity={0.92}
        stroke="#bae6fd"
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 9.5, fill: "#0369a1", fontWeight: 700 }}
      >
        {text}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart                                                              */
/* ------------------------------------------------------------------ */

export default function OperationalTrendsChart({
  trends,
  granularity,
  loading = false,
  error = null,
  onRetry,
}: OperationalTrendsChartProps) {
  const { t, language } = useI18n();
  const locale = language === "te" ? "te-IN" : "en-IN";

  const rows = trends?.rows;

  const buckets = useMemo(
    () => aggregateOperational(rows ?? [], granularity),
    [rows, granularity]
  );
  const previous = useMemo(() => previousBySortKey(buckets), [buckets]);
  const totals = useMemo(() => summariseOperational(buckets), [buckets]);

  // A bucket that gained weight clamps to a zero-height segment so the stack
  // still equals the farm weight (the true value stays in the tooltip).
  const data = useMemo(
    () => buckets.map((bucket) => ({ ...bucket, lossBar: Math.max(bucket.weightLoss, 0) })),
    [buckets]
  );

  if (loading && !trends) {
    return (
      <div className="flex h-[20.625rem] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (error && !trends) {
    return (
      <div className="flex h-[20.625rem] w-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-[13px] font-semibold text-slate-600">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-600"
          >
            {t("common.retry")}
          </button>
        ) : null}
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="flex h-[20.625rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
        <p className="text-sm font-semibold text-slate-500">{t("ops.dashboard.trend.empty")}</p>
        <p className="text-[11.5px] text-slate-400">{t("ops.dashboard.trend.empty_hint")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* ── Plot ─────────────────────────────────────────────────────── */}
      <div className="min-h-[8.75rem] w-full flex-1" style={{ minHeight: "8.75rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 2, bottom: 0, left: -8 }}>
            <defs>
              {/* Soft fills give the stacked movement areas depth without
                  overpowering the trips line. */}
              <linearGradient id="ot-trips-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.trips} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COLOR.trips} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ot-delivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.delivered} stopOpacity={1} />
                <stop offset="100%" stopColor={COLOR.delivered} stopOpacity={0.72} />
              </linearGradient>
              <linearGradient id="ot-mortality" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.mortality} stopOpacity={1} />
                <stop offset="100%" stopColor={COLOR.mortality} stopOpacity={0.78} />
              </linearGradient>
              <linearGradient id="ot-loss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.weightLoss} stopOpacity={1} />
                <stop offset="100%" stopColor={COLOR.weightLoss} stopOpacity={0.78} />
              </linearGradient>
              {/* A touch of depth keeps the trips line readable above the areas. */}
              <filter id="ot-line-shadow" x="-20%" y="-20%" width="140%" height="160%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={COLOR.trips} floodOpacity={0.3} />
              </filter>
            </defs>

            <CartesianGrid stroke="#eef2f7" strokeDasharray="4 8" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatBucket(value, locale)}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              yAxisId="weight"
              tickFormatter={(value: number) => tickKg(value, locale)}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="trips"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: COLOR.trips }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                const point = (payload?.[0]?.payload ?? null) as OperationalBucket | null;
                if (!active || !point) return null;
                return (
                  <ChartTooltip
                    point={point}
                    label={String(label ?? point.date)}
                    previous={previous.get(point.sortKey) ?? null}
                    t={t}
                    locale={locale}
                  />
                );
              }}
              cursor={{ fill: "rgba(99,102,241,0.05)", radius: 6 }}
            />

            {/* Smooth stacked movement areas replace the heavy bar treatment.
                The three layers still sum to farm weight, but now read as a
                continuous flow across the selected date window. */}
            <Area
              yAxisId="weight"
              type="monotone"
              dataKey="deliveredWeight"
              stackId="wt"
              name={t("ops.dashboard.trend.delivered_weight")}
              stroke={COLOR.delivered}
              strokeWidth={1.6}
              fill="url(#ot-delivered)"
              animationDuration={620}
              animationEasing="ease-out"
              connectNulls
            />
            <Area
              yAxisId="weight"
              type="monotone"
              dataKey="mortalityWeight"
              stackId="wt"
              name={t("ops.dashboard.trend.mortality_weight")}
              stroke={COLOR.mortality}
              strokeWidth={1.4}
              fill="url(#ot-mortality)"
              animationDuration={620}
              animationEasing="ease-out"
              connectNulls
            />
            <Area
              yAxisId="weight"
              type="monotone"
              dataKey="lossBar"
              stackId="wt"
              name={t("ops.dashboard.trend.weight_loss")}
              stroke={COLOR.weightLoss}
              strokeWidth={1.4}
              fill="url(#ot-loss)"
              animationDuration={620}
              animationEasing="ease-out"
              connectNulls
            />
            <ReferenceLine
              yAxisId="weight"
              y={totals.avgFarmWeight}
              stroke={COLOR.farmWeight}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              strokeWidth={1}
              /* Its own little plate, so the average never prints over an area. */
              label={
                <AverageLabel
                  text={`${t("ops.dashboard.trend.average")} ${tickKg(totals.avgFarmWeight, locale)}`}
                />
              }
            />

            <Area
              yAxisId="trips"
              type="monotone"
              dataKey="trips"
              stroke="none"
              fill="url(#ot-trips-area)"
              animationDuration={820}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="trips"
              type="monotone"
              dataKey="trips"
              name={t("ops.dashboard.trips")}
              stroke={COLOR.trips}
              strokeWidth={2.2}
              strokeLinecap="round"
              filter="url(#ot-line-shadow)"
              dot={{ r: 2.6, fill: COLOR.trips, strokeWidth: 0 }}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff" }}
              animationDuration={820}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer: the whole period, in numbers ──────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat
          label={t("ops.dashboard.trips")}
          value={totals.trips}
          format={(value) => plain(Math.round(value), 0, locale)}
          color={COLOR.trips}
        />
        <Stat
          label={t("ops.dashboard.trend.farm_weight")}
          value={totals.farmWeight}
          format={(value) => compactKg(value, locale)}
          color={COLOR.farmWeight}
        />
        <Stat
          label={t("ops.dashboard.trend.delivered_weight")}
          value={totals.deliveredWeight}
          format={(value) => compactKg(value, locale)}
          color={COLOR.delivered}
        />
        <Stat
          label={t("ops.dashboard.mortality_birds")}
          value={totals.mortalityCount}
          format={(value) => plain(Math.round(value), 0, locale)}
          color={COLOR.mortality}
        />
        <Stat
          label={t("ops.dashboard.trend.weight_loss")}
          value={totals.weightLoss}
          format={(value) => compactKg(value, locale)}
          color={COLOR.weightLoss}
        />
      </div>

      {trends?.truncated ? (
        <p className="mt-2 text-[10.5px] font-medium text-slate-400">
          {t("ops.dashboard.trend.truncated", { count: trends.countedTrips })}
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  format,
  color,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  color: string;
}) {
  const shown = useAnimatedNumber(value);
  return (
    <div
      className="group min-w-0 cursor-default rounded-xl px-2.5 py-2 ring-1 ring-inset ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: `${color}0f` }}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-0.5 block truncate text-[15px] font-black tabular-nums text-slate-800">
        {format(shown)}
      </span>
    </div>
  );
}
