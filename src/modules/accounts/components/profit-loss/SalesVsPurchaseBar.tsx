import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface SalesVsPurchaseBarProps {
  data: { month: string; sales: number; purchase: number }[];
}

export const SalesVsPurchaseBar = memo(({ data }: SalesVsPurchaseBarProps) => {
  return (
    <div className="bg-white p-4 rounded shadow border">
      <h3 className="text-sm font-semibold mb-2">Sales vs Purchase</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip formatter={(v) => formatCurrency(v as number)} />
          <Bar dataKey="sales" fill="#4CAF50" name="Sales" />
          <Bar dataKey="purchase" fill="#F44336" name="Purchase" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
SalesVsPurchaseBar.displayName = 'SalesVsPurchaseBar';