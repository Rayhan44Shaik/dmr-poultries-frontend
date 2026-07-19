import  { memo } from 'react';
import { Calendar, RotateCcw } from 'lucide-react';

interface StaffDashboardFiltersProps {
  fromDate: string;
  toDate: string;
  department: string;
  departments: string[];
  setFromDate: (val: string) => void;
  setToDate: (val: string) => void;
  setDepartment: (val: string) => void;
  onReset: () => void;
}

function StaffDashboardFilters({
  fromDate,
  toDate,
  department,
  departments,
  setFromDate,
  setToDate,
  setDepartment,
  onReset,
}: StaffDashboardFiltersProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={onReset}
            className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(StaffDashboardFilters);