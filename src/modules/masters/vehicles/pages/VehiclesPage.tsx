import MasterListToolbar from "../../components/MasterListToolbar";
import MasterListSummary from "../../components/MasterListSummary";
import MasterPagination from "../../components/MasterPagination";
import "../../styles/masters.css";
// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\vehicles\pages\MasterVehiclesPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import VehicleTable from "../components/VehicleTable";
import VehicleDialog from "../dialogs/VehicleDialog";
import { useVehicles } from "../hooks/useVehicles";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/vehicleService";
import type { Vehicle } from "../types/vehicle";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildVehicleBulkImportConfig } from "../bulkImportConfig";

type MasterVehiclesPageProps = {
  embedded?: boolean;
};

const ITEMS_PER_PAGE = 10;

function MasterVehiclesPage({ embedded = false }: MasterVehiclesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const {
    vehicles,
    loading,
    saving,
    error,
    reload,
    addVehicle,
    addVehiclesBulk,
    editVehicle,
    removeVehicle,
  } = useVehicles();

  const vehicleBulkImportConfig = useMemo(
    () => buildVehicleBulkImportConfig({ addVehiclesBulk, reload }),
    [addVehiclesBulk, reload],
  );

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredVehicles = useMemo(() => {
    const keyword = search.toLowerCase();
    return vehicles.filter(
      (vehicle) =>
        vehicle.vehicleNumber?.toLowerCase().includes(keyword) ||
        vehicle.vehicleType?.toLowerCase().includes(keyword) ||
        vehicle.trackingId?.toLowerCase().includes(keyword) ||
        vehicle.fastagBank?.toLowerCase().includes(keyword) ||
        vehicle.engineNumber?.toLowerCase().includes(keyword) ||
        vehicle.chassisNumber?.toLowerCase().includes(keyword),
    );
  }, [vehicles, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredVehicles.length / ITEMS_PER_PAGE) || 1;
  // Deleting or filtering records can leave currentPage beyond the last valid
  // page; render the last valid page instead of a stranded empty one.
  const safePage = Math.min(currentPage, totalPages);
  const paginatedVehicles = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredVehicles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredVehicles, safePage]);

  const handleExportPDF = () => {
    if (filteredVehicles.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Vehicle No",
      "Vehicle Number",
      "Type",
      "Boxes",
      "Bird Capacity",
      "Status",
    ];
    const rows = filteredVehicles.map((v) => [
      v.vehicleNo?.toString() || "",
      v.vehicleNumber || "",
      v.vehicleType || "",
      v.noOfBoxes?.toString() || "0",
      v.birdCapacity?.toString() || "0",
      v.status || "",
    ]);
    const filename = `Vehicles_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Vehicles - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_PDF", "Vehicles", undefined, {
      count: filteredVehicles.length,
    });
    showNotification("PDF exported successfully!", "success");
  };

  const handleExportExcel = () => {
    if (filteredVehicles.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Vehicle No",
      "Vehicle Number",
      "Type",
      "Boxes",
      "Bird Capacity",
      "Status",
    ];
    const rows = filteredVehicles.map((v) => [
      v.vehicleNo?.toString() || "",
      v.vehicleNumber || "",
      v.vehicleType || "",
      v.noOfBoxes?.toString() || "0",
      v.birdCapacity?.toString() || "0",
      v.status || "",
    ]);
    const filename = `Vehicles_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Vehicles - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_EXCEL", "Vehicles", undefined, {
      count: filteredVehicles.length,
    });
    showNotification("Excel exported successfully!", "success");
  };

  const validateVehicle = (
    vehicle: Partial<Vehicle> & { emiDay?: number; totalEMIs?: number },
  ): string | null => {
    const vehicleNumber = vehicle.vehicleNumber?.trim() ?? "";
    const vehicleType = vehicle.vehicleType?.trim() ?? "";
    const engineNumber = vehicle.engineNumber?.trim() ?? "";
    const chassisNumber = vehicle.chassisNumber?.trim() ?? "";
    const noOfBoxes = Number(vehicle.noOfBoxes);
    const birdCapacity = Number(vehicle.birdCapacity);
    const capacityKg = Number(vehicle.capacityKg);

    if (
      !vehicleNumber ||
      !vehicleType ||
      Number.isNaN(noOfBoxes) ||
      Number.isNaN(birdCapacity) ||
      Number.isNaN(capacityKg)
    ) {
      return "Please fill all required fields.";
    }
    if (!engineNumber) {
      return "Engine Number is required.";
    }
    if (!chassisNumber) {
      return "Chassis Number is required.";
    }
    if (noOfBoxes <= 0 || birdCapacity <= 0 || capacityKg <= 0) {
      return "Boxes, bird capacity, and capacity (kg) must be positive numbers.";
    }

    const duplicate = vehicles.some(
      (v) =>
        v.vehicleNumber?.trim().toLowerCase() === vehicleNumber.toLowerCase() &&
        v.id !== editingVehicle?.id,
    );
    if (duplicate) {
      return "Vehicle Number already exists.";
    }

    return null;
  };

  const handleSaveVehicle = async (
    vehicle: Partial<Vehicle> & { emiDay?: number; totalEMIs?: number },
  ): Promise<boolean> => {
    const validationError = validateVehicle(vehicle);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    const payload = {
      vehicleNumber: vehicle.vehicleNumber!.trim(),
      vehicleType: vehicle.vehicleType!.trim(),
      trackingId: vehicle.trackingId?.trim() ?? "",
      noOfBoxes: Number(vehicle.noOfBoxes),
      birdCapacity: Number(vehicle.birdCapacity),
      capacityKg: Number(vehicle.capacityKg),
      fastagBank: vehicle.fastagBank?.trim() ?? "",
      engineNumber: vehicle.engineNumber!.trim(),
      chassisNumber: vehicle.chassisNumber!.trim(),
      insuranceExpiry: editingVehicle?.insuranceExpiry ?? "",
      permitExpiry: editingVehicle?.permitExpiry ?? "",
      fitnessExpiry: editingVehicle?.fitnessExpiry ?? "",
      purchaseDate: vehicle.purchaseDate ?? "",
      purchaseAmount: vehicle.purchaseAmount,
      emiStartDate: editingVehicle?.emiStartDate,
      emiDay: vehicle.emiDay,
      totalEMIs: vehicle.totalEMIs,
      rcDate: vehicle.rcDate ?? "",
      status: vehicle.status ?? "Active",
    };

    try {
      if (editingVehicle) {
        await editVehicle(editingVehicle.id, {
          ...payload,
          vehicleNo: editingVehicle.vehicleNo,
        });
        logAuditEvent("UPDATE_VEHICLE", "Vehicles", editingVehicle.id);
        showNotification("Vehicle updated successfully!", "success");
      } else {
        const list = await addVehicle(payload);
        const created = list.find(
          (v) =>
            v.vehicleNumber === payload.vehicleNumber &&
            v.engineNumber === payload.engineNumber,
        );
        logAuditEvent("CREATE_VEHICLE", "Vehicles", created?.id);
        showNotification("Vehicle added successfully!", "success");
      }
      setEditingVehicle(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowDialog(true);
  };

  const handleDeleteVehicle = async (id: number) => {
    setDeletingId(id);
    try {
      await removeVehicle(id);
      logAuditEvent("DELETE_VEHICLE", "Vehicles", id);
      showNotification("Vehicle deleted successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const content = (
    <div className="master-page w-full min-w-0 space-y-3 font-sans text-slate-700">
      {/* Main Container - Removed overflow-hidden so dropdowns overlay properly */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm">
        {/* Toolbar - Search on LEFT, Buttons on RIGHT in same line */}
        <MasterListToolbar
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search Vehicle..."
          addLabel="Add Vehicle"
          onAdd={() => {
            setEditingVehicle(null);
            setShowDialog(true);
          }}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          loading={loading}
          saving={saving}
          onImport={() => setShowBulkImport(true)}
        />

        {/* Status Counter Bar */}
        <MasterListSummary
          title="Vehicles Directory"
          total={filteredVehicles.length}
          shown={paginatedVehicles.length}
          page={safePage}
          totalPages={totalPages}
          loading={loading}
          saving={saving}
          deleting={deletingId !== null}
        />

        {error && !loading && (
          <div className="mx-4 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                void reload().catch(() => undefined);
              }}
              className="shrink-0 text-xs font-semibold text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="p-0 relative min-h-[120px]">
          {loading && vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm font-medium">Loading vehicles...</p>
            </div>
          ) : !loading && vehicles.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">
                No vehicles found.
              </p>
              <p className="text-xs text-slate-500">
                Add a vehicle to get started.
              </p>
            </div>
          ) : (
            <VehicleTable
              vehicles={paginatedVehicles}
              onEdit={handleEditVehicle}
              onDelete={handleDeleteVehicle}
              emptyMessage={
                search.trim() ? "No vehicles matching your search." : undefined
              }
            />
          )}
        </div>

        {shouldShowPagination(filteredVehicles.length) && (
          <MasterPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
          />
        )}
      </div>

      {/* Modal Dialog */}
      <VehicleDialog
        open={showDialog}
        onClose={() => {
          setEditingVehicle(null);
          setShowDialog(false);
        }}
        onSave={handleSaveVehicle}
        vehicle={editingVehicle}
      />
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        config={vehicleBulkImportConfig}
        existing={vehicles}
        onImported={(result) => {
          logAuditEvent("BULK_IMPORT", "Vehicles", undefined, {
            count: result.imported,
          });
          showNotification(
            `Imported ${result.imported} of ${result.total} vehicles.`,
            result.failed === 0 ? "success" : "error",
          );
        }}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(MasterVehiclesPage);
