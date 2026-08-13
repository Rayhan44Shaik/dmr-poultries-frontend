// src/modules/operations/fuel-expenses/pages/FuelExpensesPage.tsx

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Select from "react-select";
import { useFuelExpenses } from "../hooks/useFuelExpenses";
import { FuelKPICards } from "../components/FuelKPICards";
import { FuelEntryForm } from "../components/FuelEntryForm";
import { FuelBillTable } from "../components/FuelBillTable";
import { FuelViewModal } from "../components/FuelViewModal";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import {
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";
import { DatePicker } from "../../../../components/common/DatePicker";

const SOURCE_OPTIONS = [
  { value: "ALL", label: "All Sources" },
  { value: "TRIP", label: "Trip" },
  { value: "MANUAL", label: "Manual" },
] as const;

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "Pending Approval", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
] as const;

function FuelExpensesPage() {
  const { showNotification } = useSafeNotification();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();

  const activeVehicles = useMemo(
    () =>
      vehicles
        .filter((v) => v.status?.toLowerCase() === "active")
        .map((v) => v.vehicleNumber)
        .sort(),
    [vehicles]
  );

  const vehicleOptions = useMemo(
    () => activeVehicles.map((v) => ({ value: v, label: v })),
    [activeVehicles]
  );

  const drivers = useMemo(
    () => employees.filter((e) => e.department === "Driver"),
    [employees]
  );
  const supervisors = useMemo(
    () => employees.filter((e) => e.department === "Supervisor"),
    [employees]
  );

  const {
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
    filteredSummary,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    refresh,
    loading,
    isSaving,
  } = useFuelExpenses(showNotification);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedBill = useMemo(
    () => filteredData.find((b) => b.id === selectedId) || null,
    [filteredData, selectedId]
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<FuelExpense | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<FuelExpense | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Clicking outside the table deselects the row — but not while the reject
  // dialog (rendered outside the table container) or the view modal is open,
  // otherwise typing a rejection reason immediately closes the dialog.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rejectDialogOpen || viewModalOpen) return;
      if (
        tableContainerRef.current &&
        !tableContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rejectDialogOpen, viewModalOpen]);

  const hasFilters =
    fromDate !== "" ||
    toDate !== "" ||
    selectedVehicles.length > 0 ||
    sourceType !== "ALL" ||
    approvalStatus !== "ALL" ||
    search !== "";

  // Trip-generated fuel is auto-approved and owned by the Trip Step 5 record —
  // it can only be viewed here, never edited/deleted directly.
  const canEditDelete = useCallback((bill: FuelExpense): boolean => bill.sourceType === "MANUAL", []);
  const canApproveReject = useCallback(
    (bill: FuelExpense): boolean =>
      bill.sourceType === "MANUAL" && (bill.status === "Pending Approval" || bill.status === "Draft"),
    []
  );

  const handleView = useCallback(() => {
    if (selectedBill) {
      setViewingBill(selectedBill);
      setViewModalOpen(true);
    }
  }, [selectedBill]);

  const handleEdit = useCallback(() => {
    if (!selectedBill) return;
    if (!canEditDelete(selectedBill)) {
      showNotification("Trip-generated fuel cannot be edited here. Edit the Trip's Step 5 diesel entry instead.", "error");
      return;
    }
    setEditingId(selectedBill.id);
    setEditingData(selectedBill);
    setShowForm(true);
  }, [selectedBill, canEditDelete, showNotification]);

  const handleDelete = useCallback(() => {
    if (!selectedBill) return;
    if (!canEditDelete(selectedBill)) {
      showNotification("Trip-generated fuel cannot be deleted here.", "error");
      return;
    }
    if (window.confirm(`Delete bill ${selectedBill.billNo}?`)) {
      deleteExpense(selectedBill.id);
      setSelectedId(null);
    }
  }, [selectedBill, canEditDelete, deleteExpense, showNotification]);

  const handleApprove = useCallback(() => {
    if (!selectedBill) return;
    if (!canApproveReject(selectedBill)) {
      showNotification("Only pending manual fuel bills can be approved here.", "info");
      return;
    }
    approveExpense(selectedBill.id);
    setSelectedId(null);
  }, [selectedBill, canApproveReject, approveExpense, showNotification]);

  const openRejectDialog = useCallback(() => {
    if (!selectedBill) return;
    if (!canApproveReject(selectedBill)) {
      showNotification("Only pending manual fuel bills can be rejected here.", "info");
      return;
    }
    setRejectReason("");
    setRejectDialogOpen(true);
  }, [selectedBill, canApproveReject, showNotification]);

  const confirmReject = useCallback(async () => {
    if (!selectedBill) return;
    if (!rejectReason.trim()) {
      showNotification("A rejection reason is required.", "error");
      return;
    }
    const ok = await rejectExpense(selectedBill.id, rejectReason.trim());
    if (ok) {
      setRejectDialogOpen(false);
      setSelectedId(null);
    }
  }, [selectedBill, rejectReason, rejectExpense, showNotification]);

  const handleFormCancel = useCallback(() => {
    setEditingId(null);
    setEditingData(null);
    setShowForm(false);
  }, []);

  const closeViewModal = useCallback(() => {
    setViewModalOpen(false);
    setViewingBill(null);
  }, []);

  const exportHeaders = [
    "Bill No", "Date", "Source", "Trip No", "Vehicle", "Driver", "Supervisor",
    "Meter (KM)", "Amount (₹)", "Rate (₹/L)", "Litres", "Bunk", "Status",
  ];
  const toExportRow = (b: FuelExpense) => [
    b.billNo, b.billDate, b.sourceType, b.tripNo || "", b.vehicleNo || "", b.driverName || "",
    b.supervisorName || "", String(b.currentMeter), b.amount.toFixed(2), b.fuelRate.toFixed(2),
    b.liters.toFixed(2), b.pumpName, b.status,
  ];

  const handleExportPDF = useCallback(() => {
    if (filteredData.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const filename = `Fuel_Bills_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Fuel Bills Report", exportHeaders, filteredData.map(toExportRow), filename);
  }, [filteredData, showNotification]);

  const handleExportExcel = useCallback(() => {
    if (filteredData.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const filename = `Fuel_Bills_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Fuel Bills Report", exportHeaders, filteredData.map(toExportRow), filename);
  }, [filteredData, showNotification]);

  const handleResetFilters = () => {
    resetFilters();
    setCurrentPage(1);
    showNotification("Filters reset.", "info");
  };

  const handleRefresh = () => {
    refresh();
    showNotification("Data refreshed.", "info");
  };

  const KpiCards = useMemo(
    () =>
      hasFilters ? (
        <FuelKPICards
          totalLitres={filteredSummary.totalLitres}
          totalAmount={filteredSummary.totalAmount}
          pendingCount={filteredSummary.pendingCount}
          approvedCount={filteredSummary.approvedCount}
          rejectedCount={filteredSummary.rejectedCount}
          tripCount={filteredSummary.tripCount}
          manualCount={filteredSummary.manualCount}
          avgMileage={filteredSummary.avgMileage}
          recentTripMileage={filteredSummary.recentTripMileage}
        />
      ) : null,
    [hasFilters, filteredSummary]
  );

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: '0.375rem',
      borderColor: '#cbd5e1',
      minHeight: '40px',
      boxShadow: 'none',
      '&:hover': { borderColor: '#94a3b8' },
      '&:focus-within': { borderColor: '#22c55e', boxShadow: '0 0 0 1px #22c55e' },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? '#16a34a' : isFocused ? '#dcfce7' : 'white',
      color: isSelected ? 'white' : '#1e293b',
      padding: '8px 12px',
      fontSize: '14px',
    }),
    menu: (base: any) => ({ ...base, zIndex: 50 }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: '#dcfce7',
      borderRadius: '4px',
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: '#166534',
      fontSize: '12px',
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: '#166534',
      ':hover': { backgroundColor: '#bbf7d0', color: '#dc2626' },
    }),
  };

  return (
    <div className="space-y-6">
      {/* ─── Action Buttons ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 cursor-pointer transition"
          >
            <Plus size={16} />
            {showForm ? "Hide Form" : "Add Fuel"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-white px-3 py-2 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>Refresh</span>
          </button>
          {isSaving && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              Saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={filteredData.length === 0}
            className={`inline-flex items-center gap-2 rounded-md border border-red-600 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition-all ${
              filteredData.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-red-50 cursor-pointer"
            }`}
          >
            <FileText size={16} /> PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={filteredData.length === 0}
            className={`inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all ${
              filteredData.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700 cursor-pointer"
            }`}
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      </div>

      {KpiCards}

      {/* ─── Filters ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start">
          <DatePicker value={fromDate} onChange={setFromDate} label="From Date" className="w-full" placeholder="Select start" />
          <DatePicker value={toDate} onChange={setToDate} label="To Date" className="w-full" placeholder="Select end" />
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Vehicles</label>
            <Select
              isMulti
              isSearchable
              options={vehicleOptions}
              value={vehicleOptions.filter((opt) => selectedVehicles.includes(opt.value))}
              onChange={(selected) => {
                setSelectedVehicles(selected ? selected.map((s: any) => s.value) : []);
                setCurrentPage(1);
              }}
              placeholder="Search & select vehicles..."
              styles={selectStyles}
              maxMenuHeight={190}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Source</label>
            <Select
              options={SOURCE_OPTIONS as unknown as { value: string; label: string }[]}
              value={SOURCE_OPTIONS.find((o) => o.value === sourceType)}
              onChange={(opt: any) => { setSourceType(opt?.value ?? "ALL"); setCurrentPage(1); }}
              styles={selectStyles}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Approval</label>
            <Select
              options={STATUS_OPTIONS as unknown as { value: string; label: string }[]}
              value={STATUS_OPTIONS.find((o) => o.value === approvalStatus)}
              onChange={(opt: any) => { setApprovalStatus(opt?.value ?? "ALL"); setCurrentPage(1); }}
              styles={selectStyles}
              className="w-full text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search bill no, vehicle, driver, trip no..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 cursor-pointer"
          >
            <RotateCcw size={16} /> Reset Filters
          </button>
        </div>
      </div>

      {showForm && (
        <FuelEntryForm
          onSave={saveExpense}
          onUpdate={updateExpense}
          editingId={editingId}
          initialData={editingData}
          vehicles={vehicles}
          drivers={drivers}
          supervisors={supervisors}
          onCancel={handleFormCancel}
        />
      )}

      {/* ─── Table Card ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" ref={tableContainerRef}>
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-700">Fuel Expenses</h3>
            <span className="text-xs text-slate-500">{filteredData.length} bills</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedBill ? (
              <>
                <span className="text-sm font-medium text-slate-700 mr-1">
                  Selected: {selectedBill.billNo}
                </span>
                <button
                  onClick={handleView}
                  className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition"
                  title="View"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={handleEdit}
                  disabled={!canEditDelete(selectedBill)}
                  className={`p-1.5 rounded-md transition ${
                    canEditDelete(selectedBill)
                      ? "text-green-600 hover:bg-green-50 hover:text-green-700 cursor-pointer"
                      : "text-slate-300 cursor-not-allowed"
                  }`}
                  title={canEditDelete(selectedBill) ? "Edit" : "Trip-generated fuel — view only"}
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!canEditDelete(selectedBill)}
                  className={`p-1.5 rounded-md transition ${
                    canEditDelete(selectedBill)
                      ? "text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      : "text-slate-300 cursor-not-allowed"
                  }`}
                  title={canEditDelete(selectedBill) ? "Delete" : "Trip-generated fuel — view only"}
                >
                  <Trash2 size={16} />
                </button>
                {canApproveReject(selectedBill) && (
                  <>
                    <button
                      onClick={handleApprove}
                      className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
                      title="Approve"
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button
                      onClick={openRejectDialog}
                      className="p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600 transition"
                      title="Reject"
                    >
                      <XCircle size={16} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <span className="text-xs text-slate-400">Select a row to view actions</span>
            )}
          </div>
        </div>

        <FuelBillTable
          bills={paginatedData}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <div className="text-sm text-slate-600">
              Showing {paginatedData.length} of {filteredData.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className={`rounded-md p-2 transition cursor-pointer ${
                  currentPage === 1 ? "cursor-not-allowed text-slate-300" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Previous
              </button>
              <span className="text-sm font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className={`rounded-md p-2 transition cursor-pointer ${
                  currentPage === totalPages ? "cursor-not-allowed text-slate-300" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <FuelViewModal
        isOpen={viewModalOpen}
        bill={viewingBill}
        onClose={closeViewModal}
      />

      {rejectDialogOpen && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Reject Fuel Bill {selectedBill.billNo}</h3>
            <p className="text-sm text-slate-500">A reason is required to reject this bill.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Duplicate bill, Incorrect meter, Wrong amount"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectDialogOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                Reject Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FuelExpensesPage);
