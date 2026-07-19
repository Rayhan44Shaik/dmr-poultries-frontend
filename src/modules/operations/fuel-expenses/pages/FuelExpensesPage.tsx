import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useFuelExpenses } from "../hooks/useFuelExpenses";
import { FuelKPICards } from "../components/FuelKPICards";
import { FuelEntryForm } from "../components/FuelEntryForm";
import { FuelBillTable } from "../components/FuelBillTable";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import {
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  X,
  Plus,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import type { FuelExpense } from "../types/fuelExpense";
import { DatePicker } from "../../../../components/common/DatePicker"; // <-- modern picker

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
    resetFilters,
    filteredSummary,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
  } = useFuelExpenses(showNotification);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedBill = useMemo(
    () => filteredData.find((b) => b.id === selectedId) || null,
    [filteredData, selectedId]
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableContainerRef.current &&
        !tableContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<FuelExpense | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<FuelExpense | null>(null);

  const hasFilters = fromDate !== "" || toDate !== "" || selectedVehicles.length > 0;

  const canEditDelete = useCallback(
    (bill: FuelExpense): boolean => {
      const created = new Date(bill.createdDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 10;
    },
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
      showNotification("Edit not allowed – bill is older than 10 days.", "error");
      return;
    }
    setEditingId(selectedBill.id);
    setEditingData(selectedBill);
    setShowForm(true);
  }, [selectedBill, canEditDelete, showNotification]);

  const handleDelete = useCallback(() => {
    if (!selectedBill) return;
    if (!canEditDelete(selectedBill)) {
      showNotification("Delete not allowed – bill is older than 10 days.", "error");
      return;
    }
    if (window.confirm(`Delete bill ${selectedBill.billNo}?`)) {
      deleteExpense(selectedBill.id);
      setSelectedId(null);
    }
  }, [selectedBill, canEditDelete, deleteExpense, showNotification]);

  const handleApprove = useCallback(() => {
    if (!selectedBill) return;
    if (selectedBill.status === "Approved") {
      showNotification("Bill already approved.", "info");
      return;
    }
    approveExpense(selectedBill.id);
    setSelectedId(null);
  }, [selectedBill, approveExpense, showNotification]);

  const handleFormCancel = useCallback(() => {
    setEditingId(null);
    setEditingData(null);
    setShowForm(false);
  }, []);

  const closeViewModal = useCallback(() => {
    setViewModalOpen(false);
    setViewingBill(null);
  }, []);

  const formatDate = useCallback((d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  }, []);

  const handleExportPDF = useCallback(() => {
    if (filteredData.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Bill No",
      "Date",
      "Vehicle",
      "Driver",
      "Supervisor",
      "Meter (KM)",
      "Amount (₹)",
      "Rate (₹/L)",
      "Litres",
      "Bunk",
      "Status",
    ];
    const rows = filteredData.map((b) => [
      b.billNo,
      b.date,
      b.vehicleNo,
      b.driverName,
      b.supervisorName,
      b.meterReading.toString(),
      b.amount.toFixed(2),
      b.rate.toFixed(2),
      b.litres.toFixed(2),
      b.petrolBunk,
      b.status,
    ]);
    const filename = `Fuel_Bills_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Fuel Bills Report", headers, rows, filename);
  }, [filteredData, showNotification]);

  const handleExportExcel = useCallback(() => {
    if (filteredData.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Bill No",
      "Date",
      "Vehicle",
      "Driver",
      "Supervisor",
      "Meter (KM)",
      "Amount (₹)",
      "Rate (₹/L)",
      "Litres",
      "Bunk",
      "Status",
    ];
    const rows = filteredData.map((b) => [
      b.billNo,
      b.date,
      b.vehicleNo,
      b.driverName,
      b.supervisorName,
      b.meterReading,
      b.amount,
      b.rate,
      b.litres,
      b.petrolBunk,
      b.status,
    ]);
    const filename = `Fuel_Bills_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Fuel Bills Report", headers, rows, filename);
  }, [filteredData, showNotification]);

  const handleResetFilters = () => {
    resetFilters();
    setCurrentPage(1);
    showNotification("Filters reset.", "info");
  };

  // Memoize KPICards to avoid re-render when only filters change
  const KpiCards = useMemo(
    () =>
      hasFilters ? (
        <FuelKPICards
          totalLitres={filteredSummary.totalLitres}
          totalAmount={filteredSummary.totalAmount}
          pendingCount={filteredSummary.pendingCount}
          approvedCount={filteredSummary.approvedCount}
          avgMileage={filteredSummary.avgMileage}
          recentTripMileage={filteredSummary.recentTripMileage}
        />
      ) : null,
    [hasFilters, filteredSummary]
  );

  return (
    // Reduced padding from p-6 to p-2 (same as TripEntryPage)
    <div className="p-2 space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition flex items-center gap-1.5"
        >
          <Plus size={16} />
          {showForm ? "Hide Form" : "Add Fuel Bill"}
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={!hasFilters || filteredData.length === 0}
            className={`px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-medium transition-all flex items-center gap-1.5 ${
              !hasFilters || filteredData.length === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-red-50"
            }`}
          >
            <FileText size={16} /> PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!hasFilters || filteredData.length === 0}
            className={`px-4 py-2 rounded-lg border border-green-500 text-green-600 text-sm font-medium transition-all flex items-center gap-1.5 ${
              !hasFilters || filteredData.length === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-green-50"
            }`}
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
        </div>
      </div>

      {/* KPI Cards (only when filters active) */}
      {KpiCards}

      {/* Filter Bar – now using DatePicker */}
      <div className="rounded-lg border border-green-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* From Date */}
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            label="From Date"
            placeholder="Select start"
            className="w-full"
          />

          {/* To Date */}
          <DatePicker
            value={toDate}
            onChange={setToDate}
            label="To Date"
            placeholder="Select end"
            className="w-full"
          />

          {/* Vehicle Multi-select */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vehicles</label>
            <select
              multiple
              value={selectedVehicles}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
                setSelectedVehicles(values);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
              size={1}
              style={{ height: "auto", minHeight: "2.5rem" }}
            >
              <option value="">All Vehicles</option>
              {activeVehicles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            {selectedVehicles.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedVehicles.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                  >
                    {v}
                    <button
                      onClick={() => {
                        setSelectedVehicles(selectedVehicles.filter((x) => x !== v));
                        setCurrentPage(1);
                      }}
                      className="hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Reset Button */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="h-10 w-full rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Fuel Entry Form */}
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

      {/* Table with selection actions */}
      <div ref={tableContainerRef} className="space-y-3">
        {selectedBill && (
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 flex-wrap">
            <span className="text-sm font-medium text-slate-700 mr-2">
              Selected: {selectedBill.billNo}
            </span>
            <button
              onClick={handleView}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Eye size={14} /> View
            </button>
            <button
              onClick={handleEdit}
              disabled={!canEditDelete(selectedBill)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                canEditDelete(selectedBill)
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
              title={!canEditDelete(selectedBill) ? "Older than 10 days" : ""}
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={!canEditDelete(selectedBill)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                canEditDelete(selectedBill)
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
              title={!canEditDelete(selectedBill) ? "Older than 10 days" : ""}
            >
              <Trash2 size={14} /> Delete
            </button>
            {selectedBill.status === "Pending" && (
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition"
              >
                <CheckCircle size={14} /> Approve
              </button>
            )}
          </div>
        )}

        <FuelBillTable
          bills={paginatedData}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-xs text-slate-500">
            Showing {paginatedData.length} of {filteredData.length} entries
          </div>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1 rounded border text-xs disabled:opacity-40 hover:bg-slate-100"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1 rounded border text-xs disabled:opacity-40 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModalOpen && viewingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Fuel Bill Details</h3>
              <button onClick={closeViewModal} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium text-slate-600">Bill No</div>
                <div>{viewingBill.billNo}</div>
                <div className="font-medium text-slate-600">Date</div>
                <div>{formatDate(viewingBill.date)}</div>
                <div className="font-medium text-slate-600">Vehicle</div>
                <div>{viewingBill.vehicleNo}</div>
                <div className="font-medium text-slate-600">Driver</div>
                <div>{viewingBill.driverName}</div>
                <div className="font-medium text-slate-600">Supervisor</div>
                <div>{viewingBill.supervisorName}</div>
                <div className="font-medium text-slate-600">Meter Reading</div>
                <div>{viewingBill.meterReading}</div>
                <div className="font-medium text-slate-600">Amount</div>
                <div>₹{viewingBill.amount.toFixed(2)}</div>
                <div className="font-medium text-slate-600">Rate / Litre</div>
                <div>₹{viewingBill.rate.toFixed(2)}</div>
                <div className="font-medium text-slate-600">Litres</div>
                <div>{viewingBill.litres.toFixed(2)}</div>
                <div className="font-medium text-slate-600">Petrol Bunk</div>
                <div>{viewingBill.petrolBunk}</div>
                <div className="font-medium text-slate-600">Status</div>
                <div>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      viewingBill.status === "Approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {viewingBill.status}
                  </span>
                </div>
                {viewingBill.remarks && (
                  <>
                    <div className="font-medium text-slate-600">Remarks</div>
                    <div>{viewingBill.remarks}</div>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-slate-200">
              <button
                onClick={closeViewModal}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FuelExpensesPage);