// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo } from 'react';
import { useDutyPlanner, isDateLocked } from '../hooks/useDutyPlanner'; 
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import type { DutyPlannerFilters as DutyPlannerFiltersType, Employee } from '../types/staffDashboard';

type DutyPlannerPageProps = { embedded?: boolean };

function DutyPlannerPage({ embedded = false }: DutyPlannerPageProps) {
  const { showNotification } = useSafeNotification();

  const {
    employees,
    weekDays,
    loading,
    filters,
    setFilters,
    getAssignment,
    updateAssignment,
    moveWeek,
    resetFilters,
    selectedCell,
    setSelectedCell,
    showPicker,
    setShowPicker,
    allRoles,
  } = useDutyPlanner(showNotification);

  const [searchQuery, setSearchQuery] = useState('');

  const handleCellClick = useCallback((employeeId: number, date: string) => {
    if (isDateLocked(date)) {
      showNotification('Cannot edit duties for previous completed weeks.', 'error');
      return;
    }
    setSelectedCell({ employeeId, date });
    setShowPicker(true);
  }, [setSelectedCell, setShowPicker, showNotification]);

  const handleSelectShift = useCallback((dutyType: string) => {
    if (!selectedCell) return;
    const success = updateAssignment(selectedCell.employeeId, selectedCell.date, dutyType as any);
    if (success) {
      setShowPicker(false);
      setSelectedCell(null);
    }
  }, [selectedCell, updateAssignment]);

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
    setSelectedCell(null);
  }, [setShowPicker, setSelectedCell]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const lowerQuery = searchQuery.toLowerCase();
    return employees.filter((emp: Employee) => 
      (emp.employeeName || '').toLowerCase().includes(lowerQuery)
    );
  }, [employees, searchQuery]);

  const selectedEmployee = useMemo(() => {
    if (!selectedCell) return null;
    return employees.find((e) => String(e.id) === String(selectedCell.employeeId)) || null;
  }, [selectedCell, employees]);

  const handleReset = useCallback(() => {
    resetFilters();
    setSearchQuery('');
  }, [resetFilters]);

  const content = (
    <div className="px-4 md:px-5 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <DutyPlannerFilters
            weekStart={filters.weekStart}
            role={filters.role}
            roles={allRoles}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onWeekStartChange={(val) =>
              setFilters((f: DutyPlannerFiltersType) => ({ ...f, weekStart: val }))
            }
            onRoleChange={(val) =>
              setFilters((f: DutyPlannerFiltersType) => ({ ...f, role: val }))
            }
            onMoveWeek={moveWeek}
            onReset={handleReset}
          />
        </div>
        <div className="p-4 sm:p-5">
          <DutyPlannerGrid
            employees={filteredEmployees}
            weekDays={weekDays}
            getAssignment={getAssignment}
            onCellClick={handleCellClick}
            loading={loading}
          />
        </div>
      </div>

      {selectedCell && (
        <ShiftPicker
          isOpen={showPicker}
          onClose={handleClosePicker}
          onSelect={handleSelectShift}
          currentDuty={getAssignment(selectedCell.employeeId, selectedCell.date)?.dutyType}
          date={selectedCell.date}
          employeeName={selectedEmployee ? (selectedEmployee.employeeName || (selectedEmployee as any).name) : ''}
          employeeRole={selectedEmployee ? selectedEmployee.role : ''}
        />
      )}

      <div className="space-y-3">
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-800 flex items-start sm:items-center gap-3 shadow-sm shadow-amber-100/50">
          <div className="bg-amber-100/70 p-1.5 rounded-lg shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a99 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="leading-relaxed">
            <strong className="font-semibold text-amber-900">Important Rule:</strong> Saturday is compulsory duty. Rest and Weekly Off cannot be assigned on Saturday.
          </span>
        </div>

        <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-800 flex items-start sm:items-center gap-3 shadow-sm shadow-blue-100/50">
          <div className="bg-blue-100/70 p-1.5 rounded-lg shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="leading-relaxed">
            <strong className="font-semibold text-blue-900">Week Lock Policy:</strong> Duties can be edited throughout the current week up until Sunday. Once a new week begins on Monday, previous weeks are automatically locked and read-only.
          </span>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;
  return content;
}

export default DutyPlannerPage;