import { memo } from 'react';
import { CheckCircle2, Clock, CalendarClock, CircleDollarSign } from 'lucide-react';

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

interface EmiPlanningSummaryProps {
  monthLabel: string;
  due: number;
  paid: number;
  pending: number;
  overdue: number;
  loading: boolean;
}

const EmiPlanningSummary = ({ monthLabel, due, paid, pending, overdue, loading }: EmiPlanningSummaryProps) => {
  const progress = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
  const isCurrent = monthLabel.toUpperCase() === 'THIS MONTH';

  const stats = [
    { label: 'Total Due', value: money(due), icon: CircleDollarSign, tone: 'text-slate-800' },
    { label: 'Paid', value: money(paid), icon: CheckCircle2, tone: 'text-emerald-600' },
    { label: 'Pending', value: money(pending), icon: CalendarClock, tone: 'text-amber-600' },
    { label: 'Overdue', value: money(overdue), icon: Clock, tone: 'text-rose-600' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            {isCurrent ? 'This Month' : monthLabel}
          </h3>
          <p className="mt-0.5 text-sm font-bold text-slate-800">EMI payment plan</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          {loading ? '…' : `${progress}% paid`}
        </span>
      </div>

      <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
          style={{ width: loading ? '0%' : `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <div className={`flex items-center gap-1.5 ${stat.tone}`}>
              <stat.icon size={13} />
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stat.label}</p>
            </div>
            {loading ? (
              <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            ) : (
              <p className="mt-1 text-sm font-black tabular-nums text-slate-900">{stat.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(EmiPlanningSummary);