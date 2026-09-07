// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDutyPlanner, isDateLocked } from '../hooks/useDutyPlanner';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters, { type DutyPlannerView } from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import DutyPlannerReportTable from '../components/duty-planner/DutyPlannerReportTable';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import { filterDutyEmployees, formatDutyDate, getDutyRangeError, todayStr, type DutyReportData, type DutyReportRange } from '../services/dutyReport';
import { CheckCircle2, AlertCircle, LoaderCircle, RefreshCw, LockKeyhole } from 'lucide-react';
import type { DutyPlannerFilters as DutyPlannerFiltersType, DutyAssignment } from '../types/staffDashboard';

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
    weekStatus,
    canEditWeek,
    unassignedCount,
    isOnApprovedLeave,
    getRangeDuties,
    prevWeekClosed,
    prevWeekStart,
    validation,
    submitCurrentWeek,
  } = useDutyPlanner(showNotification);

  const [searchQuery, setSearchQuery] = useState('');

  /* ----- Week / Month / Custom-range views ----- */
  const [view, setView] = useState<DutyPlannerView>('week');
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [customRange, setCustomRange] = useState<DutyReportRange>(() => ({
    fromDate: `${todayStr().slice(0, 7)}-01`, toDate: todayStr(),
  }));
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [reportState, setReportState] = useState<{
    key: string;
    loader: typeof getRangeDuties;
    data: DutyReportData | null;
    error: string | null;
  } | null>(null);

  const range = useMemo<DutyReportRange>(() => {
    if (view === 'custom') return customRange;
    if (view === 'month') return {
      fromDate: new Date(Date.UTC(monthCursor.y, monthCursor.m, 1)).toISOString().slice(0, 10),
      toDate: new Date(Date.UTC(monthCursor.y, monthCursor.m + 1, 0)).toISOString().slice(0, 10),
    };
    const end = new Date(`${filters.weekStart}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { fromDate: filters.weekStart, toDate: end.toISOString().slice(0, 10) };
  }, [view, customRange, monthCursor, filters.weekStart]);
  const { fromDate, toDate } = range;
  const rangeError = getDutyRangeError(range);
  const reportKey = `${fromDate}:${toDate}:${refreshKey}`;

  // A prior range, source or retry must never remain exportable while a new
  // report loads. Cancellation also protects rapid month/date changes.
  const notifyRef = useRef(showNotification);
  useEffect(() => { notifyRef.current = showNotification; });
  useEffect(() => {
    if (loading || rangeError) return;
    let cancelled = false;
    const controller = new AbortController();
    void getRangeDuties({ fromDate, toDate }, controller.signal)
      .then((data) => {
        if (!cancelled) setReportState({ key: reportKey, loader: getRangeDuties, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load duty report.';
          setReportState({ key: reportKey, loader: getRangeDuties, data: null, error: message });
          notifyRef.current('Could not load the duty report. Please retry before exporting.', 'error');
        }
      });
    return () => { cancelled = true; controller.abort(); };
  }, [fromDate, toDate, reportKey, rangeError, getRangeDuties, loading]);

  const reportCurrent = !loading && !rangeError && reportState?.key === reportKey && reportState?.loader === getRangeDuties;
  const reportData = reportCurrent ? reportState.data : null;
  const reportError = reportCurrent ? reportState.error : null;
  const today = todayStr();
  const asOfLabel = formatDutyDate(today);
  const monthLabel = new Date(monthCursor.y, monthCursor.m, 1).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric',
  });
  const prevMonth = () => setMonthCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setMonthCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));

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

  const filteredEmployees = useMemo(
    () => filterDutyEmployees(employees, filters.role, searchQuery),
    [employees, filters.role, searchQuery],
  );
  const reportEmployees = useMemo(
    () => filterDutyEmployees(reportData?.employees ?? [], filters.role, searchQuery),
    [reportData, filters.role, searchQuery],
  );
  // Export exactly the rows shown in the active table. The range report can
  // contain historical employees that are not part of the editable week roster.
  const tableEmployees = view === 'week' ? filteredEmployees : reportEmployees;
  const canDownloadExcel = !!reportData && tableEmployees.length > 0 && !saving && !exporting;

  const handleDownloadExcel = async () => {
    if (!canDownloadExcel || !reportData) return;
    setExporting(true);
    try {
      const { downloadDutyExcel } = await import('../services/dutyReportExcel');
      await downloadDutyExcel({
        data: reportData,
        employees: tableEmployees,
        asOf: today,
        filterLabel: `Roles: ${filters.role.length ? filters.role.join(', ') : 'All'}${searchQuery.trim() ? ` | Employee search: ${searchQuery.trim()}` : ''}`,
      });
      showNotification('Duty Planner Excel downloaded successfully.', 'success');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Could not export Duty Planner to Excel. Please retry.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const selectedEmployee = useMemo(() => {
    if (!selectedCell) return null;
    return employees.find((e) => String(e.id) === String(selectedCell.employeeId)) || null;
  }, [selectedCell, employees]);

  // This week is locked until the previous week is closed.
  const gatedByPrevWeek =
    !loading && !prevWeekClosed && (weekStatus === 'Open' || weekStatus === 'Draft' || weekStatus === '');

  const statusLabel =
    gatedByPrevWeek
      ? 'Locked — close previous week'
      : weekStatus === 'Closed'
        ? 'Closed'
        : weekStatus === 'Locked'
          ? 'Locked'
          : weekStatus === 'Submitted'
            ? 'Submitted'
            : weekStatus || 'Open';

  const statusClasses =
    gatedByPrevWeek
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : weekStatus === 'Closed'
        ? 'bg-slate-100 text-slate-600 border-slate-200'
        : weekStatus === 'Locked'
          ? 'bg-slate-100 text-slate-600 border-slate-200'
          : weekStatus === 'Submitted'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const formatWeekRange = (start: string, compact = false) => {
    if (!start) return '';
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const sameYear = startDate.getUTCFullYear() === endDate.getUTCFullYear();
    const sameMonth = sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();
    const startLabel = compact ? startDate.toLocaleDateString('en-IN', {
      day: '2-digit', month: sameMonth ? undefined : 'short',
      year: sameYear ? undefined : 'numeric', timeZone: 'UTC',
    }) : formatDutyDate(start);
    return `${startLabel} – ${formatDutyDate(endDate.toISOString().slice(0, 10))}`;
  };

  return (
    <div className="w-full space-y-4 bg-slate-50/30 min-h-screen pb-8">
      {/* One filter panel controls both the table and its Excel download. */}
      <DutyPlannerFilters
        role={filters.role}
        roles={[...new Set([...allRoles, ...(reportData?.employees ?? []).map((employee) => employee.role)])]}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRoleChange={(val) =>
          setFilters((f: DutyPlannerFiltersType) => ({ ...f, role: val }))
        }
        onReset={handleReset}
        onDownloadExcel={() => { void handleDownloadExcel(); }}
        canDownloadExcel={canDownloadExcel}
        exporting={exporting}
        downloadTitle={rangeError || reportError || (saving
          ? 'Wait for duty changes to finish saving.'
          : reportData
            ? `Download the displayed table: ${formatDutyDate(fromDate)} – ${formatDutyDate(toDate)}, ${tableEmployees.length} employees. Counts through ${asOfLabel}; future duties are marked Planned.`
            : 'Wait for the table data to finish loading.')}
        view={view}
        onViewChange={setView}
        periodLabel={view === 'month' ? monthLabel : formatWeekRange(filters.weekStart, true)}
        periodTitle={view === 'month' ? monthLabel : formatWeekRange(filters.weekStart)}
        onPreviousPeriod={view === 'month' ? prevMonth : () => moveWeek(-1)}
        onNextPeriod={view === 'month' ? nextMonth : () => moveWeek(1)}
        onCurrentPeriod={view === 'week' ? resetFilters : undefined}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        periodMeta={(
          <>
            {view === 'week' && (
              <span
                title={`${statusLabel}${!canEditWeek ? ' (read-only)' : ''}`}
                className={`inline-flex h-5 items-center whitespace-nowrap rounded-full border px-2 text-[10px] font-semibold ${statusClasses}`}
              >
                {gatedByPrevWeek ? 'Locked' : statusLabel}
              </span>
            )}
            {usingSampleData && (
              <span
                title="Backend unavailable — showing local sample data (edits are kept in memory only)"
                className="inline-flex h-5 items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700"
              >
                Sample data
              </span>
            )}
          </>
        )}
        feedback={rangeError ? (
          <p role="alert" className="text-xs font-medium text-rose-600">{rangeError}</p>
        ) : reportError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
            <AlertCircle size={14} /> Could not load the full report. {reportError} Export is unavailable until it loads successfully.
            <button onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 font-semibold hover:bg-rose-50">
              <RefreshCw size={12} /> Retry report
            </button>
          </div>
        ) : !reportData ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-slate-500"><LoaderCircle size={13} className="animate-spin" /> Loading table data…</p>
        ) : tableEmployees.length === 0 ? (
          <p role="status" className="text-xs text-amber-700">No employees match the selected filters. Change the role or employee search to export.</p>
        ) : null}
      />

      {/* Previous week must be closed before this week takes entries */}
      {view === 'week' && !loading && !prevWeekClosed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2.5 text-amber-800">
          <LockKeyhole size={15} className="shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            Previous week {prevWeekStart ? `(${formatWeekRange(prevWeekStart)}) ` : ''}is not closed yet.
            Submit it first — this week will then be open for entries and submission.
          </p>
        </div>
      )}

      {/* Week remains editable; month/custom ranges are read-only reports. */}
      {view === 'week' ? (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <DutyPlannerGrid
            employees={tableEmployees}
            weekDays={weekDays}
            getAssignment={getAssignment}
            onCellClick={handleCellClick}
            loading={loading}
            weekLocked={!canEditWeek}
            isOnLeave={isOnApprovedLeave}
          />
        </div>
      ) : reportData ? (
        <DutyPlannerReportTable data={reportData} employees={tableEmployees} asOf={today} />
      ) : (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center text-sm text-slate-500">
          {rangeError ? 'Choose a valid date range to view duties.' : reportError ? 'The report could not be loaded. Use Retry report above.' : 'Loading duty report…'}
        </div>
      )}

      {/* Week Actions - Compact row (week view only) */}
      {view === 'week' && (
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={handleSubmitWeek}
          disabled={!canEditWeek || loading || saving || unassignedCount > 0}
          title={
            !prevWeekClosed
              ? 'Close the previous week first — submit it, then this week can be submitted'
              : unassignedCount > 0
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