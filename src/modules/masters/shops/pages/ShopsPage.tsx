import "../../styles/masters.css";
import MasterDropdown from "../../components/MasterDropdown";
import { MapPin, Store } from "lucide-react";
// D:\Development\DMR-Poultries-ERP\frontend\dmr-poultries-web\src\modules\masters\shops\pages\ShopsPage.tsx

import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import ShopTable from "../components/ShopTable";
import ShopDialog from "../dialogs/ShopDialog";
import { useShops } from "../hooks/useShops";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/shopService";
import type { Shop } from "../types/shop";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildShopBulkImportConfig } from "../bulkImportConfig";
import { useI18n } from "../../../../i18n";
import { countActiveFilters } from "../../../../ui";
import {
  MasterDirectoryFilters,
  MasterDirectoryField,
  MasterDirectoryCard,
} from "../../components/MasterDirectory";

type ShopsPageProps = { embedded?: boolean };

const DEFAULT_PAGE_SIZE = 10;

function ShopsPage({ embedded = false }: ShopsPageProps) {
  const { t } = useI18n();
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("number");
  const [cityFilter, setCityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const { showNotification } = useSafeNotification();
  const {
    shops,
    loading,
    saving,
    error,
    reload,
    addShop,
    addShopsBulk,
    editShop,
    total,
    page: serverPage,
    exportRows,
    facets,
  } = useShops({
    page: currentPage,
    pageSize: pageSize,
    search,
    status: statusFilter,
    sort: sortOrder,
    city: cityFilter,
  });

  const shopBulkImportConfig = useMemo(
    () => buildShopBulkImportConfig({ addShopsBulk, reload }),
    [addShopsBulk, reload],
  );

  // Reset to page 1 whenever search keyword changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Reset to page 1 whenever the city filter changes
  const handleCityChange = (value: string) => {
    setCityFilter(value);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCityFilter("");
    setStatusFilter("");
    setSortOrder("number");
    setCurrentPage(1);
  };

  // Reset to page 1 whenever the rows-per-page value changes
  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setCurrentPage(1);
  };

  // City dropdown options are derived live from the full loaded shop dataset —
  // never hardcoded. Empty values are ignored; case/whitespace variants collapse
  // to a single option (first spelling seen wins for display).
  const cityOptions = facets.city ?? [];

  const safePage = serverPage;
  const paginatedShops = shops;
  const pageStartIndex = (safePage - 1) * pageSize;

  const handleExportPDF = async () => {
    try {
      const filteredShops = await exportRows();

      if (filteredShops.length === 0) {
        showNotification(t("masters.shops.toast.no_data_export"), "error");
        return;
      }

      const doc = new jsPDF("l", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const usableWidth = pageWidth - margin * 2;

      // Nine columns: S.No, shop, owner, mobile, city, association, paper rate,
      // opening balance, current balance.
      const relativeWeights = [
        0.05, 0.19, 0.14, 0.12, 0.1, 0.11, 0.08, 0.1, 0.11,
      ];
      const columnStylesConfig: {
        [key: number]: {
          cellWidth: number;
          halign?: "center" | "left" | "right";
        };
      } = {};

      const headers = [
        t("masters.shops.table.s_no"),
        t("masters.shops.table.shop_name"),
        t("masters.shops.table.owner"),
        t("masters.shops.table.mobile_no"),
        t("masters.shops.table.city"),
        t("masters.shops.table.association_type"),
        t("masters.shops.table.paper_rate"),
        t("masters.shops.table.opening_balance"),
        t("masters.shops.table.current_balance"),
      ];
      headers.forEach((_, index) => {
        const computedWidth = usableWidth * relativeWeights[index];
        const isCentered = index === 0 || index === 6;
        columnStylesConfig[index] = {
          cellWidth: computedWidth,
          halign: isCentered ? "center" : "left",
        };
      });

      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(
        t("masters.shops.title") + " - " + t("common.master_list"),
        margin,
        15,
      );

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${t("common.generated_on")}: ${new Date().toLocaleDateString()}`,
        margin,
        21,
      );

      const rows = filteredShops.map((shop, index) => [
        (index + 1).toString(),
        shop.shopName,
        shop.ownerName,
        shop.phoneNumber,
        shop.city,
        shop.associationType || "—",
        shop.paperRate.toString(),
        `₹${Number(shop.openingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `₹${Number(shop.currentBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ]);

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
            `${t("common.confidential_report")} • ${t("common.page")} ${data.pageNumber} ${t("common.of")} ${pageCount}`,
            margin,
            doc.internal.pageSize.height - 10,
          );
        },
      });

      const filename = `${t("masters.shops.title")}_${new Date().toISOString().split("T")[0]}`;
      doc.save(`${filename}.pdf`);
      logAuditEvent("EXPORT_PDF", "Shops", undefined, {
        count: filteredShops.length,
      });
      showNotification(t("masters.shops.toast.pdf_exported"), "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const handleExportExcel = async () => {
    try {
      const filteredShops = await exportRows();

      if (filteredShops.length === 0) {
        showNotification(t("masters.shops.toast.no_data_export"), "error");
        return;
      }
      const headers = [
        t("masters.shops.table.s_no"),
        t("masters.shops.table.shop_name"),
        t("masters.shops.table.owner"),
        t("masters.shops.table.mobile_no"),
        t("masters.shops.table.city"),
        t("masters.shops.table.association_type"),
        t("masters.shops.table.paper_rate"),
        t("masters.shops.table.opening_balance"),
        t("masters.shops.table.current_balance"),
      ];
      const rows = filteredShops.map((shop, index) => [
        (index + 1).toString(),
        shop.shopName,
        shop.ownerName,
        shop.phoneNumber,
        shop.city,
        shop.associationType || "—",
        shop.paperRate.toString(),
        Number(shop.openingBalance || 0),
        Number(shop.currentBalance || 0),
      ]);
      const filename = `${t("masters.shops.title")}_${new Date().toISOString().split("T")[0]}`;

      exportToExcel(
        `${t("masters.shops.title")} - ${t("common.master_list")}`,
        headers,
        rows,
        filename,
      );
      logAuditEvent("EXPORT_EXCEL", "Shops", undefined, {
        count: filteredShops.length,
      });
      showNotification(t("masters.shops.toast.excel_exported"), "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    }
  };

  const validateShop = (shop: Partial<Shop>): string | null => {
    const shopName = shop.shopName?.trim() ?? "";
    const ownerName = shop.ownerName?.trim() ?? "";
    const phoneNumber = shop.phoneNumber?.trim() ?? "";
    const secondaryPhoneNumber = shop.secondaryPhoneNumber?.trim() ?? "";
    const email = shop.email?.trim() ?? "";
    const city = shop.city?.trim() ?? "";

    if (!shopName || !ownerName || !phoneNumber || !city) {
      return t("masters.shops.validation.fill_required");
    }
    if (shopName.length < 3) {
      return t("masters.shops.validation.shop_name_min");
    }
    if (ownerName.length < 3) {
      return t("masters.shops.validation.owner_name_min");
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      return t("masters.shops.validation.mobile_10_digits");
    }
    if (
      secondaryPhoneNumber !== "" &&
      !/^[0-9]{10}$/.test(secondaryPhoneNumber)
    ) {
      return t("masters.shops.validation.secondary_mobile_10_digits");
    }
    if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return t("masters.shops.validation.email_invalid");
    }

    const duplicateShop = shops.some(
      (s) =>
        s.shopName.trim().toLowerCase() === shopName.toLowerCase() &&
        s.id !== editingShop?.id,
    );
    if (duplicateShop) {
      return t("masters.shops.validation.duplicate_shop");
    }

    return null;
  };

  const handleSaveShop = async (shop: Partial<Shop>): Promise<boolean> => {
    const validationError = validateShop(shop);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    const payload = {
      shopNumber: shop.shopNumber?.trim() ?? "",
      shopName: shop.shopName!.trim(),
      ownerName: shop.ownerName!.trim(),
      phoneNumber: shop.phoneNumber!.trim(),
      secondaryPhoneNumber: shop.secondaryPhoneNumber?.trim() ?? "",
      email: shop.email?.trim() ?? "",
      city: shop.city!.trim(),
      address: shop.address?.trim() ?? "",
      latitude: shop.latitude != null ? Number(shop.latitude) : 0,
      longitude: shop.longitude != null ? Number(shop.longitude) : 0,
      paperRate: shop.paperRate ?? 1,
      associationType: shop.associationType?.trim() ?? "",
      status: shop.status ?? "Active",
      openingBalance: shop.openingBalance ?? 0,
    };

    try {
      if (editingShop) {
        await editShop(editingShop.id, {
          ...payload,
          shopNo: editingShop.shopNo,
        });
        logAuditEvent("UPDATE_SHOP", "Shops", editingShop.id);
        showNotification(t("masters.shops.toast.updated"), "success");
      } else {
        const list = await addShop(payload);
        const created = list.find(
          (s) =>
            s.shopName === payload.shopName &&
            s.phoneNumber === payload.phoneNumber,
        );
        logAuditEvent("CREATE_SHOP", "Shops", created?.id);
        showNotification(t("masters.shops.toast.added"), "success");
      }
      setEditingShop(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditShop = (shop: Shop) => {
    setEditingShop(shop);
    setShowDialog(true);
  };

  const activeFilterCount = countActiveFilters(
    search.trim() !== "",
    cityFilter !== "",
    statusFilter !== "",
    sortOrder !== "number",
  );
  const hasRows = paginatedShops.length > 0;
  const searchId = "shops-search";

  const content = (
    <div className="master-page w-full min-w-0 space-y-4 font-sans text-slate-700">
      <MasterDirectoryFilters
        ariaLabel={t("masters.shops.outlets_directory")}
        searchId={searchId}
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t("masters.shops.search_placeholder")}
        extraActive={cityFilter !== ""}
        extraFilter={
          <MasterDirectoryField
            icon={MapPin}
            label={t("masters.shops.filter.city")}
          >
            <MasterDropdown
              label={t("masters.shops.filter.city")}
              hideLabel
              value={cityFilter}
              placeholder={t("masters.shops.filter.all_cities")}
              options={cityOptions}
              onChange={handleCityChange}
              allowClear
              searchable
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
        addLabel={t("masters.shops.add_shop")}
        onAdd={() => {
          setEditingShop(null);
          setShowDialog(true);
        }}
        onImport={() => setShowBulkImport(true)}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        hasRows={hasRows}
        loading={loading}
        saving={saving}
      />

      <MasterDirectoryCard
        icon={Store}
        title={t("masters.shops.outlets_directory")}
        total={total}
        error={error}
        loading={loading}
        onRetry={() => {
          void reload().catch(() => undefined);
        }}
        retryLabel={t("masters.shops.error_retry")}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      >
        <ShopTable
          shops={paginatedShops}
          onEdit={handleEditShop}
          startIndex={pageStartIndex}
          loading={loading}
          emptyMessage={
            activeFilterCount > 0
              ? t("masters.shops.no_shops_found")
              : t("masters.shops.add_first")
          }
        />
      </MasterDirectoryCard>

      {/* Modal Dialog */}
      <ShopDialog
        open={showDialog}
        onClose={() => {
          setEditingShop(null);
          setShowDialog(false);
        }}
        onSave={handleSaveShop}
        shop={editingShop}
      />
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        config={shopBulkImportConfig}
        existing={shops}
        onImported={(result) => {
          logAuditEvent("BULK_IMPORT", "Shops", undefined, {
            count: result.imported,
          });
          showNotification(
            t("masters.shops.toast.imported", {
              imported: result.imported,
              total: result.total,
            }),
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

export default React.memo(ShopsPage);
