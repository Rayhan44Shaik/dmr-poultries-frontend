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
import { loadDutyReportLeaves, loadDutyReportRange, formatDutyDate, todayStr, type DutyReportRange } from '../services/dutyReport';
import { listLeaves } from '../services/leaveService';
import { AutomaticDutySyncError, getAutomaticDuty, hasApprovedDutyLeave, resolveDutyCell, syncAutomaticDuties } from '../services/dutyRules';
import { STAFF_LEAVES_CHANGED } from '../services/staffEvents';
import { useDutyPlannerText } from './useDutyPlannerText';
import { dutyText, localizeDutyError, dutyDisplayValue, type DutyTextKey } from '../i18n/dutyPlannerCopy';
import type { Employee, DutyAssignment, DutyPlannerFilters, LeaveRequest } from '../types/staffDashboard';

const DEFAULT_ROLES = ['Supervisor', 'Driver', 'Helper', 'Loader'];

/** An employee with at least one day this week that has no duty, no approved
 *  leave and no automatic duty — a cell that is truly pending assignment. */
export interface PendingDutyEmployee {
  employeeId: number;
  employeeName: string;
  role: string;
  department?: string;
  missingDays: string[];
}

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
  const mutationInFlight = useRef(false);

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
    window.addEventListener(STAFF_LEAVES_CHANGED, refresh);
    document.addEventListener('visibilitychange', onVisible);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(refresh, Math.max(1000, midnight.getTime() - Date.now() + 100));
    return () => {
      window.removeEventListener(STAFF_LEAVES_CHANGED, refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(timer);
    };
  }, [refresh]);

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
      } catch (cause) {
        if (cancelled) return;
        setEmployees([]);
        setAssignments([]);
        setWeekDays([]);
        setLeaves([]);
        setPrevWeekStatus(null);
        setPrevWeekStart(prevMonday);
        setError(localizeDutyError(new Error(handleApiError(cause)), languageRef.current));
        setLoading(false);
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

  // (employee × day) cells in this week that still have no duty AND no approved
  // leave/default, grouped per employee. The week can only be submitted when
  // this list is empty; the UI shows exactly WHO is missing WHICH days.
  const pendingDuties = useMemo<PendingDutyEmployee[]>(() => {
    const rows: PendingDutyEmployee[] = [];
    for (const emp of employees) {
      const missingDays = weekDays.filter((day) => {
        const hasDuty = assignments.some((a) => a.employeeId === emp.id && a.date === day);
        return !hasDuty && !isOnApprovedLeave(emp.id, day) && !getAutomaticDuty(emp, day);
      });
      if (missingDays.length) rows.push({ employeeId: emp.id, employeeName: emp.employeeName, role: emp.role, department: emp.department, missingDays });
    }
    return rows;
  }, [employees, weekDays, assignments, isOnApprovedLeave]);
  const unassignedCount = useMemo(
    () => pendingDuties.reduce((count, row) => count + row.missingDays.length, 0),
    [pendingDuties]
  );

  /** Week, month or custom-range reports use the same authoritative data.
   * Sample mode is explicit and preserves edits to the currently loaded week.
   * A failed live report is never padded with sample data. */
  const getRangeDuties = useCallback(
    (range: DutyReportRange, signal?: AbortSignal) => loadDutyReportRange(range, {
      usingSampleData: false,
      loadWeek: async (monday) => {
        if (monday === weekStart) return { weekStart, employees, assignments };
        return getDutyPlannerWeek(monday);
      },
      loadLeaves: async () => {
        const approvedLeaves = await loadDutyReportLeaves(range, listLeaves, signal);
        signal?.throwIfAborted();
        // Keep the editable week in sync with the same approved-leave source
        // as its export. A partial range must not erase other days' leaves.
        if (range.fromDate <= weekStart && range.toDate >= weekEnd) setLeaves(approvedLeaves);
        return approvedLeaves;
      },
    }, signal),
    [weekStart, weekEnd, employees, assignments],
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

      if (mutationInFlight.current) return false;
      mutationInFlight.current = true;
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
        mutationInFlight.current = false;
        setSaving(false);
      }
    },
    [getAssignment, applyWeek, showNotification, canEditWeek, weekStatus, isOnApprovedLeave, text]
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

      if (mutationInFlight.current) return false;
      mutationInFlight.current = true;
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
        mutationInFlight.current = false;
        setSaving(false);
      }
    },
    [getAssignment, applyWeek, showNotification, canEditWeek, weekStatus, isOnApprovedLeave, text]
  );

  /** Drag & drop: move a duty from one cell to another. When the target cell
   *  already holds a duty the two swap; an empty target receives the duty and
   *  the source is cleared. One notification covers the whole move. */
  const moveDuty = useCallback(
    async (
      source: { employeeId: number; date: string },
      target: { employeeId: number; date: string },
    ): Promise<boolean> => {
      if (source.employeeId === target.employeeId && source.date === target.date) return false;
      const sourceAssignment = getAssignment(source.employeeId, source.date);
      if (!sourceAssignment?.dutyType) return false;
      const sourceDuty = sourceAssignment.dutyType as DutyAssignment['dutyType'];
      const targetExisting = getAssignment(target.employeeId, target.date);
      const targetDuty = (targetExisting?.dutyType as DutyAssignment['dutyType'] | undefined) ?? null;
      const blockedMessage = (employeeId: number, date: string): string | null => {
        if (date > todayStr()) return text('futureLocked');
        if (isOnApprovedLeave(employeeId, date)) return text('leaveLocked');
        if (isDateLocked(date)) return text('pastLocked');
        return null;
      };
      const blocked =
        blockedMessage(source.employeeId, source.date) ?? blockedMessage(target.employeeId, target.date);
      if (blocked) { showNotification?.(blocked, 'error'); return false; }
      if (!canEditWeek) {
        showNotification?.(text('weekReadOnly', { status: dutyDisplayValue(weekStatus, languageRef.current) }), 'error');
        return false;
      }
      if (mutationInFlight.current) return false;
      mutationInFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        // 1) The target cell receives the dragged duty.
        await upsertDutyAssignment({ id: targetExisting?.id, employeeId: target.employeeId, dutyType: sourceDuty, date: target.date });
        // 2) The source cell swaps in the target's old duty, or is cleared.
        if (targetDuty) {
          const week = await upsertDutyAssignment({ id: sourceAssignment.id, employeeId: source.employeeId, dutyType: targetDuty, date: source.date });
          applyWeek(week);
        } else if (sourceAssignment.id) {
          let week = await deleteDutyAssignment(sourceAssignment.id);
          const approved = await loadDutyReportLeaves({ fromDate: week.weekStart, toDate: week.weekEnd }, listLeaves);
          week = await syncAutomaticDuties(week, approved, todayStr(), upsertDutyAssignment);
          applyWeek(week);
          setLeaves(approved);
        } else {
          applyWeek(await getDutyPlannerWeek(weekStart));
        }
        const nameOf = (employeeId: number) => employees.find((e) => e.id === employeeId)?.employeeName ?? '';
        showNotification?.(
          text(targetDuty ? 'dragSwapped' : 'dragMoved', {
            source: `${nameOf(source.employeeId)} · ${formatDutyDate(source.date, languageRef.current)}`,
            target: `${nameOf(target.employeeId)} · ${formatDutyDate(target.date, languageRef.current)}`,
          }),
          'success',
        );
        return true;
      } catch (err) {
        const message = localizeDutyError(new Error(handleApiError(err)), languageRef.current);
        setError(message);
        showNotification?.(message, 'error');
        return false;
      } finally {
        mutationInFlight.current = false;
        setSaving(false);
      }
    },
    [getAssignment, isOnApprovedLeave, canEditWeek, weekStatus, weekStart, employees, applyWeek, setLeaves, showNotification, text],
  );

  const autoAssignAll = useCallback(async (): Promise<{ ok: boolean; plan?: AutoPlan; message?: string }> => {
    if (!canEditWeek) {
      showNotification?.(text('weekReadOnly', { status: dutyDisplayValue(weekStatus, languageRef.current) }), 'error');
      return { ok: false, message: `This week is ${weekStatus.toLowerCase()}.` };
    }

    if (mutationInFlight.current) return { ok: false, message: 'Another planner update is already in progress.' };
    mutationInFlight.current = true;
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
      mutationInFlight.current = false;
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
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
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
      mutationInFlight.current = false;
      setSaving(false);
    }
  }, [weekStatus, weekStart, unassignedCount, prevWeekClosed, applyWeek, showNotification, text]);

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
    pendingDuties,
    leaves,
    isOnApprovedLeave,
    getRangeDuties,
    loading,
    saving,
    error,
    usingSampleData: false,
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
    moveDuty,
    submitCurrentWeek,
  };
}
