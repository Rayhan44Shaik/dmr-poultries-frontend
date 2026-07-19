import React, { useState, useEffect, useMemo } from 'react';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';
import { useStaffDashboardData } from '../hooks/useStaffDashboardData';
import StaffKPICards from '../components/StaffKPICards';
import DutyAllocationChart from '../components/DutyAllocationChart';
import WeeklyAttendanceChart from '../components/WeeklyAttendanceChart';
import OnDutyEmployeesTable from '../components/OnDutyEmployeesTable';
import StaffDashboardFilters from '../components/StaffDashboardFilters'; // ✅ File exists now

function StaffDashboardPage() {
  const { employees } = useEmployees();

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))],
    [employees]
  );

  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
    department: '',
  });

  const { data, isLoading, error, refetch } = useStaffDashboardData(filters);

  useEffect(() => {
    const interval = setInterval(refetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        <p>Error loading dashboard: {error}</p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-slate-500">
        No data available. Please adjust filters.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Staff Dashboard</h1>
        <span className="text-sm text-slate-500">
          Last updated: {new Date().toLocaleTimeString()}
        </span>
      </div>

      <StaffDashboardFilters
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        department={filters.department}
        departments={departments}
        setFromDate={(val: string) => setFilters((f) => ({ ...f, fromDate: val }))}
        setToDate={(val: string) => setFilters((f) => ({ ...f, toDate: val }))}
        setDepartment={(val: string) => setFilters((f) => ({ ...f, department: val }))}
        onReset={() => setFilters({ fromDate: today, toDate: today, department: '' })}
      />

      <StaffKPICards data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DutyAllocationChart data={data.dutyAllocation} />
        <WeeklyAttendanceChart data={data.weeklyAttendance} />
      </div>

      <OnDutyEmployeesTable employees={data.onDutyEmployees} />
    </div>
  );
}

export default React.memo(StaffDashboardPage);