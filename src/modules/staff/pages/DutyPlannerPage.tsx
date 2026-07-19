// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo } from 'react';
import { useDutyPlanner } from '../hooks/useDutyPlanner';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import AutoAssignButton from '../components/duty-planner/AutoAssignButton';

type DutyPlannerPageProps = { embedded?: boolean };

function DutyPlannerPage({ embedded = false }: DutyPlannerPageProps) {
  const { showNotification } = useSafeNotification();

  const {
    employees,
    // assignments,   // ❌ not used in this page – we use getAssignment
    weekDays,
    loading,
    filters,
    setFilters,
    getAssignment,
    updateAssignment,
    autoAssign,
    moveWeek,
    resetFilters,
    selectedCell,
    setSelectedCell,
    showPicker,
    setShowPicker,
  } = useDutyPlanner(showNotification);

  const handleCellClick = useCallback((employeeId: number, date: string) => {
    setSelectedCell({ employeeId, date });
    setShowPicker(true);
  }, [setSelectedCell, setShowPicker]);

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

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts);
  }, [employees]);

  const roles = useMemo(() => {
    const r = new Set(employees.map(e => e.role).filter(Boolean));
    return Array.from(r);
  }, [employees]);

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Duty Planner</h1>
          <p className="text-sm text-slate-500">Manage weekly employee duty schedules</p>
        </div>
        <AutoAssignButton onClick={autoAssign} disabled={loading || employees.length === 0} />
      </div>

      <DutyPlannerFilters
        weekStart={filters.weekStart}
        department={filters.department}
        role={filters.role}
        departments={departments}
        roles={roles}
        onWeekStartChange={(val) => setFilters(f => ({ ...f, weekStart: val }))}
        onDepartmentChange={(val) => setFilters(f => ({ ...f, department: val }))}
        onRoleChange={(val) => setFilters(f => ({ ...f, role: val }))}
        onMoveWeek={moveWeek}
        onReset={resetFilters}
      />

      <DutyPlannerGrid
        employees={employees}
        weekDays={weekDays}
        getAssignment={getAssignment}
        onCellClick={handleCellClick}
        loading={loading}
      />

      {selectedCell && (
        <ShiftPicker
          isOpen={showPicker}
          onClose={handleClosePicker}
          onSelect={handleSelectShift}
          currentDuty={getAssignment(selectedCell.employeeId, selectedCell.date)?.dutyType}
          date={selectedCell.date}
        />
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-center gap-2">
        <span className="font-medium">📌 Note:</span> Saturday is compulsory duty. Rest and Weekly Off cannot be assigned on Saturday.
      </div>
    </div>
  );

  if (embedded) return content;
  return content;
}

export default DutyPlannerPage;