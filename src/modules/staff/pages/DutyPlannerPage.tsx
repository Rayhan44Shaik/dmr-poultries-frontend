// src/modules/staff/pages/DutyPlannerPage.tsx

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDutyPlanner, isDateLocked } from '../hooks/useDutyPlanner';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import DutyPlannerFilters, { type DutyPlannerView } from '../components/duty-planner/DutyPlannerFilters';
import DutyPlannerGrid from '../components/duty-planner/DutyPlannerGrid';
import DutyPlannerReportTable from '../components/duty-planner/DutyPlannerReportTable';
import DutyDateFilter from '../components/duty-planner/DutyDateFilter';
import PendingDutiesPanel from '../components/duty-planner/PendingDutiesPanel';
import ShiftPicker from '../components/duty-planner/ShiftPicker';
import { useDutyPlannerText } from '../hooks/useDutyPlannerText';
import { dutyDisplayValue, dutyLocale, localizeDutyError } from '../i18n/dutyPlannerCopy';
import '../styles/dutyPlanner.css';
import { filterDutyEmployees, formatDutyDate, getDutyRangeError, todayStr, type DutyReportData, type DutyReportRange } from '../services/dutyReport';
import { CheckCircle2, AlertCircle, LoaderCircle, RefreshCw, LockKeyhole, ChevronDown } from 'lucide-react';
import type { DutyPlannerFilters as DutyPlannerFiltersType, DutyAssignment } from '../types/staffDashboard';

/* Default Period state — shared by the initial mount and by Reset so the two
   can never drift apart. Reset always lands back on the Weekly view of the
   current week, whatever Period / custom date range was active before. */
const initialMonthCursor = () => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
};
const initialCustomRange = (): DutyReportRange => ({
  fromDate: `${todayStr().slice(0, 7)}-01`, toDate: todayStr(),
});

function DutyPlannerPage() {
  const { showNotification } = useSafeNotification();
  const { language, t } = useDutyPlannerText();
  const textRef = useRef(t);
  useEffect(() => { textRef.current = t; }, [t]);

  const {
    employees,
    weekDays,
    loading,
    error: loadError,
    saving,
    usingSampleData,
    filters,
    setFilters,
    getAssignment,
    getDutyCell,
    automaticSaveError,
    refresh: refreshDuties,
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
    pendingDuties,
    isOnApprovedLeave,
    getRangeDuties,
    prevWeekClosed,
    prevWeekStart,
    validation,
    autoAssignAll,
    moveDuty,
    submitCurrentWeek,
  } = useDutyPlanner(showNotification);

  const [searchQuery, setSearchQuery] = useState('');
  /* Pending-duties checker (week view): lists exactly who is missing which day. */
  const [showPending, setShowPending] = useState(false);
  /* Date-wise table filter: date columns hidden from the active table. */
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(new Set());
  const toggleTableDate = useCallback((date: string) => {
    setHiddenDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }, []);
  const showAllTableDates = useCallback(() => setHiddenDates(new Set()), []);

  /* ----- Week / Month / Custom-range views ----- */
  const [view, setView] = useState<DutyPlannerView>('week');
  const [monthCursor, setMonthCursor] = useState(initialMonthCursor);
  const [customRange, setCustomRange] = useState<DutyReportRange>(initialCustomRange);
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
  const rangeError = getDutyRangeError(range, language);
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
          notifyRef.current(textRef.current('loadRetry'), 'error');
        }
      });
    return () => { cancelled = true; controller.abort(); };
  }, [fromDate, toDate, reportKey, rangeError, getRangeDuties, loading]);

  const reportCurrent = !loading && !rangeError && reportState?.key === reportKey && reportState?.loader === getRangeDuties;
  const reportData = reportCurrent ? reportState.data : null;
  const reportError = reportCurrent && reportState.error ? localizeDutyError(reportState.error, language) : null;
  const today = todayStr();
  const monthLabel = new Date(monthCursor.y, monthCursor.m, 1).toLocaleDateString(dutyLocale(language), {
    month: 'long', year: 'numeric',
  });
  const prevMonth = () => setMonthCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setMonthCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));

  const handleCellClick = useCallback((employeeId: number, date: string) => {
    if (date > todayStr()) { showNotification(t('futureLocked'), 'error'); return; }
    if (isOnApprovedLeave(employeeId, date)) { showNotification(t('leaveLocked'), 'error'); return; }
    if (isDateLocked(date)) {
      showNotification(t('pastLocked'), 'error');
      return;
    }
    if (!canEditWeek) {
      showNotification(t('weekReadOnly', { status: dutyDisplayValue(weekStatus, language) }), 'error');
      return;
    }
    setSelectedCell({ employeeId, date });
    setShowPicker(true);
  }, [canEditWeek, weekStatus, setSelectedCell, setShowPicker, showNotification, isOnApprovedLeave, language, t]);

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

  // Submit stays clickable while cells are pending: submitCurrentWeek() blocks
  // it with a notification, and the pending panel opens automatically so the
  // user sees exactly WHO is missing WHICH days instead of a bare count.
  const handleSubmitWeek = useCallback(() => {
    if (unassignedCount > 0) setShowPending(true);
    void submitCurrentWeek();
  }, [submitCurrentWeek, unassignedCount]);

  // Brand refresh: reload the editable week and the range report together.
  const handleRefresh = useCallback(() => {
    refreshDuties();
    setRefreshKey((key) => key + 1);
  }, [refreshDuties]);

  const handleAutoAssign = useCallback(() => {
    void autoAssignAll();
  }, [autoAssignAll]);

  // Drag & drop: move a duty to another cell (swaps when the target has one).
  const handleDropDuty = useCallback(
    (source: { employeeId: number; date: string }, target: { employeeId: number; date: string }) => {
      void moveDuty(source, target);
    },
    [moveDuty],
  );

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
    setSelectedCell(null);
  }, [setShowPicker, setSelectedCell]);

  // Reset restores the WHOLE filter panel: default roles, current week, the
  // default Weekly period view, the default custom range and a cleared
  // employee search — one click always returns to the standard starting view.
  const handleReset = useCallback(() => {
    resetFilters();
    setSearchQuery('');
    setView('week');
    setMonthCursor(initialMonthCursor());
    setCustomRange(initialCustomRange());
    setHiddenDates(new Set());
  }, [resetFilters]);

  const filteredEmployees = useMemo(
    () => filterDutyEmployees(employees, filters.role, searchQuery),
    [employees, filters.role, searchQuery],
  );
  // `employeeId:date` keys of every pending cell — the week grid flags these
  // amber so the gaps are visible while scrolling, not only in the panel.
  const pendingCellKeys = useMemo(
    () => new Set(pendingDuties.flatMap((row) => row.missingDays.map((date) => `${row.employeeId}:${date}`))),
    [pendingDuties],
  );
  // Date columns of whichever table is active (week grid or report table).
  const tableDates = useMemo(
    () => (view === 'week' ? weekDays : reportData?.days.map((day) => day.date) ?? []),
    [view, weekDays, reportData],
  );
  const visibleTableDates = useMemo(
    () => tableDates.filter((date) => !hiddenDates.has(date)),
    [tableDates, hiddenDates],
  );
  const reportEmployees = useMemo(
    () => filterDutyEmployees(reportData?.employees ?? [], filters.role, searchQuery),
    [reportData, filters.role, searchQuery],
  );
  // Export exactly the rows shown in the active table. The range report can
  // contain historical employees that are not part of the editable week roster.
  const tableEmployees = view === 'week' ? filteredEmployees : reportEmployees;
  const canDownloadExcel = !!reportData && tableEmployees.length > 0 && !saving && !exporting && !automaticSaveError;

  const handleDownloadExcel = async () => {
    if (!canDownloadExcel || !reportData) return;
    setExporting(true);
    try {
      const { downloadDutyExcel } = await import('../services/dutyReportExcel');
      await downloadDutyExcel({
        data: reportData,
        employees: tableEmployees,
        asOf: today,
        language,
        filterLabel: `${t('filterRole', { roles: filters.role.length ? filters.role.map((role) => dutyDisplayValue(role, language)).join(', ') : t('allRoles') })}${searchQuery.trim() ? ` | ${t('filterSearch', { search: searchQuery.trim() })}` : ''}`,
      });
      showNotification(t('downloadSuccess'), 'success');
    } catch (error) {
      showNotification(error ? localizeDutyError(error, language) : t('downloadFailed'), 'error');
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

  const statusLabel = gatedByPrevWeek ? t('lockedPrevious') : dutyDisplayValue(weekStatus || 'Open', language);

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
    const startLabel = compact ? startDate.toLocaleDateString(dutyLocale(language), {
      day: '2-digit', month: sameMonth ? undefined : 'short',
      year: sameYear ? undefined : 'numeric', timeZone: 'UTC',
    }) : formatDutyDate(start, language);
    return `${startLabel} – ${formatDutyDate(endDate.toISOString().slice(0, 10), language)}`;
  };

  return (
    <div lang={language} className="duty-planner-page w-full space-y-3 bg-slate-50/30 min-h-screen pb-8">
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
        onRefresh={handleRefresh}
        refreshing={loading || saving}
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
                title={`${statusLabel}${!canEditWeek ? ` (${t('readOnly')})` : ''}`}
                className={`inline-flex h-5 items-center whitespace-nowrap rounded-full border px-2 text-[10px] font-semibold ${statusClasses}`}
              >
                {gatedByPrevWeek ? t('locked') : statusLabel}
              </span>
            )}
            {usingSampleData && (
              <span
                title={t('sampleHint')}
                className="inline-flex h-5 items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700"
              >
                {t('sample')}
              </span>
            )}
          </>
        )}
        feedback={loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
            <AlertCircle size={14} />{loadError}
            <button type="button" onClick={refreshDuties} className="rounded-md border border-rose-200 px-2 py-1 font-semibold">{t('retry')}</button>
          </div>
        ) : automaticSaveError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
            <AlertCircle size={14} />{t('autoSaveFailed')}
            <button type="button" onClick={refreshDuties} className="rounded-md border border-rose-200 px-2 py-1 font-semibold">{t('retrySave')}</button>
          </div>
        ) : rangeError ? (
          <p role="alert" className="text-xs font-medium text-rose-600">{rangeError}</p>
        ) : reportError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
            <AlertCircle size={14} />{t('loadFailed')}
            <button onClick={() => { refreshDuties(); setRefreshKey((key) => key + 1); }} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 font-semibold hover:bg-rose-50">
              <RefreshCw size={12} />{t('retry')}
            </button>
          </div>
        ) : !reportData ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-slate-500"><LoaderCircle size={13} className="animate-spin" />{t('loading')}</p>
        ) : tableEmployees.length === 0 ? (
          <p role="status" className="text-xs text-amber-700">{t('noEmployees')} {t('changeFilters')}</p>
        ) : null}
      />

      {/* Previous week must be closed before this week takes entries */}
      {view === 'week' && !loading && !prevWeekClosed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2.5 text-amber-800">
          <LockKeyhole size={15} className="shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            {t('previousNotClosed', { range: prevWeekStart ? formatWeekRange(prevWeekStart) : '' })}
          </p>
        </div>
      )}

      {/* Date-wise table filter — one chip per date column, applies to the
          week grid and the month/custom report tables alike. */}
      {tableDates.length > 0 && !loading && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <DutyDateFilter dates={tableDates} visible={visibleTableDates} onToggleDate={toggleTableDate} onShowAll={showAllTableDates} />
        </div>
      )}

      {/* Week remains editable; month/custom ranges are read-only reports. */}
      {view === 'week' ? (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <DutyPlannerGrid
            employees={tableEmployees}
            weekDays={visibleTableDates}
            countDays={weekDays}
            getDutyCell={getDutyCell}
            onCellClick={handleCellClick}
            loading={loading}
            weekLocked={!canEditWeek}
            pendingDates={pendingCellKeys}
            onDropDuty={handleDropDuty}
          />
        </div>
      ) : reportData ? (
        <DutyPlannerReportTable data={reportData} employees={tableEmployees} asOf={today} dates={visibleTableDates} />
      ) : (
        <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center text-sm text-slate-500">
          {rangeError ? t('chooseRange') : reportError ? t('loadRetry') : t('loading')}
        </div>
      )}

      {/* Week Actions - Compact row (week view only) */}
      {view === 'week' && (
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={handleSubmitWeek}
          disabled={!canEditWeek || loading || saving || automaticSaveError}
          title={
            !prevWeekClosed
              ? t('closePrevious')
              : unassignedCount > 0
                ? t('assignAll', { count: unassignedCount })
                : t('submit')
          }
          className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={15} />
          {t('submit')}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {/* Pending-duties checker: expands the panel below. */}
          <button
            type="button"
            onClick={() => setShowPending((value) => !value)}
            aria-expanded={showPending}
            aria-controls="duty-pending-panel"
            title={unassignedCount > 0 ? t('assignAll', { count: unassignedCount }) : t('ready')}
            className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-300 ${unassignedCount > 0
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'}`}
          >
            {unassignedCount > 0 ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
            {unassignedCount > 0 ? `${t('pendingDuties')} · ${unassignedCount}` : t('allAssigned')}
            <ChevronDown size={12} className={`transition-transform ${showPending ? 'rotate-180' : ''}`} />
          </button>
          {!validation.ok && (
            <span className="flex items-center gap-1.5 text-rose-600 ml-2 border-l border-slate-200 pl-2">
              <AlertCircle size={12} />
              {t('issues', { count: validation.problems.length })}
            </span>
          )}
        </div>
      </div>
      )}

      {/* Pending duties — who is missing which day (week view only) */}
      {view === 'week' && !loading && showPending && (
        <PendingDutiesPanel
          pending={pendingDuties}
          unassignedCount={unassignedCount}
          canEdit={canEditWeek}
          saving={saving}
          onPickCell={handleCellClick}
          onAutoAssign={handleAutoAssign}
        />
      )}

      {/* Validation issues - week view only */}
      {view === 'week' && !validation.ok && validation.problems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3">
          {!validation.ok && validation.problems.length > 0 && (
            <div className="bg-rose-50/80 border border-rose-200/80 rounded-lg p-2.5 text-xs text-rose-700">
              <strong className="font-semibold">{t('validation')}:</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {validation.problems.map((problem, i) => (
                  <li key={i}>{language === 'en' ? problem : localizeDutyError(problem, language)}</li>
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
          currentDuty={getDutyCell(selectedCell.employeeId, selectedCell.date)?.dutyType ?? undefined}
          date={selectedCell.date}
          employeeName={selectedEmployee ? selectedEmployee.employeeName : ''}
          employeeRole={selectedEmployee ? selectedEmployee.role : ''}
          employeeDepartment={selectedEmployee?.department}
        />
      )}
    </div>
  );
}

export default DutyPlannerPage;
