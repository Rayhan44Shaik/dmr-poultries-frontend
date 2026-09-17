import "../../styles/masters.css";
import { Warehouse } from "lucide-react";
import { countActiveFilters } from "../../../../ui";
import {
  MasterDirectoryFilters,
  MasterDirectoryCard,
} from "../../components/MasterDirectory";
import { useI18n } from "../../../../i18n";
// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\farms\pages\FarmsPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import FarmTable from "../components/FarmTable";
import FarmDialog from "../dialogs/FarmDialog";
import { useFarms } from "../hooks/useFarms";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/farmService";
import type { Farm } from "../types/farm";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildFarmBulkImportConfig } from "../bulkImportConfig";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type FarmsPageProps = { embedded?: boolean };

const DEFAULT_PAGE_SIZE = 10;

function FarmsPage({ embedded = false }: FarmsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("number");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const {
    farms,
    loading,
    saving,
    error,
    reload,
    addFarm,
    addFarmsBulk,
    editFarm,
    removeFarm,
    total,
    page: serverPage,
    exportRows,
  } = useFarms({
    page: currentPage,
    pageSize: pageSize,
    search,
    status: statusFilter,
    sort: sortOrder,
  });

  const farmBulkImportConfig = useMemo(
    () => buildFarmBulkImportConfig({ addFarmsBulk, reload }),
    [addFarmsBulk, reload],
  );

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const safePage = serverPage;
  const paginatedFarms = farms;

  const handleExportPDF = async () => {
    try {
      const filteredFarms = await exportRows();

      if (filteredFarms.length === 0) {
        showNotification("No data to export.", "error");
        return;
      }

      // Initialize jsPDF in Landscape ('l') orientation with exact dimensions
      const doc = new jsPDF("l", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth(); // 297mm for A4 Landscape
      const margin = 14;
      const usableWidth = pageWidth - margin * 2;

      // Adjusted weights to ensure total sum maps precisely to usableWidth without clipping right borders
      // [Farm No, Farm Name, Owner, Supervisor, Village, Phone, Status]
      const relativeWeights = [0.09, 0.23, 0.18, 0.18, 0.16, 0.08, 0.08];
      const columnStylesConfig: {
        [key: number]: {
          cellWidth: number;
          halign?: "center" | "left" | "right";
        };
      } = {};

      const headers = [
        "Farm No",
        "Farm Name",
        "Owner",
        "Supervisor",
        "Village",
        "Phone",
        "Status",
      ];
      headers.forEach((_, index) => {
        const computedWidth = usableWidth * relativeWeights[index];
        const isCentered = index === 0 || index === headers.length - 1;
        columnStylesConfig[index] = {
          cellWidth: computedWidth,
          halign: isCentered ? "center" : "left",
        };
      });

      // Document Header Block
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text("Farms - Master List", margin, 15);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated On: ${new Date().toLocaleDateString()}`, margin, 21);

      const rows = filteredFarms.map((farm) => [
        farm.farmNo.toString(),
        farm.farmName,
        farm.ownerName,
        farm.supervisorName,
        farm.village,
        farm.phoneNumber,
        farm.status,
      ]);

      // Render AutoTable with precise explicit table width bounds to prevent right-side clipping
      autoTable(doc, {
        startY: 26,
        head: [headers],
        body: rows,
        theme: "grid",
        tableWidth: usableWidth,
        margin: { left: margin, right: margin, bottom: 18 },
        styles: {
          fontSize: 8.5,
          cellPadding: 3.5,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: columnStylesConfig,
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Confidential Business Report • Page ${data.pageNumber} of ${pageCount}`,
            margin,
            doc.internal.pageSize.height - 10,
          );
        },
      });

      const filename = `Farms_${new Date().toISOString().split("T")[0]}`;
      doc.save(`${filename}.pdf`);
      logAuditEvent("EXPORT_PDF", "Farms", undefined, {
        count: filteredFarms.length,
      });
      showNotification("PDF exported successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const handleExportExcel = async () => {
    try {
      const filteredFarms = await exportRows();

      if (filteredFarms.length === 0) {
        showNotification("No data to export.", "error");
        return;
      }
      const headers = [
        "Farm No",
        "Farm Name",
        "Owner",
        "Supervisor",
        "Village",
        "Phone",
        "Status",
      ];
      const rows = filteredFarms.map((farm) => [
        farm.farmNo.toString(),
        farm.farmName,
        farm.ownerName,
        farm.supervisorName,
        farm.village,
        farm.phoneNumber,
        farm.status,
      ]);
      const filename = `Farms_${new Date().toISOString().split("T")[0]}`;

      exportToExcel("Farms - Master List", headers, rows, filename);
      logAuditEvent("EXPORT_EXCEL", "Farms", undefined, {
        count: filteredFarms.length,
      });
      showNotification("Excel exported successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const validateFarm = (farm: Partial<Farm>): string | null => {
    const farmName = farm.farmName?.trim() ?? "";
    const ownerName = farm.ownerName?.trim() ?? "";
    const supervisorName = farm.supervisorName?.trim() ?? "";
    const phoneNumber = farm.phoneNumber?.trim() ?? "";
    const village = farm.village?.trim() ?? "";
    const capacity = Number(farm.capacity);

    if (
      !farmName ||
      !ownerName ||
      !supervisorName ||
      !phoneNumber ||
      !village
    ) {
      return "Please fill all required fields (marked with *).";
    }
    if (ownerName.length < 3) {
      return "Owner Name must contain at least 3 characters.";
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      return "Mobile Number must be exactly 10 digits.";
    }
    if (Number.isNaN(capacity) || capacity <= 0) {
      return "Bird Capacity must be a positive number.";
    }

    const duplicateFarm = farms.some(
      (f) =>
        f.farmName.trim().toLowerCase() === farmName.toLowerCase() &&
        f.id !== editingFarm?.id,
    );
    if (duplicateFarm) {
      return "Farm Name already exists.";
    }

    const duplicatePhone = farms.some(
      (f) => f.phoneNumber === phoneNumber && f.id !== editingFarm?.id,
    );
    if (duplicatePhone) {
      return "Phone Number already exists.";
    }

    return null;
  };

  const handleSaveFarm = async (farm: Partial<Farm>): Promise<boolean> => {
    const validationError = validateFarm(farm);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    const payload = {
      farmName: farm.farmName!.trim(),
      ownerName: farm.ownerName!.trim(),
      supervisorName: farm.supervisorName!.trim(),
      phoneNumber: farm.phoneNumber!.trim(),
      village: farm.village!.trim(),
      address: farm.address?.trim() ?? "",
      capacity: Number(farm.capacity),
      status: farm.status ?? "Active",
    };

    try {
      if (editingFarm) {
        await editFarm(editingFarm.id, {
          ...payload,
          farmNo: editingFarm.farmNo,
        });
        logAuditEvent("UPDATE_FARM", "Farms", editingFarm.id);
        showNotification("Farm updated successfully!", "success");
      } else {
        const list = await addFarm(payload);
        const created = list.find(
          (f) =>
            f.farmName === payload.farmName &&
            f.phoneNumber === payload.phoneNumber,
        );
        logAuditEvent("CREATE_FARM", "Farms", created?.id);
        showNotification("Farm added successfully!", "success");
      }
      setEditingFarm(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditFarm = (farm: Farm) => {
    setEditingFarm(farm);
    setShowDialog(true);
  };

  const handleDeleteFarm = async (id: number) => {
    setDeletingId(id);
    try {
      await removeFarm(id);
      logAuditEvent("DELETE_FARM", "Farms", id);
      showNotification("Farm deleted successfully!", "success");
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
        ariaLabel={t("masters.dir.farms_title")}
        searchId="farms-search"
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t("masters.dir.search_farm")}
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
        addLabel={t("masters.dir.add_farm")}
        onAdd={() => {
          setEditingFarm(null);
          setShowDialog(true);
        }}
        onImport={() => setShowBulkImport(true)}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        hasRows={paginatedFarms.length > 0}
        loading={loading}
        saving={saving}
      />

      <MasterDirectoryCard
        icon={Warehouse}
        title={t("masters.dir.farms_title")}
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
        <FarmTable
          farms={paginatedFarms}
          onEdit={handleEditFarm}
          onDelete={handleDeleteFarm}
          loading={loading || deletingId !== null}
          emptyMessage={
            activeFilterCount > 0 ? t("masters.dir.no_records") : undefined
          }
        />
      </MasterDirectoryCard>

      {/* Modal Dialog */}
      <FarmDialog
        open={showDialog}
        onClose={() => {
          setEditingFarm(null);
          setShowDialog(false);
        }}
        onSave={handleSaveFarm}
        farm={editingFarm}
      />
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        config={farmBulkImportConfig}
        existing={farms}
        onImported={(result) => {
          logAuditEvent("BULK_IMPORT", "Farms", undefined, {
            count: result.imported,
          });
          showNotification(
            `Imported ${result.imported} of ${result.total} farms.`,
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

export default React.memo(FarmsPage);
