import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { Payment } from '../../types/payment.types';
import { EmptyState, type EmptyVariant } from '../../../../ui/EmptyState';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { Button } from '../../../../ui/Button';
import { canEditItem, canDeleteItem } from '../../../../utils/dateUtils';
import { paymentCurrency } from '../../utils/paymentRegister';
import { uiTableClass, uiTableHeadClass, uiTableThClass, uiTableTdClass, uiTableRowClass, uiBadgeClass } from '../../../../shared/ui/uiTokens';

interface PaymentTableProps {
  payments: Payment[];
  loading?: boolean;
  readOnly?: boolean;
  emptyVariant?: EmptyVariant;
  error?: boolean;
  isPending: (id: string) => boolean;
  onView: (payment: Payment) => void;
  onEdit: (payment: Payment) => void;
  onDelete: (payment: Payment) => void;
}

export function PaymentTable({ payments, loading, error, readOnly = false, emptyVariant = 'no-data', isPending, onView, onEdit, onDelete }: PaymentTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={uiTableClass} style={{ minWidth: 1180 }}>
        <caption className="sr-only">Payment Register transaction records</caption>
        <thead className={uiTableHeadClass}><tr>
          {['Payment No', 'Date', 'Payment Type', 'Paid To', 'Amount', 'Mode', 'Reference / Bill No', 'Remarks', 'Status', 'Actions'].map(title => <th key={title} scope="col" className={`${uiTableThClass} ${title === 'Amount' || title === 'Actions' ? 'text-right' : ''}`}>{title}</th>)}
        </tr></thead>
        <tbody>
          {!payments.length ? <tr><td colSpan={10}>
            {loading ? <p className="px-4 py-14 text-center text-sm text-slate-500" role="status">Loading payments…</p> : <EmptyState variant={error ? 'error' : emptyVariant}
              title={error ? 'Records unavailable' : emptyVariant === 'no-data' ? 'No payments recorded yet' : 'No payments found'}
              description={error ? 'Use Refresh to try again.' : emptyVariant === 'no-data' ? 'New payments will appear here once recorded.' : 'Try adjusting your search or date, type and mode filters.'} />}
          </td></tr> : payments.map(payment => (
            <tr key={payment.id} className={`${uiTableRowClass} ${payment.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : ''}`}>
              <td className={`${uiTableTdClass} whitespace-nowrap font-semibold text-slate-900`}>{payment.paymentNo || <span className="font-normal text-slate-400">Not assigned</span>}</td>
              <td className={`${uiTableTdClass} whitespace-nowrap tabular-nums`}>{payment.paymentDate.slice(0, 10).split('-').reverse().join('/')}</td>
              <td className={uiTableTdClass}>{payment.paymentType}</td>
              <td className={`${uiTableTdClass} min-w-36 font-medium`}>{payment.paidTo}</td>
              <td className={`${uiTableTdClass} text-right tabular-nums whitespace-nowrap font-semibold text-slate-900`}>{paymentCurrency.format(payment.amount)}</td>
              <td className={`${uiTableTdClass} whitespace-nowrap`}><span className={uiBadgeClass('neutral')}>{payment.paymentMode || '—'}</span></td>
              <td className={uiTableTdClass}>{payment.referenceNo || '—'}</td>
              <td className={`${uiTableTdClass} max-w-52`}><p className="truncate" title={payment.remarks}>{payment.remarks || '—'}</p></td>
              <td className={uiTableTdClass}><StatusBadge status={payment.status} /></td>
              <td className={uiTableTdClass}><div className="flex justify-end gap-1">
                <Button variant="ghost" size="xs" iconOnly aria-label={`View ${payment.paymentNo || payment.paidTo}`} title="View payment" onClick={() => onView(payment)}><Eye size={15} /></Button>
                {!readOnly && <><Button variant="ghost" size="xs" iconOnly aria-label={`Edit ${payment.paymentNo}`} title={canEditItem(payment.createdAt) ? 'Edit payment' : 'Payments older than 10 days cannot be edited'} disabled={isPending(payment.id) || !canEditItem(payment.createdAt)} onClick={() => onEdit(payment)}><Pencil size={15} /></Button>
                <Button variant="ghost" size="xs" iconOnly aria-label={`Delete ${payment.paymentNo}`} title={canDeleteItem(payment.createdAt) ? 'Delete payment' : 'Payments older than 10 days cannot be deleted'} disabled={isPending(payment.id) || !canDeleteItem(payment.createdAt)} onClick={() => onDelete(payment)}><Trash2 size={15} /></Button></>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
