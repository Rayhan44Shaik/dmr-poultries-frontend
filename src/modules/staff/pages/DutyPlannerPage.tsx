// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo } from 'react';
import { useDutyPlanner, isDateLocked } from '../hooks/useDutyPlanner'; 
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import PageLayout from '../../../components/common/PageLayout';
import { Info, Lock } from 'lucide-react';
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

  // Main content without PageLayout wrapper (for embedded mode)
  const content = (
    <>
      {/* Filter Section Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 py-3 px-5 sm:py-4 sm:px-6 shadow-sm space-y-3 backdrop-blur-xs">
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

      {/* Grid Section Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm overflow-hidden">
        <DutyPlannerGrid
          employees={filteredEmployees}
          weekDays={weekDays}
          getAssignment={getAssignment}
          onCellClick={handleCellClick}
          loading={loading}
        />
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

      <div className="space-y-3 pb-8">
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-800 flex items-start sm:items-center gap-3 shadow-2xs">
          <div className="bg-amber-100/70 p-1.5 rounded-xl shrink-0 text-amber-600">
            <Info size={16} />
          </div>
          <span className="leading-relaxed">
            <strong className="font-semibold text-amber-900">Important Rule:</strong> Saturday is compulsory duty. Rest and Weekly Off cannot be assigned on Saturday.
          </span>
        </div>

        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-800 flex items-start sm:items-center gap-3 shadow-2xs">
          <div className="bg-blue-100/70 p-1.5 rounded-xl shrink-0 text-blue-600">
            <Lock size={16} />
          </div>
          <span className="leading-relaxed">
            <strong className="font-semibold text-blue-900">Week Lock Policy:</strong> Duties can be edited throughout the current week up until Sunday. Once a new week begins on Monday, previous weeks are automatically locked and read-only.
          </span>
        </div>
      </div>
    </>
  );

  // If embedded in a tab container, render without PageLayout (staff master handles spacing)
  if (embedded) {
    return <div className="space-y-6 w-full">{content}</div>;
  }

  // Standalone mode: wrap with PageLayout
  return <PageLayout>{content}</PageLayout>;
}

export default DutyPlannerPage;