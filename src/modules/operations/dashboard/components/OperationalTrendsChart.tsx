// src/modules/operations/dashboard/components/OperationalTrendsChart.tsx
// OPERATIONAL TRENDS — the dashboard's main analytical chart.
//
// What it shows, all in one plot:
//   • Trips            → indigo line, right axis
//   • Farm weight      → the height of the stacked bar (kg)
//   • Delivered weight → emerald segment of that bar
//   • Mortality        → rose segment of that bar
//   • Weight loss      → amber segment of that bar
//
// Because farm weight = delivered + mortality + loss holds for every trip, the
// three segments stack to exactly the farm weight — one bar carries all four
// weight numbers at once. The second mode re-reads the same data as a 100%
// stack so a quiet week and a heavy one can be compared by shape.
//
// The range comes from the dashboard's global calendar; the default bucket
// (day / week / month) follows that range's length and resets whenever the
// calendar moves, so a reload always lands on the calendar's own view. Trips,
// farm weight, delivered weight, mortality and weight loss are all summed from
// the completed-trips API — the same endpoint the Weight Loss / Mortality page
// reads — so the two can never disagree.

import { useMemo, useState } from "react";
import {
  Bar,
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
  /** Bucket implied by the global calendar; the chart resets to it when it moves. */
  defaultGranularity: Granularity;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

type Mode = "weight" | "share";

const COLOR = {
  trips: "#6366f1",
  farmWeight: "#0ea5e9",
  delivered: "#10b981",
  mortality: "#f43f5e",
  weightLoss: "#f59e0b",
} as const;

const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];
const SHARE_TICKS = [0, 25, 50, 75, 100];

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
}: {
  point: OperationalBucket;
  label: string;
  previous: OperationalBucket | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const tripsDelta = signed(point.trips, previous?.trips);
  const farmDelta = signed(point.farmWeight, previous?.farmWeight);

  return (
    <div className="min-w-[236px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
      <p className="mb-2 border-b border-slate-100 pb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
        {formatBucketLong(label)}
      </p>

      <div className="space-y-1.5">
        <Row color={COLOR.trips} label={t("ops.dashboard.trips")} value={plain(point.trips)} delta={tripsDelta} />
        <Row
          color={COLOR.farmWeight}
          label={t("ops.dashboard.trend.farm_weight")}
          value={`${plain(point.farmWeight, 2)} kg`}
          delta={farmDelta}
        />
        <Row
          color={COLOR.delivered}
          label={t("ops.dashboard.trend.delivered_weight")}
          value={`${plain(point.deliveredWeight, 2)} kg`}
          delta={`${point.deliveredPct.toFixed(2)}%`}
        />
        <Row
          color={COLOR.mortality}
          label={t("ops.dashboard.trend.mortality_weight")}
          value={`${plain(point.mortalityWeight, 2)} kg`}
          delta={`${point.mortalityPct.toFixed(2)}%`}
        />
        <Row
          color={COLOR.weightLoss}
          label={t("ops.dashboard.trend.weight_loss")}
          value={`${plain(point.weightLoss, 2)} kg`}
          delta={`${point.weightLossPct.toFixed(2)}%`}
        />

        <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5 text-slate-400">
          <Row
            label={t("ops.dashboard.mortality_birds")}
            value={plain(point.mortalityCount)}
            delta={`${point.mortalityBirdPct.toFixed(2)}%`}
          />
          <Row label={t("ops.dashboard.trend.per_trip")} value={`${point.birdsPerTrip.toFixed(1)} ${t("ops.dashboard.trend.birds").toLowerCase()}`} />
          <Row label={t("ops.dashboard.trend.kg_per_trip")} value={`${plain(point.kgPerTrip, 1)} kg`} />
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

/* ------------------------------------------------------------------ */
/*  Chart                                                              */
/* ------------------------------------------------------------------ */

export default function OperationalTrendsChart({
  trends,
  defaultGranularity,
  loading = false,
  error = null,
  onRetry,
}: OperationalTrendsChartProps) {
  const { t } = useI18n();
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);
  const [mode, setMode] = useState<Mode>("weight");

  // The calendar is the source of truth: when its range changes, fall back to
  // the bucket that range implies (so a reload always opens on the calendar's
  // own view instead of a remembered toggle). Adjusting state during render —
  // rather than in an effect — keeps it in the same pass as the new prop.
  const [lastDefault, setLastDefault] = useState<Granularity>(defaultGranularity);
  if (defaultGranularity !== lastDefault) {
    setLastDefault(defaultGranularity);
    setGranularity(defaultGranularity);
  }

  const rows = trends?.rows;

  const buckets = useMemo(
    () => aggregateOperational(rows ?? [], granularity),
    [rows, granularity]
  );
  const previous = useMemo(() => previousBySortKey(buckets), [buckets]);
  const totals = useMemo(() => summariseOperational(buckets), [buckets]);

  // Share mode must not clip: a bucket that gained weight pushes delivered +
  // mortality above 100%, and a shrinking bucket puts the loss below zero.
  const shareDomain = useMemo<[number, number] | [number, "auto"]>(() => {
    if (mode !== "share") return [0, "auto"];
    const tops = buckets.map((b) => b.deliveredPct + b.mortalityPct + Math.max(b.weightLossPct, 0));
    const lows = buckets.map((b) => Math.min(0, b.weightLossPct));
    return [Math.min(...lows, 0) * 1.4, Math.max(...tops, 100) * 1.005];
  }, [mode, buckets]);

  // Weight mode: a bucket that gained weight clamps to a zero-height segment so
  // the stack still equals the farm weight (the true value stays in the tooltip).
  const data = useMemo(() => {
    if (mode !== "weight") return buckets;
    return buckets.map((bucket) => ({ ...bucket, lossBar: Math.max(bucket.weightLoss, 0) }));
  }, [mode, buckets]);

  if (loading && !trends) {
    return (
      <div className="flex h-[330px] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-500" />
      </div>
    );
  }

  if (error && !trends) {
    return (
      <div className="flex h-[330px] w-full flex-col items-center justify-center gap-3 text-center">
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
      <div className="flex h-[330px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
        <p className="text-sm font-semibold text-slate-500">{t("ops.dashboard.trend.empty")}</p>
        <p className="text-[11.5px] text-slate-400">{t("ops.dashboard.trend.empty_hint")}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ── Controls: bucketing on the left, reading mode on the right ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t("ops.dashboard.trend.bucket_by")}
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        >
          {GRANULARITIES.map((value) => {
            const active = granularity === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setGranularity(value)}
                className={`rounded-[6px] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide transition-colors ${
                  active ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {t(
                  value === "daily"
                    ? "ops.dashboard.daily"
                    : value === "weekly"
                      ? "ops.dashboard.weekly"
                      : "ops.dashboard.monthly"
                )}
              </button>
            );
          })}
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(["weight", "share"] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`rounded-[6px] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide transition-colors ${
                mode === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t(value === "weight" ? "ops.dashboard.trend.mode_weight" : "ops.dashboard.trend.mode_share")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────── */}
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
        <LegendDot color={COLOR.trips} label={t("ops.dashboard.trips")} shape="line" />
        <LegendDot color={COLOR.delivered} label={t("ops.dashboard.trend.delivered_weight")} />
        <LegendDot color={COLOR.mortality} label={t("ops.dashboard.trend.mortality_weight")} />
        <LegendDot color={COLOR.weightLoss} label={t("ops.dashboard.trend.weight_loss")} />
        <span className="text-slate-400">
          {mode === "weight"
            ? t("ops.dashboard.trend.mode_weight_hint")
            : t("ops.dashboard.trend.mode_share_hint")}
        </span>
      </div>

      {/* ── Plot ─────────────────────────────────────────────────────── */}
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatBucket}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              yAxisId="weight"
              tickFormatter={(value: number) => (mode === "share" ? `${Math.round(value)}%` : tickKg(value))}
              domain={shareDomain}
              ticks={mode === "share" ? SHARE_TICKS : undefined}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="trips"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#6366f1" }}
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
                  />
                );
              }}
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
            />

            {mode === "weight" ? (
              <>
                {/* Segments sum to the farm weight — the bar's height IS it. */}
                <Bar
                  yAxisId="weight"
                  dataKey="deliveredWeight"
                  stackId="wt"
                  name={t("ops.dashboard.trend.delivered_weight")}
                  fill={COLOR.delivered}
                  maxBarSize={30}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="weight"
                  dataKey="mortalityWeight"
                  stackId="wt"
                  name={t("ops.dashboard.trend.mortality_weight")}
                  fill={COLOR.mortality}
                  maxBarSize={30}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="weight"
                  dataKey="lossBar"
                  stackId="wt"
                  name={t("ops.dashboard.trend.weight_loss")}
                  fill={COLOR.weightLoss}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={30}
                  isAnimationActive={false}
                />
                <ReferenceLine
                  yAxisId="weight"
                  y={totals.avgFarmWeight}
                  stroke={COLOR.farmWeight}
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  label={{
                    value: `${t("ops.dashboard.trend.average")} ${tickKg(totals.avgFarmWeight)}`,
                    position: "insideTopRight",
                    style: { fontSize: 9.5, fill: "#0ea5e9", fontWeight: 700 },
                  }}
                />
              </>
            ) : (
              <>
                <Bar
                  yAxisId="weight"
                  dataKey="deliveredPct"
                  stackId="share"
                  name={t("ops.dashboard.trend.delivered_weight")}
                  fill={COLOR.delivered}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="weight"
                  dataKey="mortalityPct"
                  stackId="share"
                  name={t("ops.dashboard.trend.mortality_weight")}
                  fill={COLOR.mortality}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="weight"
                  dataKey="weightLossPct"
                  stackId="share"
                  name={t("ops.dashboard.trend.weight_loss")}
                  fill={COLOR.weightLoss}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={34}
                  isAnimationActive={false}
                />
              </>
            )}

            <Line
              yAxisId="trips"
              type="monotone"
              dataKey="trips"
              name={t("ops.dashboard.trips")}
              stroke={COLOR.trips}
              strokeWidth={2}
              dot={{ r: 2.6, fill: COLOR.trips, strokeWidth: 0 }}
              activeDot={{ r: 4.5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer: the whole period, in numbers ──────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat
          label={t("ops.dashboard.trips")}
          value={plain(totals.trips)}
          hint={`${plain(totals.avgTrips, 1)} / ${t("ops.dashboard.trend.per_bucket").toLowerCase()}`}
          color={COLOR.trips}
        />
        <Stat
          label={t("ops.dashboard.trend.farm_weight")}
          value={compactKg(totals.farmWeight)}
          hint={`${compactKg(totals.avgFarmWeight)} / ${t("ops.dashboard.trend.per_bucket").toLowerCase()}`}
          color={COLOR.farmWeight}
        />
        <Stat
          label={t("ops.dashboard.trend.delivered_weight")}
          value={compactKg(totals.deliveredWeight)}
          hint={`${totals.deliveredPct.toFixed(2)}% ${t("ops.dashboard.trend.of_farm")}`}
          color={COLOR.delivered}
        />
        <Stat
          label={t("ops.dashboard.trend.mortality_weight")}
          value={compactKg(totals.mortalityWeight)}
          hint={`${totals.mortalityPct.toFixed(2)}% · ${plain(totals.mortalityCount)} ${t("ops.dashboard.trend.birds").toLowerCase()}`}
          color={COLOR.mortality}
        />
        <Stat
          label={t("ops.dashboard.trend.weight_loss")}
          value={compactKg(totals.weightLoss)}
          hint={`${totals.weightLossPct.toFixed(2)}% ${t("ops.dashboard.trend.of_farm")}`}
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

function LegendDot({
  color,
  label,
  shape = "square",
}: {
  color: string;
  label: string;
  shape?: "square" | "line";
}) {
  return (
    <span className="flex items-center gap-1.5">
      {shape === "line" ? (
        <span className="h-[3px] w-4 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50/80 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="block truncate text-[14px] font-black tabular-nums text-slate-800">{value}</span>
      <span className="block truncate text-[10.5px] font-semibold text-slate-400">{hint}</span>
    </div>
  );
}
