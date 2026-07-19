// src/modules/staff/pages/LeaveManagementPage.tsx

import { useState, useCallback } from 'react';
import { useLeaveManagement } from '../hooks/useLeaveManagement'; // ✅ named import
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import LeaveStats from '../components/leave/LeaveStats';
import LeaveBalanceSummary from '../components/leave/LeaveBalanceSummary';
import LeaveFilters from '../components/leave/LeaveFilters';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import LeaveTable from '../components/leave/LeaveTable';
import { Plus } from 'lucide-react';

type LeaveManagementPageProps = { embedded?: boolean };

function LeaveManagementPage({ embedded = false }: LeaveManagementPageProps) {
  const { showNotification } = useSafeNotification();
  const [showForm, setShowForm] = useState(false);

  const {
    leaves,
    stats,
    totalBalances,
    filter,
    setFilter,
    search,
    setSearch,
    loading,
    addLeave,
    approveLeave,
    rejectLeave,
    deleteLeave,
    employees,
  } = useLeaveManagement(showNotification);

  const handleAddLeave = useCallback(
    (data: any) => {
      const success = addLeave(data);
      if (success) setShowForm(false);
    },
    [addLeave]
  );

  const handleApprove = useCallback((id: string) => {
    approveLeave(id);
  }, [approveLeave]);

  const handleReject = useCallback((id: string, reason: string) => {
    rejectLeave(id, reason);
  }, [rejectLeave]);

  const handleDelete = useCallback((id: string) => {
    deleteLeave(id);
  }, [deleteLeave]);

  const handleReset = () => {
    setFilter('Pending');
    setSearch('');
  };

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-sm text-slate-500">Manage employee leave requests and balances</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
        >
          <Plus size={16} />
          {showForm ? 'Hide Form' : 'New Request'}
        </button>
      </div>

      <LeaveStats stats={stats} />
      <LeaveBalanceSummary balances={totalBalances} />

      <LeaveFilters
        filter={filter}
        search={search}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
        onReset={handleReset}
      />

      {showForm && (
        <LeaveRequestForm
          employees={employees.map((e: any) => ({ id: e.id, name: e.employeeName }))}
          onSubmit={handleAddLeave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <LeaveTable
          leaves={leaves}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
        />
      )}
    </div>
  );

  if (embedded) return content;
  return content;
}

export default LeaveManagementPage;