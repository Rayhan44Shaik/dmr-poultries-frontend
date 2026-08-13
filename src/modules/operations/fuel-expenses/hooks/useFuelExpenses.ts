// src/modules/operations/fuel-expenses/hooks/useFuelExpenses.ts

import { useEffect, useMemo, useState, useCallback } from "react";
import { fuelExpenseService } from "../services/fuelExpenseService";
import type { FuelExpense, FuelExpenseInput, FuelSourceType, FuelApprovalStatus } from "../types/fuelExpense";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;

export function useFuelExpenses(showNotification?: NotificationFn) {
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<"ALL" | FuelSourceType>("ALL");
  const [approvalStatus, setApprovalStatus] = useState<"ALL" | FuelApprovalStatus>("ALL");
  const [search, setSearch] = useState("");

  // Fetch everything (not deleted) and filter client-side for vehicle-number
  // multi-select + search, since the backend expects a single vehicleId.
  // Backend-native filters (date range, source, status) are still sent so
  // large datasets don't have to be pulled down unnecessarily.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fuelExpenseService.getAll({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        sourceType,
        status: approvalStatus,
        search: search || undefined,
      });
      setExpenses(data);
    } catch {
      showNotification?.("Failed to load fuel expenses from server.", "error");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, sourceType, approvalStatus, search, showNotification]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, sourceType, approvalStatus, search]);

  const filteredData = useMemo(() => {
    let data = [...expenses];
    if (selectedVehicles.length > 0) {
      data = data.filter((e) => e.vehicleNo && selectedVehicles.includes(e.vehicleNo));
    }
    return data.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [expenses, selectedVehicles]);

  const filteredSummary = useMemo(() => {
    const totalLitres = filteredData.reduce((sum, e) => sum + e.liters, 0);
    const totalAmount = filteredData.reduce((sum, e) => sum + e.amount, 0);
    const approvedAmount = filteredData
      .filter((e) => e.status === "Approved")
      .reduce((sum, e) => sum + e.amount, 0);
    const pendingCount = filteredData.filter(
      (e) => e.status === "Pending Approval" || e.status === "Draft"
    ).length;
    const approvedCount = filteredData.filter((e) => e.status === "Approved").length;
    const rejectedCount = filteredData.filter((e) => e.status === "Rejected").length;
    const tripCount = filteredData.filter((e) => e.sourceType === "TRIP").length;
    const manualCount = filteredData.filter((e) => e.sourceType === "MANUAL").length;

    const vehicleBills = new Map<string, FuelExpense[]>();
    filteredData.forEach((bill) => {
      const key = bill.vehicleNo ?? "";
      if (!vehicleBills.has(key)) vehicleBills.set(key, []);
      vehicleBills.get(key)!.push(bill);
    });

    let totalEfficiency = 0;
    let efficiencyCount = 0;
    vehicleBills.forEach((bills) => {
      bills.sort((a, b) => a.billDate.localeCompare(b.billDate));
      for (let i = 1; i < bills.length; i++) {
        const prev = bills[i - 1];
        const curr = bills[i];
        const distance = curr.currentMeter - prev.currentMeter;
        if (distance > 0 && curr.liters > 0) {
          totalEfficiency += distance / curr.liters;
          efficiencyCount++;
        }
      }
    });
    const avgMileage = efficiencyCount > 0 ? totalEfficiency / efficiencyCount : null;

    let recentTripMileage: number | null = null;
    if (selectedVehicles.length === 1) {
      const vehicle = selectedVehicles[0];
      const vehicleBillsForRecent = filteredData
        .filter((b) => b.vehicleNo === vehicle)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      if (vehicleBillsForRecent.length >= 2) {
        const latest = vehicleBillsForRecent[0];
        const previous = vehicleBillsForRecent[1];
        const distance = latest.currentMeter - previous.currentMeter;
        if (distance > 0 && previous.liters > 0) {
          recentTripMileage = distance / previous.liters;
        }
      }
    }

    return {
      totalLitres,
      totalAmount,
      approvedAmount,
      pendingCount,
      approvedCount,
      rejectedCount,
      tripCount,
      manualCount,
      avgMileage,
      recentTripMileage,
    };
  }, [filteredData, selectedVehicles]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const saveExpense = async (expense: FuelExpenseInput) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.create(expense);
      showNotification?.("Fuel expense submitted successfully. Status: PENDING", "success");
      await refresh();
      return true;
    } catch {
      showNotification?.("Failed to save fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateExpense = async (id: string, updates: Partial<FuelExpenseInput>) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.update(id, updates);
      showNotification?.("Fuel bill updated successfully!", "success");
      await refresh();
      return true;
    } catch (err: any) {
      const message = err?.message || "Edit not allowed.";
      showNotification?.(message, "error");
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
    } catch {
      showNotification?.("Delete not allowed.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const approveExpense = async (id: string, approvedBy?: string) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.approve(id, approvedBy);
      showNotification?.("Fuel bill approved successfully!", "success");
      await refresh();
      return true;
    } catch (err: any) {
      showNotification?.(err?.message || "Failed to approve fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const rejectExpense = async (id: string, reason: string, rejectedBy?: string) => {
    setIsSaving(true);
    try {
      await fuelExpenseService.reject(id, reason, rejectedBy);
      showNotification?.("Fuel bill rejected.", "success");
      await refresh();
      return true;
    } catch (err: any) {
      showNotification?.(err?.message || "Failed to reject fuel bill.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setSelectedVehicles([]);
    setSourceType("ALL");
    setApprovalStatus("ALL");
    setSearch("");
    setCurrentPage(1);
  };

  return {
    expenses,
    filteredData,
    paginatedData,
    currentPage,
    setCurrentPage,
    totalPages,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    selectedVehicles,
    setSelectedVehicles,
    sourceType,
    setSourceType,
    approvalStatus,
    setApprovalStatus,
    search,
    setSearch,
    resetFilters,
    refresh,
    loading,
    isSaving,
    filteredSummary,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
  };
}
