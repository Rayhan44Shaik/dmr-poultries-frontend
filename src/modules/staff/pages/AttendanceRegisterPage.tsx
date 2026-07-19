// src/modules/staff/pages/AttendanceRegisterPage.tsx

import { useMemo } from 'react';
import { useAttendanceRegister } from '../hooks/useAttendanceRegister';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import AttendanceFilters from '../components/attendance/AttendanceFilters';
import AttendanceMatrix from '../components/attendance/AttendanceMatrix';

type AttendanceRegisterPageProps = { embedded?: boolean };

function AttendanceRegisterPage({ embedded = false }: AttendanceRegisterPageProps) {
  const { showNotification } = useSafeNotification();

  const {
    month,
    setMonth,
    department,
    setDepartment,
    employees,
    dayNumbers,
    loading,
    getEmployeeRecord,
    updateDayStatus,
    // getStatusColor,  // ✅ removed – not used
    refresh,
    resetFilters,
  } = useAttendanceRegister(showNotification);

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts);
  }, [employees]);

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Register</h1>
          <p className="text-sm text-slate-500">Manage monthly attendance for employees</p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm transition active:scale-95"
        >
          Refresh
        </button>
      </div>

      <AttendanceFilters
        month={month}
        department={department}
        departments={departments}
        onMonthChange={setMonth}
        onDepartmentChange={setDepartment}
        onReset={resetFilters}
      />

      <AttendanceMatrix
        employees={employees}
        dayNumbers={dayNumbers}
        getEmployeeRecord={getEmployeeRecord}
        updateDayStatus={updateDayStatus}
        loading={loading}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-3 text-xs text-slate-500 flex flex-wrap gap-4">
        <span>P = Present</span>
        <span>A = Absent</span>
        <span>H = Half Day</span>
        <span>L = Leave</span>
        <span>WO = Weekly Off</span>
        <span className="text-blue-600">Click any cell to cycle through statuses.</span>
      </div>
    </div>
  );

  if (embedded) return content;
  return content;
}

export default AttendanceRegisterPage;