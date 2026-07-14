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
  const [vehicle, setVehicle] = useState("");

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
    if (vehicle) data = data.filter((e) => e.vehicleNo === vehicle);
    return data.sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  }, [expenses, fromDate, toDate, vehicle]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Summary including totalMileage
  const summary = useMemo(() => {
    const base = fuelExpenseService.getSummary();
    const mileage = fuelExpenseService.getTotalMileage();
    return { ...base, totalMileage: mileage };
  }, [expenses]);

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
    setVehicle("");
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
    vehicle,
    setVehicle,
    resetFilters,
    refresh,
    loading,
    summary,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
  };
}