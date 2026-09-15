// src/modules/staff/components/performance/WeeklyPerformanceChart.tsx
//
// ============================================================================
// WEEKLY PERFORMANCE CHART — shared rendering for both performance pages
// ============================================================================
// Two variants, one implementation family (stable trees, stable keys,
// animation off — filtering can never flicker or remount the SVG):
//
//   variant="grouped" (Driver)
//     One grouped bar chart: Distance (km) + Fuel (L) on a shared axis;
//     weekly mileage derived in the tooltip from the same real values.
//
//   variant="panels" (Supervisor)
//     Small multiples — one clean mini-chart per metric, each with its OWN
//     scale (no misleading dual-axis overlays):
//       Birds (emerald bars) · Mortality (red area) · Weight loss kg (violet
//       area). Panels make the volume and the loss trends independently
//     readable while staying visually one quiet row.
//
// Series carry `kind: "bar" | "line"`; in panels a "line" renders as a soft
// gradient area. The chart only ever renders the buckets the API returned,
// in the API's order, with the API's own numbers — the `week` label is used
// for DISPLAY only. Nothing is re-bucketed or fabricated.
//
// Tooltip: one polished card everywhere — bold period header over a hairline,
// shape-coded swatch rows with right-aligned bold tabular values, derived
// metrics below a dashed divider in muted style.
// ============================================================================

import { memo, useMemo, type ReactNode } from "react";
import {
  Area,
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

export interface WeeklyChartSeries {
  key: string;
  /** Already-translated series name (legend + tooltip). */
  label: string;
  color: string;
  /** Which value axis this series binds to (grouped variant). */
  axis: "left" | "right";
  /** Visual encoding: bars for volumes, lines/areas for trends/losses. */
  kind?: "bar" | "line";
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
  /** Extra derived rows appended to the tooltip (e.g. mileage). */
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
  /** Chart body height (grouped variant). */
  heightClass?: string;
  /** grouped = one shared-axis chart · panels = small multiples. */
  variant?: "grouped" | "panels";
  /** Optional header slot (legend is rendered inside the chart). */
  header?: ReactNode;
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

function seriesHasValue(rows: readonly WeeklyChartPoint[], key: string): boolean {
  return rows.some((row) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
}

/* ------------------------------ tooltip card ----------------------------- */

interface TipCardProps {
  label: unknown;
  payload: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
  series: readonly WeeklyChartSeries[];
  tooltipExtras?: (point: WeeklyChartPoint) => WeeklyTooltipRow[];
  point?: WeeklyChartPoint;
}

function TooltipCard({
  label,
  payload,
  series,
  tooltipExtras,
  weekTrips,
  point,
}: TipCardProps & { weekTrips?: (point: WeeklyChartPoint) => WeekTripRow[] }) {
  const extras = point ? (tooltipExtras?.(point) ?? []) : [];
  const trips = point ? (weekTrips?.(point) ?? []) : [];
  return (
    <div className="min-w-[190px] rounded-xl border border-slate-200 bg-white/95 px-3.5 py-3 shadow-xl backdrop-blur">
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

const axisTick = { fontSize: 11, fill: "#94a3b8", fontWeight: 500 } as const;
const axisTickSmall = { fontSize: 10, fill: "#94a3b8", fontWeight: 500 } as const;

/* ---------------------------- grouped variant ---------------------------- */

function GroupedChart({
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
  const hasRightAxis = series.some((s) => s.axis === "right");
  const hasLineSeries = series.some((s) => s.kind === "line");
  const barCount = series.filter((s) => (s.kind ?? "bar") === "bar").length;

  return (
    <div className={heightClass} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 8, left: -8, bottom: 4 }}
          barGap={barCount > 1 ? 6 : 0}
          barCategoryGap={barCount > 1 ? "24%" : "38%"}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            interval={0}
          />
          <YAxis
            yAxisId="left"
            tick={axisTick}
            tickFormatter={compactAxis}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={axisTick}
              tickFormatter={compactAxis}
              axisLine={false}
              tickLine={false}
              width={48}
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
            height={28}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-[11px] font-semibold text-slate-500">{String(value)}</span>
            )}
          />
          {series.map((config) =>
            config.kind === "line" ? (
              <Line
                key={config.key}
                yAxisId={config.axis}
                type="monotone"
                dataKey={config.key}
                name={config.label}
                stroke={config.color}
                strokeWidth={2}
                dot={{ r: 3, fill: config.color, strokeWidth: 0 }}
                activeDot={{ r: 4.5, fill: config.color, stroke: "#ffffff", strokeWidth: 2 }}
                legendType="circle"
                isAnimationActive={false}
              />
            ) : (
              <Bar
                key={config.key}
                yAxisId={config.axis}
                dataKey={config.key}
                name={config.label}
                fill={config.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={hasLineSeries ? 44 : 36}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------- panels variant ---------------------------- */

function PanelsChart({
  rows,
  series,
  tooltipExtras,
  weekTrips,
  ariaLabel,
  emptyText,
}: {
  rows: WeeklyChartPoint[];
  series: readonly WeeklyChartSeries[];
  tooltipExtras?: (point: WeeklyChartPoint) => WeeklyTooltipRow[];
  weekTrips?: (point: WeeklyChartPoint) => WeekTripRow[];
  ariaLabel: string;
  emptyText: string;
}) {
  const gridClass =
    series.length >= 3 ? "grid-cols-1 sm:grid-cols-3" : series.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";

  return (
    <div className={`grid gap-3 ${gridClass}`} role="img" aria-label={ariaLabel}>
      {series.map((config) => {
        const isBar = (config.kind ?? "bar") === "bar";
        const alive = seriesHasValue(rows, config.key);
        return (
          <div
            key={config.key}
            data-testid="perf-chart-panel"
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-1.5 px-0.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: config.color }}
                aria-hidden="true"
              />
              <span className="truncate text-[11px] font-semibold text-slate-500">
                {config.label}
              </span>
            </div>
            {alive ? (
              <div className="mt-1 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`perf-grad-${config.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={config.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={config.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={axisTickSmall}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={6}
                      interval={0}
                    />
                    <YAxis
                      tick={axisTickSmall}
                      tickFormatter={compactAxis}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(15, 23, 42, 0.045)" }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <TooltipCard
                            label={label}
                            payload={payload}
                            series={[config]}
                            tooltipExtras={tooltipExtras}
                            weekTrips={weekTrips}
                            point={payload[0]?.payload as WeeklyChartPoint | undefined}
                          />
                        ) : null
                      }
                    />
                    {isBar ? (
                      <Bar
                        dataKey={config.key}
                        name={config.label}
                        fill={config.color}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                        isAnimationActive={false}
                      />
                    ) : (
                      <Area
                        type="monotone"
                        dataKey={config.key}
                        name={config.label}
                        stroke={config.color}
                        strokeWidth={2}
                        fill={`url(#perf-grad-${config.key})`}
                        dot={{ r: 2.5, fill: config.color, strokeWidth: 0 }}
                        activeDot={{ r: 4, fill: config.color, stroke: "#ffffff", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-1 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-2 text-center text-[11px] font-medium text-slate-400">
                {emptyText}
              </div>
            )}
          </div>
        );
      })}
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
  heightClass = "h-64 sm:h-72",
  variant = "grouped",
}: WeeklyPerformanceChartProps) {
  const hasData = useMemo(() => rows.length > 0 && hasAnyValue(rows, series), [rows, series]);

  if (loading) {
    return (
      <div className={`w-full ${variant === "panels" ? "h-56" : heightClass}`} role="status" aria-busy="true">
        {/* Calm placeholder while the week loads — no pulse, no layout jump. */}
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

  if (variant === "panels") {
    return (
      <div className="w-full">
        <PanelsChart
          rows={rows}
          series={series}
          tooltipExtras={tooltipExtras}
          ariaLabel={ariaLabel}
          emptyText={emptyText}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <GroupedChart
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
