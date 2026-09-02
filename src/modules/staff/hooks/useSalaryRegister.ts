// src/modules/staff/hooks/useSalaryRegister.ts
// Backend-authoritative salary register hook. Records are loaded from
// GET /api/staff/salaries?month=YYYY-MM and every mutation (bulk mark
// paid / mark unpaid / generate / submit month) is a backend call followed by
// a reload. No localStorage, no synthetic rows, no frontend salary calculation.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  bulkUpdateSalaryStatus,
  generateSalaries,
  listSalaries,
  handleApiError,
} from "../services/salaryService";
import type { SalaryRecord } from "../types/staffDashboard";

export interface SalaryRegisterTotals {
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  netPayroll: number;
  paidCount: number;
  pendingCount: number;
  submittedCount: number;
}

export function useSalaryRegister(month: string, department: string = "") {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Submitted' | 'Paid'>('All');

  const requestSeq = useRef(0);
  const initialLoaded = useRef(false);

  // Initial load only (full spinner is acceptable on first paint).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listSalaries(month, department || undefined);
        if (!cancelled) setRecords(data);
      } catch (err) {
        if (!cancelled) setError(handleApiError(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialLoaded.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, department]);

  /** Refresh preserves existing rows — no blanking, no full-page spinner. */
  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    setRefreshing(true);
    setError(null);
    try {
      const data = await listSalaries(month, department || undefined);
      if (seq === requestSeq.current) setRecords(data);
    } catch (err) {
      if (seq === requestSeq.current) setError(handleApiError(err));
    } finally {
      if (seq === requestSeq.current) setRefreshing(false);
    }
  }, [month, department]);

  const filteredRecords = useMemo(() => {
    if (filter === 'All') return records;
    return records.filter((r) => r.status === filter);
  }, [records, filter]);

  const totals = useMemo<SalaryRegisterTotals>(() => {
    return {
      totalEmployees: records.length,
      totalGross: records.reduce((sum, r) => sum + r.totalGross, 0),
      totalDeductions: records.reduce((sum, r) => sum + r.totalDeductions, 0),
      netPayroll: records.reduce((sum, r) => sum + r.netSalary, 0),
      paidCount: records.filter((r) => r.status === 'Paid').length,
      pendingCount: records.filter((r) => r.status === 'Pending').length,
      submittedCount: records.filter((r) => r.status === 'Submitted').length,
    };
  }, [records]);

  const runMutation = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setSaving(true);
      setError(null);
      try {
        await action();
        await refresh();
        return { ok: true as const, message: successMessage };
      } catch (err) {
        const message = handleApiError(err);
        setError(message);
        return { ok: false as const, message };
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  /** Bulk Mark as Paid — one transaction for the whole selection. */
  const markPaidBulk = useCallback(
    (ids: string[], input: { paymentDate: string; paymentMode: string }) =>
      runMutation(
        () =>
          bulkUpdateSalaryStatus(ids, {
            status: "Paid",
            paymentDate: input.paymentDate,
            paymentMode: input.paymentMode,
          }),
        `Marked ${ids.length} salary record${ids.length === 1 ? "" : "s"} as Paid.`
      ),
    [runMutation]
  );

  /** Bulk Mark as Unpaid — Pending/Submitted stay; Paid reverts only inside
   *  the 7-day correction window; the batch aborts atomically otherwise. */
  const markUnpaidBulk = useCallback(
    (ids: string[]) =>
      runMutation(
        () => bulkUpdateSalaryStatus(ids, { status: "Pending" }),
        `Marked ${ids.length} salary record${ids.length === 1 ? "" : "s"} as unpaid — returned to Pending.`
      ),
    [runMutation]
  );

  const generate = useCallback(
    () =>
      runMutation(
        () => generateSalaries(month, department || undefined),
        "Salary register generated for the month."
      ),
    [runMutation, month, department]
  );

  return {
    records: filteredRecords,
    allRecords: records,
    totals,
    filter,
    setFilter,
    loading,
    refreshing,
    saving,
    error,
    refresh,
    markPaidBulk,
    markUnpaidBulk,
    generate,
    hasRecords: records.length > 0,
  };
}