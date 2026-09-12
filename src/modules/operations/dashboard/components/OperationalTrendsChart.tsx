// src/modules/operations/dashboard/components/OperationalTrendsChart.tsx
// OPERATIONAL TRENDS — the dashboard's main analytical chart.
//
// Three questions, one plot:
//   • How many trips ran?               → bars, left axis (counts)
//   • How much bird reached the shops?  → gradient area, right axis (kg)
//   • What did each trip cost us?       → mortality per trip, left axis (birds/trip)
//
// Trips and mortality-per-trip are both counts per day, so they honestly share
// the left axis; weight lives on the right one. That keeps the plot to two axes
// instead of the three overlapping ones the old chart needed, while every true
// number — trips, kilograms, birds, birds/trip, kg/trip and the change against
// the previous bucket — is spelled out in the tooltip.
//
// Extras that make it readable rather than merely decorated: a dashed average
// line, a 3-bucket moving average of weight, legend chips that toggle a series
// off, daily/weekly/monthly bucketing and a totals footer.

import { useMemo, useState } from "react";
import {
  Area,
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
import {
  aggregate,
  compactKg,
  formatBucket,
  formatBucketLong,
  plain,
  previousBySortKey,
  summarise,
  tickKg,
  type Bucket,
  type Granularity,
  type TrendPoint,
} from "../utils/trendSeries";

interface OperationalTrendsChartProps {
  data: TrendPoint[];
  /** Bucket chosen on mount; the page keys the chart by range width. */
  initialGranularity?: Granularity;
}

type SeriesKey = "trips" | "weight" | "mortality";

interface SeriesMeta {
  key: SeriesKey;
  labelKey: string;
  color: string;
  /** Legend/tooltip wording for what the series means. */
  hintKey: string;
}

const SERIES: SeriesMeta[] = [
  { key: "trips", labelKey: "ops.dashboard.trips", color: "#6366f1", hintKey: "ops.dashboard.trend.hint_trips" },
  { key: "weight", labelKey: "ops.dashboard.sales_kg", color: "#10b981", hintKey: "ops.dashboard.trend.hint_weight" },
  {
    key: "mortality",
    labelKey: "ops.dashboard.trend.mortality_per_trip",
    color: "#f43f5e",
    hintKey: "ops.dashboard.trend.hint_mortality",
  },
];

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

const pctOf = (current: number, earlier: number | undefined): string | null => {
  if (earlier == null || earlier === 0) return null;
  return `${((current - earlier) / earlier) * 100 > 0 ? "+" : ""}${(((current - earlier) / earlier) * 100).toFixed(1)}%`;
};

function ChartTooltip({
  point,
  label,
  previous,
  t,
}: {
  point: Bucket;
  label: string;
  previous: Bucket | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const tripsDelta = pctOf(point.trips, previous?.trips);
  const weightDelta = pctOf(point.weight, previous?.weight);

  return (
    <div className="min-w-[218px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-sm">
      <p className="mb-2 border-b border-slate-100 pb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
        {formatBucketLong(label)}
      </p>

      <div className="space-y-1.5">
        <Row color="#6366f1" label={t("ops.dashboard.trips")} value={plain(point.trips)} delta={tripsDelta} />
        <Row
          color="#10b981"
          label={t("ops.dashboard.sales_kg")}
          value={`${plain(point.weight, 2)} kg`}
          delta={weightDelta}
        />
        <Row color="#f43f5e" label={t("ops.dashboard.mortality_birds")} value={plain(point.mortality)} />

        <div className="mt-1.5 space-y-1 border-t border-slate-100 pt-1.5">
          <Row
            label={t("ops.dashboard.trend.per_trip")}
            value={`${point.birdsPerTrip.toFixed(1)} ${t("ops.dashboard.trend.birds").toLowerCase()}`}
          />
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
}: {
  color?: string;
  label: string;
  value: string;
  delta?: string | null;
}) {
  const up = delta ? delta.startsWith("+") : false;
  return (
    <div className="flex items-baseline justify-between gap-4 text-[12px]">
      <span className="flex items-center gap-1.5 text-slate-500">
        {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> : null}
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-bold tabular-nums text-slate-800">{value}</span>
        {delta ? (
          <span className={`text-[10.5px] font-bold tabular-nums ${up ? "text-emerald-600" : "text-rose-500"}`}>
            {up ? "▲" : "▼"} {delta.replace(/^[+-]/, "")}
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
  data,
  initialGranularity = "daily",
}: OperationalTrendsChartProps) {
  const { t } = useI18n();
  const [granularity, setGranularity] = useState<Granularity>(initialGranularity);
  const [hiddenSeries, setHiddenSeries] = useState<SeriesKey[]>([]);

  const buckets = useMemo(() => aggregate(data ?? [], granularity), [data, granularity]);
  const previous = useMemo(() => previousBySortKey(buckets), [buckets]);
  const totals = useMemo(() => summarise(buckets), [buckets]);

  const isHidden = (key: SeriesKey) => hiddenSeries.includes(key);
  const toggleSeries = (key: SeriesKey) =>
    setHiddenSeries((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );

  if (buckets.length === 0) {
    return (
      <div className="flex h-[290px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
        <p className="text-sm font-semibold text-slate-500">{t("ops.dashboard.trend.empty")}</p>
        <p className="text-[11.5px] text-slate-400">{t("ops.dashboard.trend.empty_hint")}</p>
      </div>
    );
  }

  const showMovingAverage = buckets.length >= 5 && !isHidden("weight");

  return (
    <div className="w-full">
      {/* ── Controls: bucketing on the left, series toggles on the right ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t("ops.dashboard.trend.bucket_by")}
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        >
          {(["daily", "weekly", "monthly"] as Granularity[]).map((value) => {
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

        <div className="flex flex-wrap items-center gap-1">
          {SERIES.map((series) => {
            const off = isHidden(series.key);
            return (
              <button
                key={series.key}
                type="button"
                onClick={() => toggleSeries(series.key)}
                aria-pressed={!off}
                title={t(series.hintKey)}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold transition-colors ${
                  off
                    ? "border-slate-200 bg-white text-slate-300"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full transition-opacity"
                  style={{ backgroundColor: series.color, opacity: off ? 0.25 : 1 }}
                />
                {t(series.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Plot ─────────────────────────────────────────────────────── */}
      <div className="h-[268px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={buckets} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="trendWeightFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="trendTripsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.45} />
              </linearGradient>
            </defs>

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
              yAxisId="counts"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              width={34}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="kg"
              orientation="right"
              tickFormatter={tickKg}
              tick={{ fontSize: 10, fill: "#10b981" }}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                const point = (payload?.[0]?.payload ?? null) as Bucket | null;
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

            {!isHidden("weight") && (
              <ReferenceLine
                yAxisId="kg"
                y={totals.avgWeight}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: `${t("ops.dashboard.trend.average")} ${tickKg(totals.avgWeight)}`,
                  position: "insideTopRight",
                  style: { fontSize: 9.5, fill: "#94a3b8", fontWeight: 700 },
                }}
              />
            )}

            {!isHidden("weight") && (
              <Area
                yAxisId="kg"
                type="monotone"
                dataKey="weight"
                name={t("ops.dashboard.sales_kg")}
                stroke="#10b981"
                strokeWidth={2.4}
                fill="url(#trendWeightFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            )}

            {!isHidden("trips") && (
              <Bar
                yAxisId="counts"
                dataKey="trips"
                name={t("ops.dashboard.trips")}
                fill="url(#trendTripsFill)"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            )}

            {showMovingAverage && (
              <Line
                yAxisId="kg"
                type="monotone"
                dataKey="movingAvg"
                name={t("ops.dashboard.trend.moving_average")}
                stroke="#059669"
                strokeWidth={1.6}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}

            {!isHidden("mortality") && (
              <Line
                yAxisId="counts"
                type="monotone"
                dataKey="birdsPerTrip"
                name={t("ops.dashboard.trend.mortality_per_trip")}
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={{ r: 2.4, fill: "#f43f5e", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer: the period in numbers ─────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
        <Stat
          label={t("ops.dashboard.trips")}
          value={plain(totals.trips)}
          hint={`${plain(totals.avgTrips, 1)} / ${t("ops.dashboard.trend.per_bucket").toLowerCase()}`}
          color="#6366f1"
        />
        <Stat
          label={t("ops.dashboard.sales_kg")}
          value={compactKg(totals.weight)}
          hint={`${compactKg(totals.avgWeight)} / ${t("ops.dashboard.trend.per_bucket").toLowerCase()}`}
          color="#10b981"
        />
        <Stat
          label={t("ops.dashboard.mortality_birds")}
          value={plain(totals.mortality)}
          hint={`${totals.birdsPerTrip.toFixed(1)} ${t("ops.dashboard.trend.per_trip_unit")}`}
          color="#f43f5e"
        />
        <Stat
          label={t("ops.dashboard.trend.busiest_bucket")}
          value={totals.busiest ? plain(totals.busiest.trips) : "—"}
          hint={totals.busiest ? formatBucket(totals.busiest.date) : ""}
          color="#0ea5e9"
        />
      </div>
    </div>
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
