import { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#FF6384'];

interface ExpenseBreakdownDonutProps {
  data: { name: string; value: number }[];
}

export const ExpenseBreakdownDonut = memo(({ data }: ExpenseBreakdownDonutProps) => {
  if (data.length === 0) {
    return (
      <div className="bg-white p-4 rounded shadow border text-center text-gray-400">
        <h3 className="text-sm font-semibold mb-2">Expense Breakdown</h3>
        <p>No expenses</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded shadow border">
      <h3 className="text-sm font-semibold text-center mb-2">Expense Breakdown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(v as number)} />
          <Legend verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
ExpenseBreakdownDonut.displayName = 'ExpenseBreakdownDonut';