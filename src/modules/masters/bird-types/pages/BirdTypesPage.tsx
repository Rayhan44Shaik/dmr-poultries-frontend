import "../../styles/masters.css";
import MasterDropdown from "../../components/MasterDropdown";
import { Layers3 } from "lucide-react";
import { countActiveFilters } from "../../../../ui";
import {
  MasterDirectoryField,
  MasterDirectoryFilters,
  MasterDirectoryCard,
} from "../../components/MasterDirectory";
import { useI18n } from "../../../../i18n";
// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\bird-types\pages\BirdTypesPage.tsx

import React, { useState } from "react";
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

type BirdTypesPageProps = { embedded?: boolean };

const DEFAULT_PAGE_SIZE = 10;

function BirdTypesPage({ embedded = false }: BirdTypesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBirdType, setEditingBirdType] = useState<BirdType | null>(null);
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
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
    editBirdType,
    removeBirdType,
    total,
    page: serverPage,
    facets,
    exportRows,
  } = useBirdTypes({
    page: currentPage,
    pageSize: pageSize,
    search,
    status: statusFilter,
    sort: sortOrder,
    category: typeFilter,
  });

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const typeOptions = facets.category?.length ? facets.category : ["Bird", "Fuel Bunk"];
  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };
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
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const handleExportExcel = async () => {
    try {
      const filteredBirdTypes = await exportRows();

      if (filteredBirdTypes.length === 0) {
        showNotification("No data to export.", "error");
        return;
      }
      const headers = [
        "Other No",
        "Category",
        "Name",
        "Average Weight (kg)",
        "Owner",
        "Mobile",
        "Address",
        "GPS",
        "Description",
        "Status",
      ];
      const rows = filteredBirdTypes.map((bt) => [
        bt.birdTypeNo.toString(),
        bt.category,
        bt.birdType,
        bt.category === "Bird" ? bt.averageWeight.toString() : "-",
        bt.ownerName || "-",
        bt.mobileNumber || "-",
        bt.address || "-",
        bt.latitude == null ? "-" : `${bt.latitude}, ${bt.longitude}`,
        bt.description || "-",
        bt.status,
      ]);
      const filename = `Others_${new Date().toISOString().split("T")[0]}`;
      exportToExcel("Others - Master List", headers, rows, filename);
      logAuditEvent("EXPORT_EXCEL", "BirdTypes", undefined, {
        count: filteredBirdTypes.length,
      });
      showNotification("Excel exported successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const validateBirdType = (birdType: Partial<BirdType>): string | null => {
    const name = birdType.birdType?.trim() ?? "";
    const averageWeight = Number(birdType.averageWeight);
    const fuel = birdType.category === "Fuel Bunk";
    if (!name || (!fuel && (Number.isNaN(averageWeight) || averageWeight <= 0))) {
      return "Please fill all required fields with valid values.";
    }

    const duplicate = birdTypes.some(
      (bt) =>
        bt.birdType.trim().toLowerCase() === name.toLowerCase() &&
        bt.id !== editingBirdType?.id,
    );
    if (duplicate) {
      return "A record with this name already exists.";
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
      category: birdType.category ?? "Bird",
      ownerName: birdType.ownerName?.trim() ?? "",
      mobileNumber: birdType.mobileNumber?.trim() ?? "",
      address: birdType.address?.trim() ?? "",
      latitude: birdType.latitude ?? null,
      longitude: birdType.longitude ?? null,
      status: birdType.status ?? "Active",
    };

    try {
      if (editingBirdType) {
        await editBirdType(editingBirdType.id, {
          ...payload,
          birdTypeNo: editingBirdType.birdTypeNo,
        });
        logAuditEvent("UPDATE_BIRD_TYPE", "BirdTypes", editingBirdType.id);
        showNotification("Record updated successfully!", "success");
      } else {
        const list = await addBirdType(payload);
        const created = list.find((bt) => bt.birdType === payload.birdType);
        logAuditEvent("CREATE_BIRD_TYPE", "BirdTypes", created?.id);
        showNotification("Record added successfully!", "success");
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
      showNotification("Record deactivated successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setSortOrder("number");
    setCurrentPage(1);
  };
  const activeFilterCount = countActiveFilters(
    search.trim() !== "",
    typeFilter !== "",
    statusFilter !== "",
    sortOrder !== "number",
  );

  const content = (
    <div className="master-page w-full min-w-0 space-y-4 font-sans text-slate-700">
      <MasterDirectoryFilters
        ariaLabel={t("masters.dir.bird_types_title")}
        searchId="bird-types-search"
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t("masters.dir.search_bird_type")}
        extraActive={typeFilter !== ""}
        extraFilter={
          <MasterDirectoryField icon={Layers3} label="Type">
            <MasterDropdown
              label="Type"
              hideLabel
              value={typeFilter}
              placeholder="All Types"
              options={typeOptions}
              onChange={handleTypeChange}
              allowClear
              className="w-full"
            />
          </MasterDirectoryField>
        }
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
        addLabel={t("masters.dir.add_bird_type")}
        onAdd={() => {
          setEditingBirdType(null);
          setShowDialog(true);
        }}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        hasRows={paginatedBirdTypes.length > 0}
        loading={loading}
        saving={saving}
      />

      <MasterDirectoryCard
        icon={Layers3}
        title={t("masters.dir.bird_types_title")}
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
        <BirdTypeTable
          birdTypes={paginatedBirdTypes}
          onEdit={handleEditBirdType}
          onDelete={handleDeleteBirdType}
          loading={loading || deletingId !== null}
          emptyMessage={
            activeFilterCount > 0 ? t("masters.dir.no_records") : undefined
          }
        />
      </MasterDirectoryCard>

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
