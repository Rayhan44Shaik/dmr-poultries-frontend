import { Eye } from 'lucide-react';
import type { Payment } from '../../types/payment.types';
import { EmptyState, type EmptyVariant } from '../../../../ui/EmptyState';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { Button } from '../../../../ui/Button';
import { paymentCurrency, paymentStatusLabel } from '../../utils/paymentRegister';
import { uiTableClass, uiTableHeadClass, uiTableThClass, uiTableTdClass, uiTableRowClass, uiTableRowSelectedClass, uiBadgeClass } from '../../../../shared/ui/uiTokens';

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
      <table className={uiTableClass} style={{ minWidth: 1180 }}>
        <caption className="sr-only">Payment Register transaction records</caption>
        <thead className={uiTableHeadClass}><tr>
          <th scope="col" className={`${uiTableThClass} w-10`}><span className="sr-only">Select payment</span></th>
          {['Payment No', 'Date', 'Payment Type', 'Paid To', 'Amount', 'Mode', 'Reference / Bill No', 'Remarks', 'Status', 'Actions'].map(title => <th key={title} scope="col" className={`${uiTableThClass} ${title === 'Amount' || title === 'Actions' ? 'text-right' : ''}`}>{title}</th>)}
        </tr></thead>
        <tbody>
          {!payments.length ? <tr><td colSpan={11}>
            {loading ? <p className="px-4 py-14 text-center text-sm text-slate-500" role="status">Loading payments…</p> : <EmptyState variant={error ? 'error' : emptyVariant}
              title={error ? 'Records unavailable' : emptyVariant === 'no-data' ? 'No payments recorded yet' : 'No payments found'}
              description={error ? 'Use Refresh to try again.' : emptyVariant === 'no-data' ? 'New payments will appear here once recorded.' : 'Try adjusting your search or date, type and mode filters.'} />}
          </td></tr> : payments.map(payment => (
            <tr key={payment.id} aria-selected={selectedId === payment.id}
              onClick={() => onSelect(selectedId === payment.id ? null : payment.id)}
              className={`cursor-pointer ${selectedId === payment.id ? uiTableRowSelectedClass : `${uiTableRowClass} ${payment.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : ''}`}`}>
              <td className={uiTableTdClass}>
                <input type="checkbox" aria-label={`Select ${payment.paymentNo || payment.paidTo}`} checked={selectedId === payment.id}
                  onClick={event => event.stopPropagation()} onChange={event => onSelect(event.target.checked ? payment.id : null)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" />
              </td>
              <td className={`${uiTableTdClass} whitespace-nowrap font-semibold text-slate-900`}>{payment.paymentNo || <span className="font-normal text-slate-400">Not assigned</span>}</td>
              <td className={`${uiTableTdClass} whitespace-nowrap tabular-nums`}>{payment.paymentDate.slice(0, 10).split('-').reverse().join('/')}</td>
              <td className={uiTableTdClass}>{payment.paymentType}</td>
              <td className={`${uiTableTdClass} min-w-36 font-medium`}>{payment.paidTo}</td>
              <td className={`${uiTableTdClass} text-right tabular-nums whitespace-nowrap font-semibold text-slate-900`}>{paymentCurrency.format(payment.amount)}</td>
              <td className={`${uiTableTdClass} whitespace-nowrap`}><span className={uiBadgeClass('neutral')}>{payment.paymentMode || '—'}</span></td>
              <td className={uiTableTdClass}>{payment.referenceNo || '—'}</td>
              <td className={`${uiTableTdClass} max-w-52`}><p className="truncate" title={payment.remarks}>{payment.remarks || '—'}</p></td>
              <td className={uiTableTdClass}><StatusBadge status={payment.status} label={paymentStatusLabel(payment.status)} tone={payment.status === 'Draft' ? 'warning' : undefined} /></td>
              <td className={uiTableTdClass}><div className="flex justify-end gap-1">
                <Button variant="ghost" size="xs" iconOnly aria-label={`View ${payment.paymentNo || payment.paidTo}`} title="View payment" onClick={event => { event.stopPropagation(); onView(payment); }}><Eye size={15} /></Button>

              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
