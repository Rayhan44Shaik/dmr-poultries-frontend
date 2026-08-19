import { memo } from 'react';
import {
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Landmark,
  Wallet,
} from 'lucide-react';

export interface EmiKpiValues {
  monthlyCommitment: number;
  activeLoans: number;
  dueThisMonth: number;
  paidThisMonth: number;
  pendingThisMonth: number;
  overdueAmount: number;
  remainingCommitment: number;
  nextDueDate: string | null;
  nextDueAmount: number;
}

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const shortDate = (value: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

interface EmiKpiCardsProps {
  values: EmiKpiValues;
  loading: boolean;
}

const EmiKpiCards = ({ values, loading }: EmiKpiCardsProps) => {
  const cards = [
    {
      label: 'Monthly Commitment',
      value: money(values.monthlyCommitment),
      icon: Wallet,
      tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      hint: 'Per-month EMI obligation',
    },
    {
      label: 'Active Loans',
      value: String(values.activeLoans),
      icon: Landmark,
      tone: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      hint: 'Vehicles with EMI records',
    },
    {
      label: 'Due This Month',
      value: money(values.dueThisMonth),
      icon: CalendarDays,
      tone: 'bg-blue-50 text-blue-600 border-blue-100',
      hint: 'Scheduled for the month',
    },
    {
      label: 'Paid This Month',
      value: money(values.paidThisMonth),
      icon: CheckCircle2,
      tone: 'bg-teal-50 text-teal-600 border-teal-100',
      hint: 'Completed installments',
    },
    {
      label: 'Pending This Month',
      value: money(values.pendingThisMonth),
      icon: CalendarClock,
      tone: 'bg-amber-50 text-amber-600 border-amber-100',
      hint: 'Not yet paid this month',
    },
    {
      label: 'Overdue',
      value: money(values.overdueAmount),
      icon: Clock,
      tone: 'bg-rose-50 text-rose-600 border-rose-100',
      hint: 'Past due installments',
    },
    {
      label: 'Remaining Commitment',
      value: money(values.remainingCommitment),
      icon: CircleDollarSign,
      tone: 'bg-violet-50 text-violet-600 border-violet-100',
      hint: 'Outstanding across loans',
    },
    {
      label: 'Next Due',
      value: values.nextDueAmount > 0 ? `${money(values.nextDueAmount)}` : '—',
      icon: Banknote,
      tone: 'bg-slate-100 text-slate-600 border-slate-200',
      hint: values.nextDueDate ? `Due ${shortDate(values.nextDueDate)}` : 'No pending EMI',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs transition-shadow hover:shadow-sm"
        >
          <div className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg border ${card.tone}`}>
            <card.icon size={14} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
          {loading ? (
            <div className="mt-1 h-5 w-2/3 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-0.5 truncate text-lg font-black tabular-nums text-slate-900">{card.value}</p>
          )}
          <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{card.hint}</p>
        </div>
      ))}
    </div>
  );
};

export default memo(EmiKpiCards);