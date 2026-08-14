// src/modules/masters/shops/pages/ShopsPage.tsx
import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import ShopTable from "../components/ShopTable";
import ShopDialog from "../dialogs/ShopDialog";
import { useShops } from "../hooks/useShops";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useLanguage } from "../../../../providers/languageContext";
import { exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/shopService";
import type { Shop } from "../types/shop";
import type { ShopInput } from "../services/shopService";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildShopBulkImportConfig } from "../bulkImportConfig";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ShopsPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function ShopsPage({ embedded = false }: ShopsPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const { t } = useLanguage();
  const {
    shops,
    loading,
    saving,
    error,
    reload,
    addShop,
    addShopsBulk,
    editShop,
    removeShop,
  } = useShops();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredShops = useMemo(() => {
    const keyword = search.toLowerCase();
    return shops.filter(
      (shop) =>
        shop.shopName.toLowerCase().includes(keyword) ||
        shop.ownerName.toLowerCase().includes(keyword) ||
        shop.village.toLowerCase().includes(keyword) ||
        shop.phoneNumber.includes(keyword)
    );
  }, [shops, search]);

  const totalPages = Math.ceil(filteredShops.length / ITEMS_PER_PAGE) || 1;
  const paginatedShops = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredShops.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredShops, currentPage]);

  const handleExportPDF = () => {
    if (filteredShops.length === 0) {
      showNotification(t("common.noRecords"), "error");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const usableWidth = pageWidth - (margin * 2);
    const relativeWeights = [0.08, 0.22, 0.18, 0.18, 0.12, 0.12, 0.10];
    const columnStylesConfig: { [key: number]: { cellWidth: number; halign?: "center" | "left" | "right" } } = {};

    const headers = [
      t("shops.shopNo"),
      t("shops.shopName"),
      t("shops.owner"),
      t("shops.village"),
      t("shops.phone"),
      t("shops.openingBalance"),
      t("common.status"),
    ];
    headers.forEach((_, index) => {
      const computedWidth = usableWidth * relativeWeights[index];
      const isCentered = index === 0 || index === headers.length - 1;
      const isRightAligned = index === 5;
      columnStylesConfig[index] = {
        cellWidth: computedWidth,
        halign: isRightAligned ? "right" : isCentered ? "center" : "left",
      };
    });

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(`${t("shops.shopName")} - Master List`, margin, 15);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, margin, 21);

    const rows = filteredShops.map((shop) => [
      shop.shopNo.toString(),
      shop.shopName,
      shop.ownerName,
      shop.village,
      shop.phoneNumber,
      `Rs. ${Number(shop.openingBalance || 0).toFixed(2)}`,
      shop.status,
    ]);

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: "grid",
      tableWidth: usableWidth,
      margin: { left: margin, right: margin, bottom: 18 },
      styles: { fontSize: 8.5, cellPadding: 3.5, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", halign: "center" },
      bodyStyles: { textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: columnStylesConfig,
      didDrawPage: (data) => {
        const internal = doc.internal as unknown as { getNumberOfPages(): number };
    const pageCount = internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`${t("common.confidentialReport")} • Page ${data.pageNumber} of ${pageCount}`, margin, doc.internal.pageSize.height - 10);
      },
    });

    const filename = `Shops_${new Date().toISOString().split("T")[0]}`;
    doc.save(`${filename}.pdf`);
    logAuditEvent("EXPORT_PDF", "Shops", undefined, { count: filteredShops.length });
    showNotification("PDF exported successfully!", "success");
  };

  const handleExportExcel = () => {
    if (filteredShops.length === 0) {
      showNotification(t("common.noRecords"), "error");
      return;
    }
    const headers = [
      t("shops.shopNo"),
      t("shops.shopName"),
      t("shops.owner"),
      t("shops.village"),
      t("shops.phone"),
      t("shops.openingBalance"),
      t("common.status"),
    ];
    const rows = filteredShops.map((shop) => [
      shop.shopNo.toString(),
      shop.shopName,
      shop.ownerName,
      shop.village,
      shop.phoneNumber,
      shop.openingBalance,
      shop.status,
    ]);
    const filename = `Shops_${new Date().toISOString().split("T")[0]}`;
    exportToExcel(`${t("shops.shopName")} - Master List`, headers, rows, filename);
    logAuditEvent("EXPORT_EXCEL", "Shops", undefined, { count: filteredShops.length });
    showNotification("Excel exported successfully!", "success");
  };

  const shopBulkImportConfig = useMemo(
    () => buildShopBulkImportConfig({ addShopsBulk, reload }),
    [addShopsBulk, reload]
  );

  const validateShop = (shop: Partial<Shop>): string | null => {
    const shopName = shop.shopName?.trim() ?? "";
    const ownerName = shop.ownerName?.trim() ?? "";
    const phoneNumber = shop.phoneNumber?.trim() ?? "";
    const village = shop.village?.trim() ?? "";

    if (!shopName || !ownerName || !phoneNumber || !village) {
      return t("common.required");
    }
    if (shopName.length < 3) {
      return t("shops.form.errShopNameShort");
    }
    if (ownerName.length < 3) {
      return t("shops.form.errOwnerNameShort");
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      return t("shops.form.errMobile10");
    }
    if (village.length === 0) {
      return t("shops.form.errVillageRequired");
    }

    const duplicateShop = shops.some(
      (s) => s.shopName.trim().toLowerCase() === shopName.toLowerCase() && s.id !== editingShop?.id
    );
    if (duplicateShop) {
      return t("shops.duplicate");
    }
    return null;
  };

  const handleSaveShop = async (shop: Partial<Shop>): Promise<boolean> => {
    const validationError = validateShop(shop);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }
    const payload: ShopInput = {
      shopName: shop.shopName!.trim(),
      ownerName: shop.ownerName!.trim(),
      phoneNumber: shop.phoneNumber!.trim(),
      village: shop.village!.trim(),
      address: shop.address?.trim() ?? "",
      status: shop.status ?? "Active",
      openingBalance: shop.openingBalance ?? 0,
    };
    try {
      if (editingShop) {
        await editShop(editingShop.id, { ...payload, shopNo: editingShop.shopNo });
        logAuditEvent("UPDATE_SHOP", "Shops", editingShop.id);
        showNotification(t("shops.updated"), "success");
      } else {
        const list = await addShop(payload);
        const created = list.find((s) => s.shopName === payload.shopName);
        logAuditEvent("CREATE_SHOP", "Shops", created?.id);
        showNotification(t("shops.added"), "success");
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

  const handleDeleteShop = async (id: number) => {
    if (!window.confirm(t("shops.deactivateConfirm"))) return;
    setDeletingId(id);
    try {
      await removeShop(id);
      logAuditEvent("DEACTIVATE_SHOP", "Shops", id);
      showNotification(t("shops.deactivated"), "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const content = (
    <div className="w-full space-y-2 shop-page-container">
      <style>{`.shop-page-container button,[role="dialog"] button{transition:all 0.15s ease-in-out}.shop-page-container button:hover,[role="dialog"] button:hover{transform:translateY(-1px)}`}</style>

      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t("shops.search")}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  disabled={loading}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                PDF
              </button>
              <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                Excel
              </button>
              <button onClick={() => setShowBulkImport(true)} disabled={loading || saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                {t("common.bulkImport")}
              </button>
              <button onClick={() => { setEditingShop(null); setShowDialog(true); }} disabled={loading || saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t("shops.addShop")}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">{t("common.directory")}</span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">{filteredShops.length} {t("common.records")}</span>
            {(loading || saving || deletingId !== null) && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                {loading ? t("common.loading") : t("common.saving")}
              </span>
            )}
          </div>
          <p className="text-slate-500 font-medium">
            {t("common.showing")} {paginatedShops.length} {t("common.of")} {filteredShops.length} {t("masters.shops")} ({t("common.page")} {currentPage} {t("common.of")} {totalPages})
          </p>
        </div>

        {error && !loading && (
          <div className="mx-4 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => { void reload().catch(() => undefined); }} className="shrink-0 text-xs font-semibold text-red-700 underline">{t("common.retry")}</button>
          </div>
        )}

        <div className="p-0 relative min-h-[120px]">
          {loading && shops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              <p className="text-sm font-medium">{t("common.loadingEntities")}</p>
            </div>
          ) : !loading && shops.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">{t("common.noEntities")}</p>
              <p className="text-xs text-slate-500">{t("common.addToStart")}</p>
            </div>
          ) : (
            <ShopTable shops={paginatedShops} onEdit={handleEditShop} onDelete={(id) => { void handleDeleteShop(id); }} />
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1 || loading} className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
            {t("common.previous")}
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button key={pageNum} onClick={() => setCurrentPage(pageNum)} disabled={loading} className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center ${currentPage === pageNum ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
                {pageNum}
              </button>
            ))}
          </div>
          <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || loading} className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
            {t("common.next")}
          </button>
        </div>
      </div>

      <ShopDialog
        open={showDialog}
        onClose={() => { setEditingShop(null); setShowDialog(false); }}
        onSave={handleSaveShop}
        shop={editingShop}
      />
      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        config={shopBulkImportConfig}
        existing={shops}
        onImported={(result) => {
          logAuditEvent("BULK_IMPORT", "Shops", undefined, { count: result.imported });
          showNotification(t("common.bulkImportDone").replace("{imported}", String(result.imported)).replace("{total}", String(result.total)), result.failed === 0 ? "success" : "error");
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
