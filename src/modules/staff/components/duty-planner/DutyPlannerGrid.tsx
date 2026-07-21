// src/modules/staff/components/duty-planner/DutyPlannerGrid.tsx

import { memo } from 'react';
import { getShiftConfigs } from '../../services/staffService';
import { isDateLocked } from '../../hooks/useDutyPlanner';
import type { Employee } from '../../types/staffDashboard';

interface DutyPlannerGridProps {
  employees: Employee[];
  weekDays: string[];
  getAssignment: (employeeId: number, date: string) => any;
  onCellClick: (employeeId: number, date: string) => void;
  loading: boolean;
}

function DutyPlannerGrid({ employees, weekDays, getAssignment, onCellClick, loading }: DutyPlannerGridProps) {
  const shiftConfigs = getShiftConfigs();

  const getShiftStyle = (dutyType: string) => {
    const config = shiftConfigs.find(s => s.type === dutyType);
    if (!config) return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
    return { bg: config.bgColor, text: config.textColor, border: config.borderColor };
  };

  if (loading) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">Loading...</div>;
  }

  if (employees.length === 0) {
    return <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">No employees match filters.</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
              {weekDays.map((day, idx) => {
                const date = new Date(day);
                const label = date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' });
                const isSaturday = date.getDay() === 6;
                return (
                  <th key={idx} className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                    {label}
                    {isSaturday && <span className="block text-[10px] text-rose-500">(Compulsory)</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 text-sm font-medium text-slate-800 whitespace-nowrap">
                  {emp.employeeName}
                  <span className="block text-xs text-slate-400">{emp.role}</span>
                </td>
                {weekDays.map((day, idx) => {
                  const assignment = getAssignment(emp.id, day);
                  const dutyType = assignment?.dutyType || '';
                  const { bg, text, border } = getShiftStyle(dutyType);
                  const isSaturday = new Date(day).getDay() === 6;
                  const locked = isDateLocked(day);

                  return (
                    <td key={idx} className="px-1 py-1 text-center">
                      <button
                        onClick={() => onCellClick(emp.id, day)}
                        disabled={locked}
                        className={`w-full min-w-[60px] py-1.5 rounded-lg text-xs font-medium border transition ${
                          locked 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-75 cursor-not-allowed' 
                            : `${bg} ${text} ${border} hover:shadow-md active:scale-95`
                        } ${
                          isSaturday && (dutyType === 'Rest' || dutyType === 'WeeklyOff') ? 'opacity-50 line-through' : ''
                        }`}
                        title={
                          locked 
                            ? 'Past week locked (cannot edit)' 
                            : isSaturday 
                            ? 'Saturday – compulsory duty' 
                            : ''
                        }
                      >
                        {dutyType || '—'}
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