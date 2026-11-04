import { useCallback, useEffect, useRef, useState } from "react";
import {
  fuelExpenseService,
  type FuelListMeta,
  type FuelListSummary,
} from "../services/fuelExpenseService";
import type { FuelExpense, FuelExpenseDraft } from "../types/fuelExpense";
import { useI18n } from "../../../../i18n";
import { isCanceledError } from "../../../../api/errors";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;
const FETCH_PAGE_SIZE = 200;

export function useFuelExpenses(showNotification?: NotificationFn) {
  const { t } = useI18n();
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [deletedMap, setDeletedMap] = useState<Map<string, FuelExpense>>(new Map());
  const [meta, setMeta] = useState<FuelListMeta>({ total: 0, page: 1, limit: FETCH_PAGE_SIZE, totalPages: 1 });
  const [summary, setSummary] = useState<FuelListSummary>({
    totalLitres: 0,
    totalAmount: 0,
    pendingCount: 0,
    approvedCount: 0,
    totalDistance: null,
    avgMileage: null,
    recentTripMileage: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const expensesRef = useRef(expenses);
  const deletedMapRef = useRef(deletedMap);
  useEffect(() => { expensesRef.current = expenses; }, [expenses]);
  useEffect(() => { deletedMapRef.current = deletedMap; }, [deletedMap]);

  const refresh = useCallback(async (quiet = false) => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    const keepRows = quiet || expensesRef.current.length > 0;
    if (keepRows) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const fetched: FuelExpense[] = [];
      let page = 1;
      let totalPages = 1;
      let lastMeta: FuelListMeta | null = null;
      let lastSummary: FuelListSummary | null = null;
      do {
        const result = await fuelExpenseService.list({ page, limit: FETCH_PAGE_SIZE, includeDeleted: true });
        if (requestSeqRef.current !== seq) return false;
        fetched.push(...result.data);
        lastMeta = result.meta;
        lastSummary = result.summary;
        totalPages = Math.max(1, result.meta.totalPages);
        page += 1;
      } while (page <= totalPages && page <= 20);

      const activeIds = new Set(fetched.map((row) => row.id));
      const combined = [...fetched];
      for (const [delId, delItem] of deletedMapRef.current.entries()) {
        if (!activeIds.has(delId)) combined.push(delItem);
      }
      setExpenses(combined);
      if (lastMeta) setMeta(lastMeta);
      if (lastSummary) setSummary(lastSummary);
      return true;
    } catch (err) {
      if (isCanceledError(err) || requestSeqRef.current !== seq) return false;
      const message = err instanceof Error ? err.message : "Failed to load fuel expenses.";
      setError(message);
      showNotification?.(message, "error");
      return false;
    } finally {
      if (requestSeqRef.current === seq) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [showNotification]);

  useEffect(() => {
    void refresh();
    // First load only — later refreshes are explicit (toolbar / save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveExpense = async (expense: FuelExpenseDraft) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.save(expense);
      await refresh(true);
      return true;
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : "Failed to save fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateExpense = async (id: string, updates: Partial<FuelExpense>) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.update(id, updates);
      await refresh(true);
      return true;
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : "Failed to update fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    setIsSaving(true);
    try {
      const target = expenses.find((e) => e.id === id);
      await fuelExpenseService.remove(id);
      if (target) {
        const deletedRecord: FuelExpense = {
          ...target,
          status: "Deleted",
          deleted: true,
          deletedAt: new Date().toISOString(),
        };
        setDeletedMap((prev) => new Map(prev).set(id, deletedRecord));
        setExpenses((prev) => prev.map((e) => (e.id === id ? deletedRecord : e)));
      }
      // Refetch the canonical register so the table, KPI cards and footer
      // totals/mileage all reflect the backend state (filters/sort/tab/page
      // are owned by the page and therefore retained).
      await refresh(true);
      showNotification?.(t("ops.fuel.deleted_success"), "success");
      return true;
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : "Failed to delete fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const approveExpense = async (id: string) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.approve(id);
      showNotification?.(t("ops.fuel.approved_success"), "success");
      await refresh(true);
      return true;
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : "Failed to approve fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    expenses,
    filteredData: expenses,
    meta,
    summary,
    loading,
    refreshing,
    isSaving,
    error,
    refresh,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
  };
}