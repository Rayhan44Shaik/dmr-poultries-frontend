// src/modules/staff/pages/LeaveManagementPage.tsx

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useLeaveManagement } from '../hooks/useLeaveManagement';
import { leaveFiltersFromSearch } from '../utils/leaveDeepLink';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { useI18n } from '../../../i18n';
import { usePendingDelete } from '../../../hooks/usePendingDelete';
import { PendingDeleteNotification } from '../../../components/common/PendingDeleteNotification';
import LeaveFilters from '../components/leave/LeaveFilters';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import type { LeaveRequestInput } from '../components/leave/LeaveRequestForm';
import LeaveTable from '../components/leave/LeaveTable';
import LeaveTableHeader from '../components/leave/LeaveTableHeader';
import LeaveHistoryModal from '../components/leave/LeaveHistoryModal';
import LeaveRejectDialog from '../components/leave/LeaveRejectDialog';
import Pagination from '../components/common/Pagination';
import type { LeaveRequest } from '../types/staffDashboard';
import type { LeaveFilters as LeaveFilterState } from '../hooks/useLeaveManagement';
import { personNameLabel } from '../utils/leaveDisplay';

const REFRESH_TOAST_DURATION = 5000;

function LeaveManagementPage() {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const [searchParams] = useSearchParams();
  /* Read once: the hook seeds its state with these, so a later change of the
     toggle belongs to the user, not to the URL. */
  const initialFilters = useMemo(
    () => leaveFiltersFromSearch(searchParams.toString()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [showForm, setShowForm] = useState(false);
  const [refreshToast, setRefreshToast] = useState(false);

  const {
    leaves,
    loading,
    initialLoading,
    refreshing,
    error,
    filters,
    setFilter,
    commitSearch,
    resetFilters,
    employees,
    departments,
    addLeave,
    approveLeave,
    rejectLeave,
    deleteLeave,
    refresh,
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize,
  } = useLeaveManagement(showNotification, initialFilters, { includeReport: false });

  /** The one selected row — the page owns it because its actions live in the
   *  filter bar (beside Reset) rather than in a per-row Action column. */
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<LeaveRequest | null>(null);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);

  /** The table card — the only place a click keeps the row selected. */
  const tableAreaRef = useRef<HTMLDivElement | null>(null);

  /* Derived, never mirrored in state: a row that is no longer on the page simply
     has no selection, so a refresh or a filter change can never leave a phantom
     "selected" row behind. */
  const selectedLeave = useMemo(
    () => leaves.find((leave) => leave.id === selectedRowId) ?? null,
    [leaves, selectedRowId]
  );

  /**
   * Click anywhere outside the grid and the selected row lets go — the same
   * gesture the Trip List uses. Clicks that belong to the row (its action
   * cluster in the filter bar, the dialogs it opens, the undo notification)
   * keep it selected; a press on the table itself is handled by the row.
   * Escape is the keyboard twin of that click, and steps aside while one of the
   * row's dialogs is open so Escape keeps closing the dialog first.
   */
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (tableAreaRef.current?.contains(target)) return;
      if (target.closest('[data-leave-actions]')) return;
      if (target.closest('[role="dialog"]')) return;
      setSelectedRowId(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"]')) return;
      setSelectedRowId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Auto-hide the refresh toast
  useEffect(() => {
    if (!refreshToast) return;
    const timer = window.setTimeout(() => setRefreshToast(false), REFRESH_TOAST_DURATION);
    return () => window.clearTimeout(timer);
  }, [refreshToast]);

  /** Any query change starts a new list: drop the row actions with it. */
  const handleFilterChange = useCallback(
    <K extends keyof LeaveFilterState>(key: K, value: LeaveFilterState[K]) => {
      setSelectedRowId(null);
      setFilter(key, value);
    },
    [setFilter]
  );

  const onStatusChange = useCallback(
    (status: 'All' | 'Pending' | 'Approved' | 'Rejected') => {
      setSelectedRowId(null);
      setFilter('status', status);
    },
    [setFilter]
  );

  const handleSearch = useCallback(() => {
    setSelectedRowId(null);
    commitSearch();
  }, [commitSearch]);

  const handleReset = useCallback(() => {
    setSelectedRowId(null);
    resetFilters();
  }, [resetFilters]);

  const handleRefresh = useCallback(() => {
    setSelectedRowId(null);
    void refresh();
    setRefreshToast(true);
  }, [refresh]);

  const handlePageChange = useCallback(
    (next: number) => {
      setSelectedRowId(null);
      setPage(next);
    },
    [setPage]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setSelectedRowId(null);
      setPageSize(size);
      setPage(1);
    },
    [setPage, setPageSize]
  );

  const handleAddLeave = useCallback(
    async (data: LeaveRequestInput) => {
      const success = await addLeave({
        employeeId: data.employeeId,
        type: data.type,
        fromDate: data.fromDate,
        toDate: data.toDate,
        reason: data.reason,
      });
      if (success) setShowForm(false);
    },
    [addLeave]
  );

  const handleSelectRow = useCallback((leave: LeaveRequest | null) => {
    setSelectedRowId(leave ? leave.id : null);
  }, []);

  const handleViewSelected = useCallback(() => {
    if (!selectedLeave) {
      showNotification(t('staff.leave.select_first'), 'info');
      return;
    }
    setHistoryFor(selectedLeave);
  }, [selectedLeave, showNotification, t]);

  const handleApproveSelected = useCallback(() => {
    if (!selectedLeave) return;
    void approveLeave(selectedLeave.id);
  }, [approveLeave, selectedLeave]);

  const handleRejectSelected = useCallback(() => {
    if (!selectedLeave) return;
    setRejecting(selectedLeave);
  }, [selectedLeave]);

  const handleRejectConfirm = useCallback(
    (reason: string) => {
      const target = rejecting;
      setRejecting(null);
      if (target) void rejectLeave(target.id, reason);
    },
    [rejectLeave, rejecting]
  );

  /* Deleting from the toolbar still goes through the shared delayed-delete
     guard, so the row disappears only when the undo window closes. */
  const handleDelete = useCallback(async (id: string) => {
    await deleteLeave(id);
  }, [deleteLeave]);
  const { requestDelete, cancel, pendingItems } = usePendingDelete<string>(handleDelete);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedLeave) return;
    requestDelete(selectedLeave.id, {
      label: t('staff.leave.deleting_label', {
        name: personNameLabel(t, language, selectedLeave.employeeName),
      }),
    });
  }, [requestDelete, selectedLeave, t, language]);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* Filters — includes the search, the selected row's actions, Reset,
          New Request and Refresh inside the filter box */}
      <LeaveFilters
        filters={filters}
        employees={employees}
        departments={departments}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onReset={handleReset}
        onRefresh={handleRefresh}
        onNewRequest={() => setShowForm(!showForm)}
        loading={loading}
        showForm={showForm}
        selected={selectedLeave}
        onViewSelected={handleViewSelected}
        onApproveSelected={handleApproveSelected}
        onRejectSelected={handleRejectSelected}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* New request form */}
      {showForm && (
        <LeaveRequestForm
          employees={employees}
          onSubmit={handleAddLeave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Leave requests table */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          {error}
          <button onClick={handleRefresh} className="ml-2 font-semibold underline">
            {t('common.retry')}
          </button>
        </div>
      )}

      {initialLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div
          ref={tableAreaRef}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <LeaveTableHeader status={filters.status} onStatusChange={onStatusChange} count={total} />
          {/* Fixed-height progress line: it never pushes the table down, so a
              re-fetch shows activity without a gap or a jump. */}
          <div className="h-0.5 w-full bg-transparent">
            {refreshing && (
              <div className="h-full w-full animate-pulse bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />
            )}
          </div>

          {leaves.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-500">{t('staff.leave.empty_title')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('staff.leave.empty_hint')}</p>
            </div>
          ) : (
            <>
              <LeaveTable
                leaves={leaves}
                selectedId={selectedRowId}
                onSelectRow={handleSelectRow}
                onOpenRow={setHistoryFor}
                startIndex={(page - 1) * pageSize}
              />
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={pageSize}
                onPageChange={handlePageChange}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </div>
      )}

      {/* Selected row's leave history — mounted only while open, so it always
          starts on the current year/month and takes focus on the way in. */}
      {historyFor && (
        <LeaveHistoryModal
          leave={historyFor}
          leaves={leaves}
          onClose={() => setHistoryFor(null)}
        />
      )}

      {/* Rejection reason — replaces the blocking window.prompt */}
      {rejecting && (
        <LeaveRejectDialog
          leave={rejecting}
          onCancel={() => setRejecting(null)}
          onConfirm={handleRejectConfirm}
        />
      )}

      <PendingDeleteNotification items={pendingItems} onCancel={cancel} />

      {/* Refresh Toast — top right notification with close X */}
      {refreshToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[200] flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 size={16} />
          </span>
          <span className="text-sm font-semibold text-emerald-800">{t('staff.leave.refreshed')}</span>
          <button
            type="button"
            onClick={() => setRefreshToast(false)}
            aria-label={t('staff.leave.close_notification')}
            className="ml-2 p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default LeaveManagementPage;
