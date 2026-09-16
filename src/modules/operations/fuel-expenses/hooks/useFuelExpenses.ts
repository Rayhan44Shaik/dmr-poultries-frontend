import { useCallback, useEffect, useRef, useState } from "react";
import {
  fuelExpenseService,
  type FuelListMeta,
  type FuelListSummary,
} from "../services/fuelExpenseService";
import type { FuelExpense, FuelExpenseDraft } from "../types/fuelExpense";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;

export function useFuelExpenses(showNotification?: NotificationFn) {
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [meta, setMeta] = useState<FuelListMeta>({ total: 0, page: 1, limit: 1000, totalPages: 1 });
  const [summary, setSummary] = useState<FuelListSummary>({
    totalLitres: 0,
    totalAmount: 0,
    pendingCount: 0,
    approvedCount: 0,
    avgMileage: null,
    recentTripMileage: null,
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError(null);
    try {
      // Fetch the full register for snappy client-side filtering, sorting, tab counts, and pagination
      const result = await fuelExpenseService.list({
        page: 1,
        limit: 2000,
      });
      if (requestSeqRef.current !== seq) return;
      setExpenses(result.data);
      setMeta(result.meta);
      setSummary(result.summary);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      const message = err instanceof Error ? err.message : "Failed to load fuel expenses.";
      setError(message);
      showNotification?.(message, "error");
    } finally {
      if (requestSeqRef.current === seq) {
        setLoading(false);
      }
    }
  }, [showNotification]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveExpense = async (expense: FuelExpenseDraft) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.save(expense);
      showNotification?.("Fuel bill saved successfully!", "success");
      await refresh();
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
      showNotification?.("Fuel bill updated successfully!", "success");
      await refresh();
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
      await fuelExpenseService.remove(id);
      showNotification?.("Fuel bill deleted successfully!", "success");
      await refresh();
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
      showNotification?.("Fuel bill approved successfully!", "success");
      await refresh();
      return true;
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : "Failed to approve fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const rejectExpense = async (id: string, reason: string) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.reject(id, reason);
      showNotification?.("Fuel bill rejected.", "success");
      await refresh();
      return true;
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : "Failed to reject fuel bill.", "error");
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
    isSaving,
    error,
    refresh,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
  };
}
