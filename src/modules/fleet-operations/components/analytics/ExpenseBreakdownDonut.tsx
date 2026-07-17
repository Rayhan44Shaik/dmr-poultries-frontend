import { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ExpenseBreakdownDonutProps {
  data: { name: string; value: number }[];
  height?: number;
}

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const ExpenseBreakdownDonut = ({ data, height = 200 }: ExpenseBreakdownDonutProps) => {
  const hasData = data.some(item => item.value > 0);

  if (!hasData) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        No expense data available
      </div>
    );
  }

  // Calculate total for safe percentage calculation
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          dataKey="value"
          label={({ name, value }) => {
            const percent = total > 0 ? (value / total) * 100 : 0;
            return `${name}: ${percent.toFixed(0)}%`;
          }}
          labelLine={false}
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default memo(ExpenseBreakdownDonut);