// src/modules/staff/components/performance/WeeklyPerformanceChart.tsx
//
// ============================================================================
// WEEKLY PERFORMANCE CHART — one combined chart for both performance pages
// ============================================================================
// ONE chart per page, every metric in it, nothing hidden behind a second view:
// a grouped-bar + line combo where each series owns its own ruler:
//
//   Driver      Distance (km) bars · Fuel (L) bars · Mileage (km/L) line
//   Supervisor  Birds bars · Mortality line · Weight loss (kg) line
//
// Every y-axis is tinted with the colour of the series it measures, so which
// ruler belongs to which shape is obvious at a glance. Volumes (bars) keep 0
// as their floor — a bar must never start from a cropped baseline — while
// ratios/trends (`zeroFloor: false`) get a tight axis so a 4.24 → 4.36 km/L
// week is actually visible instead of flat-lining.
//
// Series carry `kind: "bar" | "line"` and the chart only ever renders the
// buckets the API returned, in the API's order, with the API's own numbers —
// the `week` label is used for DISPLAY only. Nothing is re-bucketed or
// fabricated; a line breaks where a week has no value instead of drawing a
// fake zero.
//
// Tooltip: one polished card — bold period header over a hairline, shape-coded
// swatch rows for EVERY series of that week with right-aligned bold tabular
// values, derived metrics below a dashed divider in muted style.
//
// Animation is off everywhere: filtering can never flicker or remount the SVG.
// ============================================================================

import { memo, useMemo } from "react";
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

/** Which ruler a series is measured against (left is always rendered). */
export type WeeklyAxisId = "left" | "right" | "third";

export interface WeeklyChartSeries {
  key: string;
  /** Already-translated series name (legend + tooltip). */
  label: string;
  color: string;
  /** Which value axis this series binds to. */
  axis: WeeklyAxisId;
  /** Visual encoding: bars for volumes, lines for trends/ratios. */
  kind?: "bar" | "line";
  /**
   * `true` (default for bars) keeps 0 as the axis floor; `false` lets the axis
   * hug the data so a small week-to-week change stays readable.
   */
  zeroFloor?: boolean;
  /** Formats one value for the tooltip (already localized by the page). */
  format?: (value: number) => string;
}

export interface WeeklyChartPoint {
  /** Display label for the bucket (from `weeklyBucketLabel`). */
  label: string;
  /** Stable identity: the raw API bucket label. */
  week: string | number;
  [metric: string]: string | number | undefined;
}

export interface WeeklyTooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** One real trip mapped into a weekly bucket (see performanceView). */
export interface WeekTripRow {
  tripNo: string;
  summary: string;
}

interface WeeklyPerformanceChartProps {
  rows: WeeklyChartPoint[];
  series: readonly WeeklyChartSeries[];
  /** Extra derived rows appended to the tooltip (e.g. trips). */
  tooltipExtras?: (point: WeeklyChartPoint) => WeeklyTooltipRow[];
  /**
   * Real trips that fall inside the hovered week (from the person's loaded
   * detail) — rendered as a dedicated section of the tooltip. Empty when no
   * detail is loaded, so nothing is ever fabricated.
   */
  weekTrips?: (point: WeeklyChartPoint) => WeekTripRow[];
  emptyText: string;
  loading?: boolean;
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
  /** Chart body height. */
  heightClass?: string;
}

const compactAxis = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value * 10) / 10);
};

function hasAnyValue(rows: readonly WeeklyChartPoint[], series: readonly WeeklyChartSeries[]): boolean {
  return rows.some((row) =>
    series.some((s) => {
      const value = row[s.key];
      return typeof value === "number" && Number.isFinite(value) && value > 0;
    }),
  );
}

/* ------------------------------ tooltip card ----------------------------- */

interface TipCardProps {
  label: unknown;
  payload: ReadonlyArray<{ dataKey?: unknown; value?: unknown; payload?: unknown }>;
  series: readonly WeeklyChartSeries[];
  tooltipExtras?: (point: WeeklyChartPoint) => WeeklyTooltipRow[];
  point?: WeeklyChartPoint;
  weekTrips?: (point: WeeklyChartPoint) => WeekTripRow[];
}

function TooltipCard({ label, payload, series, tooltipExtras, weekTrips, point }: TipCardProps) {
  const extras = point ? (tooltipExtras?.(point) ?? []) : [];
  const trips = point ? (weekTrips?.(point) ?? []) : [];
  return (
    <div className="min-w-[210px] rounded-xl border border-slate-200 bg-white/95 px-3.5 py-3 shadow-xl backdrop-blur">
      <div className="mb-2 border-b border-slate-100 pb-1.5 text-xs font-bold tracking-tight text-slate-900">
        {String(label ?? "")}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const config = series.find((s) => s.key === entry.dataKey);
          const raw = typeof entry.value === "number" ? entry.value : 0;
          const isLine = config?.kind === "line";
          return (
            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-5">
              <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                <span
                  className={`h-2 w-2 shrink-0 ${isLine ? "rounded-full" : "rounded-[3px]"}`}
                  style={{ backgroundColor: config?.color ?? "#94a3b8" }}
                  aria-hidden="true"
                />
                {config?.label ?? String(entry.dataKey)}
              </span>
              <span className="text-xs font-bold tabular-nums text-slate-900">
                {config?.format ? config.format(raw) : raw.toLocaleString("en-IN")}
              </span>
            </div>
          );
        })}
        {extras.length > 0 && (
          <div className="space-y-1.5 border-t border-dashed border-slate-200 pt-1.5">
            {extras.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-5">
                <span className="text-[11px] text-slate-400">{row.label}</span>
                <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}
        {trips.length > 0 && (
          <div className="space-y-1 border-t border-dashed border-slate-200 pt-1.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {trips.length} {trips.length === 1 ? "trip" : "trips"} this week
            </div>
            {trips.map((trip) => (
              <div key={trip.tripNo} className="flex items-center justify-between gap-5">
                <span className="font-mono text-[10px] font-semibold text-slate-600">
                  {trip.tripNo}
                </span>
                <span className="text-[10px] font-medium tabular-nums text-slate-500">
                  {trip.summary}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const axisTick = { fontSize: 11, fontWeight: 500 } as const;
const axisTickSmall = { fontSize: 10, fontWeight: 500 } as const;

/** Axis domain: bars start at 0, ratios/trends hug their own data. */
type AxisDomainTuple = [(dataMin: number) => number, "auto"] | ["auto", "auto"];

/* ------------------------------- the chart ------------------------------- */

function ComboChart({
  rows,
  series,
  tooltipExtras,
  weekTrips,
  ariaLabel,
  heightClass,
}: {
  rows: WeeklyChartPoint[];
  series: readonly WeeklyChartSeries[];
  tooltipExtras?: (point: WeeklyChartPoint) => WeeklyTooltipRow[];
  weekTrips?: (point: WeeklyChartPoint) => WeekTripRow[];
  ariaLabel: string;
  heightClass: string;
}) {
  const hasBars = series.some((s) => (s.kind ?? "bar") === "bar");
  const barCount = series.filter((s) => (s.kind ?? "bar") === "bar").length;
  const axisSeries = (axis: WeeklyAxisId) => series.find((s) => s.axis === axis);
  const rightSeries = axisSeries("right");
  const thirdSeries = axisSeries("third");

  /* Tick colour = series colour, so each ruler is bound to its own shape. */
  const axisDomain = (axis: WeeklyAxisId): AxisDomainTuple => {
    const onAxis = series.filter((s) => s.axis === axis);
    const floorZero = onAxis.every((s) => s.zeroFloor ?? (s.kind ?? "bar") === "bar");
    return floorZero ? [(dataMin: number) => Math.min(0, dataMin), "auto"] : ["auto", "auto"];
  };

  const axisLabels = (axis: WeeklyAxisId) =>
    series.filter((s) => s.axis === axis).map((s) => s.label).join(" · ");

  return (
    <div className={heightClass} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 10, right: 10, left: -6, bottom: 4 }}
          barGap={barCount > 1 ? 5 : 0}
          barCategoryGap={barCount > 1 ? "30%" : "45%"}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            interval={0}
          />
          {/* Left ruler (also the axis the bars sit on). */}
          <YAxis
            yAxisId="left"
            tick={{ ...axisTick, fill: axisSeries("left")?.color ?? "#94a3b8" }}
            tickFormatter={compactAxis}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={axisDomain("left")}
          />
          {rightSeries && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ ...axisTick, fill: rightSeries.color }}
              tickFormatter={compactAxis}
              axisLine={false}
              tickLine={false}
              width={50}
              domain={axisDomain("right")}
            />
          )}
          {thirdSeries && (
            <YAxis
              yAxisId="third"
              orientation="right"
              tick={{ ...axisTickSmall, fill: thirdSeries.color }}
              tickFormatter={compactAxis}
              axisLine={false}
              tickLine={false}
              width={46}
              domain={axisDomain("third")}
            />
          )}
          <Tooltip
            cursor={{ fill: "rgba(15, 23, 42, 0.045)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  label={label}
                  payload={payload}
                  series={series}
                  tooltipExtras={tooltipExtras}
                  weekTrips={weekTrips}
                  point={payload[0]?.payload as WeeklyChartPoint | undefined}
                />
              ) : null
            }
          />
          <Legend
            verticalAlign="top"
            align="left"
            height={30}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-[11px] font-semibold text-slate-500">{String(value)}</span>
            )}
          />
          {/* Bars first, lines on top — a trend never hides behind a bar. */}
          {series
            .filter((config) => (config.kind ?? "bar") === "bar")
            .map((config) => (
              <Bar
                key={config.key}
                yAxisId={config.axis}
                dataKey={config.key}
                name={config.label}
                fill={config.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={hasBars && barCount > 1 ? 34 : 46}
                isAnimationActive={false}
              />
            ))}
          {series
            .filter((config) => config.kind === "line")
            .map((config) => (
              <Line
                key={config.key}
                yAxisId={config.axis}
                type="monotone"
                dataKey={config.key}
                name={config.label}
                stroke={config.color}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: config.color, stroke: "#ffffff", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: config.color, stroke: "#ffffff", strokeWidth: 2 }}
                legendType="circle"
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
      {/* Screen-reader summary of the rulers (the SVG itself is decorative). */}
      <span className="sr-only">
        {(["left", "right", "third"] as WeeklyAxisId[])
          .map((axis) => (axisSeries(axis) ? axisLabels(axis) : null))
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );
}

/* -------------------------------- wrapper -------------------------------- */

function WeeklyPerformanceChartImpl({
  rows,
  series,
  tooltipExtras,
  weekTrips,
  emptyText,
  loading = false,
  ariaLabel,
  heightClass = "h-72 sm:h-80",
}: WeeklyPerformanceChartProps) {
  const hasData = useMemo(() => rows.length > 0 && hasAnyValue(rows, series), [rows, series]);

  if (loading) {
    return (
      <div className={`w-full ${heightClass}`} role="status" aria-busy="true">
        {/* Calm placeholder while the weeks load — no pulse, no layout jump. */}
        <div className="h-full w-full rounded-md bg-slate-100" />
        <span className="sr-only">{emptyText}</span>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div
        role="status"
        className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm font-medium text-slate-400"
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div className="w-full">
      <ComboChart
        rows={rows}
        series={series}
        tooltipExtras={tooltipExtras}
        weekTrips={weekTrips}
        ariaLabel={ariaLabel}
        heightClass={heightClass}
      />
    </div>
  );
}

/**
 * Memoised: the page passes stable rows/series arrays (useMemo) so applying a
 * filter that does not change the weekly data cannot re-render the chart.
 */
const WeeklyPerformanceChart = memo(WeeklyPerformanceChartImpl);
export default WeeklyPerformanceChart;
