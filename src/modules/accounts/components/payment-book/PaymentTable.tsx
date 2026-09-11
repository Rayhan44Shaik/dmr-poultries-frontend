import { Eye } from 'lucide-react';
import type { Payment } from '../../types/payment.types';
import { EmptyState, type EmptyVariant } from '../../../../ui/EmptyState';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { Button } from '../../../../ui/Button';
import { paymentCurrency, paymentNoDisplay, paymentStatusLabel } from '../../utils/paymentRegister';
import { uiTableClass, uiTableHeadClass, uiTableThClass, uiTableTdClass, uiTableRowClass, uiTableRowSelectedClass } from '../../../../shared/ui/uiTokens';

const COLUMNS = ['PAYMENT NO', 'DATE', 'PAYMENT TYPE', 'PAID TO', 'AMOUNT', 'MODE', 'REFERENCE / BILL NO', 'STATUS', 'ACTIONS'] as const;

interface PaymentTableProps {
  payments: Payment[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  emptyVariant?: EmptyVariant;
  error?: boolean;
  onView: (payment: Payment) => void;
}

const displayDate = (date: string) => date.slice(0, 10).split('-').reverse().join('/');

function MobilePaymentCard({ payment, selectedId, onSelect, onView }: Pick<PaymentTableProps, 'selectedId' | 'onSelect' | 'onView'> & { payment: Payment }) {
  const selected = selectedId === payment.id;
  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm transition ${selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(selected ? null : payment.id)}>
          <p className="truncate text-sm font-bold text-slate-900">{paymentNoDisplay(payment.paymentNo) || 'Not assigned'}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{displayDate(payment.paymentDate)} · {payment.paymentType || '—'}</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={payment.status} label={paymentStatusLabel(payment.status)} tone={payment.status === 'Draft' ? 'warning' : undefined} />
          <Button variant="ghost" size="xs" iconOnly aria-label={`View ${paymentNoDisplay(payment.paymentNo) || payment.paidTo}`} title="View payment" onClick={event => { event.stopPropagation(); onView(payment); }}><Eye size={15} /></Button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-2 text-xs">
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Paid to</dt><dd className="truncate font-medium text-slate-700">{payment.paidTo || '—'}</dd></div>
        <div className="text-right"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Amount</dt><dd className="font-semibold tabular-nums text-slate-900">{paymentCurrency.format(payment.amount)}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">Mode</dt><dd className="truncate text-slate-700">{payment.paymentMode || '—'}</dd></div>
        <div className="text-right"><dt className="text-[10px] uppercase tracking-wide text-slate-400">Reference</dt><dd className="truncate text-slate-500">{payment.referenceNo || '—'}</dd></div>
      </dl>
    </article>
  );
}

/** Text-first grid on desktop and readable detail cards on narrow screens. */
export function PaymentTable({ payments, loading, error, selectedId, onSelect, emptyVariant = 'no-data', onView }: PaymentTableProps) {
  const empty = !payments.length;
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className={uiTableClass} style={{ minWidth: 980 }}>
          <caption className="sr-only">Payment Register transaction records</caption>
          <thead className={uiTableHeadClass}><tr>
            {COLUMNS.map(label => <th key={label} scope="col" className={`${uiTableThClass} text-[11px] ${label === 'AMOUNT' || label === 'ACTIONS' ? 'text-right' : ''}`}>{label}</th>)}
          </tr></thead>
          <tbody>
            {empty ? <tr><td colSpan={COLUMNS.length}>
              {loading ? <p className="px-4 py-14 text-center text-sm text-slate-500" role="status">Loading payments…</p> : <EmptyState variant={error ? 'error' : emptyVariant} title={error ? 'Records unavailable' : emptyVariant === 'no-data' ? 'No payments recorded yet' : 'No payments found'} description={error ? 'Use Refresh to try again.' : emptyVariant === 'no-data' ? 'New payments will appear here once recorded.' : 'Try adjusting your search or date, type and mode filters.'} />}
            </td></tr> : payments.map(payment => (
              <tr key={payment.id} aria-label={`Payment ${paymentNoDisplay(payment.paymentNo) || payment.paidTo}`} aria-selected={selectedId === payment.id} tabIndex={0}
                onClick={() => onSelect(selectedId === payment.id ? null : payment.id)}
                onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selectedId === payment.id ? null : payment.id); } else if (event.key === 'Escape') onSelect(null); }}
                className={`cursor-pointer text-xs outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-emerald-500)] ${selectedId === payment.id ? uiTableRowSelectedClass : `${uiTableRowClass} ${payment.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : ''}`}`}>
                <td className={`${uiTableTdClass} whitespace-nowrap font-semibold text-slate-900`}>{paymentNoDisplay(payment.paymentNo) || <span className="font-normal text-slate-400">Not assigned</span>}</td>
                <td className={`${uiTableTdClass} whitespace-nowrap tabular-nums text-slate-600`}>{displayDate(payment.paymentDate)}</td>
                <td className={`${uiTableTdClass} min-w-40 text-slate-700`}>{payment.paymentType || '—'}</td>
                <td className={`${uiTableTdClass} min-w-36 font-medium text-slate-800`}>{payment.paidTo}</td>
                <td className={`${uiTableTdClass} whitespace-nowrap text-right tabular-nums font-semibold text-slate-900`}>{paymentCurrency.format(payment.amount)}</td>
                <td className={`${uiTableTdClass} text-slate-700`}>{payment.paymentMode || '—'}</td>
                <td className={`${uiTableTdClass} whitespace-nowrap text-slate-500`}>{payment.referenceNo || '—'}</td>
                <td className={uiTableTdClass}><StatusBadge status={payment.status} label={paymentStatusLabel(payment.status)} tone={payment.status === 'Draft' ? 'warning' : undefined} /></td>
                <td className={uiTableTdClass}><div className="flex justify-end gap-1"><Button variant="ghost" size="xs" iconOnly aria-label={`View ${paymentNoDisplay(payment.paymentNo) || payment.paidTo}`} title="View payment" onClick={event => { event.stopPropagation(); onView(payment); }}><Eye size={15} /></Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-2 sm:hidden">
        {empty ? (loading ? <p className="px-2 py-12 text-center text-sm text-slate-500" role="status">Loading payments…</p> : <EmptyState variant={error ? 'error' : emptyVariant} title={error ? 'Records unavailable' : emptyVariant === 'no-data' ? 'No payments recorded yet' : 'No payments found'} description={error ? 'Use Refresh to try again.' : 'Try adjusting your filters.'} />) : payments.map(payment => <MobilePaymentCard key={payment.id} payment={payment} selectedId={selectedId} onSelect={onSelect} onView={onView} />)}
      </div>
    </>
  );
}
