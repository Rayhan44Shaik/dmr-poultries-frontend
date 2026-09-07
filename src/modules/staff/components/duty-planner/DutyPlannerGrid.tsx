// src/modules/staff/components/duty-planner/DutyPlannerGrid.tsx

import { memo } from 'react';
import { getShiftConfigs, getShiftConfigsForRole } from '../../services/staffService';
import { isDateLocked } from '../../hooks/useDutyPlanner';
import type { DutyAssignment, Employee } from '../../types/staffDashboard';

interface DutyPlannerGridProps {
  employees: Employee[];
  weekDays: string[];
  getAssignment: (employeeId: number, date: string) => DutyAssignment | undefined;
  onCellClick: (employeeId: number, date: string) => void;
  loading: boolean;
  /** True when the backend locks the whole week (Submitted/Locked). */
  weekLocked?: boolean;
  /** True when the employee has an APPROVED leave on the date. An approved
   *  leave fills an empty cell as "Leave"; an assigned duty overrides it. */
  isOnLeave?: (employeeId: number, date: string) => boolean;
}

function DutyPlannerGrid({ employees, weekDays, getAssignment, onCellClick, loading, weekLocked = false, isOnLeave }: DutyPlannerGridProps) {
  const shiftConfigs = getShiftConfigs();

  const getShiftStyle = (dutyType: string, role?: string) => {
    // Core crew roles (Supervisor/Driver/Helper/Loader) use the Weekly Off ↔
    // Off colour swap; everyone else gets the base colours.
    const configs = role ? getShiftConfigsForRole(role) : shiftConfigs;
    const config = configs.find(s => s.type === dutyType);
    if (config) return { bg: config.bgColor, text: config.textColor, border: config.borderColor };
    // Custom "Other" types have no config — violet; empty cells stay grey.
    if (dutyType) return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
    return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
  }

  // Show the friendly label (Duty / Leave / Weekly Off …); custom "Other"
  // types have no config and are displayed exactly as typed.
  const getShiftLabel = (dutyType: string) =>
    shiftConfigs.find(s => s.type === dutyType)?.label || dutyType;;

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayNum = date.toLocaleDateString('en-IN', { day: '2-digit' });
    return { dayName, dayNum };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
        <div className="animate-pulse space-y-3 max-w-2xl mx-auto">
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
          <div className="h-8 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">No employees match filters.</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200" style={{ minWidth: '100%' }}>
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-20 w-48 min-w-[180px] border-r border-slate-200">
                Employee
              </th>
              {weekDays.map((day, idx) => {
                const { dayName, dayNum } = getDayLabel(day);
                return (
                  <th key={idx} className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[100px] max-w-[140px] relative">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-medium">{dayName}</span>
                      <span className="text-sm font-semibold text-slate-700">{dayNum}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white z-10 w-48 min-w-[180px] border-r border-slate-200">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-900 truncate">{emp.employeeName}</span>
                    <span className="text-xs text-slate-400 font-medium">{emp.role}</span>
                  </div>
                </td>
                {weekDays.map((day, idx) => {
                  const assignment = getAssignment(emp.id, day);
                  // An approved leave shows as "Leave" in an empty cell;
                  // an explicitly assigned duty always overrides the leave.
                  const leaveFilled = !assignment && !!isOnLeave?.(emp.id, day);
                  const dutyType = assignment?.dutyType || (leaveFilled ? 'Rest' : '');
                  const { bg, text, border } = getShiftStyle(dutyType, emp.role);
                  const locked = weekLocked || isDateLocked(day);

                  return (
                    <td key={idx} className="px-1.5 py-1.5 text-center min-w-[100px] max-w-[140px]">
                      <button
                        onClick={() => onCellClick(emp.id, day)}
                        disabled={locked}
                        className={`w-full h-10 min-h-[40px] rounded-lg text-xs font-medium border transition-all duration-150 ${
                          locked
                            ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-75 cursor-not-allowed'
                            : `${bg} ${text} ${border} hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`
                        }`}
                        title={
                          locked
                            ? 'Past week locked (cannot edit)'
                            : leaveFilled
                              ? 'Approved leave'
                              : ''
                        }
                        style={{ minWidth: '90px' }}
                      >
                        {dutyType ? (
                          getShiftLabel(dutyType)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(DutyPlannerGrid);