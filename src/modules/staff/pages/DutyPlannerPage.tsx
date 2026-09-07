// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDutyPlanner, isDateLocked } from '../hooks/useDutyPlanner';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import { getShiftConfigs } from '../services/staffService';
import type { SampleMonthDuties } from '../services/staffSampleData';
import { CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, CalendarDays } from 'lucide-react';
import type { DutyPlannerFilters as DutyPlannerFiltersType, DutyAssignment, Employee } from '../types/staffDashboard';

function DutyPlannerPage() {
  const { showNotification } = useSafeNotification();

  const {
    employees,
    weekDays,
    loading,
    saving,
    usingSampleData,
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
    weekStatus,
    canEditWeek,
    unassignedCount,
    isOnApprovedLeave,
    getMonthDuties,
    validation,
    submitCurrentWeek,
  } = useDutyPlanner(showNotification);

  const [searchQuery, setSearchQuery] = useState('');

  /* ----- Week / Month view ----- */
  const [view, setView] = useState<'week' | 'month'>('week');
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [monthData, setMonthData] = useState<SampleMonthDuties | null>(null);
  const [monthError, setMonthError] = useState(false);

  // Keep the latest notify in a ref so the fetch effect never re-runs on render.
  const notifyRef = useRef(showNotification);
  useEffect(() => {
    notifyRef.current = showNotification;
  });

  useEffect(() => {
    if (view !== 'month') return;
    let cancelled = false;
    void getMonthDuties(monthCursor.y, monthCursor.m)
      .then((data) => {
        if (!cancelled) {
          setMonthError(false);
          setMonthData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMonthError(true);
          setMonthData(null);
          notifyRef.current('Could not load month duties.', 'error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view, monthCursor, getMonthDuties]);

  const monthStale = !monthData || monthData.year !== monthCursor.y || monthData.month !== monthCursor.m;

  const monthLabel = new Date(monthCursor.y, monthCursor.m, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const prevMonth = () =>
    setMonthCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () =>
    setMonthCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));



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

  const handleSubmitWeek = useCallback(() => {
    void submitCurrentWeek();
  }, [submitCurrentWeek]);

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
    setSelectedCell(null);
  }, [setShowPicker, setSelectedCell]);

  const handleReset = useCallback(() => {
    resetFilters();
    setSearchQuery('');
  }, [resetFilters]);

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

  const formatWeekRange = (start: string) => {
    if (!start) return '';
    const startDate = new Date(start);
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 6);
    return `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="w-full space-y-4 bg-slate-50/30 min-h-screen pb-8">
      {/* Toolbar - Week / Month views */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {view === 'week' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => moveWeek(-1)}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Previous Week"
              aria-label="Previous week"
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
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Previous Month"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 whitespace-nowrap">
              <CalendarDays size={16} className="text-slate-400" />
              {monthLabel}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Next Month"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Week / Month view toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 transition ${view === 'week' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 transition ${view === 'month' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Month
            </button>
          </div>
          {view === 'week' ? (
            <>
              <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                Week: {formatWeekRange(weekStart)}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClasses}`}>
                {statusLabel}
              </span>
              {usingSampleData && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200"
                  title="Backend unavailable — showing local sample data (edits are kept in memory only)"
                >
                  Sample data
                </span>
              )}
              {!canEditWeek && weekStatus !== 'Open' && (
                <span className="text-xs text-slate-400 hidden sm:inline">read-only</span>
              )}
            </>
          ) : (
            usingSampleData && (
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200"
                title="Backend unavailable — showing local sample data"
              >
                Sample data
              </span>
            )
          )}
        </div>
      </div>

      {/* Filter Bar - Clean and compact */}
      <DutyPlannerFilters
        role={filters.role}
        roles={allRoles}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRoleChange={(val) =>
          setFilters((f: DutyPlannerFiltersType) => ({ ...f, role: val }))
        }
        onReset={handleReset}
      />

      {/* Duty Calendar - Main focus (week) / monthly analysis (month) */}
      {view === 'week' ? (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <DutyPlannerGrid
            employees={filteredEmployees}
            weekDays={weekDays}
            getAssignment={getAssignment}
            onCellClick={handleCellClick}
            loading={loading}
            weekLocked={!canEditWeek}
            isOnLeave={isOnApprovedLeave}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-x-auto">
          {monthError ? (
            <div className="p-12 text-center text-sm text-rose-600">Could not load month duties.</div>
          ) : monthStale ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading month…</div>
          ) : (
            <>
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 min-w-[150px]">
                      Employee
                    </th>
                    {monthData.days.map((d) => (
                      <th key={d.date} className="px-0.5 py-2 text-center min-w-[30px]">
                        <div className="text-[9px] font-medium text-slate-400">{d.weekday}</div>
                        <div className="text-[11px] font-semibold text-slate-600">{d.dayNum}</div>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 min-w-[110px]">
                      Summary
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const cells = monthData.byEmployee[emp.id];
                    if (!cells) return null;
                    const work = cells.filter(
                      (c) => c.dutyType && c.dutyType !== 'Rest' && c.dutyType !== 'WeeklyOff' && c.dutyType !== 'Off'
                    ).length;
                    const leave = cells.filter((c) => c.dutyType === 'Rest').length;
                    const off = cells.filter((c) => c.dutyType === 'Off').length;
                    const wo = cells.filter((c) => c.dutyType === 'WeeklyOff').length;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 truncate max-w-[160px]">{emp.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{emp.role}</div>
                        </td>
                        {cells.map((c) => {
                          const cfg = c.dutyType ? getShiftConfigs().find((s) => s.type === c.dutyType) : undefined;
                          const cls = cfg
                            ? `${cfg.bgColor} ${cfg.borderColor}`
                            : c.dutyType
                              ? 'bg-violet-50 border-violet-200'
                              : 'bg-slate-50 border-slate-100';
                          return (
                            <td key={c.date} className="px-0.5 py-1">
                              <div
                                title={`${emp.employeeName} — ${c.date}: ${
                                  cfg ? cfg.label : c.dutyType ?? 'No duty'
                                }${c.isLeave ? ' (approved leave)' : ''}`}
                                className={`h-6 rounded border ${cls}`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-[10.5px] text-slate-500 whitespace-nowrap">
                          <span className="font-semibold text-slate-700">{work}d</span> duty
                          {' · '}
                          <span className="font-semibold text-slate-700">{leave}d</span> leave
                          {off > 0 && (
                            <>
                              {' · '}
                              <span className="font-semibold text-purple-700">{off}d</span> off
                            </>
                          )}
                          {wo > 0 && (
                            <>
                              {' · '}
                              <span className="font-semibold text-slate-700">{wo}d</span> weekly off
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
                {getShiftConfigs()
                  .filter((s) => !['Driver', 'OfficeDuty', 'Collection'].includes(s.type))
                  .map((s) => (
                    <span key={s.type} className="inline-flex items-center gap-1.5">
                      <span className={`h-3 w-5 rounded border ${s.bgColor} ${s.borderColor}`} />
                      {s.label}
                    </span>
                  ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-5 rounded border bg-violet-50 border-violet-200" />
                  Other
                </span>
                <span className="text-slate-400">
                  An assigned duty overrides an approved leave; leave days with no duty show as Leave.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Week Actions - Compact row (week view only) */}
      {view === 'week' && (
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={handleSubmitWeek}
          disabled={!canEditWeek || loading || saving || unassignedCount > 0}
          title={
            unassignedCount > 0
              ? `Assign duties for all days first — ${unassignedCount} day(s) still empty`
              : 'Submit this week'
          }
          className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={15} />
          Submit Week
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {unassignedCount > 0 ? (
            <span
              className="flex items-center gap-1.5 text-amber-600"
              title="Every employee needs a duty on every day before the week can be submitted"
            >
              <AlertCircle size={12} />
              {unassignedCount} of {employees.length * weekDays.length} day(s) without duty — assign all to submit
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 size={12} />
              All duties assigned — ready to submit
            </span>
          )}
          {!validation.ok && (
            <span className="flex items-center gap-1.5 text-rose-600 ml-2 border-l border-slate-200 pl-2">
              <AlertCircle size={12} />
              {validation.problems.length} issue(s)
            </span>
          )}
        </div>
      </div>
      )}

      {/* Validation issues - week view only */}
      {view === 'week' && !validation.ok && validation.problems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3">
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
      )}

      {/* Shift Picker Modal */}
      {selectedCell && (
        <ShiftPicker
          isOpen={showPicker}
          onClose={handleClosePicker}
          onSelect={handleSelectShift}
          onRemove={getAssignment(selectedCell.employeeId, selectedCell.date)?.id ? handleRemoveDuty : undefined}
          currentDuty={
            getAssignment(selectedCell.employeeId, selectedCell.date)?.dutyType ??
            (isOnApprovedLeave(selectedCell.employeeId, selectedCell.date) ? 'Rest' : undefined)
          }
          date={selectedCell.date}
          employeeName={selectedEmployee ? selectedEmployee.employeeName : ''}
          employeeRole={selectedEmployee ? selectedEmployee.role : ''}
        />
      )}
    </div>
  );
}

export default DutyPlannerPage;