import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { PaymentTable } from '../components/payment-book/PaymentTable';
import { PaymentViewModal } from '../components/payment-book/PaymentViewModal';
import { PaymentEditModal } from '../components/payment-book/PaymentEditModal';
import { NewPaymentModal } from '../components/payment-book/NewPaymentModal';
import { deletePayment, listPayments } from '../services/paymentApiService';
import type { Payment } from '../types/payment.types';
import { DatePicker } from '../../../components/common/DatePicker';
import { canEditItem, canDeleteItem } from '../../../utils/dateUtils';
import { weekRange } from '../../../utils/businessDate';
import { usePendingDelete } from '../../../hooks/usePendingDelete';
import { Modal } from '../../../ui/Modal';
import { pendingDeleteCountdownLabel } from '../../../shared/ui/pendingDelete';
import MasterDropdown from '../../masters/components/MasterDropdown';
import '../../masters/styles/masters.css';
import { Button } from '../../../ui/Button';
import { SearchInput } from '../../../ui/SearchInput';
import { RefreshButton, ResetButton } from '../../../ui/ExportActions';
import { uiBadgeClass } from '../../../shared/ui/uiTokens';
import { createDemoPayments } from '../utils/paymentRegisterDemo';
import { EmptyState } from '../../../ui/EmptyState';
import { Pagination } from '../../../ui/Pagination';
import { filterPayments, PAYMENT_TYPES, PAYMENT_MODES, paymentCurrency } from '../utils/paymentRegister';

type PaymentView = 'pending' | 'approved' | 'deleted';
const PAYMENT_VIEWS: { value: PaymentView; label: string; selectedClass: string; hint?: string }[] = [
  { value: 'pending', label: 'Pending', selectedClass: 'bg-orange-100 text-orange-700 shadow-sm', hint: 'Shows Draft payments; saved statuses are unchanged.' },
  { value: 'approved', label: 'Approved', selectedClass: 'bg-emerald-100 text-emerald-700 shadow-sm' },
  { value: 'deleted', label: 'Deleted', selectedClass: 'bg-rose-100 text-rose-700 shadow-sm' },
];

export function PaymentBookPage({ embedded = false }: { embedded?: boolean }) {
  const { showNotification } = useSafeNotification();
  // Show the isolated examples immediately in the development preview.
  // Production continues to open with real API data; demo remains opt-in there.
  const [demo, setDemo] = useState(import.meta.env.DEV);
  const [demoPayments] = useState(() => createDemoPayments());
  const demoRef = useRef(demo);
  const mounted = useRef(false);
  const [realPayments, setPayments] = useState<Payment[]>([]);
  const [realLoading, setLoading] = useState(true);
  const [realError, setError] = useState(false);
  const inFlight = useRef(false);
  const reloadAfterSave = useRef(false);
  const [filters, setFilters] = useState(() => ({ ...weekRange(), type: '', mode: '', search: '' }));
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [status, setStatus] = useState<PaymentView>('pending');
  const dateId = useId();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const payments = demo ? demoPayments : realPayments;
  const loading = !demo && realLoading;
  const error = !demo && realError;

  // The existing list endpoint returns the dataset. Filter locally so search
  // covers all displayed fields and paging/filter changes make no requests.
  const loadPayments = useCallback(async (afterMutation = false) => {
    if (demoRef.current || !mounted.current) return;
    if (inFlight.current) {
      // A save/delete completing during refresh must not leave stale rows.
      if (afterMutation) reloadAfterSave.current = true;
      return;
    }
    inFlight.current = true;
    setLoading(true);
    try {
      do {
        reloadAfterSave.current = false;
        const data = await listPayments();
        if (mounted.current && !reloadAfterSave.current) setPayments(data);
      } while (reloadAfterSave.current);
      if (mounted.current) setError(false);
    } catch {
      if (!mounted.current) return;
      setError(true);
      if (!demoRef.current) showNotification('Unable to load payments. Please try refreshing.', 'error');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    mounted.current = true;
    // Schedule the initial external fetch; cancel it if the view unmounts.
    const initialLoad = window.setTimeout(() => void loadPayments(), 0);
    const sync = () => { if (!document.hidden) void loadPayments(); };
    document.addEventListener('visibilitychange', sync);
    return () => { mounted.current = false; window.clearTimeout(initialLoad); document.removeEventListener('visibilitychange', sync); };
  }, [loadPayments]);

  const toggleDemo = () => {
    demoRef.current = !demo;
    setDemo(!demo);
    if (demo) void loadPayments();
  };

  const changeFilter = (key: keyof typeof filters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value }));
  };
  const clearFilters = () => {
    const cleared = { ...weekRange(), type: '', mode: '', search: '' };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setStatus('pending');
    setPage(1);
    showNotification('Filters cleared. Showing the current week.', 'info');
  };
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const applyFilters = () => {
    if (invalidRange) return;
    setAppliedFilters({ ...filters });
    setPage(1);
  };
  const matched = useMemo(() => filterPayments(payments, appliedFilters), [payments, appliedFilters]);
  const filtered = useMemo(() => {
    // UI views only: do not reclassify Paid/Cancelled as Approved/Deleted.
    if (status === 'deleted') return [];
    return matched.filter(payment => payment.status === (status === 'pending' ? 'Draft' : 'Approved'));
  }, [matched, status]);
  const types = useMemo(() => [...new Set([...PAYMENT_TYPES, ...payments.map(p => p.paymentType)])].filter(Boolean), [payments]);
  const modes = useMemo(() => [...new Set([...PAYMENT_MODES, ...payments.map(p => p.paymentMode)])].filter(Boolean), [payments]);
  const total = useMemo(() => filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0), [filtered]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const handleSave = () => {
    showNotification('Payment saved successfully', 'success');
    void loadPayments(true);
  };
  const { requestDelete, cancel, pendingItems, isPending } = usePendingDelete<string>(async id => {
    if (demoRef.current || id.startsWith('demo-payment-')) return;
    try {
      await deletePayment(id);
      showNotification('Payment deleted successfully', 'success');
      void loadPayments(true);
    } catch {
      showNotification('Failed to delete payment', 'error');
    }
  });

  return (
    <div className={`master-page w-full min-w-0 space-y-3 text-slate-700 ${embedded ? '' : 'p-4 sm:p-6'}`}>
      {/* The application header owns Accounts > Payment Register. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {demo && <span className={uiBadgeClass('warning')}>Sample data</span>}
        <Button variant="secondary" aria-pressed={demo} disabled={!!pendingItems.length} onClick={toggleDemo}>{demo ? 'Back to real payments' : 'Preview sample data'}</Button>
        <Button icon={<Plus size={16} />} disabled={demo} title={demo ? 'Return to real payments to create a payment' : undefined} onClick={() => { if (!demoRef.current) setIsNewModalOpen(true); }}>New Payment</Button>
      </div>
      <section aria-label="Payment filters" className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-2 sm:w-[302px] sm:shrink-0">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${dateId}-from`} className="sr-only">From Date</label>
              <DatePicker className="[&_input]:pr-10" id={`${dateId}-from`} placeholder="From date" value={filters.from} onChange={v => changeFilter('from', v)} hideClear />
            </div>
            <span aria-hidden="true" className="text-slate-400">–</span>
            <div className="min-w-0 flex-1">
              <label htmlFor={`${dateId}-to`} className="sr-only">To Date</label>
              <DatePicker className="[&_input]:pr-10" id={`${dateId}-to`} placeholder="To date" value={filters.to} onChange={v => changeFilter('to', v)} hideClear />
            </div>
          </div>
          <MasterDropdown label="Payment Type" hideLabel className="min-w-0 flex-1 sm:flex-none sm:w-44" value={filters.type} options={types} placeholder="All payment types" onChange={v => changeFilter('type', v)} searchable allowClear />
          <MasterDropdown label="Payment Mode" hideLabel className="min-w-0 flex-1 sm:flex-none sm:w-40" value={filters.mode} options={modes} placeholder="All payment modes" onChange={v => changeFilter('mode', v)} searchable allowClear />
          <SearchInput value={filters.search} onChange={v => changeFilter('search', v)} aria-label="Search payments" placeholder="Payment no, payee, reference…" wrapperClassName="w-full sm:flex-1 sm:min-w-44" />
          <div className="flex items-center gap-1.5">
            <Button size="lg" icon={<Search size={16} />} onClick={applyFilters} disabled={invalidRange}>Search</Button>
            <ResetButton compact ariaLabel="Clear filters" title="Clear filters" onClick={clearFilters} />
            <RefreshButton compact loading={loading} onClick={() => { if (demo) showNotification('Sample data is up to date. No server request was made.', 'info'); else void loadPayments(); }} />
          </div>
        </div>
        {invalidRange && <p role="alert" className="mt-2 text-xs text-red-600">From Date must be on or before To Date.</p>}
      </section>
      <section aria-label="Payment records" aria-busy={loading} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
            <h2 className="text-sm font-bold tracking-wide text-slate-800">Payment</h2>
            <span aria-live="polite" className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
              {loading ? 'Updating…' : status === 'deleted' ? '—' : filtered.length}
            </span>
            <div role="group" aria-label="Payment status" className="flex items-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 shadow-sm sm:ml-2">
              {PAYMENT_VIEWS.map(item => <Button key={item.value} variant="custom" size="sm" aria-pressed={status === item.value} title={item.hint}
                className={`h-auto rounded-md px-3 py-1.5 text-xs font-semibold ${status === item.value ? item.selectedClass : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'}`}
                onClick={() => { setStatus(item.value); setPage(1); }}>
                {item.label}
              </Button>)}
            </div>
          </div>
          {status !== 'deleted' && <span className="text-xs text-slate-500">Filtered total <strong className="ml-2 text-sm tabular-nums text-slate-800">{paymentCurrency.format(total)}</strong></span>}
        </div>
        {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Unable to refresh records. {payments.length ? 'Previously loaded records are still shown. ' : ''}Use Refresh to try again.</p>}
        {status === 'deleted' ? <EmptyState title="Deleted payments are unavailable" description="The current payment API does not provide deleted records. Cancelled payments are not treated as deleted." /> : <>
        <PaymentTable readOnly={demo} emptyVariant={error ? 'error' : !payments.length ? 'no-data' : appliedFilters.search.trim() ? 'no-search' : 'no-filters'} isPending={isPending} payments={rows} loading={loading && !payments.length} error={error && !payments.length} onView={setViewingPayment}
          onEdit={p => { if (!demoRef.current && canEditItem(p.createdAt)) setEditingPayment(p); }}
          onDelete={p => { if (!demoRef.current && canDeleteItem(p.createdAt)) requestDelete(p.id, { label: `Deleting payment to ${p.paidTo}` }); }} />
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
        </>}

      </section>
      <Modal isOpen={pendingItems.length > 0} title="Payment deletion pending" size="md"
        closeOnOverlay={false} showCloseButton={false} closeOnEscape={!pendingItems.some(item => item.committing)}
        onClose={() => pendingItems.filter(item => !item.committing).forEach(item => cancel(item.id))}
        footer={<Button variant="secondary" disabled={pendingItems.some(item => item.committing)} onClick={() => pendingItems.forEach(item => cancel(item.id))}>Cancel deletion</Button>}>
        <div className="space-y-3">{pendingItems.map(item => <div key={item.id}>
          <p className="text-sm font-medium text-slate-800">{item.label}</p>
          <p className="mt-2 text-sm text-slate-500" role="status">{item.committing ? 'Deleting payment…' : `${pendingDeleteCountdownLabel(item.secondsLeft)}. Cancel to keep this payment.`}</p>
        </div>)}</div>
      </Modal>
      <NewPaymentModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSave={handleSave} />
      <PaymentEditModal isOpen={!!editingPayment} payment={editingPayment} onClose={() => setEditingPayment(null)} onSave={handleSave} />
      <PaymentViewModal isOpen={!!viewingPayment} payment={viewingPayment} onClose={() => setViewingPayment(null)} />
    </div>
  );
}
