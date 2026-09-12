// src/modules/staff/pages/LeaveManagementPage.tsx

import { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useLeaveManagement } from '../hooks/useLeaveManagement';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import LeaveFilters from '../components/leave/LeaveFilters';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import type { LeaveRequestInput } from '../components/leave/LeaveRequestForm';
import LeaveTable from '../components/leave/LeaveTable';
import Pagination from '../components/common/Pagination';

const REFRESH_TOAST_DURATION = 5000;

function LeaveManagementPage() {
  const { showNotification } = useSafeNotification();
  const [showForm, setShowForm] = useState(false);
  const [refreshToast, setRefreshToast] = useState(false);

  const {
    leaves,
    loading,
    error,
    filters,
    setFilter,
    resetFilters,
    employees,
    departments,
    addLeave,
    approveLeave,
    rejectLeave,
    deleteLeave,
    cancelLeave,
    refresh,
    stats,
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize,
  } = useLeaveManagement(showNotification);

  // Auto-hide the refresh toast
  useEffect(() => {
    if (!refreshToast) return;
    const timer = window.setTimeout(() => setRefreshToast(false), REFRESH_TOAST_DURATION);
    return () => window.clearTimeout(timer);
  }, [refreshToast]);

  const handleRefresh = useCallback(() => {
    void refresh();
    setRefreshToast(true);
  }, [refresh]);

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

  const handleApprove = useCallback(
    (id: string) => { void approveLeave(id); },
    [approveLeave]
  );

  const handleReject = useCallback(
    (id: string, reason: string) => { void rejectLeave(id, reason); },
    [rejectLeave]
  );

  const handleDelete = useCallback(
    (id: string) => deleteLeave(id),
    [deleteLeave]
  );

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {/* Filters — includes Reset, New Request, Refresh inside the filter box */}
      <LeaveFilters
        filters={filters}
        employees={employees}
        departments={departments}
        onFilterChange={setFilter}
        onReset={resetFilters}
        onRefresh={handleRefresh}
        onNewRequest={() => setShowForm(!showForm)}
        loading={loading}
        showForm={showForm}
        stats={stats}
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
          <button onClick={handleRefresh} className="ml-2 font-semibold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm font-medium text-slate-500">No leave requests found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or create a new request.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <LeaveTable
            leaves={leaves}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
            onCancel={(id) => { void cancelLeave(id); }}
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={pageSize}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Refresh Toast — top right notification with close X */}
      {refreshToast && (
        <div className="fixed right-4 top-4 z-[200] flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 size={16} />
          </span>
          <span className="text-sm font-semibold text-emerald-800">Leave Management Refreshed</span>
          <button
            type="button"
            onClick={() => setRefreshToast(false)}
            aria-label="Close notification"
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
