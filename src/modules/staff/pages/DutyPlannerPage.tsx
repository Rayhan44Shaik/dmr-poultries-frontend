// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo } from 'react';
import { useDutyPlanner, isDateLocked } from '../hooks/useDutyPlanner'; 
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import { CheckCircle2, Info, Lock, Sparkles, ChevronLeft, ChevronRight, Users, UserX, CalendarDays } from 'lucide-react';
import type { DutyPlannerFilters as DutyPlannerFiltersType, DutyAssignment, Employee } from '../types/staffDashboard';
import type { AutoPlan } from '../services/dutyPlannerService';

function DutyPlannerPage() {
  const { showNotification } = useSafeNotification();

  const {
    employees,
    assignments,
    weekDays,
    loading,
    saving,
    filters,
    setFilters,
    getAssignment,
    updateAssignment,
    deleteAssignment,
    moveWeek,
    resetFilters,
    selectedCell,
    setSelectedCell,
    showPicker,
    setShowPicker,
    allRoles,
    weekStart,
    weekEnd,
    weekStatus,
    canEditWeek,
    saturday,
    validation,
    autoAssignAll,
    submitCurrentWeek,
  } = useDutyPlanner(showNotification);

  const [searchQuery, setSearchQuery] = useState('');
  const [lastAutoPlan, setLastAutoPlan] = useState<AutoPlan | null>(null);

  const handleCellClick = useCallback((employeeId: number, date: string) => {
    if (isDateLocked(date)) {
      showNotification('Cannot edit duties for previous completed weeks.', 'error');
      return;
    }
    if (!canEditWeek) {
      showNotification(`This week is ${weekStatus.toLowerCase()} and cannot be modified.`, 'error');
      return;
    }
    setSelectedCell({ employeeId, date });
    setShowPicker(true);
  }, [canEditWeek, weekStatus, setSelectedCell, setShowPicker, showNotification]);

  const handleSelectShift = useCallback((dutyType: string) => {
    if (!selectedCell) return;
    void updateAssignment(selectedCell.employeeId, selectedCell.date, dutyType as DutyAssignment['dutyType']).then((success) => {
      if (success) {
        setShowPicker(false);
        setSelectedCell(null);
      }
    });
  }, [selectedCell, updateAssignment, setSelectedCell, setShowPicker]);

  const handleRemoveDuty = useCallback(() => {
    if (!selectedCell) return;
    void deleteAssignment(selectedCell.employeeId, selectedCell.date).then((success) => {
      if (success) {
        setShowPicker(false);
        setSelectedCell(null);
      }
    });
  }, [selectedCell, deleteAssignment, setSelectedCell, setShowPicker]);

  const handleAutoAssign = useCallback(() => {
    void autoAssignAll().then((res) => {
      if (res.plan) setLastAutoPlan(res.plan);
      if (res.ok) setLastAutoPlan(res.plan ?? null);
    });
  }, [autoAssignAll]);

  const handleSubmitWeek = useCallback(() => {
    void submitCurrentWeek();
  }, [submitCurrentWeek]);

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

  // Display-only aggregations of backend truth (employees/assignments/saturday/
  // validation) — no duty-week business logic is reproduced here.
  const summary = useMemo(() => {
    const assignedEmpIds = new Set(assignments.map((a) => a.employeeId));
    const assignedCount = assignments.filter(
      (a) => a.dutyType !== 'WeeklyOff'
    ).length;
    return {
      total: employees.length,
      assigned: assignedCount,
      unassigned: employees.filter((e) => !assignedEmpIds.has(e.id)).length,
    };
  }, [employees, assignments]);

  const statusLabel =
    weekStatus === 'Closed'
      ? 'Closed'
      : weekStatus === 'Locked'
        ? 'Locked'
        : weekStatus === 'Submitted'
          ? 'Submitted'
          : weekStatus || 'Open';

  const statusClasses =
    weekStatus === 'Closed'
      ? 'bg-slate-100 text-slate-600 border-slate-200'
      : weekStatus === 'Locked'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : weekStatus === 'Submitted'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Duty Planner</h1>
          <p className="text-xs text-slate-500">Weekly workforce planning and duty allocation</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Week navigation + status strip */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => moveWeek(-1)}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Previous Week"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => resetFilters()}
              className="h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
              title="Current Week"
            >
              Current Week
            </button>
            <button
              onClick={() => moveWeek(1)}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Next Week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="text-sm font-semibold text-slate-800">
            Week: {weekStart} – {weekEnd}
          </div>
          <div className="ml-auto text-xs text-slate-400">
            {weekStatus === 'Closed'
              ? 'Week Closed — completed weeks are read-only.'
              : !canEditWeek
                ? `${statusLabel} — read-only.`
                : `${statusLabel} — editable.`}
          </div>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Employees" value={String(summary.total)} tone="bg-blue-50 text-blue-600" icon={<Users size={16} />} />
        <SummaryCard label="Assigned Duties" value={String(summary.assigned)} tone="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 size={16} />} />
        <SummaryCard label="Unassigned" value={String(summary.unassigned)} tone="bg-amber-50 text-amber-600" icon={<UserX size={16} />} />
        <SummaryCard
          label="Saturday"
          value={`${saturday.assigned} / ${saturday.required}`}
          sub={saturday.shortage > 0 ? `${saturday.shortage} short` : 'covered'}
          tone="bg-rose-50 text-rose-600"
          icon={<CalendarDays size={16} />}
        />
      </div>

      {/* Filter Section Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
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
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs overflow-hidden">
        <DutyPlannerGrid
          employees={filteredEmployees}
          weekDays={weekDays}
          getAssignment={getAssignment}
          onCellClick={handleCellClick}
          loading={loading}
          weekLocked={!canEditWeek}
        />
      </div>

      {/* Week Status & Actions */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Week {statusLabel}
          </div>
          {weekStatus === 'Closed' && (
            <span className="text-xs text-slate-500">
              Completed weeks are read-only.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleAutoAssign}
              disabled={!canEditWeek || loading || saving}
              className="h-10 px-4 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={15} />
              Auto Assign
            </button>
            <button
              onClick={handleSubmitWeek}
              disabled={!canEditWeek || loading || saving}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={15} />
              Submit Week
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Saturday Requirement</div>
            <div className="text-sm text-slate-700 mt-1">
              <span className="font-semibold">{saturday.assigned}</span> / {saturday.required} assigned
              {saturday.shortage > 0 && (
                <span className="ml-2 text-xs font-medium text-rose-600">({saturday.shortage} short)</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Week Validation</div>
            <div className="text-sm text-slate-700 mt-1">
              {validation.ok ? (
                <span className="font-semibold text-emerald-600">All checks passed</span>
              ) : (
                <span className="font-semibold text-rose-600">{validation.problems.length} issue(s) found</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Auto Assign</div>
            <div className="text-sm text-slate-700 mt-1">
              {lastAutoPlan ? (
                <span>
                  {lastAutoPlan.employeesAffected} employee(s) · Delivery {lastAutoPlan.delivery} · Repair {lastAutoPlan.repair} · Office {lastAutoPlan.office} · Collection {lastAutoPlan.collection}
                </span>
              ) : (
                <span className="text-slate-400">Run preview to see the plan</span>
              )}
            </div>
          </div>
        </div>

        {saturday.shortage > 0 && (
          <div className="bg-rose-50/80 border border-rose-200/80 rounded-lg p-2.5 text-xs text-rose-700 flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              Saturday requires <strong>{saturday.shortage} more</strong> assigned employee(s). Auto Assign preview will flag this as a conflict; the week cannot be submitted until it is resolved.
            </span>
          </div>
        )}

        {lastAutoPlan && lastAutoPlan.conflicts.length > 0 && (
          <div className="bg-rose-50/80 border border-rose-200/80 rounded-lg p-2.5 text-xs text-rose-700">
            <strong className="font-semibold">Auto Assign conflicts:</strong>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {lastAutoPlan.conflicts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {!validation.ok && validation.problems.length > 0 && (
          <div className="bg-rose-50/80 border border-rose-200/80 rounded-lg p-2.5 text-xs text-rose-700">
            <strong className="font-semibold">Validation issues:</strong>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {validation.problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {selectedCell && (
        <ShiftPicker
          isOpen={showPicker}
          onClose={handleClosePicker}
          onSelect={handleSelectShift}
          onRemove={getAssignment(selectedCell.employeeId, selectedCell.date)?.id ? handleRemoveDuty : undefined}
          currentDuty={getAssignment(selectedCell.employeeId, selectedCell.date)?.dutyType}
          date={selectedCell.date}
          employeeName={selectedEmployee ? selectedEmployee.employeeName : ''}
          employeeRole={selectedEmployee ? selectedEmployee.role : ''}
        />
      )}

      {/* Rules Section */}
      <div className="space-y-2">
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-3">
          <div className="bg-amber-100/70 p-1 rounded-lg shrink-0 text-amber-600">
            <Info size={15} />
          </div>
          <span className="leading-relaxed">
            <strong className="font-semibold text-amber-900">Important Rule:</strong> Saturday is compulsory duty. Rest and Weekly Off cannot be assigned on Saturday.
          </span>
        </div>

        <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-800 flex items-center gap-3">
          <div className="bg-blue-100/70 p-1 rounded-lg shrink-0 text-blue-600">
            <Lock size={15} />
          </div>
          <span className="leading-relaxed">
            <strong className="font-semibold text-blue-900">Week Lock Policy:</strong> Duties can be edited throughout the current week up until Sunday. Once a new week begins on Monday, previous weeks are automatically locked and read-only. Submitted weeks are read-only.
          </span>
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between shadow-sm">
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-extrabold text-slate-800 mt-1">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
      <div className={`p-2 rounded-lg ${tone}`}>{icon}</div>
    </div>
  );
}

export default DutyPlannerPage;