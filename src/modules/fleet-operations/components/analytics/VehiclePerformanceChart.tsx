import { memo, useMemo, useState } from 'react';
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

export type VehicleMetricKey = 'distance' | 'trips' | 'fuel' | 'mileage' | 'costPerKm';

interface MetricDef {
  key: VehicleMetricKey;
  label: string;
  unit: string;
  color: string;
  pick: (row: AnalyticsVehicleStat) => number;
  format: (value: number) => string;
}

const METRICS: MetricDef[] = [
  {
    key: 'distance',
    label: 'Distance',
    unit: 'km',
    color: '#2563eb',
    pick: (row) => row.distance,
    format: (value) => `${value.toLocaleString('en-IN')} km`,
  },
  {
    key: 'trips',
    label: 'Trips',
    unit: 'trips',
    color: '#6366f1',
    pick: (row) => row.trips,
    format: (value) => `${value.toLocaleString('en-IN')} trips`,
  },
  {
    key: 'fuel',
    label: 'Fuel',
    unit: 'L',
    color: '#f59e0b',
    pick: (row) => row.fuelLitres,
    format: (value) => `${value.toLocaleString('en-IN')} L`,
  },
  {
    key: 'mileage',
    label: 'Mileage',
    unit: 'km/l',
    color: '#10b981',
    pick: (row) => row.mileage,
    format: (value) => `${value.toFixed(2)} km/l`,
  },
  {
    key: 'costPerKm',
    label: 'Cost/KM',
    unit: '₹',
    color: '#f43f5e',
    pick: (row) => (row.distance > 0 ? row.totalExpense / row.distance : 0),
    format: (value) => `₹${value.toFixed(2)}/km`,
  },
];

const TOP_N = 12;

const axisCompact = (value: number): string => {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
};

const metricValue = (metric: MetricDef, row: AnalyticsVehicleStat): number => {
  const value = metric.pick(row);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

interface VehiclePerformanceChartProps {
  stats: AnalyticsVehicleStat[];
}

const VehiclePerformanceChart = ({ stats }: VehiclePerformanceChartProps) => {
  const [metricKey, setMetricKey] = useState<VehicleMetricKey>('distance');
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const rows = useMemo(() => {
    const scored = stats
      .map((row) => ({ row, value: metricValue(metric, row) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value || a.row.vehicleNumber.localeCompare(b.row.vehicleNumber))
      .slice(0, TOP_N)
      .map((entry) => ({
        vehicle: entry.row.vehicleNumber,
        value: entry.value,
      }));
    return scored.length ? scored : [];
  }, [stats, metric]);

  const hasData = rows.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">
          {hasData ? `Top ${rows.length} vehicles by ${metric.label.toLowerCase()}` : 'No vehicle activity recorded'}
        </p>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                m.key === metricKey
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-sm font-medium text-slate-400">
          No {metric.label.toLowerCase()} data for the selected filters.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={axisCompact}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="vehicle"
                width={118}
                interval={0}
                tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
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
                formatter={(value) => [metric.format(Number(value)), metric.label]}
                labelStyle={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}
              />
              <Bar
                dataKey="value"
                fill={metric.color}
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default memo(VehiclePerformanceChart);