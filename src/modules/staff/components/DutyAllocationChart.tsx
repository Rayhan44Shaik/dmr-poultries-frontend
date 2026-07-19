import { memo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DutyAllocationChartProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
}

const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

function DutyAllocationChart({ data }: DutyAllocationChartProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-2 text-center">
        Duty Allocation
      </h3>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius="80%"
              innerRadius="60%"
              paddingAngle={2}
              dataKey="value"
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
              // ✅ FIXED: Use (value: any) => [string, string]
              formatter={(value: any) => {
                const num = typeof value === 'number' ? value : parseFloat(value) || 0;
                return [`${num}%`, ''];
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(DutyAllocationChart);