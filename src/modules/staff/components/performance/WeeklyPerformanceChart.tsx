// src/modules/staff/components/performance/WeeklyPerformanceChart.tsx
//
// ============================================================================
// WEEKLY PERFORMANCE CHART — shared rendering for both performance pages
// ============================================================================
// One composed chart implementation (stable element tree, stable keys,
// animation off — so filtering can never flicker or remount the SVG)
// configured per page:
//
//   Driver     → Distance (km) + Fuel (L) grouped bars (left axis); weekly
//                mileage derived in the tooltip from the same real values.
//   Supervisor → Birds hero bar (left axis) + Weight (kg) trend line (left);
//                Mortality + Weight-loss (kg) trend lines (right axis). Loss
//                metrics are lines so they can never visually overpower the
//                volume bar they belong to.
//
// Series carry `kind: "bar" | "line"`; bar-only configs render exactly as a
// BarChart would. The chart only ever renders the buckets the API returned,
// in the API's order, with the API's own numbers — the `week` label is used
// for DISPLAY only. Nothing is re-bucketed or fabricated.
//
// Tooltip: a single polished card for both pages — bold period header over a
// hairline, one row per series (shape-coded swatch, right-aligned bold
// tabular value), derived metrics below a dashed divider in muted style.
// ============================================================================

import { memo, useMemo, type ReactNode } from "react";
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
import { uiSkeletonClass } from "../../../../shared/ui/uiTokens";

export interface WeeklyChartSeries {
  key: string;
  /** Already-translated series name (legend + tooltip). */
  label: string;
  color: string;
  /** Which value axis this series binds to. */
  axis: "left" | "right";
  /** Visual encoding: bars for volumes, lines for trends/losses. */
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

interface WeeklyPerformanceChartProps {
  rows: WeeklyChartPoint[];
  series: readonly WeeklyChartSeries[];
  /** Extra derived rows appended to the tooltip (e.g. mileage). */
  tooltipExtras?: (point: WeeklyChartPoint) => WeeklyTooltipRow[];
  emptyText: string;
  loading?: boolean;
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
  /** Legend label width behaviour: recharts default is fine. */
  heightClass?: string;
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

function WeeklyPerformanceChartImpl({
  rows,
  series,
  tooltipExtras,
  emptyText,
  loading = false,
  ariaLabel,
  heightClass = "h-64 sm:h-72",
}: WeeklyPerformanceChartProps) {
  const hasData = useMemo(() => rows.length > 0 && hasAnyValue(rows, series), [rows, series]);

  const hasRightAxis = series.some((s) => s.axis === "right");
  const hasLineSeries = series.some((s) => s.kind === "line");

  if (loading) {
    return (
      <div className={`w-full ${heightClass}`} role="status" aria-busy="true">
        <div className={`h-full w-full ${uiSkeletonClass}`} />
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

  const barCount = series.filter((s) => (s.kind ?? "bar") === "bar").length;

  return (
    <div className="w-full">
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
              tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
              tickFormatter={compactAxis}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            {hasRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                tickFormatter={compactAxis}
                axisLine={false}
                tickLine={false}
                width={48}
              />
            )}
            <Tooltip
              cursor={{ fill: "rgba(15, 23, 42, 0.045)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as WeeklyChartPoint | undefined;
                const extras = point ? (tooltipExtras?.(point) ?? []) : [];
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
                          <div
                            key={String(entry.dataKey)}
                            className="flex items-center justify-between gap-5"
                          >
                            <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                              <span
                                className={`h-2 w-2 shrink-0 ${
                                  isLine ? "rounded-full" : "rounded-[3px]"
                                }`}
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
                            <div
                              key={row.label}
                              className="flex items-center justify-between gap-5"
                            >
                              <span className="text-[11px] text-slate-400">{row.label}</span>
                              <span className="text-[11px] font-semibold tabular-nums text-slate-600">
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
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
    </div>
  );
}

/**
 * Memoised: the page passes stable rows/series arrays (useMemo) so applying a
 * filter that does not change the weekly data cannot re-render the chart.
 */
const WeeklyPerformanceChart = memo(WeeklyPerformanceChartImpl);
export default WeeklyPerformanceChart;
