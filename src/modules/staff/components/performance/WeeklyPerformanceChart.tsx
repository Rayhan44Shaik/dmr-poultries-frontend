// src/modules/staff/components/performance/WeeklyPerformanceChart.tsx
//
// ============================================================================
// WEEKLY PERFORMANCE CHART — shared rendering for both performance pages
// ============================================================================
// One chart implementation (stable element tree, stable keys, animation off —
// so filtering can never flicker or remount the SVG) configured per page:
//
//   Driver     → Distance (km) bar · Fuel (L) bar, weekly mileage derived in
//                the tooltip from the same real values (distance ÷ fuel).
//   Supervisor → Birds + Weight (kg) bars on the left axis · Mortality +
//                Weight-loss (kg) bars on the right axis; trips + derived
//                avg weight per bird in the tooltip.
//
// The chart only ever renders the buckets the API returned, in the order the
// API returned them, with the API's own numbers — the `week` label is used for
// DISPLAY only (see `performancePeriods.weeklyBucketLabel`). Nothing is
// re-bucketed or fabricated.
//
// Axis label rules: compact EN-IN magnitude abbreviations (k / L); tooltips
// reuse the page's number formatters. Empty state, loading skeleton and an
// accessible description are built in.
// ============================================================================

import { memo, useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

  return (
    <div className="w-full">
      <div className={heightClass} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, left: -8, bottom: 4 }}
            // Two series → grouped side-by-side bars per week.
            barGap={4}
            barCategoryGap="24%"
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
              cursor={{ fill: "#f8fafc", strokeDasharray: "4 4", stroke: "#e2e8f0" }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 12px 28px -8px rgba(15, 23, 42, 0.18)",
                fontSize: "12px",
                padding: "10px 14px",
                backgroundColor: "#fff",
              }}
              labelStyle={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as WeeklyChartPoint | undefined;
                return (
                  <div className="min-w-[140px] text-xs">
                    <div className="mb-1.5 font-bold text-slate-900">{String(label ?? "")}</div>
                    <div className="space-y-1">
                      {payload.map((entry) => {
                        const config = series.find((s) => s.key === entry.dataKey);
                        const raw = typeof entry.value === "number" ? entry.value : 0;
                        return (
                          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <span
                                className="h-2 w-2 rounded-sm"
                                style={{ backgroundColor: config?.color ?? "#94a3b8" }}
                                aria-hidden="true"
                              />
                              {config?.label ?? String(entry.dataKey)}
                            </span>
                            <span className="font-semibold tabular-nums text-slate-800">
                              {config?.format ? config.format(raw) : raw.toLocaleString("en-IN")}
                            </span>
                          </div>
                        );
                      })}
                      {point &&
                        tooltipExtras?.(point).map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1">
                            <span className="text-slate-400">{row.label}</span>
                            <span className="font-semibold tabular-nums text-slate-600">{row.value}</span>
                          </div>
                        ))}
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
            {series.map((config) => (
              <Bar
                key={config.key}
                yAxisId={config.axis}
                dataKey={config.key}
                name={config.label}
                fill={config.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
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
