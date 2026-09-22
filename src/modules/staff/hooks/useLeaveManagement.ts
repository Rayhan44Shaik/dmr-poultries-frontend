// src/modules/staff/hooks/useLeaveManagement.ts
// Leave Management + Leave Report — fully PostgreSQL/API backed. No localStorage.
// Authoritative sources:
//   - Leave requests: leaveService -> GET/POST/PATCH/DELETE /api/staff/leaves
//   - Leave report:   leaveService -> GET /api/staff/leaves/report
//   - Employees:      masters employeeService -> GET /api/masters/employees

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  listLeaves,
  createLeave,
  updateLeaveStatus,
  deleteLeave as deleteLeaveApi,
  getLeaveReport,
} from '../services/leaveService';
import { loadEmployees } from '../../masters/employees/services/employeeService';
import { useI18n } from '../../../i18n';
import type { Employee } from '../../masters/employees/types/employee';
import type {
  LeaveRequest,
  LeaveListResult,
  LeaveReport,
  LeaveReportItem,
} from '../types/staffDashboard';

type NotificationFn = (message: string, type?: 'success' | 'error' | 'info') => void;

export interface LeaveFilters {
  status: 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  month: string;
  department: string;
  employeeId: number | null;
  leaveType: 'All' | 'Casual' | 'Sick' | 'Emergency' | 'Annual';
  search: string;
}

export const DEFAULT_LEAVE_FILTERS: LeaveFilters = {
  status: 'All',
  month: new Date().toISOString().slice(0, 7),
  department: '',
  employeeId: null,
  leaveType: 'All',
  search: '',
};

/**
 * Typing pause before a search is sent to the API — the same 300 ms the Trip
 * List uses. `filters.search` stays the *input* value; the request only ever
 * sees the committed `appliedSearch`, so a fast typist fires one request
 * instead of one per character (which is what made the page flicker and stall).
 */
const SEARCH_DEBOUNCE_MS = 300;

/** Number of leave facets away from their defaults (drives the Reset badge). */
export function countActiveLeaveFilters(f: LeaveFilters): number {
  const d = DEFAULT_LEAVE_FILTERS;
  return (
    (f.status !== d.status ? 1 : 0) +
    (f.month !== d.month ? 1 : 0) +
    (f.department !== d.department ? 1 : 0) +
    (f.employeeId !== d.employeeId ? 1 : 0) +
    (f.leaveType !== d.leaveType ? 1 : 0) +
    (f.search.trim() !== '' ? 1 : 0)
  );
}

export interface UseLeaveManagementOptions {
  /**
   * Also fetch `GET /staff/leaves/report`.
   *
   * The Leave page renders its table, tabs and counts from the list alone, so
   * it opts out: the report is a whole-month aggregate (every employee, no
   * paging) that would otherwise be re-requested on every keystroke, filter
   * change and refresh for data nothing on screen reads. Defaults to `true` so
   * the hook's contract is unchanged for any other caller.
   */
  includeReport?: boolean;
}

/**
 * @param initialFilters Filters to open with, taken from a deep link — e.g. the
 *   dashboard's pending-approvals tile sends `status: 'Pending', month: ''` so
 *   the page's very first fetch already asks for exactly what the tile counted.
 *   They seed the state rather than being patched on afterwards, which keeps the
 *   first request correct (and the set-state-in-effect rule quiet).
 */
export function useLeaveManagement(
  showNotification?: NotificationFn,
  initialFilters?: Partial<LeaveFilters>,
  options: UseLeaveManagementOptions = {}
) {
  const { includeReport = true } = options;
  /* Messages and API-failure copy follow the language switch like the UI. */
  const { t } = useI18n();
  const notify = useMemo(
    () => showNotification || ((msg: string) => console.log(msg)),
    [showNotification]
  );

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState<LeaveFilters>(() => ({
    ...DEFAULT_LEAVE_FILTERS,
    ...(initialFilters ?? {}),
  }));
  const [list, setList] = useState<LeaveListResult>({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [report, setReport] = useState<LeaveReport>({ month: DEFAULT_LEAVE_FILTERS.month, items: [] });
  const [loading, setLoading] = useState(true);
  /** First load only — afterwards the table stays on screen while it re-fetches. */
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const mutations = useRef(new Set<string>());

  /** Committed search term — what the API is asked for (see SEARCH_DEBOUNCE_MS). */
  const [appliedSearch, setAppliedSearch] = useState(() => (initialFilters?.search ?? '').trim());
  const appliedSearchRef = useRef(appliedSearch);
  /** Monotonic request id: a slow response can never overwrite a newer one. */
  const listSeqRef = useRef(0);

  // Authoritative Employee Master from the backend.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadEmployees();
        if (active) setEmployees(Array.isArray(data) ? data : []);
      } catch {
        if (active) setEmployees([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const fetchList = useCallback(async () => {
    return listLeaves({
      status: filters.status,
      month: filters.month || undefined,
      department: filters.department || undefined,
      employeeId: filters.employeeId ?? undefined,
      leaveType: filters.leaveType === 'All' ? undefined : filters.leaveType,
      search: appliedSearch || undefined,
      page,
      limit: pageSize,
    });
  }, [filters.status, filters.month, filters.department, filters.employeeId, filters.leaveType, appliedSearch, page, pageSize]);

  const fetchReport = useCallback(async () => {
    return getLeaveReport({
      month: filters.month,
      ...(filters.department ? { department: filters.department } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    });
  }, [filters.month, filters.department, filters.employeeId]);

  // Initial + filter-change loads. The async IIFE only touches state after an
  // await, so it never triggers a synchronous setState cascade inside an effect.
  // `cancelled` covers the re-run; `listSeqRef` also covers the manual `refresh`
  // racing this fetch, so the newest answer is always the one rendered.
  useEffect(() => {
    let cancelled = false;
    const seq = ++listSeqRef.current;
    (async () => {
      try {
        const data = await fetchList();
        if (!cancelled && seq === listSeqRef.current) setList(data);
      } catch (e) {
        if (!cancelled && seq === listSeqRef.current) {
          setError(e instanceof Error ? e.message : t('staff.leave.err_load'));
          setList({ items: [], total: 0, page, limit: pageSize, totalPages: 0 });
        }
      } finally {
        // Only the newest request clears the busy flag — a stale response must
        // not hide the progress line of a refresh that is still running.
        if (!cancelled && seq === listSeqRef.current) {
          setLoading(false);
          setLoadedOnce(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchList, page, pageSize, t]);

  useEffect(() => {
    if (!includeReport) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchReport();
        if (!cancelled) setReport(data);
      } catch (e) {
        if (!cancelled) {
          setReportError(e instanceof Error ? e.message : t('staff.leave.err_report'));
          setReport({ month: filters.month, items: [] });
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchReport, filters.month, includeReport, t]);

  const stats = useMemo(() => {
    const requests = list.items;
    return {
      approved: requests.filter((l) => l.status === 'Approved').length,
      pending: requests.filter((l) => l.status === 'Pending').length,
      rejected: requests.filter((l) => l.status === 'Rejected').length,
      onLeaveToday: report.items.filter((r) => r.approvedLeaveDays > 0).length,
      approvedDays: report.items.reduce((s, r) => s + r.approvedLeaveDays, 0),
    };
  }, [list.items, report.items]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e?.department) set.add(String(e.department));
    });
    return Array.from(set).sort();
  }, [employees]);

  const refresh = useCallback(() => {
    const seq = ++listSeqRef.current;
    setLoading(true);
    setError(null);
    fetchList()
      .then((data) => {
        if (seq === listSeqRef.current) setList(data);
      })
      .catch((e) => {
        if (seq !== listSeqRef.current) return;
        setError(e instanceof Error ? e.message : t('staff.leave.err_load'));
        setList({ items: [], total: 0, page, limit: pageSize, totalPages: 0 });
      })
      .finally(() => {
        if (seq === listSeqRef.current) {
          setLoading(false);
          setLoadedOnce(true);
        }
      });
    if (!includeReport) return;
    setReportLoading(true);
    setReportError(null);
    fetchReport()
      .then((data) => setReport(data))
      .catch((e) => {
        setReportError(e instanceof Error ? e.message : t('staff.leave.err_report'));
        setReport({ month: filters.month, items: [] });
      })
      .finally(() => setReportLoading(false));
  }, [fetchList, fetchReport, filters.month, page, pageSize, includeReport, t]);

  const setFilter = useCallback(<K extends keyof LeaveFilters>(key: K, value: LeaveFilters[K]) => {
    // Typing in the search box must not re-fetch per character: the page is
    // reset (and the request started) when the debounced term is committed.
    if (key !== 'search') {
      setLoading(true);
      setPage(1);
    }
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  /** Send the current (or a given) search term to the API and go back to page 1. */
  const commitSearch = useCallback((value?: string) => {
    const normalized = (value ?? filters.search).trim();
    if (appliedSearchRef.current === normalized) return;
    appliedSearchRef.current = normalized;
    setLoading(true);
    setAppliedSearch(normalized);
    setPage(1);
  }, [filters.search]);

  /** Paging: mark the list busy so the page can show its thin progress line. */
  const changePage = useCallback((next: number) => {
    setLoading(true);
    setPage(next);
  }, []);

  const changePageSize = useCallback((size: number) => {
    setLoading(true);
    setPageSize(size);
  }, []);

  // Debounced commit — Enter / the Search button commit immediately through
  // `commitSearch`; this timer then fires with the same value and no-ops.
  useEffect(() => {
    const timer = window.setTimeout(() => commitSearch(filters.search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [commitSearch, filters.search]);

  const resetFilters = useCallback(() => {
    appliedSearchRef.current = '';
    setLoading(true);
    setAppliedSearch('');
    setPage(1);
    setFilters(DEFAULT_LEAVE_FILTERS);
  }, []);

  const addLeave = useCallback(
    async (input: {
      employeeId: number;
      type: LeaveRequest['type'];
      fromDate: string;
      toDate: string;
      days?: number;
      reason?: string;
    }) => {
      try {
        await createLeave(input);
        notify(t('staff.leave.msg_submitted'), 'success');
        refresh();
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : t('staff.leave.err_submit'), 'error');
        return false;
      }
    },
    [notify, refresh, t]
  );

  const approveLeave = useCallback(
    async (id: string) => {
      if (mutations.current.has(id)) return false;
      mutations.current.add(id);
      try {
        await updateLeaveStatus(id, 'Approved');
        notify(t('staff.leave.msg_approved'), 'success');
        refresh();
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : t('staff.leave.err_approve'), 'error');
        return false;
      } finally {
        mutations.current.delete(id);
      }
    },
    [notify, refresh, t]
  );

  const rejectLeave = useCallback(
    async (id: string, rejectionReason: string) => {
      if (!rejectionReason.trim()) {
        notify(t('staff.leave.err_reason_required'), 'error');
        return false;
      }
      if (mutations.current.has(id)) return false;
      mutations.current.add(id);
      try {
        await updateLeaveStatus(id, 'Rejected', { rejectionReason });
        notify(t('staff.leave.msg_rejected'), 'info');
        refresh();
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : t('staff.leave.err_reject'), 'error');
        return false;
      } finally {
        mutations.current.delete(id);
      }
    },
    [notify, refresh, t]
  );

  const deleteLeave = useCallback(
    async (id: string) => {
      if (mutations.current.has(id)) return false;
      mutations.current.add(id);
      try {
        await deleteLeaveApi(id);
        notify(t('staff.leave.msg_deleted'), 'info');
        refresh();
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : t('staff.leave.err_delete'), 'error');
        return false;
      } finally {
        mutations.current.delete(id);
      }
    },
    [notify, refresh, t]
  );

  const cancelLeave = useCallback(async (id: string) => {
    if (mutations.current.has(id)) return false;
    mutations.current.add(id);
    try {
      await updateLeaveStatus(id, 'Cancelled');
      notify(t('staff.leave.msg_cancelled'), 'info');
      refresh();
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : t('staff.leave.err_cancel'), 'error');
      return false;
    } finally {
      mutations.current.delete(id);
    }
  }, [notify, refresh, t]);

  return {
    leaves: list.items,
    allLeaves: list.items,
    report,
    reportLoading,
    reportError,
    stats,
    loading,
    /** True only until the first list response — the page's full-page spinner. */
    initialLoading: loading && !loadedOnce,
    /** True while a later fetch is in flight — the table stays mounted. */
    refreshing: loading && loadedOnce,
    error,
    filters,
    setFilter,
    commitSearch,
    resetFilters,
    employees,
    departments,
    addLeave,
    approveLeave,
    rejectLeave,
    deleteLeave,
    cancelLeave,
    refresh,
    page: list.page,
    pageSize: list.limit,
    total: list.total,
    totalPages: list.totalPages,
    setPage: changePage,
    setPageSize: changePageSize,
  };
}

export type { LeaveReportItem };
