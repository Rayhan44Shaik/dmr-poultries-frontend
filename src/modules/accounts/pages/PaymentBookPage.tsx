import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { Plus, History, RotateCcw, Search, Pencil, CheckCircle2, Trash2, Calendar, Wallet, CreditCard } from 'lucide-react';
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
import { shouldShowPagination } from '../../../shared/ui/paginationStyles';
import MasterDropdown from '../../masters/components/MasterDropdown';
import '../../masters/styles/masters.css';
import { Button } from '../../../ui/Button';
import { uiBadgeClass } from '../../../shared/ui/uiTokens';
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsPrimaryButtonClass,
  opsSecondaryButtonClass,
} from '../../../shared/ui/operationsStyles';
import { useI18n } from '../../../i18n';
import { applyDemoWrite, createDemoPayments, resetDemoPayments } from '../utils/paymentRegisterDemo';
import { EmptyState } from '../../../ui/EmptyState';
import { BrandRefreshButton, Pagination } from '../../../ui';
import { filterPayments, PAYMENT_TYPES, PAYMENT_MODES, paymentCurrency, paymentNoDisplay } from '../utils/paymentRegister';

type PaymentView = 'pending' | 'approved' | 'deleted';
const PAYMENT_VIEWS: { value: PaymentView; labelKey: string; selectedClass: string }[] = [
  { value: 'pending', labelKey: 'status.pending', selectedClass: 'bg-orange-50/80 text-orange-500 shadow-sm' },
  { value: 'approved', labelKey: 'status.approved', selectedClass: 'bg-emerald-50/80 text-emerald-500 shadow-sm' },
  { value: 'deleted', labelKey: 'accounts.payment.status_deleted', selectedClass: 'bg-rose-50/80 text-rose-500 shadow-sm' },
];

export function PaymentBookPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
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
  // Default to the live API in every environment so the page shows the same
  // dataset as the rest of the app; the bundled examples remain available as
  // an explicit fallback when the payments endpoint is unreachable.
  const [demo, setDemo] = useState(false);
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
  // Filter control ids — the visible icon labels name these through htmlFor,
  // exactly like the Trip List's filter card.
  const typeFilterId = useId();
  const modeFilterId = useId();
  const searchId = useId();
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
  // Resolves true only when the dataset actually came back.
  const loadPayments = useCallback(async (afterMutation = false): Promise<boolean> => {
    if (demoRef.current || !mounted.current) return false;
    if (inFlight.current) {
      // A save/delete completing during refresh must not leave stale rows.
      if (afterMutation) reloadAfterSave.current = true;
      return false;
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
      return true;
    } catch {
      if (!mounted.current) return false;
      setError(true);
      if (!demoRef.current) showNotification(t('accounts.payment.notif_load_error'), 'error');
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [showNotification, t]);

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

  /* Filter feedback: the Search / Reset glyphs beat once per click (700 ms).
     The refresh button follows the trip list's contract instead — plain hen,
     success toast when the load finishes. */
  const [filterAction, setFilterAction] = useState<'search' | 'clear' | 'refresh' | null>(null);
  const spinTimer = useRef<number | null>(null);
  const animateFilterAction = (action: 'search' | 'clear' | 'refresh') => {
    setFilterAction(action);
    if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    spinTimer.current = window.setTimeout(() => setFilterAction(null), 700);
  };
  // The trip list's refresh contract, kept identical: the hen button stays
  // plain (no loading prop, so it never pre-dances), and a finished refresh
  // confirms with the shared "Data refreshed" success notification.
  const handleRefresh = useCallback(() => {
    if (demoRef.current) {
      showNotification(t('accounts.payment.notif_demo_fresh'), 'info');
      return;
    }
    void loadPayments().then(ok => { if (ok) showNotification(t('notification.data_refreshed'), 'success'); });
  }, [loadPayments, showNotification, t]);
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
    showNotification(t('accounts.payment.notif_filters_cleared'), 'info');
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
    showNotification(t('accounts.payment.notif_rows_rebuilt'), 'info');
  };

  const handleSave = (saved: Payment) => {
    setSelectedId(null);
    const sample = saved.id.startsWith('demo-payment-');
    showNotification(sample ? t('accounts.payment.notif_sample_updated') : t('accounts.payment.notif_saved'), sample ? 'info' : 'success');
    // Real rows reload from the server; there is nothing to reload for a sample.
    if (!sample) void loadPayments(true);
  };
  const { requestDelete, cancel, pendingItems, isPending } = usePendingDelete<string>(async id => {
    if (id.startsWith('demo-payment-')) {
      // The countdown committed on a preview row: remove it locally, no request.
      writeDemoRows(demoRows.current.filter(row => row.id !== id));
      showNotification(t('accounts.payment.notif_sample_removed'), 'info');
      return;
    }
    try {
      await deletePayment(id);
      showNotification(t('accounts.payment.notif_deleted'), 'success');
      void loadPayments(true);
    } catch {
      showNotification(t('accounts.payment.notif_delete_failed'), 'error');
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

  const confirmApproval = async () => {
    const payment = approvalPayment;
    if (!payment || approvingRef.current) return;
    const sample = isSample(payment);
    const current = (sample ? demoRows.current : realPayments).find(item => item.id === payment.id);
    if (!current || current.status !== 'Draft' || (!sample && (!canEditItem(current.createdAt) || isPending(payment.id)))) {
      setApprovalError(t('accounts.payment.approve_error_stale'));
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
        showNotification(t('accounts.payment.notif_sample_approved'), 'info');
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
      showNotification(t('accounts.payment.notif_approved'), 'success');
      void loadPayments(true);
      requestAnimationFrame(() => statusGroupRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true }));
    } catch (error) {
      if (mounted.current) setApprovalError(error instanceof Error ? error.message : t('accounts.payment.approve_failed_default'));
    } finally {
      approvingRef.current = false;
      if (mounted.current) setApproving(false);
    }
  };

  return (
    <div className={`w-full space-y-5 animate-in fade-in duration-200 ${embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800'}`}>
      {/* Sample-data preview — this register's own demo affordance. The
          application header owns the Accounts > Payment Register title. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {demo && <span className={uiBadgeClass('warning')}>{t('accounts.payment.sample_badge')}</span>}
        <Button variant="secondary" aria-pressed={demo} disabled={!!pendingItems.length || approving} onClick={toggleDemo}>
          {demo ? t('accounts.payment.back_real') : t('accounts.payment.preview_sample')}
        </Button>
        {demo && <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={resetDemo}>{t('accounts.payment.reset_rows')}</Button>}
      </div>

      {/* The same filter card the Trip List uses (opsFilterCardClass): one
          labelled grid — icon + name per field — with the search row and every
          register action beneath it. Glyph motions come from the global
          tokens: search sways, reset spins, refresh is the brand hen. */}
      <section aria-label={t('accounts.payment.filters_aria')} className={opsFilterCardClass}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label htmlFor={`${dateId}-from`} className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t('common.from')}</span>
            </label>
            <DatePicker
              id={`${dateId}-from`}
              value={filters.from}
              onChange={v => changeFilter('from', v)}
              placeholder={t('accounts.payment.from')}
              className="w-full text-xs font-medium"
              openOnFocus={false}
              hideClear
            />
          </div>
          <div>
            <label htmlFor={`${dateId}-to`} className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t('common.to')}</span>
            </label>
            <DatePicker
              id={`${dateId}-to`}
              value={filters.to}
              onChange={v => changeFilter('to', v)}
              placeholder={t('accounts.payment.to')}
              className="w-full text-xs font-medium"
              openOnFocus={false}
              hideClear
            />
          </div>
          <div>
            <label htmlFor={typeFilterId} className={opsFilterLabelClass}>
              <Wallet size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t('accounts.payment.type')}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t('accounts.payment.type')}
              triggerId={typeFilterId}
              value={filters.type}
              options={types}
              onChange={v => changeFilter('type', v)}
              placeholder={t('accounts.payment.all_types')}
              searchable
              allowClear
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor={modeFilterId} className={opsFilterLabelClass}>
              <CreditCard size={17} className="text-sky-500 flex-shrink-0" />
              <span>{t('accounts.payment.mode')}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t('accounts.payment.mode')}
              triggerId={modeFilterId}
              value={filters.mode}
              options={modes}
              onChange={v => changeFilter('mode', v)}
              placeholder={t('accounts.payment.all_modes')}
              searchable
              allowClear
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-end pt-1">
          <div className="lg:col-span-5">
            <label htmlFor={searchId} className={opsFilterLabelClass}>
              <Search size={17} className="text-slate-400 flex-shrink-0" />
              <span>{t('common.search')}</span>
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id={searchId}
                value={filters.search}
                onChange={event => changeFilter('search', event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') applyFilters(); }}
                placeholder={t('accounts.payment.search_placeholder')}
                className={`${opsInputClass} pl-10`}
              />
            </div>
          </div>
          <div className="lg:col-span-7 flex items-center gap-2 justify-end flex-wrap">
            <button type="button" onClick={() => setIsNewModalOpen(true)} className={`group relative ${opsPrimaryButtonClass}`} aria-label={t('accounts.payment.new')}>
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><Plus size={15} /></span>
              {t('accounts.payment.new')}
            </button>
            <button type="button" onClick={applyFilters} disabled={invalidRange} className={`group relative ${opsSecondaryButtonClass}`} aria-label={t('common.search')}>
              <span className={`inline-flex motion-safe:group-hover:animate-[var(--animate-action-search)] ${filterAction === 'search' ? 'motion-safe:animate-[var(--animate-action-search)]' : ''}`}><Search size={15} /></span>
              {t('common.search')}
            </button>
            <button type="button" onClick={clearFilters} className={`group relative ${opsSecondaryButtonClass}`} aria-label={t('common.reset')}>
              <span className={`inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)] ${filterAction === 'clear' ? 'motion-safe:animate-[var(--animate-action-reset)]' : ''}`}><RotateCcw size={14} /></span>
              {t('common.reset')}
            </button>
            <BrandRefreshButton onClick={handleRefresh} />
          </div>
        </div>
        {invalidRange && <p role="alert" className="mt-2 text-xs text-red-600">{t('accounts.payment.invalid_range')}</p>}
      </section>

      {/* The table card — the exact shell the Trip List uses: white rounded-2xl
          card, gradient header bar with icon tile + title, table, global
          pagination at the foot. */}
      <section ref={tableRef} aria-label={t('accounts.payment.records_aria')} aria-busy={loading} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
        {/* Header — the Trip Entry (Recent Trip Activity) header: the logo tile
            + heading, the count beside them, and the status toggle immediately
            beside the heading and count — then the toggle, in that order. */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">{t('accounts.payment.register_title')}</h3>
            </div>
            <span aria-live="polite" className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums">
              {loading ? t('accounts.payment.updating') : status === 'deleted' ? '—' : filtered.length}
            </span>
            {/* Status toggle — exactly beside the heading and count, then the
                toggle: the same order and spacing (ml-2) as trip entry. */}
            <div ref={statusGroupRef} role="group" aria-label={t('accounts.payment.status_aria')} className="flex items-center p-0.5 ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 shadow-sm">
              {PAYMENT_VIEWS.map(item => <Button key={item.value} variant="custom" size="sm" aria-pressed={status === item.value}
                className={`h-auto rounded-md px-5 py-1.5 text-xs font-semibold ${status === item.value ? item.selectedClass : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                onClick={() => { setSelectedId(null); setStatus(item.value); setPage(1); }}>
                {t(item.labelKey)}
              </Button>)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Row actions appear only once a row is selected — the same
                pattern as the trip entry table's Edit/Delete beside search. */}
            {selectedPayment && (
              <div role="group" aria-label={t('accounts.payment.selected_actions')} className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Pencil size={14} />} disabled={!canEditSelected}
                  onClick={() => { if (canEditSelected) setEditingPayment(selectedPayment); }}>{t('common.edit')}</Button>
                <Button variant="success" size="sm" icon={<CheckCircle2 size={14} />} disabled={!canApproveSelected}
                  onClick={() => { if (canApproveSelected) { setApprovalError(''); setApprovalPayment(selectedPayment); } }}>{t('common.approve')}</Button>
                <Button variant="destructiveOutline" size="sm" icon={<Trash2 size={14} />} disabled={!canDeleteSelected}
                  onClick={() => { if (canDeleteSelected) requestDelete(selectedPayment.id, { label: t('accounts.payment.deleting_to', { name: selectedPayment.paidTo }) }); }}>{t('common.delete')}</Button>
              </div>
            )}
          </div>
        </div>
        {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{t('accounts.payment.error_alert')}</p>}
        {status === 'deleted' ? <EmptyState title={t('accounts.payment.deleted_title')} description={t('accounts.payment.deleted_desc')} />
          : (<>
          <PaymentTable selectedId={selectedPayment?.id ?? null} onSelect={setSelectedId}
            emptyVariant={error ? 'error' : !payments.length ? 'no-data' : appliedFilters.search.trim() ? 'no-search' : 'no-filters'}
            payments={rows} loading={loading && !payments.length} error={error && !payments.length} onView={setViewingPayment} />
          {/* Global pagination, exactly as the Trip List renders it: the same
              shared component, shown only when there is more than one page,
              and blocked while a refresh is in flight. Fed the clamped page
              so the pager and the row window can never disagree. */}
          {shouldShowPagination(filtered.length) && (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={filtered.length}
              disabled={loading}
              onPageChange={next => { setSelectedId(null); setPage(next); }}
              onPageSizeChange={size => { setSelectedId(null); setPageSize(size); setPage(1); }}
            />
          )}
        </>
          )}
      </section>
      <Modal isOpen={pendingItems.length > 0} title={t('accounts.payment.delete_pending_title')} size="md"
        closeOnOverlay={false} showCloseButton={false} closeOnEscape={!pendingItems.some(item => item.committing)}
        onClose={() => pendingItems.filter(item => !item.committing).forEach(item => cancel(item.id))}
        footer={<Button variant="secondary" disabled={pendingItems.some(item => item.committing)} onClick={() => pendingItems.forEach(item => cancel(item.id))}>{t('accounts.payment.cancel_deletion')}</Button>}>
        <div className="space-y-3">{pendingItems.map(item => <div key={item.id}>
          <p className="text-sm font-medium text-slate-800">{item.label}</p>
          <p className="mt-2 text-sm text-slate-500" role="status">{item.committing ? t('accounts.payment.deleting') : `${pendingDeleteCountdownLabel(item.secondsLeft)}. ${t('accounts.payment.keep_payment')}`}</p>
        </div>)}</div>
      </Modal>
      <ConfirmDialog isOpen={!!approvalPayment} title={t('accounts.payment.approve_title')} tone="primary" confirmLabel={t('accounts.payment.approve_title')} loading={approving}
        record={approvalPayment ? `${paymentNoDisplay(approvalPayment.paymentNo)} · ${approvalPayment.paidTo} · ${paymentCurrency.format(approvalPayment.amount)}` : undefined}
        message={<>
          {t('accounts.payment.approve_message')}
          {approvalError && <span role="alert" className="mt-2 block text-rose-700">{approvalError}</span>}
        </>}
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
        editHint={viewingPayment && !isSample(viewingPayment) ? t('accounts.payment.edit_hint') : t('accounts.payment.edit_hint_busy')} />
    </div>
  );
}
