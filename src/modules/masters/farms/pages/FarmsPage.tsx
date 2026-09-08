import MasterListToolbar from "../../components/MasterListToolbar";
import MasterListSummary from "../../components/MasterListSummary";
import MasterPagination from "../../components/MasterPagination";
import "../../styles/masters.css";
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
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildFarmBulkImportConfig } from "../bulkImportConfig";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type FarmsPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function FarmsPage({ embedded = false }: FarmsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
  } = useFarms();

  const farmBulkImportConfig = useMemo(
    () => buildFarmBulkImportConfig({ addFarmsBulk, reload }),
    [addFarmsBulk, reload],
  );

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredFarms = useMemo(() => {
    const keyword = search.toLowerCase();
    return farms.filter(
      (farm) =>
        farm.farmName.toLowerCase().includes(keyword) ||
        farm.ownerName.toLowerCase().includes(keyword) ||
        farm.supervisorName.toLowerCase().includes(keyword) ||
        farm.village.toLowerCase().includes(keyword) ||
        farm.phoneNumber.includes(keyword),
    );
  }, [farms, search]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredFarms.length / ITEMS_PER_PAGE) || 1;
  // Deleting or filtering records can leave currentPage beyond the last valid
  // page; render the last valid page instead of a stranded empty one.
  const safePage = Math.min(currentPage, totalPages);
  const paginatedFarms = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredFarms.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredFarms, safePage]);

  const handleExportPDF = () => {
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
        const pageCount = (doc as any).internal.getNumberOfPages();
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
  };

  const handleExportExcel = () => {
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

  const content = (
    <div className="master-page w-full min-w-0 space-y-3 font-sans text-slate-700">
      {/* Main Container - Removed overflow-hidden so dropdowns overlay properly */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm">
        {/* Toolbar - Search on LEFT, Buttons on RIGHT in same line */}
        <MasterListToolbar
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search Farm..."
          addLabel="Add Farm"
          onAdd={() => {
            setEditingFarm(null);
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
          title="Farms Directory"
          total={filteredFarms.length}
          shown={paginatedFarms.length}
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
          {loading && farms.length === 0 ? (
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
              <p className="text-sm font-medium">Loading farms...</p>
            </div>
          ) : !loading && farms.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">
                No farms found.
              </p>
              <p className="text-xs text-slate-500">
                Add a farm to get started.
              </p>
            </div>
          ) : (
            <FarmTable
              farms={paginatedFarms}
              onEdit={handleEditFarm}
              onDelete={handleDeleteFarm}
              emptyMessage={
                search.trim() ? "No farms matching your search." : undefined
              }
            />
          )}
        </div>

        {shouldShowPagination(filteredFarms.length) && (
          <MasterPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
          />
        )}
      </div>

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
