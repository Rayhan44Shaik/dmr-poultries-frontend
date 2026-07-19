// src/modules/staff/components/performance/DutyTypeDonutChart.tsx

import { memo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DutyTypeDonutChartProps {
  data: { name: string; value: number; color: string }[];
  loading: boolean;
}

function DutyTypeDonutChart({ data, loading }: DutyTypeDonutChartProps) {
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
        <p className="text-slate-500">No duty data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Duty Type Summary</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => {
                // ✅ Fixed: percent may be undefined – use fallback 0
                const pct = percent ?? 0;
                return `${name} ${(pct * 100).toFixed(0)}%`;
              }}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              formatter={(value: any, name: any) => {
                const num = typeof value === 'number' ? value : parseFloat(value) || 0;
                return [`${num}%`, name];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(DutyTypeDonutChart);