import { BadgeCheck, Calendar, Check, CreditCard, Eye, Hash, IndianRupee, Loader2, ScrollText, UserRound, Wallet } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { Payment } from '../../types/payment.types';
import { EmptyState, type EmptyVariant } from '../../../../ui/EmptyState';
import { StatusBadge } from '../../../../ui/StatusBadge';
import { Button } from '../../../../ui/Button';
import { useI18n } from '../../../../i18n';
import { paymentCurrency, paymentNoDisplay, PAYMENT_TYPE_I18N_KEYS } from '../../utils/paymentRegister';
import { uiTableClass, uiTableHeadClass, uiTableThClass, uiTableTdClass, uiTableRowClass, uiTableRowSelectedClass } from '../../../../shared/ui/uiTokens';

// The register's stored statuses read as Pending / Approved / Cancelled,
// all through the shared status dictionary.
const statusLabelKey = (status: Payment['status']) =>
  status === 'Approved' ? 'status.approved' : status === 'Cancelled' ? 'status.cancelled' : 'status.pending';

interface PaymentTableProps {
  payments: Payment[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  emptyVariant?: EmptyVariant;
  error?: boolean;
  onView: (payment: Payment) => void;
  /** Zero-based index of the first row, so S.No survives paging like the Trip List. */
  startIndex?: number;
}

const displayDate = (date: string) => date.slice(0, 10).split('-').reverse().join('/');

/** Animated "loading the register" state — same sentence in every language. */
function LoadingState({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className ?? 'px-4 py-14'}`} role="status">
      <Loader2 size={22} className="animate-spin text-emerald-500" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500">{t('accounts.payment.loading')}</p>
    </div>
  );
}

/** View control with the shared view motion on hover — table rows and cards. */
function ViewButton({ label, onClick }: { label: string; onClick: (event: ReactMouseEvent) => void }) {
  return (
    <Button variant="ghost" size="xs" iconOnly className="group" aria-label={label} onClick={onClick}>
      <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]"><Eye size={15} /></span>
    </Button>
  );
}

function MobilePaymentCard({ payment, selectedId, onSelect, onView }: Pick<PaymentTableProps, 'selectedId' | 'onSelect' | 'onView'> & { payment: Payment }) {
  const { t } = useI18n();
  const selected = selectedId === payment.id;
  const viewName = paymentNoDisplay(payment.paymentNo) || payment.paidTo;
  const typeKey = PAYMENT_TYPE_I18N_KEYS[payment.paymentType];
  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm transition ${selected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(selected ? null : payment.id)}>
          <p className="truncate text-sm font-bold text-slate-900">{paymentNoDisplay(payment.paymentNo) || t('accounts.payment.not_assigned')}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{displayDate(payment.paymentDate)} · {typeKey ? t(typeKey) : payment.paymentType || '—'}</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={payment.status} label={t(statusLabelKey(payment.status))} tone={payment.status === 'Draft' ? 'warning' : undefined} />
          <ViewButton label={t('accounts.payment.view_aria', { name: viewName })} onClick={event => { event.stopPropagation(); onView(payment); }} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-2 text-xs">
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">{t('accounts.payment.col_paid_to')}</dt><dd className="truncate font-medium text-slate-700">{payment.paidTo || '—'}</dd></div>
        <div className="text-right"><dt className="text-[10px] uppercase tracking-wide text-slate-400">{t('accounts.payment.col_amount')}</dt><dd className="font-semibold tabular-nums text-slate-900">{paymentCurrency.format(payment.amount)}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-wide text-slate-400">{t('accounts.payment.mode')}</dt><dd className="truncate text-slate-700">{payment.paymentMode || '—'}</dd></div>
        <div className="text-right"><dt className="text-[10px] uppercase tracking-wide text-slate-400">{t('accounts.payment.col_reference')}</dt><dd className="truncate text-slate-500">{payment.referenceNo || '—'}</dd></div>
      </dl>
    </article>
  );
}

/** Text-first grid on desktop and readable detail cards on narrow screens. */
export function PaymentTable({ payments, loading, error, selectedId, onSelect, emptyVariant = 'no-data', onView, startIndex = 0 }: PaymentTableProps) {
  const { t } = useI18n();
  const empty = !payments.length;
  const emptyTitle = error ? t('accounts.payment.empty_error_title') : emptyVariant === 'no-data' ? t('accounts.payment.empty_no_data_title') : t('accounts.payment.empty_no_found_title');
  const emptyDescription = error ? t('accounts.payment.empty_error_desc') : emptyVariant === 'no-data' ? t('accounts.payment.empty_no_data_desc') : t('accounts.payment.empty_no_filters_desc');
  // Each column header carries its own glyph — the same icon-label language
  // as the Trip List's master table. S.No is plain and centred, like the
  // Trip List's leading serial column.
  const columns: { key: string; labelKey: string; icon?: ReactNode; align?: 'right' | 'center' }[] = [
    { key: 'sno', labelKey: 'table.s_no', align: 'center' },
    { key: 'paymentNo', labelKey: 'accounts.payment.col_payment_no', icon: <Hash size={14} className="text-slate-400 flex-shrink-0" /> },
    { key: 'date', labelKey: 'accounts.payment.col_date', icon: <Calendar size={14} className="text-blue-500 flex-shrink-0" /> },
    { key: 'type', labelKey: 'accounts.payment.type', icon: <Wallet size={14} className="text-emerald-500 flex-shrink-0" /> },
    { key: 'paidTo', labelKey: 'accounts.payment.col_paid_to', icon: <UserRound size={14} className="text-indigo-500 flex-shrink-0" /> },
    { key: 'amount', labelKey: 'accounts.payment.col_amount', icon: <IndianRupee size={14} className="text-orange-500 flex-shrink-0" />, align: 'right' },
    { key: 'mode', labelKey: 'accounts.payment.mode', icon: <CreditCard size={14} className="text-sky-500 flex-shrink-0" /> },
    { key: 'reference', labelKey: 'accounts.payment.col_reference', icon: <ScrollText size={14} className="text-violet-500 flex-shrink-0" /> },
    { key: 'status', labelKey: 'accounts.payment.col_status', icon: <BadgeCheck size={14} className="text-amber-500 flex-shrink-0" /> },
    { key: 'actions', labelKey: 'accounts.payment.col_actions', icon: <Eye size={14} className="text-slate-400 flex-shrink-0" />, align: 'right' },
  ];
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className={uiTableClass} style={{ minWidth: 1010 }}>
          <caption className="sr-only">{t('accounts.payment.table_caption')}</caption>
          <thead className={uiTableHeadClass}><tr>
            {columns.map(col => <th key={col.key} scope="col" className={`${uiTableThClass} text-[11px] ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center w-14' : ''}`}>
              {col.icon
                ? <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>{col.icon}<span>{t(col.labelKey)}</span></div>
                : <span>{t(col.labelKey)}</span>}
            </th>)}
          </tr></thead>
          <tbody>
            {empty ? <tr><td colSpan={columns.length}>
              {loading ? <LoadingState /> : <EmptyState variant={error ? 'error' : emptyVariant} title={emptyTitle} description={emptyDescription} />}
            </td></tr> : payments.map((payment, index) => {
              const isSelected = selectedId === payment.id;
              const viewName = paymentNoDisplay(payment.paymentNo) || payment.paidTo;
              const typeKey = PAYMENT_TYPE_I18N_KEYS[payment.paymentType];
              return (
                <tr key={payment.id} aria-label={t('accounts.payment.view_aria', { name: viewName })} aria-selected={isSelected} tabIndex={0}
                  onClick={() => onSelect(isSelected ? null : payment.id)}
                  onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(isSelected ? null : payment.id); } else if (event.key === 'Escape') onSelect(null); }}
                  className={`cursor-pointer text-xs outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-emerald-500)] ${isSelected ? uiTableRowSelectedClass : `${uiTableRowClass} ${payment.status === 'Cancelled' ? 'bg-slate-50 text-slate-400' : ''}`}`}>
                  <td className={`${uiTableTdClass} w-14 text-center font-medium text-slate-500`}>
                    {isSelected ? <Check size={16} className="text-blue-500 inline" aria-hidden="true" /> : startIndex + index + 1}
                  </td>
                  <td className={`${uiTableTdClass} whitespace-nowrap font-semibold text-slate-900`}>{paymentNoDisplay(payment.paymentNo) || <span className="font-normal text-slate-400">{t('accounts.payment.not_assigned')}</span>}</td>
                  <td className={`${uiTableTdClass} whitespace-nowrap tabular-nums text-slate-600`}>{displayDate(payment.paymentDate)}</td>
                  <td className={`${uiTableTdClass} min-w-40 text-slate-700`}>{typeKey ? t(typeKey) : payment.paymentType || '—'}</td>
                  <td className={`${uiTableTdClass} min-w-36 font-medium text-slate-800`}>{payment.paidTo}</td>
                  <td className={`${uiTableTdClass} whitespace-nowrap text-right tabular-nums font-semibold text-slate-900`}>{paymentCurrency.format(payment.amount)}</td>
                  <td className={`${uiTableTdClass} text-slate-700`}>{payment.paymentMode || '—'}</td>
                  <td className={`${uiTableTdClass} whitespace-nowrap text-slate-500`}>{payment.referenceNo || '—'}</td>
                  <td className={uiTableTdClass}><StatusBadge status={payment.status} label={t(statusLabelKey(payment.status))} tone={payment.status === 'Draft' ? 'warning' : undefined} /></td>
                  <td className={uiTableTdClass}><div className="flex justify-end gap-1"><ViewButton label={t('accounts.payment.view_aria', { name: viewName })} onClick={event => { event.stopPropagation(); onView(payment); }} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 p-2 sm:hidden">
        {empty ? (loading ? <LoadingState className="px-2 py-12" /> : <EmptyState variant={error ? 'error' : emptyVariant} title={emptyTitle} description={error ? t('accounts.payment.empty_error_desc') : t('accounts.payment.empty_no_filters_desc')} />) : payments.map((payment, index) => (
          <div key={payment.id} className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-center text-[11px] font-semibold tabular-nums text-slate-400">{startIndex + index + 1}</span>
            <div className="min-w-0 flex-1"><MobilePaymentCard payment={payment} selectedId={selectedId} onSelect={onSelect} onView={onView} /></div>
          </div>
        ))}
      </div>
    </>
  );
}
