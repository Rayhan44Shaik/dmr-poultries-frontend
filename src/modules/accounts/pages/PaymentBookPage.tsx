import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { Plus, History, Pencil, CheckCircle2, Trash2, Calendar, Wallet, CreditCard } from 'lucide-react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { PaymentTable } from '../components/payment-book/PaymentTable';
import { PaymentViewModal } from '../components/payment-book/PaymentViewModal';
import { PaymentEditModal } from '../components/payment-book/PaymentEditModal';
import { NewPaymentModal } from '../components/payment-book/NewPaymentModal';
import { deletePayment, listPayments, updatePayment } from '../services/paymentApiService';
import type { Payment } from '../types/payment.types';
import { DatePicker } from '../../../components/common/DatePicker';
import { canEditItem, canDeleteItem } from '../../../utils/dateUtils';
import { weekRange } from '../../../utils/businessDate';
import { FilterResetButton, countActiveFilters } from '../../../ui';
import { usePendingDelete } from '../../../hooks/usePendingDelete';
import { ConfirmDialog } from '../../../ui/ConfirmDialog';
import { Modal } from '../../../ui/Modal';
import { pendingDeleteCountdownLabel } from '../../../shared/ui/pendingDelete';
import { shouldShowPagination } from '../../../shared/ui/paginationStyles';
import MasterDropdown from '../../masters/components/MasterDropdown';
import '../../masters/styles/masters.css';
import { Button } from '../../../ui/Button';
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsPrimaryButtonClass,
} from '../../../shared/ui/operationsStyles';
import { useI18n } from '../../../i18n';
import { EmptyState } from '../../../ui/EmptyState';
import { BrandRefreshButton, Pagination } from '../../../ui';
import { filterPayments, localizePaymentType, PAYMENT_TYPES, PAYMENT_MODES, paymentCurrency, paymentNoDisplay } from '../utils/paymentRegister';

type PaymentView = 'pending' | 'approved' | 'deleted';
const PAYMENT_VIEWS: { value: PaymentView; labelKey: string; selectedClass: string }[] = [
  { value: 'pending', labelKey: 'status.pending', selectedClass: 'bg-orange-50/80 text-orange-500 shadow-sm' },
  { value: 'approved', labelKey: 'status.approved', selectedClass: 'bg-emerald-50/80 text-emerald-500 shadow-sm' },
  { value: 'deleted', labelKey: 'accounts.payment.status_deleted', selectedClass: 'bg-rose-50/80 text-rose-500 shadow-sm' },
];

export function PaymentBookPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const tableRef = useRef<HTMLElement>(null);
  const statusGroupRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approvalPayment, setApprovalPayment] = useState<Payment | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const approvingRef = useRef(false);
  const mounted = useRef(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const reloadAfterSave = useRef(false);
  // The register filters reactively: picking a date, type or mode updates the
  // rows and the count beside the heading immediately — no Search step.
  const [filters, setFilters] = useState(() => ({ ...weekRange(), type: '', mode: '' }));
  const [status, setStatus] = useState<PaymentView>('pending');
  const dateId = useId();
  // Filter control ids — the visible icon labels name these through htmlFor,
  // exactly like the Trip List's filter card.
  const typeFilterId = useId();
  const modeFilterId = useId();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // The existing list endpoint returns the dataset. Filter locally so search
  // covers all displayed fields and paging/filter changes make no requests.
  // Resolves true only when the dataset actually came back.
  const loadPayments = useCallback(async (afterMutation = false): Promise<boolean> => {
    if (!mounted.current) return false;
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
      showNotification(t('accounts.payment.notif_load_error'), 'error');
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
  // The trip list's refresh contract, kept identical: the hen button stays
  // plain (no loading prop, so it never pre-dances), and a finished refresh
  // confirms with the shared "Data refreshed" success notification.
  const handleRefresh = useCallback(() => {
    void loadPayments().then(ok => { if (ok) showNotification(t('notification.data_refreshed'), 'success'); });
  }, [loadPayments, showNotification, t]);

  const changeFilter = (key: keyof typeof filters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value }));
  };
  const clearFilters = () => {
    setSelectedId(null);
    setFilters({ ...weekRange(), type: '', mode: '' });
    setStatus('pending');
    setPage(1);
    showNotification(t('accounts.payment.notif_filters_cleared'), 'info');
  };
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  // No search field: the three date/type/mode filters ARE the whole query,
  // applied the moment any of them changes.
  const matched = useMemo(() => filterPayments(payments, { ...filters, search: '' }), [payments, filters]);
  const filtered = useMemo(() => {
    // UI views only: do not reclassify Paid/Cancelled as Approved/Deleted.
    if (status === 'deleted') return [];
    return matched.filter(payment => payment.status === (status === 'pending' ? 'Draft' : 'Approved'));
  }, [matched, status]);
  // Type options read in the active language; the raw value stays the filter
  // value so the API data is never touched. Modes stay in their stored form.
  const types = useMemo(() => [...new Set([...PAYMENT_TYPES, ...payments.map(p => p.paymentType)])].filter(Boolean)
    .map(value => ({ value, label: localizePaymentType(value, t) })), [payments, t]);
  const modes = useMemo(() => [...new Set([...PAYMENT_MODES, ...payments.map(p => p.paymentMode)])].filter(Boolean), [payments]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedPayment = rows.find(payment => payment.id === selectedId) ?? null;

  const handleSave = () => {
    setSelectedId(null);
    showNotification(t('accounts.payment.notif_saved'), 'success');
    // Rows reload from the server so the list always reflects the write.
    void loadPayments(true);
  };
  const { requestDelete, cancel, pendingItems, isPending } = usePendingDelete<string>(async id => {
    try {
      await deletePayment(id);
      showNotification(t('accounts.payment.notif_deleted'), 'success');
      void loadPayments(true);
    } catch {
      showNotification(t('accounts.payment.notif_delete_failed'), 'error');
    }
  });

  const selectedBusy = Boolean(selectedPayment && (isPending(selectedPayment.id) || approving));
  const canEditSelected = Boolean(selectedPayment && !selectedBusy && canEditItem(selectedPayment.createdAt));
  const canDeleteSelected = Boolean(selectedPayment && !selectedBusy && canDeleteItem(selectedPayment.createdAt));
  const canApproveSelected = Boolean(canEditSelected && selectedPayment?.status === 'Draft');

  const confirmApproval = async () => {
    const payment = approvalPayment;
    if (!payment || approvingRef.current) return;
    const current = payments.find(item => item.id === payment.id);
    if (!current || current.status !== 'Draft' || (!canEditItem(current.createdAt) || isPending(payment.id))) {
      setApprovalError(t('accounts.payment.approve_error_stale'));
      return;
    }
    approvingRef.current = true;
    setApproving(true);
    setApprovalError('');
    try {
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
      {/* The same filter card the Trip List uses (opsFilterCardClass): one
          labelled grid — icon + name per field — with the search row and every
          register action beneath it. Glyph motions come from the global
          tokens: search sways, reset spins, refresh is the brand hen. */}
      <section aria-label={t('accounts.payment.filters_aria')} className={opsFilterCardClass}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label htmlFor={`${dateId}-from`} className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t('accounts.payment.from')}</span>
            </label>
            <DatePicker
              id={`${dateId}-from`}
              value={filters.from}
              onChange={v => changeFilter('from', v)}
              placeholder="dd/mm/yyyy"
              className="w-full text-xs font-medium"
              openOnFocus={false}
              hideClear
            />
          </div>
          <div>
            <label htmlFor={`${dateId}-to`} className={opsFilterLabelClass}>
              <Calendar size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t('accounts.payment.to')}</span>
            </label>
            <DatePicker
              id={`${dateId}-to`}
              value={filters.to}
              onChange={v => changeFilter('to', v)}
              placeholder="dd/mm/yyyy"
              className="w-full text-xs font-medium"
              openOnFocus={false}
              hideClear
            />
          </div>
          <div>
            <label htmlFor={typeFilterId} className={opsFilterLabelClass}>
              <Wallet size={17} className="text-emerald-500 flex-shrink-0" />
              <span>{t('accounts.payment.all_types')}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t('accounts.payment.all_types')}
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
              <span>{t('accounts.payment.all_modes')}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t('accounts.payment.all_modes')}
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

        {/* No search field in this register: the date / type / mode filters
            apply themselves, so the actions row holds exactly New Payment,
            Reset and the brand Refresh. */}
        <div className="flex items-center gap-2 justify-end flex-wrap pt-1">
          <button type="button" onClick={() => setIsNewModalOpen(true)} className={`group relative ${opsPrimaryButtonClass}`} aria-label={t('accounts.payment.new')}>
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><Plus size={15} /></span>
            {t('accounts.payment.new')}
          </button>
          <FilterResetButton
            count={countActiveFilters(
              filters.type !== '',
              filters.mode !== '',
              filters.from !== weekRange().from || filters.to !== weekRange().to,
              status !== 'pending',
            )}
            onClick={clearFilters}
          />
          <BrandRefreshButton onClick={handleRefresh} />
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
            {/* Row actions appear only once a row is selected — the same
                pattern as the trip entry table's Edit/Delete beside search.
                Each icon plays its canonical action motion on hover. */}
            {selectedPayment && (
              <div role="group" aria-label={t('accounts.payment.selected_actions')} className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" className="group" disabled={!canEditSelected}
                  icon={<span className={`inline-flex ${canEditSelected ? 'motion-safe:group-hover:animate-[var(--animate-action-edit)]' : ''}`}><Pencil size={14} /></span>}
                  onClick={() => { if (canEditSelected) setEditingPayment(selectedPayment); }}>{t('common.edit')}</Button>
                <Button variant="success" size="sm" className="group" disabled={!canApproveSelected}
                  icon={<span className={`inline-flex ${canApproveSelected ? 'motion-safe:group-hover:animate-[var(--animate-action-approve)]' : ''}`}><CheckCircle2 size={14} /></span>}
                  onClick={() => { if (canApproveSelected) { setApprovalError(''); setApprovalPayment(selectedPayment); } }}>{t('common.approve')}</Button>
                <Button variant="destructiveOutline" size="sm" className="group" disabled={!canDeleteSelected}
                  icon={<span className={`inline-flex ${canDeleteSelected ? 'motion-safe:group-hover:animate-[var(--animate-action-delete)]' : ''}`}><Trash2 size={14} /></span>}
                  onClick={() => { if (canDeleteSelected) requestDelete(selectedPayment.id, { label: t('accounts.payment.deleting_to', { name: selectedPayment.paidTo }) }); }}>{t('common.delete')}</Button>
              </div>
            )}
          </div>
        </div>
        {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{t('accounts.payment.error_alert')}</p>}
        {status === 'deleted' ? <EmptyState title={t('accounts.payment.deleted_title')} description={t('accounts.payment.deleted_desc')} />
          : (<>
          <PaymentTable selectedId={selectedPayment?.id ?? null} onSelect={setSelectedId}
            startIndex={(safePage - 1) * pageSize}
            emptyVariant={error ? 'error' : !payments.length ? 'no-data' : 'no-filters'}
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
      <NewPaymentModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSave={handleSave} />
      <PaymentEditModal isOpen={!!editingPayment} payment={editingPayment} onClose={() => setEditingPayment(null)} onSave={handleSave} />
      {/* The sheet hands edit back to the register, which owns the row's
          eligibility rules; closing first keeps only one dialog mounted. */}
      <PaymentViewModal isOpen={!!viewingPayment} payment={viewingPayment} onClose={() => setViewingPayment(null)}
        onEdit={viewingPayment ? () => { const next = viewingPayment; setViewingPayment(null); setEditingPayment(next); } : undefined}
        canEdit={Boolean(viewingPayment && !isPending(viewingPayment.id) && !approving && canEditItem(viewingPayment.createdAt))}
        editHint={t('accounts.payment.edit_hint')} />
    </div>
  );
}
