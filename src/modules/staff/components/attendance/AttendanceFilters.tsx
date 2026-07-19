// src/modules/staff/components/attendance/AttendanceFilters.tsx

import { memo } from 'react';
import { Calendar, Filter, RotateCcw } from 'lucide-react';

interface AttendanceFiltersProps {
  month: string;
  department: string;
  departments: string[];
  onMonthChange: (val: string) => void;
  onDepartmentChange: (val: string) => void;
  onReset: () => void;
}

function AttendanceFilters({
  month,
  department,
  departments,
  onMonthChange,
  onDepartmentChange,
  onReset,
}: AttendanceFiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <select
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onReset}
          className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

export default memo(AttendanceFilters);