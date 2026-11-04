// src/modules/operations/fuel-expenses/pages/FuelExpensesPage.tsx

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useFuelExpenses } from "../hooks/useFuelExpenses";
import { FuelKPICards } from "../components/FuelKPICards";
import { FuelEntryForm } from "../components/FuelEntryForm";
import { FuelBillTable } from "../components/FuelBillTable";
import { FuelViewModal } from "../components/FuelViewModal";
import FuelFilters from "../components/FuelFilters";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { CAPABILITIES, useCan } from "../../../auth/permissions";
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
  getLatestApprovedFuelExpensesPerVehicle,
  type FuelQuickTab,
  effectiveStatus,
} from "../utils/filterFuelExpenses";
import { summarizeFuelBills } from "../utils/fuelSummary";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { useI18n } from "../../../../i18n";
import { formatVehicleNumber } from "../../../../utils/format";
import type { MasterDropdownOption } from "../../../masters/components/MasterDropdown";
import { loadBirdTypes } from "../../../masters/bird-types/services/birdTypeService";
import type { BirdType } from "../../../masters/bird-types/types/birdType";

type FuelExpensesPageProps = { embedded?: boolean };

const ALL_VEHICLES = "All Vehicles";
const ALL_DRIVERS = "All Drivers";
const ALL_BUNKS = "All Bunks";
const isGenericOtherBunk = (value: string) => /^others?$/i.test(value.trim());
const withinManualWindow = (bill: FuelExpense) => Date.now() - new Date(bill.createdDate).getTime() <= 14 * 24 * 60 * 60 * 1000;

function FuelExpensesPage({ embedded = false }: FuelExpensesPageProps) {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  // Entry-only roles (supervisor) can add fuel bills but never approve/delete.
  const can = useCan();
  const { vehicles: masterVehicles } = useVehicles();
  const { employees: masterEmployees } = useEmployees();

  const {
    expenses,
    loading,
    refreshing,
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
  const [bunk, setBunk] = useState(ALL_BUNKS);
  const [sourceType, setSourceType] = useState("All");
  const [quickTab, setQuickTab] = useState<FuelQuickTab>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<FuelSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [includeMasterBunks, setIncludeMasterBunks] = useState(true);

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
  const [fuelBunks, setFuelBunks] = useState<BirdType[]>([]);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const exportBusyRef = useRef<"pdf" | "excel" | null>(null);

  useEffect(() => {
    let active = true;
    void loadBirdTypes()
      .then((rows) => {
        if (active) setFuelBunks(rows.filter((row) => row.category === "Fuel Bunk" && row.status === "Active"));
      })
      .catch(() => { if (active) setFuelBunks([]); });
    return () => { active = false; };
  }, []);

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

  const bunkOptions = useMemo<MasterDropdownOption[]>(() => {
    const names = new Map<string, string>();
    fuelBunks.forEach((item) => {
      const name = item.birdType.trim();
      if (isGenericOtherBunk(name)) return;
      const key = name.toLocaleLowerCase();
      if (!names.has(key)) names.set(key, name);
    });
    return [
      { value: "__OTHER__", label: "Other", searchText: "other others custom non-master" },
      ...[...names.values()].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name, searchText: name })),
    ];
  }, [fuelBunks]);

  const driversList = useMemo(
    () => masterEmployees.filter((e) => (e.department || e.role || "").toLowerCase().includes("driver")),
    [masterEmployees]
  );
  const supervisorsList = useMemo(
    () => masterEmployees.filter((e) => `${e.department} ${e.secondaryDepartment ?? ""} ${e.role ?? ""}`.toLowerCase().includes("supervisor")),
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
  // Deleted rows are kept here so the Deleted register tab (applied below)
  // can see them; the active quick tabs filter them out again downstream.
  const baseFilteredBills = useMemo(() => {
    return filterFuelExpenses(deduplicatedExpenses, {
      fromDate,
      toDate,
      vehicleNo: vehicle === ALL_VEHICLES ? "" : vehicle,
      driverName: driver === ALL_DRIVERS ? "" : driver,
      petrolBunk: bunk === ALL_BUNKS ? "" : bunk,
      includeDeleted: true,
      masterBunkNames: fuelBunks
        .map((item) => item.birdType.trim())
        .filter((name) => name && !isGenericOtherBunk(name)),
      sourceType: sourceType === "All" ? "" : sourceType,
      includeMasterBunks,
      search,
    });
  }, [deduplicatedExpenses, fromDate, toDate, vehicle, driver, bunk, sourceType, search, fuelBunks, includeMasterBunks]);

  // ── Live Tab Counts (All, Pending, Approved, Deleted) ──
  const tabCounts = useMemo(() => {
    const approvedBills = baseFilteredBills.filter((b) => !b.deleted && b.status !== "Deleted" && effectiveStatus(b) === "Approved");

    return {
      all: baseFilteredBills.filter((b) => !b.deleted && b.status !== "Deleted").length,
      pending: baseFilteredBills.filter((b) => !b.deleted && b.sourceType !== "TRIP" && !b.tripNo && b.status === "Pending").length,
      approved: getLatestApprovedFuelExpensesPerVehicle(approvedBills).length,
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

  // ── Stay on the nearest valid page when the filtered set shrinks ──
  // (e.g. the last item on a page is deleted). Filters, sort and the
  // selected tab are retained — only an out-of-range page is clamped.
  const totalPages = Math.max(1, Math.ceil(sortedBills.length / pageSize));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
    bunk !== ALL_BUNKS ||
    sourceType !== "All" ||
    search.trim() !== "";

  // ── Summary Totals for KPI Cards + table footer (all filtered bills) ──
  // Distance is the backend-saved trip distance deduplicated per trip;
  // mileage is Total Distance ÷ Total Fuel Litres (null when litres are 0).
  const summaryTotals = useMemo(() => {
    const summary = summarizeFuelBills(allFilteredBills);
    const bunkMap = new Map<string, { name: string; bills: number; litres: number; amount: number }>();
    allFilteredBills.forEach((bill) => {
      const name = bill.petrolBunk?.trim() || "Other";
      const current = bunkMap.get(name) ?? { name, bills: 0, litres: 0, amount: 0 };
      current.bills += 1;
      current.litres += Number(bill.litres || 0);
      current.amount += Number(bill.amount || 0);
      bunkMap.set(name, current);
    });

    return {
      ...summary,
      bunkDetails: [...bunkMap.values()].sort((a, b) => b.amount - a.amount),
    };
  }, [allFilteredBills]);

  // ── Sort Handlers ──
  const handleSortChange = useCallback((key: FuelSortKey) => {
    const numeric = key === "meterReading" || key === "litres" || key === "rate" || key === "amount";
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir(numeric ? "desc" : "asc");
    } else if (sortDir === (numeric ? "desc" : "asc")) {
      setSortDir(numeric ? "asc" : "desc");
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
    setBunk(ALL_BUNKS);
    setSourceType("All");
    setQuickTab("ALL");
    setSearch("");
    setSortBy(null);
    setSortDir("asc");
    setIncludeMasterBunks(true);
    setCurrentPage(1);
    setSelectedId(null);
    showNotification(t("ops.fuel.filters_reset"), "info");
  }, [showNotification, t]);

  // ── Row Actions Handlers ──
  const handleView = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (target) {
      setViewingBill(target);
      setViewModalOpen(true);
    } else {
      showNotification(language === "te" ? "దయచేసి చూడటానికి ఒక బillitను ఎంచుకోండి." : "Please select a fuel bill to view.", "info");
    }
  }, [selectedBill, showNotification, language]);

  const handleEdit = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (!target) return;
    if (target.sourceType === "TRIP" || !!target.tripNo || !!target.tripId) {
      showNotification(t("ops.fuel.cant_delete_trip_diesel"), "info");
      return;
    }
    if (!withinManualWindow(target)) {
      showNotification("Manual fuel bills are frozen 14 days after entry.", "info");
      return;
    }
    setEditingId(target.id);
    setEditingData(target);
    setShowForm(true);
  }, [selectedBill, showNotification, t]);

  // ── Delayed 10-Second Pending Delete with Undo ──
  const { requestDelete, cancel, pendingItems } = usePendingDelete<string>(async (id) => {
    await deleteExpense(id);
    setSelectedId((current) => (current === id ? null : current));
  }, 10);

  const handleDelete = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (!target) return;
    if (target.sourceType === "TRIP" || !!target.tripNo || !!target.tripId) {
      showNotification(t("ops.fuel.cant_delete_trip_diesel"), "info");
      return;
    }
    if (!withinManualWindow(target)) {
      showNotification("Manual fuel bills are frozen 14 days after entry.", "info");
      return;
    }
    requestDelete(target.id, {
      label: language === "te" ? `ఇNDERనం బillitను తొలగించ datas ${target.billNo}` : `Deleting fuel bill ${target.billNo}`,
    });
  }, [selectedBill, requestDelete, showNotification, language, t]);

  const handleApprove = useCallback((bill?: FuelExpense) => {
    const target = bill || selectedBill;
    if (!target) return;
    if (target.sourceType === "TRIP" || !!target.tripNo || !!target.tripId) {
      showNotification(t("ops.fuel.trip_diesel_auto_approved"), "info");
      return;
    }
    if (target.status === "Approved") {
      showNotification(t("ops.fuel.already_approved"), "info");
      return;
    }
    void approveExpense(target.id);
    setSelectedId(null);
  }, [selectedBill, approveExpense, showNotification, t]);

  // ── Export Handlers ──
  const handleExportPDF = useCallback(async () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "pdf";
    try {
      if (allFilteredBills.length === 0) {
        showNotification(t("ops.fuel.no_export_records"), "error");
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
          { label: "Total Distance", value: summaryTotals.totalDistance != null ? `${summaryTotals.totalDistance.toFixed(2)} km` : "—" },
          { label: "Avg Mileage", value: summaryTotals.avgMileage != null ? `${summaryTotals.avgMileage.toFixed(2)} km/L` : "—" },
          { label: "Pending Bills", value: String(summaryTotals.pendingCount) },
        ],
        numericColumns: [6, 7, 8, 9],
      });
      showNotification(t("ops.fuel.pdf_exported"), "success");
    } catch {
      showNotification(t("ops.fuel.pdf_failed"), "error");
    } finally {
      exportBusyRef.current = null;
    }
  }, [allFilteredBills, fromDate, toDate, vehicle, driver, sourceType, quickTab, summaryTotals, showNotification, t]);

  const handleExportExcel = useCallback(async () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "excel";
    try {
      if (allFilteredBills.length === 0) {
        showNotification(t("ops.fuel.no_export_records"), "error");
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
      // Filtered totals row (whole filtered set, not just the current page).
      rows.push([
        `TOTAL (${allFilteredBills.length} filtered bills)`,
        "",
        "",
        "",
        "",
        "",
        "",
        Number(summaryTotals.totalLitres.toFixed(2)),
        "",
        Number(summaryTotals.totalAmount.toFixed(2)),
        summaryTotals.totalDistance != null ? Number(summaryTotals.totalDistance.toFixed(2)) : "—",
        summaryTotals.avgMileage != null ? `${summaryTotals.avgMileage.toFixed(2)} km/L` : "—",
      ]);
      const filename = `Fuel_Expenses_${new Date().toISOString().split("T")[0]}`;
      exportToExcel("Fuel Expenses Register", headers, rows, filename);
      showNotification(t("ops.fuel.excel_exported"), "success");
    } catch {
      showNotification(t("ops.fuel.excel_failed"), "error");
    } finally {
      exportBusyRef.current = null;
    }
  }, [allFilteredBills, showNotification, t]);

  const handleRefreshClick = useCallback(() => {
    void refresh(true).then((ok) => {
      if (ok) showNotification(t("ops.fuel.refreshed"), "success");
    });
  }, [refresh, showNotification, t]);

  return (
    <div
      className={`w-full space-y-5 animate-in fade-in duration-200 ${embedded ? "" : "px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800"}`}
    >
      {/* ── Filters Card with Unified Action Toolbar (Status dropdown removed) ── */}
      <FuelFilters
        fromDate={fromDate}
        toDate={toDate}
        vehicle={vehicle}
        driver={driver}
        bunk={bunk}
        sourceType={sourceType}
        sortBy={sortBy}
        sortDir={sortDir}
        search={search}
        setFromDate={(v) => { setFromDate(v); setCurrentPage(1); }}
        setToDate={(v) => { setToDate(v); setCurrentPage(1); }}
        setVehicle={(v) => { setVehicle(v); setCurrentPage(1); }}
        setDriver={(v) => { setDriver(v); setCurrentPage(1); }}
        setBunk={(v) => { setBunk(v); setCurrentPage(1); }}
        setSourceType={(v) => { setSourceType(v); setCurrentPage(1); }}
        setSort={handleExplicitSort}
        setSearch={(v) => { setSearch(v); setCurrentPage(1); }}
        onReset={handleResetFilters}
        vehicles={vehicleOptions}
        drivers={driverOptions}
        bunks={bunkOptions}
        onAddFuelBill={() => setShowForm(!showForm)}
        isFormOpen={showForm}
        onExportPDF={() => void handleExportPDF()}
        onExportExcel={() => void handleExportExcel()}
        onRefresh={handleRefreshClick}
        hasFilters={hasFilters}
        canExport={allFilteredBills.length > 0}
        refreshing={refreshing}
      />

      {/* ── KPI Summary Cards (Appear smoothly ONLY when filter is active) ── */}
      {hasFilters && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <FuelKPICards
            totalLitres={summaryTotals.totalLitres}
            totalAmount={summaryTotals.totalAmount}
            pendingCount={summaryTotals.pendingCount}
            totalDistance={summaryTotals.totalDistance === 0 ? null : summaryTotals.totalDistance}
            avgMileage={summaryTotals.avgMileage}
            bunkDetails={summaryTotals.bunkDetails}
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
            supervisors={supervisorsList}
            fuelBunks={fuelBunks}
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
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-[13px] shadow-sm"
      >
        <FuelBillTable
          bills={paginatedBills}
          isLoading={loading}
          refreshing={refreshing}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={can(CAPABILITIES.FUEL_DELETE) ? handleDelete : undefined}
          onApprove={can(CAPABILITIES.FUEL_APPROVE) ? handleApprove : undefined}
          startIndex={(currentPage - 1) * pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          activeTab={quickTab}
          onTabChange={(tab) => { setQuickTab(tab); setCurrentPage(1); }}
          tabCounts={tabCounts}
          includeMasterBunks={includeMasterBunks}
          onIncludeMasterBunksChange={(next) => { setIncludeMasterBunks(next); setCurrentPage(1); }}
          filteredTotals={allFilteredBills.length > 0 ? { records: allFilteredBills.length, litres: summaryTotals.totalLitres, amount: summaryTotals.totalAmount, distance: summaryTotals.totalDistance, mileage: summaryTotals.avgMileage } : null}
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
        vehicles={masterVehicles}
        activeTab={quickTab}
        vehicleBills={
          viewingBill
            ? deduplicatedExpenses.filter(
                (b) =>
                  (b.vehicleNo && viewingBill.vehicleNo && b.vehicleNo.toLowerCase() === viewingBill.vehicleNo.toLowerCase()) ||
                  (b.vehicleId && viewingBill.vehicleId && String(b.vehicleId) === String(viewingBill.vehicleId))
              )
            : []
        }
        canEdit={Boolean(
          viewingBill &&
          viewingBill.sourceType !== "TRIP" &&
          !viewingBill.tripNo &&
          effectiveStatus(viewingBill) !== "Approved" &&
          !viewingBill.deleted &&
          effectiveStatus(viewingBill) !== "Deleted"
        )}
        onEdit={(billToEdit) => {
          setViewModalOpen(false);
          handleEdit(billToEdit);
        }}
        onClose={() => {
          setViewModalOpen(false);
          setViewingBill(null);
        }}
      />
    </div>
  );
}

export default React.memo(FuelExpensesPage);