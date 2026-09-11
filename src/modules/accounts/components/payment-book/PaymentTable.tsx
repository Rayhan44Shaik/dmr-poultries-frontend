import {
  ArrowLeftRight,
  CalendarDays,
  Eye,
  IndianRupee,
  Layers,
  ScrollText,
  ShieldCheck,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { Payment } from '../../types/payment.types';
import { EmptyState, type EmptyVariant } from '../../../../ui/EmptyState';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { Button } from '../../../../ui/Button';
import { paymentCurrency, paymentNoDisplay, paymentStatusLabel } from '../../utils/paymentRegister';
import { PaymentModeMark, PaymentTypeMark } from './PaymentGlyphMarks';
import { uiTableClass, uiTableHeadClass, uiTableThClass, uiTableTdClass, uiTableRowClass, uiTableRowSelectedClass } from '../../../../shared/ui/uiTokens';

interface PaymentColumn {
  label: string;
  Icon: LucideIcon;
  /** Tinted chip so the header reads as an index: the same colour family the
      cell content uses, which makes the column findable without scanning text. */
  tint: string;
  align?: 'right';
}

/** Header order is the column order. */
const COLUMNS: readonly PaymentColumn[] = [
  { label: 'Payment No', Icon: Tag, tint: 'bg-indigo-50 text-indigo-600 ring-indigo-600/15' },
  { label: 'Date', Icon: CalendarDays, tint: 'bg-sky-50 text-sky-600 ring-sky-600/15' },
  { label: 'Payment Type', Icon: Layers, tint: 'bg-emerald-50 text-emerald-600 ring-emerald-600/15' },
  { label: 'Paid To', Icon: UserRound, tint: 'bg-violet-50 text-violet-600 ring-violet-600/15' },
  { label: 'Amount', Icon: IndianRupee, tint: 'bg-amber-50 text-amber-600 ring-amber-600/15', align: 'right' },
  { label: 'Mode', Icon: ArrowLeftRight, tint: 'bg-teal-50 text-teal-600 ring-teal-600/15' },
  { label: 'Reference / Bill No', Icon: ScrollText, tint: 'bg-blue-50 text-blue-600 ring-blue-600/15' },
  { label: 'Status', Icon: ShieldCheck, tint: 'bg-orange-50 text-orange-600 ring-orange-600/15' },
  { label: 'Actions', Icon: Eye, tint: 'bg-slate-100 text-slate-500 ring-slate-500/15', align: 'right' },
];

interface PaymentTableProps {
  payments: Payment[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  emptyVariant?: EmptyVariant;
  error?: boolean;
  onView: (payment: Payment) => void;
}

export function PaymentTable({ payments, loading, error, selectedId, onSelect, emptyVariant = 'no-data', onView }: PaymentTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={uiTableClass} style={{ minWidth: 1020 }}>
        <caption className="sr-only">Payment Register transaction records</caption>
        <thead className={uiTableHeadClass}><tr>
          {COLUMNS.map(({ label, Icon, tint, align }) => (
            <th key={label} scope="col" className={`${uiTableThClass} ${align === 'right' ? 'text-right' : ''}`}>
              {/* The chip is decorative; the visible words remain the label. */}
              <span className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                <span aria-hidden="true" className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] ring-1 ring-inset ${tint}`}>
                  <Icon size={11} strokeWidth={2.2} />
                </span>
                {label}
              </span>
            </th>
          ))}
        </tr></thead>
        <tbody>
          {!payments.length ? <tr><td colSpan={COLUMNS.length}>
            {loading ? <p className="px-4 py-14 text-center text-sm text-slate-500" role="status">Loading payments…</p> : <EmptyState variant={error ? 'error' : emptyVariant}
              title={error ? 'Records unavailable' : emptyVariant === 'no-data' ? 'No payments recorded yet' : 'No payments found'}
              description={error ? 'Use Refresh to try again.' : emptyVariant === 'no-data' ? 'New payments will appear here once recorded.' : 'Try adjusting your search or date, type and mode filters.'} />}
          </td></tr> : payments.map(payment => (
            <tr key={payment.id} aria-label={`Payment ${paymentNoDisplay(payment.paymentNo) || payment.paidTo}`} aria-selected={selectedId === payment.id} tabIndex={0}
              onClick={() => onSelect(selectedId === payment.id ? null : payment.id)}
              onKeyDown={event => {
                // A nested View button keeps its native Enter/Space behavior.
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(selectedId === payment.id ? null : payment.id);
                } else if (event.key === 'Escape') {
                  onSelect(null);
                }
              }}
              className={`cursor-pointer outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-emerald-500)] ${selectedId === payment.id ? uiTableRowSelectedClass : `${uiTableRowClass} ${payment.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : ''}`}`}>
              <td className={`${uiTableTdClass} whitespace-nowrap font-semibold text-slate-900`}>{paymentNoDisplay(payment.paymentNo) || <span className="font-normal text-slate-400">Not assigned</span>}</td>
              <td className={`${uiTableTdClass} whitespace-nowrap tabular-nums text-slate-600`}>{payment.paymentDate.slice(0, 10).split('-').reverse().join('/')}</td>
              <td className={`${uiTableTdClass} min-w-40`}><PaymentTypeMark type={payment.paymentType} /></td>
              <td className={`${uiTableTdClass} min-w-36 font-medium text-slate-800`}>{payment.paidTo}</td>
              <td className={`${uiTableTdClass} text-right tabular-nums whitespace-nowrap font-semibold text-slate-900`}>{paymentCurrency.format(payment.amount)}</td>
              <td className={uiTableTdClass}><PaymentModeMark mode={payment.paymentMode} /></td>
              <td className={`${uiTableTdClass} whitespace-nowrap text-slate-500`}>{payment.referenceNo || '—'}</td>
              <td className={uiTableTdClass}><StatusBadge status={payment.status} label={paymentStatusLabel(payment.status)} tone={payment.status === 'Draft' ? 'warning' : undefined} /></td>
              <td className={uiTableTdClass}><div className="flex justify-end gap-1">
                <Button variant="ghost" size="xs" iconOnly aria-label={`View ${paymentNoDisplay(payment.paymentNo) || payment.paidTo}`} title="View payment" onClick={event => { event.stopPropagation(); onView(payment); }}><Eye size={15} /></Button>

              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
