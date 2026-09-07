// src/modules/staff/hooks/useDutyPlanner.ts
// PostgreSQL-backed duty planner hook. All persistent data flows through
// the existing staff duty API; localStorage is not used.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  autoAssignApply,
  autoAssignPreview,
  deleteDutyAssignment,
  getDutyPlannerWeek,
  handleApiError,
  submitDutyPlannerWeek,
  upsertDutyAssignment,
  type AutoPlan,
  type DutyPlannerSaturday,
  type DutyPlannerValidation,
  type DutyPlannerWeek,
} from '../services/dutyPlannerService';
import { buildSampleLeaves, localDeleteAssignment, localUpsertAssignment, markSampleWeekClosed } from '../services/staffSampleData';
import { getDutyReportWeekStarts, loadDutyReportLeaves, loadDutyReportRange, todayStr, type DutyReportRange } from '../services/dutyReport';
import { listLeaves } from '../services/leaveService';
import { buildDutyPlannerSampleWeek } from '../services/dutyPlannerSampleData';
import { AutomaticDutySyncError, getAutomaticDuty, hasApprovedDutyLeave, resolveDutyCell, syncAutomaticDuties } from '../services/dutyRules';
import { STAFF_LEAVES_CHANGED } from '../services/staffEvents';
import { useDutyPlannerText } from './useDutyPlannerText';
import { dutyText, localizeDutyError, dutyDisplayValue, type DutyTextKey } from '../i18n/dutyPlannerCopy';
import type { Employee, DutyAssignment, DutyPlannerFilters, LeaveRequest } from '../types/staffDashboard';

const DEFAULT_ROLES = ['Supervisor', 'Driver', 'Helper', 'Loader'];

export function isDateLocked(dateStr: string): boolean {
  const current = new Date(`${todayStr()}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() - (current.getUTCDay() + 6) % 7);
  return dateStr < current.toISOString().slice(0, 10);
}

/** ISO date of the Monday that starts the week before `weekStart`. */
function prevWeekMondayISO(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useDutyPlanner(showNotification?: (msg: string, type: 'success' | 'error' | 'info') => void) {
  const { language } = useDutyPlannerText();
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);
  const text = useCallback((key: DutyTextKey, params?: Record<string, string | number>) => dutyText(languageRef.current, key, params), []);
  const [reloadKey, setReloadKey] = useState(0);
  const [automaticSaveError, setAutomaticSaveError] = useState(false);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const getCurrentWeekMonday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    const year = startOfWeek.getFullYear();
    const month = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    const date = String(startOfWeek.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const [filters, setFilters] = useState<DutyPlannerFilters>({
    department: '',
    role: DEFAULT_ROLES, // Pre-selected by default
    weekStart: getCurrentWeekMonday(),
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<string[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Backend-authoritative week state
  const [weekStart, setWeekStart] = useState(filters.weekStart);
  const [weekEnd, setWeekEnd] = useState('');
  const [weekStatus, setWeekStatus] = useState('Open');
  const [saturday, setSaturday] = useState<DutyPlannerSaturday>({
    required: 0,
    assigned: 0,
    shortage: 0,
    status: '',
    requiredByRole: {},
    assignedByRole: {},
    availableByRole: {},
  });
  const [validation, setValidation] = useState<DutyPlannerValidation>({ ok: true, problems: [] });
  const [error, setError] = useState<string | null>(null);
  // The week BEFORE the loaded one — the current week only accepts entries
  // after that previous week has been closed (Submitted/Locked/Closed).
  const [prevWeekStatus, setPrevWeekStatus] = useState<string | null>(null);
  const [prevWeekStart, setPrevWeekStart] = useState('');
  // Non-null while the page is showing the local sample roster (backend
  // unavailable). Edits then apply in-memory instead of hitting the API.
  const [sampleWeek, setSampleWeek] = useState<DutyPlannerWeek | null>(null);
  // Authoritative leave API in live mode. Only APPROVED requests affect duties.
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  const [selectedCell, setSelectedCell] = useState<{ employeeId: number; date: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Latest notification callback without making it a load-effect dependency
  // (a new callback identity must never reset the loaded week).
  const notifyRef = useRef<typeof showNotification>(showNotification);
  useEffect(() => {
    notifyRef.current = showNotification;
  }, [showNotification]);

  /** True once the previous week has been closed (submitted/locked). */
  const prevWeekClosed =
    prevWeekStatus === 'Submitted' || prevWeekStatus === 'Locked' || prevWeekStatus === 'Closed';

  /**
   * A week can only take entries after the previous week is closed, and the
   * backend must not have locked/submitted the week itself.
   */
  const canEditWeek =
    (weekStatus === 'Open' || weekStatus === 'Draft' || weekStatus === '') && prevWeekClosed;

  const applyWeek = useCallback((week: DutyPlannerWeek) => {
    setWeekStart(week.weekStart);
    setWeekEnd(week.weekEnd);
    setWeekStatus(week.status);
    setSaturday(week.saturday);
    setValidation(week.validation);
    setEmployees(week.employees);
    setAssignments(week.assignments);
    setWeekDays(week.days.map((d) => d.date));
    const mergedRoles = Array.from(new Set([...DEFAULT_ROLES, ...week.allRoles]));
    setAllRoles(mergedRoles);
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(STAFF_LEAVES_CHANGED, refresh);
    document.addEventListener('visibilitychange', onVisible);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(refresh, Math.max(1000, midnight.getTime() - Date.now() + 100));
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(STAFF_LEAVES_CHANGED, refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(timer);
    };
  }, [refresh, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setAutomaticSaveError(false);
      const prevMonday = prevWeekMondayISO(filters.weekStart);
      let loaded: DutyPlannerWeek;
      let previous: DutyPlannerWeek | null;
      try {
        [loaded, previous] = await Promise.all([
          getDutyPlannerWeek(filters.weekStart),
          getDutyPlannerWeek(prevMonday).catch(() => null),
        ]);
      } catch {
        if (cancelled) return;
        let sample = buildDutyPlannerSampleWeek(filters.weekStart);
        const sampleLeaves = buildSampleLeaves(sample.weekStart);
        sample = await syncAutomaticDuties(sample, sampleLeaves, todayStr(), async (input) => {
          sample = localUpsertAssignment(sample, input.employeeId, input.date, input.dutyType);
          return sample;
        }, controller.signal).catch(() => sample);
        if (cancelled) return;
        applyWeek(sample);
        setSampleWeek(sample);
        setLeaves(sampleLeaves);
        const prev = buildDutyPlannerSampleWeek(prevMonday);
        setPrevWeekStatus(prev.status);
        setPrevWeekStart(prev.weekStart);
        setError(null);
        setLoading(false);
        notifyRef.current?.(text('sampleNotice'), 'info');
        return;
      }
      if (cancelled) return;
      // A leave/write failure must never replace an available live week with
      // sample data. Keep the latest saved snapshot and expose a retry action.
      let approved: LeaveRequest[] = [];
      try {
        approved = await loadDutyReportLeaves({ fromDate: loaded.weekStart, toDate: loaded.weekEnd }, listLeaves, controller.signal);
        const editable = ['Open', 'Draft', ''].includes(loaded.status) &&
          !!previous && ['Submitted', 'Locked', 'Closed'].includes(previous.status) && !isDateLocked(loaded.weekStart);
        if (editable) loaded = await syncAutomaticDuties(loaded, approved, todayStr(), upsertDutyAssignment, controller.signal);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof AutomaticDutySyncError) loaded = cause.week;
        setAutomaticSaveError(true);
      }
      if (cancelled) return;
      applyWeek(loaded);
      setSampleWeek(null);
      setLeaves(approved);
      setPrevWeekStatus(previous?.status ?? null);
      setPrevWeekStart(previous?.weekStart ?? prevMonday);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [filters.weekStart, applyWeek, reloadKey, text]);

  const moveWeek = useCallback((direction: -1 | 1) => {
    setFilters((prev) => {
      const d = new Date(`${prev.weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + direction * 7);
      return { ...prev, weekStart: d.toISOString().slice(0, 10) };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      department: '',
      role: DEFAULT_ROLES, // Resets back to default selected roles
      weekStart: getCurrentWeekMonday(),
    });
  }, []);

  const getAssignment = useCallback(
    (employeeId: number, date: string): DutyAssignment | undefined => {
      return assignments.find((a) => a.employeeId === employeeId && a.date === date);
    },
    [assignments]
  );

  const isOnApprovedLeave = useCallback(
    (employeeId: number, date: string): boolean => hasApprovedDutyLeave(leaves, employeeId, date),
    [leaves],
  );
  const getDutyCell = useCallback((employeeId: number, date: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    return employee ? resolveDutyCell(employee, date, getAssignment(employeeId, date), isOnApprovedLeave(employeeId, date)) : undefined;
  }, [employees, getAssignment, isOnApprovedLeave]);

  // Number of (employee × day) cells in this week that still have no duty
  // AND no approved leave/default. The week can only be submitted when this is 0.
  const unassignedCount = useMemo(() => {
    let count = 0;
    for (const emp of employees) {
      for (const day of weekDays) {
        const hasDuty = assignments.some((a) => a.employeeId === emp.id && a.date === day);
        if (!hasDuty && !isOnApprovedLeave(emp.id, day) && !getAutomaticDuty(emp, day)) count += 1;
      }
    }
    return count;
  }, [employees, weekDays, assignments, isOnApprovedLeave]);

  /** Week, month or custom-range reports use the same authoritative data.
   * Sample mode is explicit and preserves edits to the currently loaded week.
   * A failed live report is never padded with sample data. */
  const getRangeDuties = useCallback(
    (range: DutyReportRange, signal?: AbortSignal) => loadDutyReportRange(range, {
      usingSampleData: sampleWeek !== null,
      loadWeek: async (monday) => {
        if (monday === weekStart) return { weekStart, employees, assignments };
        return sampleWeek ? buildDutyPlannerSampleWeek(monday) : getDutyPlannerWeek(monday);
      },
      loadLeaves: async () => {
        if (sampleWeek) return getDutyReportWeekStarts(range).flatMap(buildSampleLeaves);
        const approvedLeaves = await loadDutyReportLeaves(range, listLeaves, signal);
        signal?.throwIfAborted();
        // Keep the editable week in sync with the same approved-leave source
        // as its export. A partial range must not erase other days' leaves.
        if (range.fromDate <= weekStart && range.toDate >= weekEnd) setLeaves(approvedLeaves);
        return approvedLeaves;
      },
    }, signal),
    [sampleWeek, weekStart, weekEnd, employees, assignments],
  );

  const updateAssignment = useCallback(
    async (employeeId: number, date: string, dutyType: DutyAssignment['dutyType']): Promise<boolean> => {
      if (date > todayStr()) { showNotification?.(text('futureLocked'), 'error'); return false; }
      if (isOnApprovedLeave(employeeId, date)) { showNotification?.(text('leaveLocked'), 'error'); return false; }
      if (isDateLocked(date)) {
        showNotification?.(text('pastLocked'), 'error');
        return false;
      }
      if (!canEditWeek) {
        showNotification?.(text('weekReadOnly', { status: dutyDisplayValue(weekStatus, languageRef.current) }), 'error');
        return false;
      }

      // Sample mode: apply the change in-memory (the backend is down).
      if (sampleWeek) {
        const next = localUpsertAssignment(sampleWeek, employeeId, date, dutyType);
        applyWeek(next);
        setSampleWeek(next);
        showNotification?.(text('updateSample'), 'success');
        return true;
      }

      setSaving(true);
      setError(null);
      try {
        const existing = getAssignment(employeeId, date);
        const week = await upsertDutyAssignment({
          id: existing?.id,
          employeeId,
          dutyType,
          date,
        });
        applyWeek(week);
        showNotification?.(text('updateSuccess'), 'success');
        return true;
      } catch (err) {
        const message = localizeDutyError(new Error(handleApiError(err)), languageRef.current);
        setError(message);
        showNotification?.(message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [getAssignment, applyWeek, showNotification, canEditWeek, weekStatus, sampleWeek, isOnApprovedLeave, text]
  );

  const deleteAssignment = useCallback(
    async (employeeId: number, date: string): Promise<boolean> => {
      if (date > todayStr()) { showNotification?.(text('futureLocked'), 'error'); return false; }
      if (isOnApprovedLeave(employeeId, date)) { showNotification?.(text('leaveLocked'), 'error'); return false; }
      if (isDateLocked(date)) {
        showNotification?.(text('pastLocked'), 'error');
        return false;
      }
      if (!canEditWeek) {
        showNotification?.(text('weekReadOnly', { status: dutyDisplayValue(weekStatus, languageRef.current) }), 'error');
        return false;
      }

      const existing = getAssignment(employeeId, date);
      if (!existing?.id) {
        showNotification?.(text('noAssignment'), 'info');
        return false;
      }

      // Sample mode: remove in-memory (the backend is down).
      if (sampleWeek) {
        const next = localDeleteAssignment(sampleWeek, existing.id);
        applyWeek(next);
        setSampleWeek(next);
        showNotification?.(text('removeSample'), 'success');
        return true;
      }

      setSaving(true);
      setError(null);
      try {
        let week = await deleteDutyAssignment(existing.id);
        const approved = await loadDutyReportLeaves({ fromDate: week.weekStart, toDate: week.weekEnd }, listLeaves);
        week = await syncAutomaticDuties(week, approved, todayStr(), upsertDutyAssignment);
        applyWeek(week);
        setLeaves(approved);
        showNotification?.(text('removeSuccess'), 'success');
        return true;
      } catch (err) {
        const message = localizeDutyError(new Error(handleApiError(err)), languageRef.current);
        setError(message);
        showNotification?.(message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [getAssignment, applyWeek, showNotification, canEditWeek, weekStatus, sampleWeek, isOnApprovedLeave, text]
  );

  const autoAssignAll = useCallback(async (): Promise<{ ok: boolean; plan?: AutoPlan; message?: string }> => {
    if (!canEditWeek) {
      showNotification?.(text('weekReadOnly', { status: dutyDisplayValue(weekStatus, languageRef.current) }), 'error');
      return { ok: false, message: `This week is ${weekStatus.toLowerCase()}.` };
    }

    setSaving(true);
    setError(null);
    try {
      // Preview from backend (no local algorithm)
      const preview = await autoAssignPreview(weekStart);
      if (preview.conflicts.length > 0) {
        const conflictMsg = preview.conflicts.join(' ');
        showNotification?.(`Auto assign has unresolved conflicts: ${conflictMsg}`, 'error');
        return { ok: false, plan: preview, message: conflictMsg };
      }
      // Apply backend plan and reload week from the returned payload
      const week = await autoAssignApply(weekStart, preview);
      applyWeek(week);
      showNotification?.(
        `Auto assign applied: ${preview.employeesAffected} employee(s), Delivery ${preview.delivery}, Repair ${preview.repair}, Office ${preview.office}, Collection ${preview.collection}.`,
        'success'
      );
      return { ok: true, plan: preview };
    } catch (err) {
      const message = localizeDutyError(new Error(handleApiError(err)), languageRef.current);
      setError(message);
      showNotification?.(message, 'error');
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }, [canEditWeek, weekStatus, weekStart, applyWeek, showNotification, text]);

  const submitCurrentWeek = useCallback(async (): Promise<boolean> => {
    if (weekStatus === 'Locked') {
      showNotification?.(text('locked'), 'error');
      return false;
    }
    // A week can only be closed after the previous week is closed.
    if (!prevWeekClosed) {
      showNotification?.(
        text('closePrevious'),
        'error'
      );
      return false;
    }
    // The week is only submittable once every employee has a duty on every day.
    if (unassignedCount > 0) {
      showNotification?.(
        text('submitMissing', { count: unassignedCount }),
        'error'
      );
      return false;
    }
    // Sample mode: close the week in-memory (the backend is down).
    if (sampleWeek) {
      const closed: DutyPlannerWeek = { ...sampleWeek, status: 'Submitted' };
      markSampleWeekClosed(weekStart);
      applyWeek(closed);
      setSampleWeek(closed);
      showNotification?.(text('submitSample'), 'success');
      return true;
    }

    setSaving(true);
    setError(null);
    try {
      if (!isDateLocked(weekStart)) {
        const latest = await getDutyPlannerWeek(weekStart);
        const approved = await loadDutyReportLeaves({ fromDate: latest.weekStart, toDate: latest.weekEnd }, listLeaves);
        await syncAutomaticDuties(latest, approved, latest.weekEnd, upsertDutyAssignment);
      }
      const week = await submitDutyPlannerWeek(weekStart);
      applyWeek(week);
      showNotification?.(text('submitSuccess'), 'success');
      return true;
    } catch (err) {
      const message = localizeDutyError(new Error(handleApiError(err)), languageRef.current);
      setError(message);
      showNotification?.(message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [weekStatus, weekStart, unassignedCount, prevWeekClosed, sampleWeek, applyWeek, showNotification, text]);

  return {
    employees,
    assignments,
    automaticSaveError,
    refresh,
    getDutyCell,
    prevWeekStatus,
    prevWeekStart,
    prevWeekClosed,
    weekDays,
    unassignedCount,
    leaves,
    isOnApprovedLeave,
    getRangeDuties,
    loading,
    saving,
    error,
    usingSampleData: sampleWeek !== null,
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
  };
}