import type { LucideIcon } from 'lucide-react';
import { Banknote, ReceiptText, Truck, Wallet, Wrench } from 'lucide-react';
import { inr, kg } from '../approvalsUtils';

interface KpiTotals {
  trips: number;
  tripBirds: number;
  tripShops: number;
  rates: number;
  maintenanceCount: number;
  maintenanceValue: number;
  paymentCount: number;
  paymentValue: number;
  cashAwaiting: number;
}

interface ApprovalKpiCardsProps {
  totals: KpiTotals;
  active: string;
  onSelect: (tab: 'trips' | 'rates' | 'maintenance' | 'payments') => void;
}

interface CardProps {
  label: string;
  count: number;
  icon: LucideIcon;
  accent: { card: string; icon: string; bar: string };
  active: boolean;
  valueLine: string;
  subLine: string;
  onClick: () => void;
}

function KpiCard({ label, count, icon: Icon, accent, active, valueLine, subLine, onClick }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200/80'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accent.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 pl-1.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{count}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.card}`}>
          <Icon size={19} className={accent.icon} />
        </span>
      </div>
      <p className="mt-2 pl-1.5 text-sm font-bold tabular-nums text-slate-700">{valueLine}</p>
      <p className="pl-1.5 text-xs text-slate-400">{subLine}</p>
    </button>
  );
}

export function ApprovalKpiCards({ totals, active, onSelect }: ApprovalKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        label="Trips to approve"
        count={totals.trips}
        icon={Truck}
        accent={{
          card: 'bg-sky-50',
          icon: 'text-sky-600',
          bar: 'bg-sky-500',
        }}
        active={active === 'trips'}
        valueLine={`${kg.format(totals.tripBirds)} birds`}
        subLine={`Across ${totals.tripShops} shop deliveries`}
        onClick={() => onSelect('trips')}
      />
      <KpiCard
        label="Rate entries due"
        count={totals.rates}
        icon={ReceiptText}
        accent={{
          card: 'bg-cyan-50',
          icon: 'text-cyan-600',
          bar: 'bg-cyan-500',
        }}
        active={active === 'rates'}
        valueLine={totals.rates === 1 ? '1 completed trip' : `${totals.rates} completed trips`}
        subLine="Waiting for shop-wise sale rates"
        onClick={() => onSelect('rates')}
      />
      <KpiCard
        label="Maintenance bills"
        count={totals.maintenanceCount}
        icon={Wrench}
        accent={{
          card: 'bg-violet-50',
          icon: 'text-violet-600',
          bar: 'bg-violet-500',
        }}
        active={active === 'maintenance'}
        valueLine={inr.format(totals.maintenanceValue)}
        subLine="Bill & spare-part rates to verify"
        onClick={() => onSelect('maintenance')}
      />
      <KpiCard
        label="Payments to approve"
        count={totals.paymentCount}
        icon={Banknote}
        accent={{
          card: 'bg-emerald-50',
          icon: 'text-emerald-600',
          bar: 'bg-emerald-500',
        }}
        active={active === 'payments'}
        valueLine={inr.format(totals.paymentValue)}
        subLine="Draft payments awaiting sign-off"
        onClick={() => onSelect('payments')}
      />
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
        <span className="absolute inset-y-0 left-0 w-1 bg-amber-500" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 pl-1.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/80">
              Cash awaiting approval
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-900">
              {inr.format(totals.cashAwaiting)}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Wallet size={19} className="text-amber-600" />
          </span>
        </div>
        <p className="mt-2 pl-1.5 text-xs text-amber-700/80">
          Maintenance bills + payments not yet approved
        </p>
      </div>
    </div>
  );
}
