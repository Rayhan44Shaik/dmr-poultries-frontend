import { useState } from "react";
import { useFuelExpenses } from "../hooks/useFuelExpenses";
import { FuelKPICards } from "../components/FuelKPICards";
import { FuelFilters } from "../components/FuelFilters";
import { FuelEntryForm } from "../components/FuelEntryForm";
import { FuelBillTable } from "../components/FuelBillTable";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import type { FuelExpense } from "../types/fuelExpense";

function FuelExpensesPage() {
  const { showNotification } = useSafeNotification();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();

  // ✅ Only active vehicles (safe)
  const activeVehicles = vehicles
    .filter((v) => (v.status?.toLowerCase() === "active"))
    .map((v) => v.vehicleNumber)
    .sort();

  const drivers = employees.filter((e) => e.department === "Driver");
  const supervisors = employees.filter((e) => e.department === "Supervisor");

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
    vehicle,
    setVehicle,
    resetFilters,
    summary,
    saveExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
  } = useFuelExpenses(showNotification);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<FuelExpense | null>(null);
  const [showForm, setShowForm] = useState(false);

  const hasFilters = fromDate !== "" || toDate !== "" || vehicle !== "";

  const handleExportPDF = () => {
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
  };

  const handleExportExcel = () => {
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
  };

  const handleEdit = (bill: FuelExpense) => {
    setEditingId(bill.id);
    setEditingData(bill);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
    setShowForm(false);
  };

  const handleView = (bill: FuelExpense) => {
    showNotification(`Viewing bill ${bill.billNo}`, "info");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          {showForm ? "Hide Form" : "+ Add Fuel Bill"}
        </button>
      </div>

      {hasFilters && (
        <FuelKPICards
          totalLitres={summary.totalLitres}
          totalAmount={summary.totalAmount}
          pendingCount={summary.pendingCount}
          approvedCount={summary.approvedCount}
          totalMileage={summary.totalMileage}
        />
      )}

      <FuelFilters
        fromDate={fromDate}
        toDate={toDate}
        vehicle={vehicle}
        activeVehicles={activeVehicles}
        setFromDate={setFromDate}
        setToDate={setToDate}
        setVehicle={setVehicle}
        onSearch={() => setCurrentPage(1)}
        onReset={resetFilters}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        hasFilters={hasFilters}
        totalEntries={filteredData.length}
      />

      {showForm && (
        <FuelEntryForm
          onSave={saveExpense}
          onUpdate={updateExpense}
          editingId={editingId}
          initialData={editingData}
          vehicles={vehicles}
          drivers={drivers}
          supervisors={supervisors}
          onCancel={handleCancelEdit}
        />
      )}

      <FuelBillTable
        bills={paginatedData}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={deleteExpense}
        onApprove={approveExpense}
      />

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
    </div>
  );
}

export default FuelExpensesPage;