// src/modules/fleet-operations/components/analytics/ExpenseBreakdownDonut.tsx
import { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ExpenseData {
  name: string;
  value: number;
}

interface ExpenseBreakdownDonutProps {
  data: ExpenseData[];
  height?: number;
}

const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6'];

const ExpenseBreakdownDonut = ({ data, height = 220 }: ExpenseBreakdownDonutProps) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-slate-400 text-sm font-medium">
        No expense data recorded
      </div>
    );
  }

  const totalExpense = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full" style={{ height }}>
      {/* Chart Block with Fixed Clipping Bounds */}
      <div className="relative w-full sm:w-1/2 h-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="88%"
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none transition-all duration-300 hover:opacity-90" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']}
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderRadius: '8px',
                border: 'none',
                color: '#fff',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Dynamic Center Text Data Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">Total Outlay</span>
          <span className="text-lg font-black text-slate-900 mt-0.5">
            ₹{totalExpense >= 100000 ? `${(totalExpense / 100000).toFixed(1)}L` : totalExpense.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Premium Side Sidebar Legend Grid Layout */}
      <div className="w-full sm:w-1/2 grid grid-cols-2 sm:grid-cols-1 gap-2.5 px-2">
        {data.map((item, idx) => {
          const percentage = ((item.value / totalExpense) * 100).toFixed(1);
          return (
            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100/80 hover:bg-slate-100/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-xs font-semibold text-slate-700 truncate">{item.name}</span>
              </div>
              <span className="text-xs font-bold text-slate-500 pl-2">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(ExpenseBreakdownDonut);