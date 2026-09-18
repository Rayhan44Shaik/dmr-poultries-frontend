import { memo, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsVehicleStat } from '../../types/analytics';
import { METRICS, type MetricDef, type VehicleMetricKey } from './vehiclePerformanceMetrics';
import { formatVehicleNumber } from '../../../../utils/format';

const TOP_N = 12;

const axisCompact = (value: number): string => {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)} L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} K`;
  return String(Math.round(value));
};

const metricValue = (metric: MetricDef, row: AnalyticsVehicleStat): number => {
  const value = metric.pick(row);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

interface VehiclePerformanceChartProps {
  stats: AnalyticsVehicleStat[];
  /** Controlled metric — the page places the switch on the card heading. */
  metricKey?: VehicleMetricKey;
}

const VehiclePerformanceChart = ({ stats, metricKey = 'distance' }: VehiclePerformanceChartProps) => {
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const rows = useMemo(() => {
    const scored = stats
      .map((row) => ({ row, value: metricValue(metric, row) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value || a.row.vehicleNumber.localeCompare(b.row.vehicleNumber))
      .slice(0, TOP_N)
      .map((entry) => ({
        // Registrations read spaced — "TS 07 UB 1333" — on the left axis.
        vehicle: formatVehicleNumber(entry.row.vehicleNumber),
        value: entry.value,
      }));
    return scored.length ? scored : [];
  }, [stats, metric]);

  const hasData = rows.length > 0;

  return (
    <div className="flex h-full flex-col">
      {!hasData ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-sm font-medium text-slate-400">
          No data for the selected filters.
        </div>
      ) : (
        <div className="h-80 w-full">
          <div className="h-full w-full rounded-lg border border-slate-100 bg-white p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} vertical={true} />
                <XAxis
                  type="number"
                  domain={[0, 'dataMax']}
                  tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={axisCompact}
                  axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  tickLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  tickMargin={8}
                  minTickGap={40}
                />
                <YAxis
                  type="category"
                  dataKey="vehicle"
                  width={140}
                  interval={0}
                  tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  tickLine={false}
                  tickMargin={8}
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
                  formatter={(value) => [metric.format(Number(value)), metric.label]}
                  labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}
                />
                <Bar
                  dataKey="value"
                  fill={metric.color}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(VehiclePerformanceChart);
