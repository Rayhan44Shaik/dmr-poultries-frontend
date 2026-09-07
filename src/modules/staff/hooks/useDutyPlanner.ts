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
import { buildSampleDutyWeek, buildSampleLeaves, localDeleteAssignment, localUpsertAssignment, markSampleWeekClosed } from '../services/staffSampleData';
import { getDutyReportWeekStarts, loadDutyReportLeaves, loadDutyReportRange, type DutyReportRange } from '../services/dutyReport';
import { listLeaves } from '../services/leaveService';
import { loadLeaveRequests } from '../services/staffService';
import type { Employee, DutyAssignment, DutyPlannerFilters, LeaveRequest } from '../types/staffDashboard';

const DEFAULT_ROLES = ['Supervisor', 'Driver', 'Helper', 'Loader'];

export function isDateLocked(dateStr: string): boolean {
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  const day = targetDate.getDay();
  const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
  const targetWeekMonday = new Date(targetDate);
  targetWeekMonday.setDate(diff);
  targetWeekMonday.setHours(0, 0, 0, 0);

  const now = new Date();
  const currDay = now.getDay();
  const currDiff = now.getDate() - currDay + (currDay === 0 ? -6 : 1);
  const currentWeekMonday = new Date(now);
  currentWeekMonday.setDate(currDiff);
  currentWeekMonday.setHours(0, 0, 0, 0);

  return targetWeekMonday.getTime() < currentWeekMonday.getTime();
}

/** ISO date of the Monday that starts the week before `weekStart`. */
function prevWeekMondayISO(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useDutyPlanner(showNotification?: (msg: string, type: 'success' | 'error' | 'info') => void) {
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
  // Leave requests (sample-generated in sample mode, the staff leave
  // store otherwise). Only APPROVED leaves affect the planner.
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
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prevMonday = prevWeekMondayISO(filters.weekStart);
      try {
        const [week, prev] = await Promise.all([
          getDutyPlannerWeek(filters.weekStart),
          getDutyPlannerWeek(prevMonday).catch(() => null),
        ]);
        if (cancelled) return;
        applyWeek(week);
        setSampleWeek(null);
        setLeaves(loadLeaveRequests());
        setPrevWeekStatus(prev ? prev.status : null);
        setPrevWeekStart(prev ? prev.weekStart : prevMonday);
        setError(null);
      } catch {
        if (cancelled) return;
        // Backend unavailable — fall back to the local sample roster so the
        // Staff page stays usable for review. Real data resumes automatically
        // as soon as the staff API responds again.
        const week = buildSampleDutyWeek(filters.weekStart);
        const prev = buildSampleDutyWeek(prevMonday);
        applyWeek(week);
        setSampleWeek(week);
        setLeaves(buildSampleLeaves(filters.weekStart));
        setPrevWeekStatus(prev.status);
        setPrevWeekStart(prev.weekStart);
        setError(null);
        notifyRef.current?.('Backend unavailable — showing sample staff data.', 'info');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.weekStart, applyWeek]);

  const moveWeek = useCallback((direction: -1 | 1) => {
    setFilters((prev) => {
      const d = new Date(prev.weekStart);
      d.setDate(d.getDate() + direction * 7);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return { ...prev, weekStart: `${year}-${month}-${date}` };
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

  // True when the employee has an APPROVED leave covering the date.
  // (Pending/Rejected leaves are ignored everywhere.)
  const isOnApprovedLeave = useCallback(
    (employeeId: number, date: string): boolean =>
      leaves.some(
        (l) => l.status === 'Approved' && l.employeeId === employeeId && l.fromDate <= date && l.toDate >= date
      ),
    [leaves]
  );

  // Number of (employee × day) cells in this week that still have no duty
  // AND no approved leave. The week can only be submitted when this is 0.
  const unassignedCount = useMemo(() => {
    let count = 0;
    for (const emp of employees) {
      for (const day of weekDays) {
        const hasDuty = assignments.some((a) => a.employeeId === emp.id && a.date === day);
        if (!hasDuty && !isOnApprovedLeave(emp.id, day)) count += 1;
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
        return sampleWeek ? buildSampleDutyWeek(monday) : getDutyPlannerWeek(monday);
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
      if (isDateLocked(date)) {
        showNotification?.('Cannot edit duties for previous completed weeks.', 'error');
        return false;
      }
      if (!canEditWeek) {
        showNotification?.(`This week is ${weekStatus.toLowerCase()} and cannot be modified.`, 'error');
        return false;
      }

      // Sample mode: apply the change in-memory (the backend is down).
      if (sampleWeek) {
        const next = localUpsertAssignment(sampleWeek, employeeId, date, dutyType);
        applyWeek(next);
        setSampleWeek(next);
        showNotification?.('Duty updated (sample data).', 'success');
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
        showNotification?.('Duty assignment updated successfully', 'success');
        return true;
      } catch (err) {
        const message = handleApiError(err);
        setError(message);
        showNotification?.(message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [getAssignment, applyWeek, showNotification, canEditWeek, weekStatus, sampleWeek]
  );

  const deleteAssignment = useCallback(
    async (employeeId: number, date: string): Promise<boolean> => {
      if (isDateLocked(date)) {
        showNotification?.('Cannot edit duties for previous completed weeks.', 'error');
        return false;
      }
      if (!canEditWeek) {
        showNotification?.(`This week is ${weekStatus.toLowerCase()} and cannot be modified.`, 'error');
        return false;
      }

      const existing = getAssignment(employeeId, date);
      if (!existing?.id) {
        showNotification?.('No duty assignment to remove.', 'info');
        return false;
      }

      // Sample mode: remove in-memory (the backend is down).
      if (sampleWeek) {
        const next = localDeleteAssignment(sampleWeek, existing.id);
        applyWeek(next);
        setSampleWeek(next);
        showNotification?.('Duty removed (sample data).', 'success');
        return true;
      }

      setSaving(true);
      setError(null);
      try {
        const week = await deleteDutyAssignment(existing.id);
        applyWeek(week);
        showNotification?.('Duty assignment removed successfully', 'success');
        return true;
      } catch (err) {
        const message = handleApiError(err);
        setError(message);
        showNotification?.(message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [getAssignment, applyWeek, showNotification, canEditWeek, weekStatus, sampleWeek]
  );

  const autoAssignAll = useCallback(async (): Promise<{ ok: boolean; plan?: AutoPlan; message?: string }> => {
    if (!canEditWeek) {
      showNotification?.(`This week is ${weekStatus.toLowerCase()} and cannot be modified.`, 'error');
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
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, 'error');
      return { ok: false, message };
    } finally {
      setSaving(false);
    }
  }, [canEditWeek, weekStatus, weekStart, applyWeek, showNotification]);

  const submitCurrentWeek = useCallback(async (): Promise<boolean> => {
    if (weekStatus === 'Locked') {
      showNotification?.('This week is locked.', 'error');
      return false;
    }
    // A week can only be closed after the previous week is closed.
    if (!prevWeekClosed) {
      showNotification?.(
        'Close the previous week first — submit it before this week can be submitted.',
        'error'
      );
      return false;
    }
    // The week is only submittable once every employee has a duty on every day.
    if (unassignedCount > 0) {
      showNotification?.(
        `Cannot submit — ${unassignedCount} day${unassignedCount === 1 ? '' : 's'} still have no duty assigned. Assign every day for every employee first.`,
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
      showNotification?.('Week closed (sample data).', 'success');
      return true;
    }

    setSaving(true);
    setError(null);
    try {
      const week = await submitDutyPlannerWeek(weekStart);
      applyWeek(week);
      showNotification?.('Week submitted successfully.', 'success');
      return true;
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
      showNotification?.(message, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [weekStatus, weekStart, unassignedCount, prevWeekClosed, sampleWeek, applyWeek, showNotification]);

  return {
    employees,
    assignments,
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