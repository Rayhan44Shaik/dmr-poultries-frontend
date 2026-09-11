import MasterListToolbar from "../../components/MasterListToolbar";
import MasterListSummary from "../../components/MasterListSummary";
import MasterPagination from "../../components/MasterPagination";
import "../../styles/masters.css";
// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\bird-types\pages\BirdTypesPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import BirdTypeTable from "../components/BirdTypeTable";
import BirdTypeDialog from "../dialogs/BirdTypeDialog";
import { useBirdTypes } from "../hooks/useBirdTypes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToExcel } from "../../../../utils/exportUtils";
import { exportBirdTypesToPDF } from "../utils/exportBirdTypePdf";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/birdTypeService";
import type { BirdType } from "../types/birdType";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildBirdTypeBulkImportConfig } from "../bulkImportConfig";

type BirdTypesPageProps = { embedded?: boolean };

const DEFAULT_PAGE_SIZE = 10;

function BirdTypesPage({ embedded = false }: BirdTypesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingBirdType, setEditingBirdType] = useState<BirdType | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("number");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const {
    birdTypes,
    loading,
    saving,
    error,
    reload,
    addBirdType,
    addBirdTypesBulk,
    editBirdType,
    removeBirdType,
    total, page: serverPage, exportRows,
  } = useBirdTypes({ page: currentPage, pageSize: pageSize, search, status: statusFilter, sort: sortOrder });

  const birdTypeBulkImportConfig = useMemo(
    () => buildBirdTypeBulkImportConfig({ addBirdTypesBulk, reload }),
    [addBirdTypesBulk, reload],
  );

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = serverPage;
  const paginatedBirdTypes = birdTypes;

  const handleExportPDF = async () => {
    try {
      const filteredBirdTypes = await exportRows();

    if (filteredBirdTypes.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }

    const filename = `BirdTypes_${new Date().toISOString().split("T")[0]}`;

    try {
      exportBirdTypesToPDF(filteredBirdTypes, filename);

      logAuditEvent("EXPORT_PDF", "BirdTypes", undefined, {
        count: filteredBirdTypes.length,
      });
      showNotification("PDF exported successfully!", "success");
    } catch (exportError) {
      console.error("Unable to export Bird Type PDF:", exportError);
      showNotification("Unable to export PDF. Please try again.", "error");
    }
  
    } catch (err) { showNotification(handleApiError(err), "error"); }
  };

  const handleExportExcel = async () => {
    try {
      const filteredBirdTypes = await exportRows();

    if (filteredBirdTypes.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Bird Type No",
      "Bird Type",
      "Average Weight (kg)",
      "Description",
      "Status",
    ];
    const rows = filteredBirdTypes.map((bt) => [
      bt.birdTypeNo.toString(),
      bt.birdType,
      bt.averageWeight.toString(),
      bt.description || "-",
      bt.status,
    ]);
    const filename = `BirdTypes_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Bird Types - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_EXCEL", "BirdTypes", undefined, {
      count: filteredBirdTypes.length,
    });
    showNotification("Excel exported successfully!", "success");
  
    } catch (err) { showNotification(handleApiError(err), "error"); }
  };

  const validateBirdType = (birdType: Partial<BirdType>): string | null => {
    const name = birdType.birdType?.trim() ?? "";
    const averageWeight = Number(birdType.averageWeight);

    if (!name || Number.isNaN(averageWeight) || averageWeight <= 0) {
      return "Please fill all required fields with valid values.";
    }

    const duplicate = birdTypes.some(
      (bt) =>
        bt.birdType.trim().toLowerCase() === name.toLowerCase() &&
        bt.id !== editingBirdType?.id,
    );
    if (duplicate) {
      return "Bird Type already exists.";
    }

    return null;
  };

  const handleSaveBirdType = async (
    birdType: Partial<BirdType>,
  ): Promise<boolean> => {
    const validationError = validateBirdType(birdType);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    const payload = {
      birdType: birdType.birdType!.trim(),
      averageWeight: Number(birdType.averageWeight),
      description: birdType.description?.trim() ?? "",
      status: birdType.status ?? "Active",
    };

    try {
      if (editingBirdType) {
        await editBirdType(editingBirdType.id, {
          ...payload,
          birdTypeNo: editingBirdType.birdTypeNo,
        });
        logAuditEvent("UPDATE_BIRD_TYPE", "BirdTypes", editingBirdType.id);
        showNotification("Bird Type updated successfully!", "success");
      } else {
        const list = await addBirdType(payload);
        const created = list.find((bt) => bt.birdType === payload.birdType);
        logAuditEvent("CREATE_BIRD_TYPE", "BirdTypes", created?.id);
        showNotification("Bird Type added successfully!", "success");
      }

      setEditingBirdType(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditBirdType = (birdType: BirdType) => {
    setEditingBirdType(birdType);
    setShowDialog(true);
  };

  const handleDeleteBirdType = async (id: number) => {
    setDeletingId(id);
    try {
      await removeBirdType(id);
      logAuditEvent("DELETE_BIRD_TYPE", "BirdTypes", id);
      showNotification("Bird Type deleted successfully!", "success");
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
          onRefresh={() => { void reload().catch(() => {}); }}
          status={statusFilter}
          onStatusChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
          sort={sortOrder}
          onSortChange={(value) => { setSortOrder(value); setCurrentPage(1); }}
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search Bird Type..."
          addLabel="Add Bird Type"
          onAdd={() => {
            setEditingBirdType(null);
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
          title="Bird Types Directory"
          total={total}
          shown={paginatedBirdTypes.length}
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
          {loading && birdTypes.length === 0 ? (
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
              <p className="text-sm font-medium">Loading bird types...</p>
            </div>
          ) : !loading && birdTypes.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">
                No bird types found.
              </p>
              <p className="text-xs text-slate-500">
                Add a bird type to get started.
              </p>
            </div>
          ) : (
            <BirdTypeTable
              birdTypes={paginatedBirdTypes}
              onEdit={handleEditBirdType}
              onDelete={handleDeleteBirdType}
              emptyMessage={
                search.trim()
                  ? "No bird types matching your search."
                  : undefined
              }
            />
          )}
        </div>

        {shouldShowPagination(total) && (
          <MasterPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1); // a new page size invalidates the current page
            }}
          />
        )}
      </div>

      {/* Modal Dialog */}
      <BirdTypeDialog
        open={showDialog}
        onClose={() => {
          setEditingBirdType(null);
          setShowDialog(false);
        }}
        onSave={handleSaveBirdType}
        birdType={editingBirdType}
      />
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        config={birdTypeBulkImportConfig}
        existing={birdTypes}
        onImported={(result) => {
          logAuditEvent("BULK_IMPORT", "BirdTypes", undefined, {
            count: result.imported,
          });
          showNotification(
            `Imported ${result.imported} of ${result.total} bird types.`,
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

export default React.memo(BirdTypesPage);
