// src/modules/staff/pages/LeaveManagementPage.tsx

import { useState, useCallback } from 'react';
import { useLeaveManagement } from '../hooks/useLeaveManagement';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import LeaveFilters from '../components/leave/LeaveFilters';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import LeaveTable from '../components/leave/LeaveTable';
import { Plus } from 'lucide-react';

function LeaveManagementPage() {
  const { showNotification } = useSafeNotification();
  const [showForm, setShowForm] = useState(false);

  const {
    leaves,
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

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-2xs transition active:scale-95 cursor-pointer"
        >
          <Plus size={16} />
          {showForm ? 'Hide Form' : 'New Request'}
        </button>
      </div>

      <LeaveFilters
        filter={filter}
        search={search}
        onFilterChange={setFilter}
        onSearchChange={setSearch}
        onReset={handleReset}
      />

      {showForm && (
        <LeaveRequestForm
          employees={employees}
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
    </>
  );
}

export default LeaveManagementPage;