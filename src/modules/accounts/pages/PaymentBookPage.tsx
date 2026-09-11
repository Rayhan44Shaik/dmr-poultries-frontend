import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { Plus, RefreshCw, RotateCcw, Search, Pencil, CheckCircle2, Trash2 } from 'lucide-react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { PaymentTable } from '../components/payment-book/PaymentTable';
import { PaymentViewModal } from '../components/payment-book/PaymentViewModal';
import { PaymentEditModal } from '../components/payment-book/PaymentEditModal';
import { NewPaymentModal } from '../components/payment-book/NewPaymentModal';
import { deletePayment, listPayments, updatePayment } from '../services/paymentApiService';
import type { Payment, PaymentWritePayload } from '../types/payment.types';
import { DatePicker } from '../../../components/common/DatePicker';
import { canEditItem, canDeleteItem } from '../../../utils/dateUtils';
import { weekRange } from '../../../utils/businessDate';
import { usePendingDelete } from '../../../hooks/usePendingDelete';
import { ConfirmDialog } from '../../../ui/ConfirmDialog';
import { Modal } from '../../../ui/Modal';
import { pendingDeleteCountdownLabel } from '../../../shared/ui/pendingDelete';
import MasterDropdown from '../../masters/components/MasterDropdown';
import '../../masters/styles/masters.css';
import { Button } from '../../../ui/Button';
import { SearchInput } from '../../../ui/SearchInput';
import { uiActionToneClass, uiBadgeClass } from '../../../shared/ui/uiTokens';
import { applyDemoWrite, createDemoPayments, resetDemoPayments } from '../utils/paymentRegisterDemo';
import { EmptyState } from '../../../ui/EmptyState';
import { Pagination } from '../../../ui/Pagination';
import { filterPayments, PAYMENT_TYPES, PAYMENT_MODES, paymentCurrency, paymentNoDisplay } from '../utils/paymentRegister';

type PaymentView = 'pending' | 'approved' | 'deleted';
const PAYMENT_VIEWS: { value: PaymentView; label: string; selectedClass: string; hint?: string }[] = [
  { value: 'pending', label: 'Pending', selectedClass: 'bg-orange-100 text-orange-700 shadow-sm', hint: 'Payments awaiting approval.' },
  { value: 'approved', label: 'Approved', selectedClass: 'bg-emerald-100 text-emerald-700 shadow-sm' },
  { value: 'deleted', label: 'Deleted', selectedClass: 'bg-rose-100 text-rose-700 shadow-sm' },
];

export function PaymentBookPage({ embedded = false }: { embedded?: boolean }) {
  const { showNotification } = useSafeNotification();
  // Show the isolated examples immediately in the development preview.
  // Production continues to open with real API data; demo remains opt-in there.
  const tableRef = useRef<HTMLElement>(null);
  const statusGroupRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvalPayment, setApprovalPayment] = useState<Payment | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const approvingRef = useRef(false);
  const [demo, setDemo] = useState(import.meta.env.DEV);
  // Sample rows are state, not a one-shot constant: the preview is writable (see
  // `persistSample`) so create/edit/approve/delete can be exercised without a
  // server. Nothing written here ever reaches a payment endpoint.
  const [demoPayments, setDemoPayments] = useState(() => createDemoPayments());
  const demoRows = useRef(demoPayments);
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
        if (mounted.current && !reloadAfterSave.current) {
          setPayments(data);
          setSelectedId(null);
        }
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

  useEffect(() => {
    const clearOutsideSelection = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Shared dialogs are portalled outside the table. Their controls must
      // retain the captured transaction and opener while a form is active.
      if (target.closest('[role="dialog"], [role="alertdialog"]')) return;
      if (!tableRef.current?.contains(target)) setSelectedId(null);
    };
    document.addEventListener('pointerdown', clearOutsideSelection);
    return () => document.removeEventListener('pointerdown', clearOutsideSelection);
  }, []);

  /* Refresh feedback. The arrows keep turning for as long as a real load runs,
     and for one short beat on sample data, which makes no request at all — so
     the click is never silently swallowed. */
  const [spinBeat, setSpinBeat] = useState(false);
  const [filterAction, setFilterAction] = useState<'search' | 'clear' | 'refresh' | null>(null);
  const spinTimer = useRef<number | null>(null);
  const spinning = spinBeat || loading;
  const animateFilterAction = (action: 'search' | 'clear' | 'refresh') => {
    setFilterAction(action);
    setSpinBeat(true);
    if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    spinTimer.current = window.setTimeout(() => {
      setSpinBeat(false);
      setFilterAction(null);
    }, 700);
  };
  const handleRefresh = useCallback(() => {
    animateFilterAction('refresh');
    if (demoRef.current) showNotification('Sample data is up to date. No server request was made.', 'info');
    else void loadPayments();
  }, [loadPayments, showNotification]);
  useEffect(() => () => { if (spinTimer.current !== null) window.clearTimeout(spinTimer.current); }, []);

  const toggleDemo = () => {
    if (approvingRef.current) return;
    setSelectedId(null);
    demoRef.current = !demo;
    setDemo(!demo);
    if (demo) void loadPayments();
  };

  const changeFilter = (key: keyof typeof filters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value }));
  };
  const clearFilters = () => {
    animateFilterAction('clear');
    setSelectedId(null);
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
    animateFilterAction('search');
    setSelectedId(null);
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
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedPayment = rows.find(payment => payment.id === selectedId) ?? null;

  /* ---- sample preview: in-memory writes -----------------------------------
     A sample row is real enough to work with and never real enough to save.
     Writes patch this component's rows only; the `demo-payment-` prefix is what
     every guard below (and the delete controller) checks, so rows created here
     keep it and stay inside the sandbox. */
  const isSample = (payment: Payment) => payment.id.startsWith('demo-payment-');
  const writeDemoRows = useCallback((next: Payment[]) => {
    demoRows.current = next;
    setDemoPayments(next);
  }, []);
  const persistSample = useCallback(async (payload: PaymentWritePayload, target: Payment | null): Promise<Payment> => {
    // One short beat so the sheet's saving state behaves like the network path.
    await new Promise(resolve => setTimeout(resolve, 200));
    const next = applyDemoWrite(demoRows.current, payload, target);
    writeDemoRows(next.rows);
    return next.saved;
  }, [writeDemoRows]);
  const resetDemo = () => {
    setSelectedId(null);
    writeDemoRows(resetDemoPayments());
    showNotification('Sample rows rebuilt. Nothing was sent to the server.', 'info');
  };

  const handleSave = (saved: Payment) => {
    setSelectedId(null);
    const sample = saved.id.startsWith('demo-payment-');
    showNotification(sample ? 'Sample row updated — saved in this preview only.' : 'Payment saved successfully', sample ? 'info' : 'success');
    // Real rows reload from the server; there is nothing to reload for a sample.
    if (!sample) void loadPayments(true);
  };
  const { requestDelete, cancel, pendingItems, isPending } = usePendingDelete<string>(async id => {
    if (id.startsWith('demo-payment-')) {
      // The countdown committed on a preview row: remove it locally, no request.
      writeDemoRows(demoRows.current.filter(row => row.id !== id));
      showNotification('Sample row removed — this preview only.', 'info');
      return;
    }
    try {
      await deletePayment(id);
      showNotification('Payment deleted successfully', 'success');
      void loadPayments(true);
    } catch {
      showNotification('Failed to delete payment', 'error');
    }
  });

  const selectedBusy = Boolean(selectedPayment && (isPending(selectedPayment.id) || approving));
  // Eligibility follows the row, not the mode: sample rows are always inside the
  // window (their stamps are synthetic and this week's), real rows keep the
  // 10-day rule and the server path.
  const inEditWindow = (payment: Payment) => isSample(payment) || canEditItem(payment.createdAt);
  const canEditSelected = Boolean(selectedPayment && !selectedBusy && inEditWindow(selectedPayment));
  const canDeleteSelected = Boolean(selectedPayment && !selectedBusy && (isSample(selectedPayment) || canDeleteItem(selectedPayment.createdAt)));
  const canApproveSelected = Boolean(canEditSelected && selectedPayment?.status === 'Draft');
  const sampleHint = 'Sample row · changes stay in this preview and are never sent to the server.';

  const confirmApproval = async () => {
    const payment = approvalPayment;
    if (!payment || approvingRef.current) return;
    const sample = isSample(payment);
    const current = (sample ? demoRows.current : realPayments).find(item => item.id === payment.id);
    if (!current || current.status !== 'Draft' || (!sample && (!canEditItem(current.createdAt) || isPending(payment.id)))) {
      setApprovalError('This payment is no longer eligible for approval. Refresh the register and try again.');
      return;
    }
    approvingRef.current = true;
    setApproving(true);
    setApprovalError('');
    try {
      if (sample) {
        // Preview only: flip the row in memory so the list can be seen to change.
        await new Promise(resolve => setTimeout(resolve, 200));
        const now = new Date().toISOString();
        writeDemoRows(demoRows.current.map(row => row.id === payment.id ? { ...row, status: 'Approved' as const, updatedAt: now } : row));
        if (!mounted.current) return;
        setSelectedId(null);
        setApprovalPayment(null);
        showNotification('Sample row approved — this preview only.', 'info');
        return;
      }
      // Reuse the existing partial-update contract; never synthesize success.
      const saved = await updatePayment(payment.id, { status: 'Approved' });
      if (saved.id !== payment.id || saved.status !== 'Approved') {
        throw new Error('The server did not confirm approval. Refresh the register to check this payment.');
      }
      if (!mounted.current) return;
      setPayments(previous => previous.map(item => item.id === saved.id ? saved : item));
      setSelectedId(null);
      setApprovalPayment(null);
      showNotification('Payment approved successfully', 'success');
      void loadPayments(true);
      requestAnimationFrame(() => statusGroupRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
    } catch (error) {
      if (mounted.current) setApprovalError(error instanceof Error ? error.message : 'Unable to approve payment. Please try again.');
    } finally {
      approvingRef.current = false;
      if (mounted.current) setApproving(false);
    }
  };

  return (
    <div className={`master-page w-full min-w-0 space-y-3 text-slate-700 ${embedded ? '' : 'p-4 sm:p-6'}`}>
      {/* The application header owns Accounts > Payment Register. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {demo && <span className={uiBadgeClass('warning')}>Sample data</span>}
        <Button variant="secondary" aria-pressed={demo} disabled={!!pendingItems.length || approving} onClick={toggleDemo}>{demo ? 'Back to real payments' : 'Preview sample data'}</Button>
        {demo && <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} title="Rebuild the sample rows, discarding preview edits" onClick={resetDemo}>Reset sample rows</Button>}
      </div>
      <section aria-label="Payment filters" className="rounded-xl border border-slate-200 bg-white p-3">
        {/* Row one keeps dates and dropdown filters together. Row two keeps
            search and every register action together for quick scanning. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-full items-center gap-3 sm:w-[460px] sm:shrink-0">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${dateId}-from`} className="sr-only">From Date</label>
              <DatePicker className="[&_input]:h-12 [&_input]:rounded-xl [&_input]:pr-10 [&_input]:text-base" id={`${dateId}-from`} placeholder="From date" openOnFocus={false} value={filters.from} onChange={v => changeFilter('from', v)} hideClear />
            </div>
            <span aria-hidden="true" className="text-slate-400">–</span>
            <div className="min-w-0 flex-1">
              <label htmlFor={`${dateId}-to`} className="sr-only">To Date</label>
              <DatePicker className="[&_input]:h-12 [&_input]:rounded-xl [&_input]:pr-10 [&_input]:text-base" id={`${dateId}-to`} placeholder="To date" openOnFocus={false} value={filters.to} onChange={v => changeFilter('to', v)} hideClear />
            </div>
          </div>
          <MasterDropdown label="Payment Type" hideLabel className="min-w-0 flex-1 sm:flex-none sm:w-56 [&>button]:h-11 [&>button]:text-sm" value={filters.type} options={types} placeholder="All payment types" onChange={v => changeFilter('type', v)} searchable allowClear />
          <MasterDropdown label="Payment Mode" hideLabel className="min-w-0 flex-1 sm:flex-none sm:w-52 [&>button]:h-11 [&>button]:text-sm" value={filters.mode} options={modes} placeholder="All payment modes" onChange={v => changeFilter('mode', v)} searchable allowClear />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          <SearchInput value={filters.search} onChange={v => changeFilter('search', v)} aria-label="Search payments" placeholder="Payment no, payee, reference…" wrapperClassName="w-full sm:flex-1 sm:min-w-56" />
          <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
            <Button size="lg" icon={<Search size={16} className={filterAction === 'search' ? 'animate-pulse' : undefined} />} onClick={applyFilters} disabled={invalidRange}>Search</Button>
            <Button variant="secondary" size="lg" icon={<RotateCcw size={15} className={filterAction === 'clear' ? 'animate-spin' : undefined} />} aria-label="Clear filters" title="Clear filters" onClick={clearFilters}>Clear</Button>
            <Button variant="custom" size="lg" iconOnly aria-label="Refresh" title="Refresh records" className={uiActionToneClass.refresh} disabled={spinning} onClick={handleRefresh}>
              <RefreshCw size={16} strokeWidth={2} aria-hidden="true" className={`transition-transform duration-500 hover:rotate-180 ${spinning ? 'animate-[spin_0.6s_ease-in-out_1]' : ''}`} />
            </Button>
            <Button size="lg" icon={<Plus size={16} />} onClick={() => setIsNewModalOpen(true)}>New Payment</Button>
          </div>
        </div>
        {invalidRange && <p role="alert" className="mt-2 text-xs text-red-600">From Date must be on or before To Date.</p>}
      </section>
      <section ref={tableRef} aria-label="Payment records" aria-busy={loading} className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-sm font-bold tracking-wide text-slate-800">Payment</h2>
            <span aria-live="polite" className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
              {loading ? 'Updating…' : status === 'deleted' ? '—' : filtered.length}
            </span>
            <div ref={statusGroupRef} role="group" aria-label="Payment status" className="flex items-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 shadow-sm sm:ml-2">
              {PAYMENT_VIEWS.map(item => <Button key={item.value} variant="custom" size="sm" aria-pressed={status === item.value} title={item.hint}
                className={`h-auto rounded-md px-3 py-1.5 text-xs font-semibold ${status === item.value ? item.selectedClass : 'bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'}`}
                onClick={() => { setSelectedId(null); setStatus(item.value); setPage(1); }}>
                {item.label}
              </Button>)}
            </div>
          </div>
          {selectedPayment ? <div role="group" aria-label="Selected payment actions" title={isSample(selectedPayment) ? sampleHint : undefined} className="flex flex-wrap items-center gap-2">
            <span className="sr-only">Selected payment: {selectedPayment.paymentNo || selectedPayment.paidTo}</span>
            {/* Sample rows are read-only by design; said in words next to the
                buttons rather than hidden in a tooltip nobody discovers. */}
            {isSample(selectedPayment) && <span className={uiBadgeClass('info')}>Sample row · preview edits</span>}
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} aria-label="Edit selected payment" disabled={!canEditSelected}
              title={canEditSelected ? (isSample(selectedPayment) ? 'Update this sample row (preview only)' : 'Edit selected payment') : 'Payments older than 10 days cannot be edited'}
              onClick={() => { if (canEditSelected) setEditingPayment(selectedPayment); }}>Edit</Button>
            <Button variant="success" size="sm" icon={<CheckCircle2 size={14} />} aria-label="Approve selected payment" disabled={!canApproveSelected}
              title={canApproveSelected ? (isSample(selectedPayment) ? 'Approve this sample row (preview only)' : 'Approve selected pending payment') : selectedPayment.status !== 'Draft' ? 'This payment is already approved' : 'Payments older than 10 days cannot be approved'}
              onClick={() => { if (canApproveSelected) { setApprovalError(''); setApprovalPayment(selectedPayment); } }}>Approve</Button>
            <Button variant="destructiveOutline" size="sm" icon={<Trash2 size={14} />} aria-label="Delete selected payment" disabled={!canDeleteSelected}
              title={canDeleteSelected ? (isSample(selectedPayment) ? 'Remove this sample row (preview only)' : 'Delete selected payment') : 'Payments older than 10 days cannot be deleted'}
              onClick={() => { if (canDeleteSelected) requestDelete(selectedPayment.id, { label: `Deleting payment to ${selectedPayment.paidTo}` }); }}>Delete</Button>
          </div> : status !== 'deleted' && filtered.length > 0 && (
            /* Replaces the old "Filtered total" readout: the register is a work
               list, so the empty slot invites the row action instead of showing
               an amount that never drives anything. */
            <p className="text-[11px] text-slate-400">
              {demo ? 'Sample rows work like real ones here — select one to view, edit, approve or delete.' : 'Select a row to edit, approve or delete.'}
            </p>
          )}
        </div>
        {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Unable to refresh records. {payments.length ? 'Previously loaded records are still shown. ' : ''}Use Refresh to try again.</p>}
        {status === 'deleted' ? <EmptyState title="Deleted payments are unavailable" description="The current payment API does not provide deleted records. Cancelled payments are not treated as deleted." /> : <>
        <PaymentTable selectedId={selectedPayment?.id ?? null} onSelect={setSelectedId}
          emptyVariant={error ? 'error' : !payments.length ? 'no-data' : appliedFilters.search.trim() ? 'no-search' : 'no-filters'}
          payments={rows} loading={loading && !payments.length} error={error && !payments.length} onView={setViewingPayment} />
        <Pagination page={page} pageSize={pageSize} totalItems={filtered.length}
          onPageChange={next => { setSelectedId(null); setPage(next); }}
          onPageSizeChange={size => { setSelectedId(null); setPageSize(size); setPage(1); }} />
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
      <ConfirmDialog isOpen={!!approvalPayment} title="Approve Payment" tone="primary" confirmLabel="Approve Payment" loading={approving}
        record={approvalPayment ? `${paymentNoDisplay(approvalPayment.paymentNo)} · ${approvalPayment.paidTo} · ${paymentCurrency.format(approvalPayment.amount)}` : undefined}
        message={<>Mark this pending payment as approved?{approvalError && <span role="alert" className="mt-2 block text-rose-700">{approvalError}</span>}</>}
        onConfirm={() => void confirmApproval()} onCancel={() => { if (!approvingRef.current) { setApprovalPayment(null); setApprovalError(''); } }} />
      <NewPaymentModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSave={handleSave} persist={demo ? persistSample : undefined} />
      {/* The write path follows the ROW, not the toggle: flipping to sample data
          while a real payment is open must never downgrade its save to a local
          patch (or vice versa). */}
      <PaymentEditModal isOpen={!!editingPayment} payment={editingPayment} onClose={() => setEditingPayment(null)} onSave={handleSave}
        persist={editingPayment && isSample(editingPayment) ? persistSample : undefined} />
      {/* The sheet hands edit back to the register, which owns the row's
          eligibility rules; closing first keeps only one dialog mounted. */}
      <PaymentViewModal isOpen={!!viewingPayment} payment={viewingPayment} onClose={() => setViewingPayment(null)}
        onEdit={viewingPayment ? () => { const next = viewingPayment; setViewingPayment(null); setEditingPayment(next); } : undefined}
        canEdit={Boolean(viewingPayment && !isPending(viewingPayment.id) && !approving && (isSample(viewingPayment) || canEditItem(viewingPayment.createdAt)))}
        editHint={viewingPayment && !isSample(viewingPayment) ? 'Payments older than 10 days cannot be edited.' : 'Another action on this payment is still running.'} />
    </div>
  );
}
