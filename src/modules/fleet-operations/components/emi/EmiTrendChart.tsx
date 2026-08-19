import { memo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EmiTrendPoint } from '../../hooks/useEmiData';

const axisCompact = (value: number): string => {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
};

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

interface EmiTrendChartProps {
  data: EmiTrendPoint[];
  loading: boolean;
}

const EmiTrendChart = ({ data, loading }: EmiTrendChartProps) => {
  const hasData = Array.isArray(data) && data.some((point) => point.due > 0 || point.paid > 0 || point.outstanding > 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">EMI Trend</h3>
          <p className="mt-0.5 text-sm font-bold text-slate-800">Monthly schedule vs payments</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-violet-500" /> Outstanding
          </span>
        </div>
      </div>

      {!loading && !hasData ? (
        <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-400">
          No EMI schedule data for the selected period.
        </div>
      ) : (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
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
                  money(Number(value)),
                  name === 'due' ? 'Scheduled' : name === 'paid' ? 'Paid' : 'Outstanding',
                ]}
                labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}
              />
              <Bar
                dataKey="due"
                name="due"
                fill="#2563eb"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Bar
                dataKey="paid"
                name="paid"
                fill="#10b981"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="outstanding"
                name="outstanding"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default memo(EmiTrendChart);