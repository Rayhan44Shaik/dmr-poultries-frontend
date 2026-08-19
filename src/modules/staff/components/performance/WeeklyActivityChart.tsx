// src/modules/staff/components/performance/WeeklyActivityChart.tsx

import { memo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const axisCompact = (value: number): string => {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
};

export interface WeeklyBar {
  key: string;
  label: string;
  color: string;
}

interface WeeklyActivityChartProps {
  data: Array<Record<string, string | number>>;
  bars: [WeeklyBar, WeeklyBar];
  emptyText: string;
}

const WeeklyActivityChart = ({ data, bars, emptyText }: WeeklyActivityChartProps) => {
  const [primary, secondary] = bars;
  const hasData =
    Array.isArray(data) &&
    data.some((point) => Number(point[primary.key] || 0) > 0 || Number(point[secondary.key] || 0) > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-4 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: primary.color }} /> {primary.label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: secondary.color }} /> {secondary.label}
        </span>
      </div>

      {!hasData ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-sm font-medium text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="primary"
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={axisCompact}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="secondary"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={axisCompact}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 8px 20px -6px rgba(15, 23, 42, 0.15)',
                  fontSize: '12px',
                }}
                formatter={(value, name) => [
                  Number(value).toLocaleString('en-IN'),
                  name === primary.key ? primary.label : name === secondary.key ? secondary.label : String(name),
                ]}
                labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}
              />
              <Bar
                yAxisId="primary"
                dataKey={primary.key}
                name={primary.key}
                fill={primary.color}
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="secondary"
                dataKey={secondary.key}
                name={secondary.key}
                fill={secondary.color}
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default memo(WeeklyActivityChart);