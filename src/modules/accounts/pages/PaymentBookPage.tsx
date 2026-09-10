import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
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
import { createDemoPayments } from '../utils/paymentRegisterDemo';
import { Pagination } from '../../../ui/Pagination';
import { filterPayments, PAYMENT_TYPES, PAYMENT_MODES, paymentCurrency } from '../utils/paymentRegister';

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
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ ...weekRange(), type: '', mode: '', search: '' });
    setPage(1);
    showNotification('Filters cleared. Showing the current week.', 'info');
  };
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const filtered = useMemo(() => filterPayments(payments, filters), [payments, filters]);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Track outgoing payments and their transaction details.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" aria-pressed={demo} disabled={!!pendingItems.length} onClick={toggleDemo}>{demo ? 'Back to real payments' : 'Preview sample data'}</Button>
          <Button icon={<Plus size={16} />} disabled={demo} title={demo ? 'Return to real payments to create a payment' : undefined} onClick={() => { if (!demoRef.current) setIsNewModalOpen(true); }}>New Payment</Button>
        </div>
      </div>
      {demo && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Demo mode · Sample data only.</strong> These 18 fictional payments are read-only and never saved to the server. Search, filters, pagination and View are available.</div>}
      <section aria-label="Payment filters" className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DatePicker label="From Date" value={filters.from} onChange={v => changeFilter('from', v)} />
          <DatePicker label="To Date" value={filters.to} onChange={v => changeFilter('to', v)} />
          <MasterDropdown label="Payment Type" value={filters.type} options={types} placeholder="All payment types" onChange={v => changeFilter('type', v)} searchable allowClear />
          <MasterDropdown label="Payment Mode" value={filters.mode} options={modes} placeholder="All payment modes" onChange={v => changeFilter('mode', v)} searchable allowClear />
        </div>
        {invalidRange && <p role="alert" className="text-xs text-red-600">From Date must be on or before To Date.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={filters.search} onChange={v => changeFilter('search', v)} aria-label="Search payments" placeholder="Search payment no, payee, reference, remarks or amount…" wrapperClassName="w-full sm:flex-1 sm:min-w-64" />
          <ResetButton onClick={clearFilters}>Clear</ResetButton>
          <RefreshButton loading={loading} onClick={() => { if (demo) showNotification('Sample data is up to date. No server request was made.', 'info'); else void loadPayments(); }} />
        </div>
      </section>
      <section aria-label="Payment records" aria-busy={loading} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span aria-live="polite">{loading ? 'Updating records…' : `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`}</span>
          <span>Filtered total <strong className="ml-2 text-sm tabular-nums text-slate-800">{paymentCurrency.format(total)}</strong></span>
        </div>
        {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Unable to refresh records. {payments.length ? 'Previously loaded records are still shown. ' : ''}Use Refresh to try again.</p>}
        <PaymentTable readOnly={demo} emptyVariant={error ? 'error' : !payments.length ? 'no-data' : filters.search.trim() ? 'no-search' : 'no-filters'} isPending={isPending} payments={rows} loading={loading && !payments.length} error={error && !payments.length} onView={setViewingPayment}
          onEdit={p => { if (!demoRef.current && canEditItem(p.createdAt)) setEditingPayment(p); }}
          onDelete={p => { if (!demoRef.current && canDeleteItem(p.createdAt)) requestDelete(p.id, { label: `Deleting payment to ${p.paidTo}` }); }} />
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />

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
