// src/modules/staff/components/duty-planner/DutyPlannerFilters.tsx

import { memo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Filter } from 'lucide-react';

interface DutyPlannerFiltersProps {
  weekStart: string;
  department: string;
  role: string;
  departments: string[];
  roles: string[];
  onWeekStartChange: (val: string) => void;
  onDepartmentChange: (val: string) => void;
  onRoleChange: (val: string) => void;
  onMoveWeek: (direction: -1 | 1) => void;
  onReset: () => void;
}

function DutyPlannerFilters({
  weekStart,
  department,
  role,
  departments,
  roles,
  onWeekStartChange,
  onDepartmentChange,
  onRoleChange,
  onMoveWeek,
  onReset,
}: DutyPlannerFiltersProps) {
  const formatWeekLabel = (start: string) => {
    const startDate = new Date(start);
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 6);
    return `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => onMoveWeek(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => onWeekStartChange(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
          />
          <button onClick={() => onMoveWeek(1)} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
          <span className="text-sm font-medium text-slate-700 ml-2">{formatWeekLabel(weekStart)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter size={14} /><span>Filter:</span>
          </div>
          <select
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
          >
            <option value="">All Roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={onReset} className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition flex items-center gap-1">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(DutyPlannerFilters);