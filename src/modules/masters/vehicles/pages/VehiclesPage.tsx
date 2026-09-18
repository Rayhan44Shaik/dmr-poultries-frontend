import "../../styles/masters.css";
import { Truck } from "lucide-react";
import { countActiveFilters } from "../../../../ui";
import {
  MasterDirectoryFilters,
  MasterDirectoryCard,
} from "../../components/MasterDirectory";
import { useI18n } from "../../../../i18n";
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
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildVehicleBulkImportConfig } from "../bulkImportConfig";

type MasterVehiclesPageProps = {
  embedded?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;

function MasterVehiclesPage({ embedded = false }: MasterVehiclesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("number");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
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
    total,
    page: serverPage,
    exportRows,
  } = useVehicles({
    page: currentPage,
    pageSize: pageSize,
    search,
    status: statusFilter,
    sort: sortOrder,
  });

  const vehicleBulkImportConfig = useMemo(
    () => buildVehicleBulkImportConfig({ addVehiclesBulk, reload }),
    [addVehiclesBulk, reload],
  );

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const safePage = serverPage;
  const paginatedVehicles = vehicles;

  const handleExportPDF = async () => {
    try {
      const filteredVehicles = await exportRows();

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
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const handleExportExcel = async () => {
    try {
      const filteredVehicles = await exportRows();

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
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
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
      emiStartDate: vehicle.emiStartDate ?? "",
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

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setSortOrder("number");
    setCurrentPage(1);
  };
  const activeFilterCount = countActiveFilters(
    search.trim() !== "",
    statusFilter !== "",
    sortOrder !== "number",
  );

  const content = (
    <div className="master-page w-full min-w-0 space-y-4 font-sans text-slate-700">
      <MasterDirectoryFilters
        ariaLabel={t("masters.dir.vehicles_title")}
        searchId="vehicles-search"
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t("masters.dir.search_vehicle")}
        status={statusFilter}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}
        sort={sortOrder}
        onSortChange={(value) => {
          setSortOrder(value);
          setCurrentPage(1);
        }}
        onReset={handleResetFilters}
        onRefresh={() => {
          void reload().catch(() => {});
        }}
        addLabel={t("masters.dir.add_vehicle")}
        onAdd={() => {
          setEditingVehicle(null);
          setShowDialog(true);
        }}
        onImport={() => setShowBulkImport(true)}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        hasRows={paginatedVehicles.length > 0}
        loading={loading}
        saving={saving}
      />

      <MasterDirectoryCard
        icon={Truck}
        title={t("masters.dir.vehicles_title")}
        total={total}
        error={error}
        loading={loading}
        onRetry={() => {
          void reload().catch(() => undefined);
        }}
        retryLabel={t("masters.dir.retry")}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setCurrentPage(1); // a new page size invalidates the current page
        }}
      >
        <VehicleTable
          vehicles={paginatedVehicles}
          onEdit={handleEditVehicle}
          onDelete={handleDeleteVehicle}
          loading={loading || deletingId !== null}
          emptyMessage={
            activeFilterCount > 0 ? t("masters.dir.no_records") : undefined
          }
        />
      </MasterDirectoryCard>

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
