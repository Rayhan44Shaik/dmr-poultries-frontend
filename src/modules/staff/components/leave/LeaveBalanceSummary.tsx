// src/modules/staff/components/leave/LeaveBalanceSummary.tsx

import { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface LeaveBalanceSummaryProps {
  balances: { total: number; used: number; remaining: number };
}

function LeaveBalanceSummary({ balances }: LeaveBalanceSummaryProps) {
  const data = [
    { name: 'Used', value: balances.used, color: '#F59E0B' },
    { name: 'Remaining', value: balances.remaining, color: '#34D399' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-2 text-center">Overall Leave Balance</h3>
      <div className="flex items-center justify-center gap-6">
        <div className="h-24 w-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={40} paddingAngle={2} dataKey="value">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [`${value} days`, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400"></span> Used: {balances.used} days</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-400"></span> Remaining: {balances.remaining} days</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-400"></span> Total: {balances.total} days</div>
        </div>
      </div>
    </div>
  );
}

export default memo(LeaveBalanceSummary);