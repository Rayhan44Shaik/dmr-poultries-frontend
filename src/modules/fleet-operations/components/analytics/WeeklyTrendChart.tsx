// src/modules/fleet-operations/components/analytics/WeeklyTrendChart.tsx
// ---------------------------------------------------------------------------
// Weekly Activity — presented the same way as the Cost Analysis card:
// summary tiles up top (they double as the legend), then the trend chart in
// light bars with soft outlines and clean axis chrome.
// ---------------------------------------------------------------------------
import { memo, useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsWeeklyPoint } from '../../types/analytics';
import { formatNumberCompact } from '../../utils/formatters';

const axisCompact = (value: number): string => {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)} L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} K`;
  return String(Math.round(value));
};

interface WeeklyTrendChartProps {
  data: AnalyticsWeeklyPoint[];
}

const WeeklyTrendChart = ({ data }: WeeklyTrendChartProps) => {
  const rows = Array.isArray(data) ? data : [];
  const hasData = rows.some((point) => point.distance > 0 || point.fuel > 0);

  const summary = useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    const distance = rows.reduce((sum, point) => sum + (Number(point.distance) || 0), 0);
    const fuel = rows.reduce((sum, point) => sum + (Number(point.fuel) || 0), 0);
    const peak = rows.reduce<AnalyticsWeeklyPoint | null>(
      (best, point) => (!best || point.distance > best.distance ? point : best),
      null
    );
    return { distance, fuel, peak };
  }, [data]);

  if (!hasData) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-sm font-medium text-slate-400">
        No weekly activity for the selected filters.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-1.5">
        <div
          className="min-w-0 rounded-lg border border-blue-200 bg-blue-50/70 px-2 py-1 text-center text-blue-700"
          title={`Total distance covered: ${formatNumberCompact(summary.distance)} km`}
        >
          <span className="block truncate text-[8.5px] font-black uppercase tracking-wide opacity-60">
            Distance
          </span>
          <strong className="block truncate text-[12.5px] font-black tabular-nums">
            {formatNumberCompact(summary.distance)} km
          </strong>
        </div>
        <div
          className="min-w-0 rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-1 text-center text-amber-700"
          title={`Total fuel consumed: ${formatNumberCompact(summary.fuel)} L`}
        >
          <span className="block truncate text-[8.5px] font-black uppercase tracking-wide opacity-60">
            Fuel
          </span>
          <strong className="block truncate text-[12.5px] font-black tabular-nums">
            {formatNumberCompact(summary.fuel)} L
          </strong>
        </div>
        <div
          className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 text-center text-slate-700"
          title={
            summary.peak
              ? `Busiest week: ${summary.peak.weekLabel} · ${formatNumberCompact(summary.peak.distance)} km`
              : 'Busiest week'
          }
        >
          <span className="block truncate text-[8.5px] font-black uppercase tracking-wide opacity-60">
            Peak Week
          </span>
          <strong className="block truncate text-[12.5px] font-black tabular-nums">
            {summary.peak?.weekLabel ?? '—'}
          </strong>
        </div>
      </div>

      <div className="mt-2 h-80 w-full flex-1">
        <div className="h-full w-full rounded-lg border border-slate-100 bg-white p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} barCategoryGap="30%" margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} horizontal={true} />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                tickLine={false}
                tickMargin={10}
              />
              <YAxis
                yAxisId="distance"
                width={56}
                tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={axisCompact}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={40}
              />
              <YAxis
                yAxisId="fuel"
                orientation="right"
                width={56}
                tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={axisCompact}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={40}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 20px -6px rgba(15, 23, 42, 0.15)',
                  fontSize: '12px',
                  backgroundColor: '#ffffff',
                }}
                formatter={(value, name) => [
                  Number(value).toLocaleString('en-IN'),
                  name === 'distance' ? 'Distance (km)' : name === 'fuel' ? 'Fuel (L)' : String(name),
                ]}
                labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}
              />
              <Bar
                yAxisId="distance"
                dataKey="distance"
                name="distance"
                fill="#2563eb"
                fillOpacity={0.28}
                stroke="#2563eb"
                strokeOpacity={0.55}
                strokeWidth={1}
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="fuel"
                dataKey="fuel"
                name="fuel"
                fill="#f59e0b"
                fillOpacity={0.28}
                stroke="#f59e0b"
                strokeOpacity={0.55}
                strokeWidth={1}
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default memo(WeeklyTrendChart);
