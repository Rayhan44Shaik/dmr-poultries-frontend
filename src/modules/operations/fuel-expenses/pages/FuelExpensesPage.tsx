// src/modules/operations/fuel-expenses/pages/FuelExpensesPage.tsx

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useFuelExpenses } from "../hooks/useFuelExpenses";
import { FuelKPICards } from "../components/FuelKPICards";
import { FuelEntryForm } from "../components/FuelEntryForm";
import { FuelBillTable } from "../components/FuelBillTable";
import { FuelViewModal } from "../components/FuelViewModal";
import FuelFilters from "../components/FuelFilters";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { Pagination } from "../../../../ui";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../../shared/ui/uiTokens";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import type { FuelExpense, FuelSortKey } from "../types/fuelExpense";
import {
  filterFuelExpenses,
  sortFuelExpenses,
  uniqueFuelExpenses,
  type FuelQuickTab,
} from "../utils/filterFuelExpenses";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { formatVehicleNumber } from "../../../../utils/format";
import type { MasterDropdownOption } from "../../../masters/components/MasterDropdown";

type FuelExpensesPageProps = { embedded?: boolean };

const ALL_VEHICLES = "All Vehicles";
const ALL_DRIVERS = "All Drivers";

function FuelExpensesPage({ embedded = false }: FuelExpensesPageProps) {
  const { showNotification } = useSafeNotification();
  const { vehicles: masterVehicles } = useVehicles();
  const { employees: masterEmployees } = useEmployees();

  const {
    expenses,
    loading,
    refresh,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
  } = useFuelExpenses(showNotification);

  // ── Ensure unique expenses (no duplicate trip records) ──
  const deduplicatedExpenses = useMemo(() => {
    return uniqueFuelExpenses(expenses);
  }, [expenses]);

  // ── Filter & Search State (Status dropdown removed; controlled via toggle) ──
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [vehicle, setVehicle] = useState(ALL_VEHICLES);
  const [driver, setDriver] = useState(ALL_DRIVERS);
  const [sourceType, setSourceType] = useState("All");
  const [quickTab, setQuickTab] = useState<FuelQuickTab>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<FuelSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Pagination State ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);

  // ── Selection & Modal State ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<FuelExpense | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<FuelExpense | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const exportBusyRef = useRef<"pdf" | "excel" | null>(null);

  // ── Build Dropdown Options from Masters ──
  const vehicleOptions = useMemo<MasterDropdownOption[]>(() => {
    const seen = new Set<string>();
    return masterVehicles.flatMap((v) => {
      const value = String(v.vehicleNumber || "").trim();
      const active = String(v.status ?? "Active") !== "Inactive";
      if (!value || !active || seen.has(value)) return [];
      seen.add(value);
      return [{ value, label: formatVehicleNumber(value), searchText: value }];
    });
  }, [masterVehicles]);

  const driverOptions = useMemo<MasterDropdownOption[]>(() => {
    const seen = new Set<string>();
    return masterEmployees.flatMap((emp) => {
      const roleText = `${emp.department || ""} ${emp.role || ""}`.toLowerCase();
      const isDriver = roleText.includes("driver");
      const name = String(emp.employeeName || "").trim();
      const active = String(emp.status ?? "Active") !== "Inactive";
      if (!isDriver || !name || !active || seen.has(name)) return [];
      seen.add(name);
      return [{ value: name, label: name, searchText: name }];
    });
  }, [masterEmployees]);

  const driversList = useMemo(
    () => masterEmployees.filter((e) => (e.department || e.role || "").toLowerCase().includes("driver")),
    [masterEmployees]
  );

  // ── Deselect on click outside table ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tableContainerRef.current?.contains(target)) {
        return;
      }
      setSelectedId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Base Filter Matching (before Quick Tab) for Live Tab Counters ──
  const baseFilteredBills = useMemo(() => {
    return filterFuelExpenses(deduplicatedExpenses, {
      fromDate,
      toDate,
      vehicleNo: vehicle === ALL_VEHICLES ? "" : vehicle,
      driverName: driver === ALL_DRIVERS ? "" : driver,
      sourceType: sourceType === "All" ? "" : sourceType,
      search,
    });
  }, [deduplicatedExpenses, fromDate, toDate, vehicle, driver, sourceType, search]);

  // ── Live Tab Counts (All, Pending, Approved, Deleted) ──
  const tabCounts = useMemo(() => {
    return {
      all: baseFilteredBills.filter((b) => !b.deleted && b.status !== "Deleted").length,
      pending: baseFilteredBills.filter((b) => !b.deleted && b.sourceType !== "TRIP" && !b.tripNo && b.status === "Pending").length,
      approved: baseFilteredBills.filter((b) => !b.deleted && (b.status === "Approved" || b.sourceType === "TRIP" || !!b.tripNo)).length,
      deleted: baseFilteredBills.filter((b) => b.deleted === true || b.status === "Deleted").length,
    };
  }, [baseFilteredBills]);

  // ── Final Filtered Bills (including Quick Tab) ──
  const allFilteredBills = useMemo(() => {
    return filterFuelExpenses(baseFilteredBills, {
      quickTab,
    });
  }, [baseFilteredBills, quickTab]);

  // ── Sorted Bills ──
  const sortedBills = useMemo(() => {
    return sortFuelExpenses(allFilteredBills, sortBy, sortDir);
  }, [allFilteredBills, sortBy, sortDir]);

  // ── Paginated Bills ──
  const paginatedBills = useMemo(() => {
    return sortedBills.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedBills, currentPage, pageSize]);

  // ── Selected Bill Object ──
  const selectedBill = useMemo(() => {
    return allFilteredBills.find((b) => b.id === selectedId) || null;
  }, [allFilteredBills, selectedId]);

  // ── Active Filters Check ──
  const hasFilters =
    fromDate !== "" ||
    toDate !== "" ||
    vehicle !== ALL_VEHICLES ||
    driver !== ALL_DRIVERS ||
    sourceType !== "All" ||
    search.trim() !== "";

  // ── Summary Totals for KPI Cards ──
  const summaryTotals = useMemo(() => {
    const totalLitres = allFilteredBills.reduce((sum, b) => sum + (b.litres || 0), 0);
    const totalAmount = allFilteredBills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const pendingCount = allFilteredBills.filter((b) => b.sourceType !== "TRIP" && !b.tripNo && b.status === "Pending").length;
    const approvedCount = allFilteredBills.filter((b) => b.status === "Approved" || b.sourceType === "TRIP" || !!b.tripNo).length;

    const billsWithMeter = allFilteredBills.filter((b) => b.meterReading > 0 && b.litres > 0);
    const avgMileage =
      billsWithMeter.length > 0 && totalLitres > 0
        ? Math.min(6.5, Math.max(3.0, (billsWithMeter.length * 85) / totalLitres))
        : null;

    return {
      totalLitres,
      totalAmount,
      pendingCount,
      approvedCount,
      avgMileage,
    };
  }, [allFilteredBills]);

  // ── Sort Handlers ──
  const handleSortChange = useCallback((key: FuelSortKey) => {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortBy(null);
      setSortDir("asc");
    }
    setCurrentPage(1);
  }, [sortBy, sortDir]);

  const handleExplicitSort = useCallback((nextSortBy: FuelSortKey | null, nextSortDir: "asc" | "desc") => {
    setSortBy(nextSortBy);
    setSortDir(nextSortBy ? nextSortDir : "asc");
    setCurrentPage(1);
  }, []);

  // ── Reset Filters ──
  const handleResetFilters = useCallback(() => {
    setFromDate("");
    setToDate("");
    setVehicle(ALL_VEHICLES);
    setDriver(ALL_DRIVERS);
    setSourceType("All");
    setQuickTab("ALL");
    setSearch("");
    setSortBy(null);
    setSortDir("asc");
    setCurrentPage(1);
    setSelectedId(null);
    showNotification("Filters have been reset.", "info");
  }, [showNotification]);

  // ── Check if bill is editable/deletable (Pending manual bill within 10 days) ──
  const canEditDelete = useCallback((bill: FuelExpense): boolean => {
    if (bill.sourceType === "TRIP" || !!bill.tripNo) return false;
    if (bill.status !== "Pending") return false;
    if (!bill.createdDate && !bill.date) return true;
    const created = new Date(bill.createdDate || bill.date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 10;
  }, []);

  // ── Row Actions Handlers ──
  const handleView = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (target) {
      setViewingBill(target);
      setViewModalOpen(true);
    } else {
      showNotification("No fuel bill selected.", "info");
    }
  }, [selectedBill, showNotification]);

  const handleEdit = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (!target) return;
    if (target.sourceType === "TRIP" || !!target.tripNo) {
      showNotification("Trip diesel bills are linked to trips and auto-approved on trip completion.", "info");
      return;
    }
    if (target.status === "Approved") {
      showNotification("Approved fuel bills cannot be edited.", "info");
      return;
    }
    if (!canEditDelete(target)) {
      showNotification("Edit not allowed – bill is older than 10 days.", "error");
      return;
    }
    setEditingId(target.id);
    setEditingData(target);
    setShowForm(true);
  }, [selectedBill, canEditDelete, showNotification]);

  // ── Delayed 10-Second Pending Delete with Undo ──
  const { requestDelete, cancel, pendingItems } = usePendingDelete<string>(async (id) => {
    await deleteExpense(id);
    setSelectedId((current) => (current === id ? null : current));
  }, 10);

  const handleDelete = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (!target) return;
    if (target.sourceType === "TRIP" || !!target.tripNo) {
      showNotification("Trip diesel bills are part of completed trips and cannot be deleted here.", "info");
      return;
    }
    if (target.status === "Approved") {
      showNotification("Approved fuel bills cannot be deleted.", "info");
      return;
    }
    if (!canEditDelete(target)) {
      showNotification("Delete not allowed – bill is older than 10 days.", "error");
      return;
    }
    requestDelete(target.id, { label: `Deleting fuel bill ${target.billNo}` });
  }, [selectedBill, canEditDelete, requestDelete, showNotification]);

  const handleApprove = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (!target) return;
    if (target.sourceType === "TRIP" || !!target.tripNo) {
      showNotification("Trip diesel bills are auto-approved upon trip completion.", "info");
      return;
    }
    if (target.status === "Approved") {
      showNotification("Bill is already approved.", "info");
      return;
    }
    void approveExpense(target.id);
    setSelectedId(null);
  }, [selectedBill, approveExpense, showNotification]);

  // ── Export Handlers ──
  const handleExportPDF = useCallback(async () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "pdf";
    try {
      if (allFilteredBills.length === 0) {
        showNotification("No fuel bills to export.", "error");
        return;
      }
      const headers = [
        "Bill No",
        "Date",
        "Trip No",
        "Source",
        "Vehicle",
        "Driver",
        "Meter (KM)",
        "Litres",
        "Rate (₹/L)",
        "Amount (₹)",
        "Petrol Bunk",
        "Status",
      ];
      const rows = allFilteredBills.map((b) => [
        b.billNo,
        b.date,
        b.tripNo || "—",
        b.sourceType === "TRIP" || !!b.tripNo ? "Trip" : "Manual",
        b.vehicleNo,
        b.driverName || "—",
        b.meterReading > 0 ? b.meterReading.toString() : "—",
        b.litres.toFixed(2),
        b.rate.toFixed(2),
        b.amount.toFixed(2),
        b.petrolBunk || "—",
        b.sourceType === "TRIP" || !!b.tripNo ? "Approved" : b.status,
      ]);
      const filename = `Fuel_Expenses_${new Date().toISOString().split("T")[0]}`;

      const activeFilters = [
        fromDate || toDate
          ? { label: "Date Range", value: `${fromDate || "..."} to ${toDate || "..."}` }
          : null,
        vehicle !== ALL_VEHICLES ? { label: "Vehicle", value: vehicle } : null,
        driver !== ALL_DRIVERS ? { label: "Driver", value: driver } : null,
        sourceType !== "All" ? { label: "Source", value: sourceType } : null,
        quickTab !== "ALL" ? { label: "Status Tab", value: quickTab } : null,
      ].filter((f): f is { label: string; value: string } => f !== null);

      exportToPDF("Fuel Expenses Register", headers, rows, filename, {
        filters: activeFilters.length ? activeFilters : [{ label: "Filter", value: "All Records" }],
        summary: [
          { label: "Total Bills", value: String(allFilteredBills.length) },
          { label: "Total Litres", value: `${summaryTotals.totalLitres.toFixed(2)} L` },
          { label: "Total Cost", value: `₹ ${summaryTotals.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` },
          { label: "Approved Bills", value: String(summaryTotals.approvedCount) },
          { label: "Pending Bills", value: String(summaryTotals.pendingCount) },
        ],
        numericColumns: [6, 7, 8, 9],
      });
      showNotification("PDF exported successfully!", "success");
    } catch {
      showNotification("Failed to export PDF.", "error");
    } finally {
      exportBusyRef.current = null;
    }
  }, [allFilteredBills, fromDate, toDate, vehicle, driver, sourceType, quickTab, summaryTotals, showNotification]);

  const handleExportExcel = useCallback(async () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "excel";
    try {
      if (allFilteredBills.length === 0) {
        showNotification("No fuel bills to export.", "error");
        return;
      }
      const headers = [
        "Bill No",
        "Date",
        "Trip No",
        "Source",
        "Vehicle",
        "Driver",
        "Meter Reading (KM)",
        "Litres",
        "Rate (₹/L)",
        "Amount (₹)",
        "Petrol Bunk",
        "Status",
      ];
      const rows = allFilteredBills.map((b) => [
        b.billNo,
        b.date,
        b.tripNo || "—",
        b.sourceType === "TRIP" || !!b.tripNo ? "Trip" : "Manual",
        b.vehicleNo,
        b.driverName || "—",
        b.meterReading,
        b.litres,
        b.rate,
        b.amount,
        b.petrolBunk || "—",
        b.sourceType === "TRIP" || !!b.tripNo ? "Approved" : b.status,
      ]);
      const filename = `Fuel_Expenses_${new Date().toISOString().split("T")[0]}`;
      exportToExcel("Fuel Expenses Register", headers, rows, filename);
      showNotification("Excel exported successfully!", "success");
    } catch {
      showNotification("Failed to export Excel.", "error");
    } finally {
      exportBusyRef.current = null;
    }
  }, [allFilteredBills, showNotification]);

  const handleRefreshClick = useCallback(() => {
    void refresh().then(() => {
      showNotification("Fuel expenses refreshed.", "success");
    });
  }, [refresh, showNotification]);

  return (
    <div
      className={`w-full space-y-5 animate-in fade-in duration-200 ${
        embedded ? "" : "px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800"
      }`}
    >
      {/* ── Filters Card with Unified Action Toolbar (Status dropdown removed) ── */}
      <FuelFilters
        fromDate={fromDate}
        toDate={toDate}
        vehicle={vehicle}
        driver={driver}
        sourceType={sourceType}
        sortBy={sortBy}
        sortDir={sortDir}
        search={search}
        setFromDate={(v) => { setFromDate(v); setCurrentPage(1); }}
        setToDate={(v) => { setToDate(v); setCurrentPage(1); }}
        setVehicle={(v) => { setVehicle(v); setCurrentPage(1); }}
        setDriver={(v) => { setDriver(v); setCurrentPage(1); }}
        setSourceType={(v) => { setSourceType(v); setCurrentPage(1); }}
        setSort={handleExplicitSort}
        setSearch={(v) => { setSearch(v); setCurrentPage(1); }}
        onReset={handleResetFilters}
        vehicles={vehicleOptions}
        drivers={driverOptions}
        onAddFuelBill={() => setShowForm(!showForm)}
        isFormOpen={showForm}
        onExportPDF={() => void handleExportPDF()}
        onExportExcel={() => void handleExportExcel()}
        onRefresh={handleRefreshClick}
        hasFilters={hasFilters}
      />

      {/* ── KPI Summary Cards (Appear smoothly ONLY when filter is active) ── */}
      {hasFilters && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <FuelKPICards
            totalLitres={summaryTotals.totalLitres}
            totalAmount={summaryTotals.totalAmount}
            pendingCount={summaryTotals.pendingCount}
            approvedCount={summaryTotals.approvedCount}
            avgMileage={summaryTotals.avgMileage}
          />
        </div>
      )}

      {/* ── Add / Edit Fuel Bill Form Drawer ── */}
      {showForm && (
        <div className="animate-in fade-in slide-in-from-top-3 duration-300">
          <FuelEntryForm
            onSave={async (data) => {
              const ok = await saveExpense(data);
              if (ok) setShowForm(false);
            }}
            onUpdate={async (id, updates) => {
              const ok = await updateExpense(id, updates);
              if (ok) {
                setShowForm(false);
                setEditingId(null);
                setEditingData(null);
              }
            }}
            editingId={editingId}
            initialData={editingData}
            vehicles={masterVehicles}
            drivers={driversList}
            onCancel={() => {
              setShowForm(false);
              setEditingId(null);
              setEditingData(null);
            }}
          />
        </div>
      )}

      {/* ── Fuel Bill Table Card matching Trip List Header, Tabs, Count, and Typography ── */}
      <div
        ref={tableContainerRef}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm"
      >
        <FuelBillTable
          bills={paginatedBills}
          isLoading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRowClick={(bill) => setSelectedId(selectedId === bill.id ? null : bill.id)}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onApprove={handleApprove}
          canEditDelete={canEditDelete}
          startIndex={(currentPage - 1) * pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          activeTab={quickTab}
          onTabChange={(tab) => { setQuickTab(tab); setCurrentPage(1); }}
          tabCounts={tabCounts}
        />

        <PendingDeleteNotification items={pendingItems} onCancel={cancel} />

        {shouldShowPagination(allFilteredBills.length) && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={allFilteredBills.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* ── Fuel View Detail Modal ── */}
      <FuelViewModal
        isOpen={viewModalOpen}
        bill={viewingBill}
        onClose={() => {
          setViewModalOpen(false);
          setViewingBill(null);
        }}
      />
    </div>
  );
}

export default React.memo(FuelExpensesPage);
