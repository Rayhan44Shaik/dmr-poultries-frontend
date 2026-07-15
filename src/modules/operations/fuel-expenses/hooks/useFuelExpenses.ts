import { useEffect, useMemo, useState } from "react";
import { fuelExpenseService } from "../services/fuelExpenseService";
import type { FuelExpense } from "../types/fuelExpense";

type NotificationFn = (msg: string, type?: "success" | "error" | "info") => void;

export function useFuelExpenses(showNotification?: NotificationFn) {
  const [expenses, setExpenses] = useState<FuelExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  const refresh = () => {
    setLoading(true);
    const data = fuelExpenseService.getAll();
    setExpenses(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredData = useMemo(() => {
    let data = [...expenses];
    if (fromDate) data = data.filter((e) => e.date >= fromDate);
    if (toDate) data = data.filter((e) => e.date <= toDate);
    if (selectedVehicles.length > 0) {
      data = data.filter((e) => selectedVehicles.includes(e.vehicleNo));
    }
    return data.sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  }, [expenses, fromDate, toDate, selectedVehicles]);

  const filteredSummary = useMemo(() => {
    const totalLitres = filteredData.reduce((sum, e) => sum + e.litres, 0);
    const totalAmount = filteredData.reduce((sum, e) => sum + e.amount, 0);
    const pendingCount = filteredData.filter((e) => e.status === "Pending").length;
    const approvedCount = filteredData.filter((e) => e.status === "Approved").length;

    // Avg Efficiency (KM/L)
    const vehicleBills = new Map<number, FuelExpense[]>();
    filteredData.forEach((bill) => {
      if (!vehicleBills.has(bill.vehicleId)) {
        vehicleBills.set(bill.vehicleId, []);
      }
      vehicleBills.get(bill.vehicleId)!.push(bill);
    });

    let totalEfficiency = 0;
    let efficiencyCount = 0;
    vehicleBills.forEach((bills) => {
      bills.sort((a, b) => a.date.localeCompare(b.date) || a.createdDate.localeCompare(b.createdDate));
      for (let i = 1; i < bills.length; i++) {
        const prev = bills[i - 1];
        const curr = bills[i];
        const distance = curr.meterReading - prev.meterReading;
        if (distance > 0 && curr.litres > 0) {
          totalEfficiency += distance / curr.litres;
          efficiencyCount++;
        }
      }
    });
    const avgMileage = efficiencyCount > 0 ? totalEfficiency / efficiencyCount : null;

    // Recent Trip Mileage: only when exactly one vehicle is selected
    let recentTripMileage = null;
    if (selectedVehicles.length === 1) {
      const vehicle = selectedVehicles[0];
      const vehicleBillsForRecent = filteredData
        .filter((b) => b.vehicleNo === vehicle)
        .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
      if (vehicleBillsForRecent.length >= 2) {
        const latest = vehicleBillsForRecent[0];
        const previous = vehicleBillsForRecent[1];
        const distance = latest.meterReading - previous.meterReading;
        if (distance > 0 && previous.litres > 0) {
          recentTripMileage = distance / previous.litres;
        }
      }
    }

    return {
      totalLitres,
      totalAmount,
      pendingCount,
      approvedCount,
      avgMileage,
      recentTripMileage,
    };
  }, [filteredData, selectedVehicles]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CRUD methods unchanged
  const saveExpense = (expense: Omit<FuelExpense, "id" | "billNo" | "createdDate" | "createdBy" | "status">) => {
    const ok = fuelExpenseService.save(expense);
    if (ok) {
      showNotification?.("Fuel bill saved successfully!", "success");
      refresh();
    } else {
      showNotification?.("Failed to save fuel bill.", "error");
    }
    return ok;
  };

  const updateExpense = (id: string, updates: Partial<FuelExpense>) => {
    const ok = fuelExpenseService.update(id, updates);
    if (ok) {
      showNotification?.("Fuel bill updated successfully!", "success");
      refresh();
    } else {
      showNotification?.("Edit not allowed (approved or older than 10 days).", "error");
    }
    return ok;
  };

  const deleteExpense = (id: string) => {
    const ok = fuelExpenseService.remove(id);
    if (ok) {
      showNotification?.("Fuel bill deleted successfully!", "success");
      refresh();
    } else {
      showNotification?.("Delete not allowed (approved or older than 10 days).", "error");
    }
    return ok;
  };

  const approveExpense = (id: string) => {
    const ok = fuelExpenseService.approve(id);
    if (ok) {
      showNotification?.("Fuel bill approved successfully!", "success");
      refresh();
    } else {
      showNotification?.("Failed to approve fuel bill.", "error");
    }
    return ok;
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setSelectedVehicles([]);
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
    resetFilters,
    refresh,
    loading,
    filteredSummary,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
  };
}