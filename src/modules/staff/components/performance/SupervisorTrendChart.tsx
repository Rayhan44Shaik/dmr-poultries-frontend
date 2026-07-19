// src/modules/staff/components/performance/SupervisorTrendChart.tsx

import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SupervisorTrendChartProps {
  data: { month: string; trips: number; shops: number; weight: number }[];
  loading: boolean;
}

function SupervisorTrendChart({ data, loading }: SupervisorTrendChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-64 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="h-48 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-64 flex items-center justify-center">
        <p className="text-slate-500">No trend data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Performance Trend</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="trips"
              stroke="#3B82F6"
              strokeWidth={2}
              name="Trips Managed"
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="shops"
              stroke="#22C55E"
              strokeWidth={2}
              name="Shops Delivered"
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="weight"
              stroke="#8B5CF6"
              strokeWidth={2}
              name="Weight (KG)"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(SupervisorTrendChart);