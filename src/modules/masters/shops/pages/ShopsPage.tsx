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
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from "../../../../shared/ui/paginationStyles";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BulkImportDialog from "../../components/bulk-import/BulkImportDialog";
import { buildShopBulkImportConfig } from "../bulkImportConfig";
import { useI18n } from "../../../../i18n";

type ShopsPageProps = { embedded?: boolean };

const PAGE_SIZE_OPTIONS = [10, 15, 20, 25] as const;

function ShopsPage({ embedded = false }: ShopsPageProps) {
  const { t } = useI18n();
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

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
  } = useShops();

  const shopBulkImportConfig = useMemo(
    () => buildShopBulkImportConfig({ addShopsBulk, reload }),
    [addShopsBulk, reload]
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
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  // City dropdown options are derived live from the full loaded shop dataset —
  // never hardcoded. Empty values are ignored; case/whitespace variants collapse
  // to a single option (first spelling seen wins for display).
  const cityOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const shop of shops) {
      const label = (shop.city ?? "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, label);
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [shops]);

  const filteredShops = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const city = cityFilter.trim().toLowerCase();
    return shops
      .filter((shop) => {
        const matchesSearch =
          keyword === "" ||
          shop.shopName.toLowerCase().includes(keyword) ||
          shop.ownerName.toLowerCase().includes(keyword) ||
          shop.city.toLowerCase().includes(keyword) ||
          shop.phoneNumber.includes(keyword) ||
          shop.shopNumber.toLowerCase().includes(keyword);
        const matchesCity = city === "" || (shop.city ?? "").trim().toLowerCase() === city;
        return matchesSearch && matchesCity;
      })
      .sort((a, b) => a.shopNo - b.shopNo);
  }, [shops, search, cityFilter]);

  // Pagination Calculations
  const totalPages = Math.ceil(filteredShops.length / itemsPerPage) || 1;

  // Clamp at render time so a shrinking dataset (filter change, data refresh,
  // edit that moves a shop's city, delete) never leaves us on an empty page.
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * itemsPerPage;
  const paginatedShops = useMemo(() => {
    const startIndex = (safePage - 1) * itemsPerPage;
    return filteredShops.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredShops, safePage, itemsPerPage]);

  const handleExportPDF = () => {
    if (filteredShops.length === 0) {
      showNotification(t("masters.shops.toast.no_data_export"), "error");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const usableWidth = pageWidth - (margin * 2);

    const relativeWeights = [0.06, 0.22, 0.16, 0.14, 0.12, 0.10, 0.08, 0.12];
    const columnStylesConfig: { [key: number]: { cellWidth: number; halign?: "center" | "left" | "right" } } = {};

    const headers = [
      t("masters.shops.table.s_no"),
      t("masters.shops.table.shop_name"),
      t("masters.shops.table.owner"),
      t("masters.shops.table.mobile_no"),
      t("masters.shops.table.city"),
      t("masters.shops.table.association_type"),
      t("masters.shops.table.paper_rate"),
      t("masters.shops.table.opening_balance"),
    ];
    headers.forEach((_, index) => {
      const computedWidth = usableWidth * relativeWeights[index];
      const isCentered = index === 0 || index === 6 || index === 7;
      columnStylesConfig[index] = {
        cellWidth: computedWidth,
        halign: isCentered ? "center" : "left",
      };
    });

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(t("masters.shops.title") + " - " + t("common.master_list"), margin, 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${t("common.generated_on")}: ${new Date().toLocaleDateString()}`, margin, 21);

    const rows = filteredShops.map((shop, index) => [
      (index + 1).toString(),
      shop.shopName,
      shop.ownerName,
      shop.phoneNumber,
      shop.city,
      shop.associationType || "—",
      shop.paperRate.toString(),
      `₹${Number(shop.openingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${t("common.confidential_report")} • ${t("common.page")} ${data.pageNumber} ${t("common.of")} ${pageCount}`,
          margin,
          doc.internal.pageSize.height - 10
        );
      },
    });

    const filename = `${t("masters.shops.title")}_${new Date().toISOString().split("T")[0]}`;
    doc.save(`${filename}.pdf`);
    logAuditEvent("EXPORT_PDF", "Shops", undefined, { count: filteredShops.length });
    showNotification(t("masters.shops.toast.pdf_exported"), "success");
  };

  const handleExportExcel = () => {
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
    ];
    const rows = filteredShops.map((shop, index) => [
      (index + 1).toString(),
      shop.shopName,
      shop.ownerName,
      shop.phoneNumber,
      shop.city,
      shop.associationType || "—",
      shop.paperRate.toString(),
      `₹${Number(shop.openingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ]);
    const filename = `${t("masters.shops.title")}_${new Date().toISOString().split("T")[0]}`;

    exportToExcel(`${t("masters.shops.title")} - ${t("common.master_list")}`, headers, rows, filename);
    logAuditEvent("EXPORT_EXCEL", "Shops", undefined, { count: filteredShops.length });
    showNotification(t("masters.shops.toast.excel_exported"), "success");
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
    if (secondaryPhoneNumber !== "" && !/^[0-9]{10}$/.test(secondaryPhoneNumber)) {
      return t("masters.shops.validation.secondary_mobile_10_digits");
    }
    if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return t("masters.shops.validation.email_invalid");
    }

    const duplicateShop = shops.some(
      (s) =>
        s.shopName.trim().toLowerCase() === shopName.toLowerCase() &&
        s.id !== editingShop?.id
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
        await editShop(editingShop.id, { ...payload, shopNo: editingShop.shopNo });
        logAuditEvent("UPDATE_SHOP", "Shops", editingShop.id);
        showNotification(t("masters.shops.toast.updated"), "success");
      } else {
        const list = await addShop(payload);
        const created = list.find(
          (s) =>
            s.shopName === payload.shopName &&
            s.phoneNumber === payload.phoneNumber
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

  const content = (
    <div className="w-full space-y-2 shop-page-container">
      <style>{`
        .shop-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .shop-page-container button:hover,
        [role="dialog"] button:hover {
          transform: translateY(-1px);
        }
      `}</style>

      {/* Main Container */}
      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm">
        {/* Toolbar - Search on LEFT, Buttons on RIGHT in same line */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40 rounded-t-xl">
          <div className="flex items-center justify-between gap-4">
            {/* Search + City filter - Left Side */}
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-md">
                <input
                  type="text"
                  placeholder={t("masters.shops.search_placeholder")}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  disabled={loading}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <select
                  aria-label={t("masters.shops.filter.city")}
                  value={cityFilter}
                  onChange={(e) => handleCityChange(e.target.value)}
                  disabled={loading}
                  className="appearance-none pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
                >
                  <option value="">{t("masters.shops.filter.all_cities")}</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {(search !== "" || cityFilter !== "") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:text-slate-800 transition-all"
                >
                  {t("masters.shops.filter.reset")}
                </button>
              )}
            </div>

            {/* Action Buttons - Right Side */}
            <div className="flex items-center gap-3 flex-shrink-0">
              
              {/* 1. Export Dropdown (Soft Light Emerald Fill) */}
              <div className="relative group z-50">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {t("masters.shops.export")}
                  <svg className="w-4 h-4 text-emerald-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-32 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    {t("masters.shops.export_pdf")}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors border-t border-slate-100"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    {t("masters.shops.export_excel")}
                  </button>
                </div>
              </div>

              {/* 2. Import Button (Soft Light Indigo Fill) */}
              <button
                onClick={() => setShowBulkImport(true)}
                disabled={loading || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-50 z-40"
              >
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t("masters.shops.import")}
              </button>

              {/* 3. Add Shop Button (Solid Blue Fill) */}
              <button
                onClick={() => {
                  setEditingShop(null);
                  setShowDialog(true);
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 z-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t("masters.shops.add_shop")}
              </button>
            </div>
          </div>
        </div>

        {/* Status Counter Bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              {t("masters.shops.outlets_directory")}
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {t("masters.shops.records", { count: filteredShops.length })}
            </span>
            {(loading || saving) && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {loading ? t("masters.shops.loading") : t("masters.shops.saving")}
              </span>
            )}
          </div>
          <p className="text-slate-500 font-medium">
            {t("masters.shops.showing", { shown: paginatedShops.length, total: filteredShops.length, current: safePage, pages: totalPages })}
          </p>
        </div>

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
              {t("masters.shops.error_retry")}
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="p-0 relative min-h-[120px]">
          {loading && shops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 0 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm font-medium">{t("masters.shops.loading")}</p>
            </div>
          ) : !loading && shops.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">{t("masters.shops.no_shops_found")}</p>
              <p className="text-xs text-slate-500">{t("masters.shops.add_first")}</p>
            </div>
          ) : (
            <ShopTable
              shops={paginatedShops}
              onEdit={handleEditShop}
              startIndex={pageStartIndex}
            />
          )}
        </div>

        {shouldShowPagination(filteredShops.length) && (
          <div className={paginationBarClass}>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <label htmlFor="shops-page-size" className="whitespace-nowrap font-medium">
                Rows per page
              </label>
              <select
                id="shops-page-size"
                aria-label="Rows per page"
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                disabled={loading}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setCurrentPage(Math.max(safePage - 1, 1))}
              disabled={safePage === 1 || loading}
              className={paginationNavBtnClass}
            >
              {t("masters.shops.pagination.previous")}
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                  className={paginationPageBtnClass(safePage === pageNum)}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(safePage + 1, totalPages))}
              disabled={safePage === totalPages || loading}
              className={paginationNavBtnClass}
            >
              {t("masters.shops.pagination.next")}
            </button>
          </div>
        )}
      </div>

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
            t("masters.shops.toast.imported", { imported: result.imported, total: result.total }),
            result.failed === 0 ? "success" : "error"
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