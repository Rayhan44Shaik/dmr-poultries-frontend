import { memo, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getFarmerPurchases } from '../../services/storage';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];

interface PendingDonutProps {
  title: string;
  type: 'farmer' | 'shop';
  viewAllLink: string;
}

// Helper to get farms from localStorage
const getFarms = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-farms') || '[]');
  } catch {
    return [];
  }
};

export const PendingDonut = memo(({ title, type, viewAllLink }: PendingDonutProps) => {
  const data = useMemo(() => {
    if (type === 'farmer') {
      const farms = getFarms();
      const purchases = getFarmerPurchases().filter(p => p.status !== 'Paid');
      const map: Record<string, number> = {};
      purchases.forEach(p => {
        const amount = p.amount - p.paidAmount;
        if (amount > 0) map[p.farmId] = (map[p.farmId] || 0) + amount;
      });
      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, value]) => {
          const farm = farms.find((f: any) => f.id === id);
          return { name: farm?.farmName || id, value };
        });
    } else {
      // Shop collections (placeholder)
      return [];
    }
  }, [type]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200 text-center text-gray-400">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p>No pending data</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-center mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
          <Legend verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center mt-2">
        <a href={viewAllLink} className="text-blue-600 text-sm hover:underline">
          View All →
        </a>
      </div>
    </div>
  );
});
PendingDonut.displayName = 'PendingDonut';