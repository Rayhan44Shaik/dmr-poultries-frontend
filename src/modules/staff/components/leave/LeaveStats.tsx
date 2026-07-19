// src/modules/staff/components/leave/LeaveStats.tsx

import { memo } from 'react';
import { Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';

interface LeaveStatsProps {
  stats: { pending: number; approved: number; rejected: number; total: number };
}

function LeaveStats({ stats }: LeaveStatsProps) {
  const cards = [
    { label: 'Pending', value: stats.pending, icon: <Clock size={20} />, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Approved', value: stats.approved, icon: <CheckCircle size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Rejected', value: stats.rejected, icon: <XCircle size={20} />, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Total Requests', value: stats.total, icon: <Calendar size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{card.value}</p>
            </div>
            <div className={`${card.bg} p-2 rounded-lg`}>
              <div className={card.color}>{card.icon}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(LeaveStats);