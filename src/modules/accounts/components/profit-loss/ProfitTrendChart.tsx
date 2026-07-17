import { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface ProfitTrendChartProps {
  data: { month: string; profit: number }[];
}

export const ProfitTrendChart = memo(({ data }: ProfitTrendChartProps) => {
  return (
    <div className="bg-white p-4 rounded shadow border">
      <h3 className="text-sm font-semibold mb-2">Profit Trend (Last 6 Months)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip formatter={(v) => formatCurrency(v as number)} />
          <Line type="monotone" dataKey="profit" stroke="#82ca9d" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
ProfitTrendChart.displayName = 'ProfitTrendChart';