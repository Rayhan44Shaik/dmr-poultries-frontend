// src/modules/collections/pages/PendingCollectionsPage.tsx

import { useState, useEffect, useMemo, useRef } from "react";
import { collectionService } from "../services/collectionService";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import type { Collection, CollectionPendingSummaryRow, CollectionPendingSummaryTotals } from "../types/collection";
import { EditCollectionModal } from "../components/pending/EditCollectionModal";
import { useShopSearch } from "../../../../core/hooks/useShopSearch";
import {
  FileSpreadsheet,
  FileText,
  X,
  Filter,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from "../../../../shared/ui/paginationStyles";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import { PendingKPICards } from "../components/pending/PendingKPICards";
import { PendingTable } from "../components/pending/PendingTable";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../../shared/ui/operationsStyles";

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN");
};

const PAGE_SIZE = 15;

export default function PendingCollectionsPage() {
  const { showNotification } = useSafeNotification();

  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const { shops } = useShops();
  const allShopNames = shops.map((s) => s.shopName).sort();

  const tableRef = useRef<HTMLDivElement>(null);

  const { employees } = useEmployees();
  const collectors = useMemo(
    () =>
      employees
        .filter((emp) => emp.department === "Collection")
        .map((emp) => emp.employeeName)
        .sort(),
    [employees]
  );

  // ---- Filter state ----
  const [asOnDate, setAsOnDate] = useState("");
  const [shopName, setShopName] = useState("");
  const [collector, setCollector] = useState("");
  const [sortBy, setSortBy] = useState("highestBalance");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [recoveryThreshold, setRecoveryThreshold] = useState(0);

  // ---- Selection state for table toolbar ----
  const [selectedShopName, setSelectedShopName] = useState<string | null>(null);

  // ---- Pagination ----
  const [currentPage, setCurrentPage] = useState(1);

  // ---- Modal state ----
  // Pending Collection is View + Delete only — no Edit. The modal is always
  // opened in "view" mode here (Collection Entry's own page still uses edit).
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [summary, setSummary] = useState({
    balance: 0,
    weeklySales: 0,
    weeklyCollections: 0,
    weeklyPending: 0,
    shopName: "",
    dateRange: "",
    showSummary: false,
  });

  // Backend-authoritative main table source: one aggregated row per active
  // shop (opening/balance/sales/approved/pending/recovery). Do not recompute
  // recoveryPercentage or balance from these — read them as-is.
  const [pendingSummaryRows, setPendingSummaryRows] = useState<CollectionPendingSummaryRow[]>([]);
  const [pendingTotals, setPendingTotals] = useState<CollectionPendingSummaryTotals>({
    weeklySales: 0,
    weeklyApprovedCollections: 0,
    weeklyPendingCollections: 0,
    balance: 0,
    recoveryPercentage: 0,
  });
  const [defaultAsOnDate, setDefaultAsOnDate] = useState("");

  const loadData = async () => {
    try {
      await collectionService.refreshFromBackend();
      const all = collectionService.getCollections();
      setAllCollections(all);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    void collectionService.fetchWeekBounds().then((bounds) => {
      setDefaultAsOnDate(bounds.asOfDate);
      setAsOnDate((prev) => prev || bounds.asOfDate);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!asOnDate) return;
    void collectionService.fetchPendingSummary(asOnDate).then((payload) => {
      setPendingSummaryRows(payload.shops);
      setPendingTotals(payload.totals);
    }).catch(() => {
      setPendingSummaryRows([]);
    });
  }, [asOnDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setSelectedShopName(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const summaryByShopName = useMemo(() => {
    const map = new Map<string, CollectionPendingSummaryRow>();
    pendingSummaryRows.forEach((row) => map.set(row.shopName, row));
    return map;
  }, [pendingSummaryRows]);

  const filteredData = useMemo(() => {
    let data = [...pendingSummaryRows];

    if (shopName) {
      data = data.filter((s) =>
        s.shopName.toLowerCase().startsWith(shopName.toLowerCase())
      );
    }

    if (collector) {
      data = data.filter((shop) => {
        const shopCollections = allCollections
          .filter((c) => c.shopName === shop.shopName)
          .sort((a, b) => {
            const dateA = a.collectionDate || a.createdDate || "";
            const dateB = b.collectionDate || b.createdDate || "";
            return dateB.localeCompare(dateA);
          });
        if (shopCollections.length === 0) return false;
        return shopCollections[0].collectorName === collector;
      });
    }

    if (fromDate) {
      data = data.filter((s) => (s.lastCollectionDate ?? "") >= fromDate);
    }
    if (toDate) {
      data = data.filter((s) => (s.lastCollectionDate ?? "") <= toDate);
    }

    if (recoveryThreshold > 0) {
      data = data.filter((shop) => shop.recoveryPercentage >= recoveryThreshold);
    }

    switch (sortBy) {
      case "highestBalance":
        data.sort((a, b) => b.balance - a.balance);
        break;
      case "lowestBalance":
        data.sort((a, b) => a.balance - b.balance);
        break;
      case "alphabeticalAZ":
        data.sort((a, b) => a.shopName.localeCompare(b.shopName));
        break;
      case "alphabeticalZA":
        data.sort((a, b) => b.shopName.localeCompare(a.shopName));
        break;
      default:
        break;
    }
    return data;
  }, [
    pendingSummaryRows,
    shopName,
    collector,
    fromDate,
    toDate,
    sortBy,
    allCollections,
    recoveryThreshold,
  ]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [shopName, collector, fromDate, toDate, asOnDate, sortBy, recoveryThreshold]);

  const totalPending = filteredData.reduce((sum, s) => sum + s.balance, 0);

  const weeklyStats = {
    weeklySales: pendingTotals.weeklySales,
    weeklyCollections: pendingTotals.weeklyApprovedCollections,
  };
  const weeklyRecovery = pendingTotals.recoveryPercentage;

  const grandTotalPending = totalPending;
  const grandTotalWeeklySales = filteredData.reduce((sum, s) => sum + s.weeklySales, 0);
  const grandTotalWeeklyCollections = filteredData.reduce(
    (sum, s) => sum + s.weeklyApprovedCollections,
    0
  );

  const getLatestCollection = (shopName: string): Collection | null => {
    const shopCollections = allCollections
      .filter((c) => c.shopName === shopName)
      .sort((a, b) => {
        const dateA = a.collectionDate || a.createdDate || "";
        const dateB = b.collectionDate || b.createdDate || "";
        return dateB.localeCompare(dateA);
      });
    return shopCollections.length > 0 ? shopCollections[0] : null;
  };

  const updateSummaryForShop = (shopName: string) => {
    const week = summaryByShopName.get(shopName);
    if (!week) {
      setSummary((prev) => ({ ...prev, showSummary: false }));
      return;
    }
    setSummary({
      balance: week.balance,
      weeklySales: week.weeklySales,
      weeklyCollections: week.weeklyApprovedCollections,
      weeklyPending: week.weeklyPendingCollections,
      shopName: week.shopName,
      dateRange: `${week.weekStart} → ${week.weekEnd}`,
      showSummary: true,
    });
  };

  const getExportFileName = (ext: "xlsx" | "pdf") => {
    const dateStr = asOnDate.replace(/-/g, "");
    let name = `Pending_Collections_${dateStr}`;
    if (shopName) {
      const shopSlug = shopName.replace(/[^a-zA-Z0-9]/g, "_");
      name += `_${shopSlug}`;
    }
    return `${name}.${ext}`;
  };

  const exportExcel = () => {
    if (filteredData.length === 0) {
      showNotification("No data to export.", "info");
      return;
    }

    const tableData: any[] = filteredData.map((shop, idx) => {
      return {
        "#": idx + 1,
        "Shop Name": shop.shopName,
        "Last Collection": formatDate(shop.lastCollectionDate ?? "-"),
        "Total Sales": shop.weeklySales,
        "Total Collections": shop.weeklyApprovedCollections,
        Pending: shop.balance,
        "Recovery %": Number(shop.recoveryPercentage.toFixed(2)),
        "Overdue (Days)": shop.overdueDays ?? "",
      };
    });

    const summaryRow: any = {
      "#": "",
      "Shop Name": "TOTAL",
      "Last Collection": "",
      "Total Sales": filteredData.reduce((sum, s) => sum + s.weeklySales, 0),
      "Total Collections": filteredData.reduce((sum, s) => sum + s.weeklyApprovedCollections, 0),
      Pending: filteredData.reduce((sum, s) => sum + s.balance, 0),
      "Recovery %": "",
      "Overdue (Days)": "",
    };
    tableData.push(summaryRow);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(tableData);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 18 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Pending Collections");
    XLSX.writeFile(wb, getExportFileName("xlsx"));
    showNotification("Excel exported successfully!", "success");
  };

  const exportPDF = () => {
    if (filteredData.length === 0) {
      showNotification("No data to export.", "info");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    const margin = 14;

    const title = `Pending Collections - As On ${asOnDate}${
      shopName ? ` (${shopName})` : ""
    }`;
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text(title, margin, 18);

    const rows = filteredData.map((shop, idx) => {
      return [
        (idx + 1).toString(),
        shop.shopName,
        formatDate(shop.lastCollectionDate ?? "-"),
        shop.weeklySales.toFixed(2),
        shop.weeklyApprovedCollections.toFixed(2),
        shop.balance.toFixed(2),
        shop.recoveryPercentage.toFixed(2),
        shop.overdueDays == null ? "—" : shop.overdueDays.toString(),
      ];
    });

    const totalSalesSum = filteredData.reduce((sum, s) => sum + s.weeklySales, 0);
    const totalCollectionsSum = filteredData.reduce(
      (sum, s) => sum + s.weeklyApprovedCollections,
      0
    );
    const totalPendingSum = filteredData.reduce((sum, s) => sum + s.balance, 0);

    rows.push([
      "",
      "TOTAL",
      "",
      totalSalesSum.toFixed(2),
      totalCollectionsSum.toFixed(2),
      totalPendingSum.toFixed(2),
      "",
      "",
    ]);

    const colWidths = {
      0: 12,
      1: 55,
      2: 28,
      3: 28,
      4: 28,
      5: 28,
      6: 22,
      7: 20,
    };

    autoTable(doc, {
      head: [
        [
          "#",
          "Shop Name",
          "Last Collection",
          "Total Sales",
          "Total Collections",
          "Pending",
          "Recovery %",
          "Overdue Days",
        ],
      ],
      body: rows,
      startY: 25,
      theme: "striped",
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [240, 242, 245] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: colWidths[0], halign: "center" },
        1: { cellWidth: colWidths[1], halign: "left" },
        2: { cellWidth: colWidths[2] },
        3: { cellWidth: colWidths[3] },
        4: { cellWidth: colWidths[4] },
        5: { cellWidth: colWidths[5] },
        6: { cellWidth: colWidths[6] },
        7: { cellWidth: colWidths[7], halign: "center" },
      },
      tableWidth: "auto",
      margin: { left: margin, right: margin },
      didParseCell: function (data) {
        if (data.section === "body" && data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 255, 200];
        }
        if (data.column.index >= 3 && data.column.index <= 6) {
          data.cell.styles.halign = "right";
        }
      },
    });

    doc.save(getExportFileName("pdf"));
    showNotification("PDF exported successfully!", "success");
  };

  const handleView = (shopName: string) => {
    setSelectedShop(shopName);
    setIsEditModalOpen(true);
    updateSummaryForShop(shopName);
  };

  /**
   * Pending Collection delete — backend-authoritative. The 7-day eligibility
   * check (canDelete) comes from GET .../recent, never computed here; the
   * actual mutation always goes through deletePendingCollection(), which
   * calls DELETE /collection-entry/pending/:id (a different endpoint from
   * Collection Entry's own delete). If the pre-check itself fails to load,
   * the delete call is still made and the backend will reject it (409) if
   * ineligible — the frontend check is a convenience, not the authority.
   */
  const handleDelete = async (shopName: string) => {
    const latest = getLatestCollection(shopName);
    if (!latest || latest.numericId == null) {
      showNotification("No collection to delete.", "error");
      return;
    }
    const shopId = collectionService.getShopIdForName(shopName);
    if (shopId != null) {
      try {
        const recent = await collectionService.fetchRecentCollectionsForShop(shopId, 1);
        if (recent[0]?.canDelete === false) {
          showNotification(
            "Cannot delete – collection is outside the 7-day deletion window.",
            "error"
          );
          return;
        }
      } catch {
        // Eligibility pre-check failed to load; fall through and let the
        // backend's own gate on the delete call be authoritative.
      }
    }
    const result = await collectionService.deletePendingCollection(String(latest.numericId));
    if (result.success) {
      await refreshData();
      setSummary((prev) => ({ ...prev, showSummary: false }));
      setSelectedShopName(null);
      showNotification("Collection deleted successfully.", "success");
    } else {
      showNotification(result.message ?? "Delete failed.", "error");
    }
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setSelectedShop(null);
    setSummary((prev) => ({ ...prev, showSummary: false }));
  };

  const refreshData = async () => {
    try {
      await collectionService.refreshFromBackend();
      const all = collectionService.getCollections();
      setAllCollections(all);
      if (asOnDate) {
        try {
          const payload = await collectionService.fetchPendingSummary(asOnDate);
          setPendingSummaryRows(payload.shops);
          setPendingTotals(payload.totals);
        } catch {
          // Keep prior summaries if the refetch itself fails; the page-level
          // collections list has already been refreshed above.
        }
      }
      if (selectedShop) {
        updateSummaryForShop(selectedShop);
      }
    } catch (error) {
      showNotification("Failed to refresh data.", "error");
    }
  };

  const resetFilters = () => {
    setShopName("");
    setCollector("");
    setFromDate("");
    setToDate("");
    setAsOnDate(defaultAsOnDate);
    setSortBy("highestBalance");
    setRecoveryThreshold(0);
    shopSearch.setQuery("");
    setSummary((prev) => ({ ...prev, showSummary: false }));
    setSelectedShopName(null);
    setCurrentPage(1);
    showNotification("Filters reset successfully.", "info");
  };

  const shopSearch = useShopSearch(allShopNames, shopName, setShopName);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="w-full space-y-5">
      {summary.showSummary && (
        <OutstandingSummary
          balance={summary.balance}
          weeklySales={summary.weeklySales}
          weeklyCollections={summary.weeklyCollections}
          weeklyPending={summary.weeklyPending}
          showSummary={summary.showSummary}
          shopName={summary.shopName}
          dateRange={summary.dateRange}
        />
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={exportExcel} className={opsExcelButtonClass}>
          <FileSpreadsheet size={15} /> Excel
        </button>
        <button onClick={exportPDF} className={opsPdfButtonClass}>
          <FileText size={15} /> PDF
        </button>
        <button onClick={resetFilters} className={opsSecondaryButtonClass}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* Filter Bar Card */}
      <div className={opsFilterCardClass}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DatePicker
            value={asOnDate}
            onChange={(value) => setAsOnDate(value)}
            label="As On Date *"
            className="w-full"
            placeholder="Select date"
            required
          />
          <div>
            <label className={opsFilterLabelClass}>Shop Name</label>
            <div className="relative">
              <input
                type="text"
                value={shopSearch.query}
                onChange={(e) => shopSearch.handleInputChange(e.target.value)}
                onFocus={() => shopSearch.setIsOpen(true)}
                onBlur={() => setTimeout(() => shopSearch.setIsOpen(false), 200)}
                placeholder="All Shops"
                className={`${opsInputClass} pr-8`}
              />
              {shopSearch.query && (
                <button
                  type="button"
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  onClick={() => {
                    shopSearch.setQuery("");
                    setShopName("");
                    shopSearch.setIsOpen(false);
                  }}
                >
                  <X size={16} />
                </button>
              )}
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              {shopSearch.isOpen && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 text-sm shadow-lg">
                  <li
                    className="cursor-pointer px-3 py-2 hover:bg-green-50 text-blue-600 font-medium"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      shopSearch.setQuery("");
                      setShopName("");
                      shopSearch.setIsOpen(false);
                    }}
                  >
                    All Shops
                  </li>
                  {shopSearch.filteredShops.length > 0 ? (
                    shopSearch.filteredShops.slice(0, 5).map((shop) => (
                      <li
                        key={shop}
                        className="cursor-pointer px-3 py-2 hover:bg-green-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          shopSearch.handleSelect(shop);
                        }}
                      >
                        {shop}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-slate-500">No shops found</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div>
            <label className={opsFilterLabelClass}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={opsInputClass}
            >
              <option value="highestBalance">Highest Balance</option>
              <option value="lowestBalance">Lowest Balance</option>
              <option value="alphabeticalAZ">Alphabetical A–Z</option>
              <option value="alphabeticalZA">Alphabetical Z–A</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 pt-4 border-t border-slate-100">
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <Filter size={15} />
            {showMoreFilters ? "Hide" : "More"} Filters
          </button>
          {showMoreFilters && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
                setCollector("");
                setRecoveryThreshold(0);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 cursor-pointer"
            >
              <X size={15} /> Clear More Filters
            </button>
          )}
        </div>

        {showMoreFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 lg:grid-cols-3">
            <div className="space-y-4">
              <DatePicker
                value={fromDate}
                onChange={setFromDate}
                label="From Date"
                className="w-full"
                placeholder="From date"
              />
              <DatePicker
                value={toDate}
                onChange={setToDate}
                label="To Date"
                className="w-full"
                placeholder="To date"
              />
            </div>

            <div>
              <label className={opsFilterLabelClass}>Collector</label>
              <select
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                className={opsInputClass}
              >
                <option value="">All Collectors</option>
                {collectors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Recovery %</label>
                  <p className="text-xs text-slate-500">Show shops with at least this recovery percentage</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                  {recoveryThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={recoveryThreshold}
                onChange={(e) => setRecoveryThreshold(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600"
              />
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <PendingKPICards
        totalPending={totalPending}
        weeklySales={weeklyStats.weeklySales}
        weeklyCollections={weeklyStats.weeklyCollections}
        weeklyRecovery={weeklyRecovery}
      />

      {/* Table Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" ref={tableRef}>
        <PendingTable
          data={paginatedData}
          selectedShopName={selectedShopName}
          onSelectShop={setSelectedShopName}
          onView={handleView}
          onDelete={handleDelete}
          grandTotalPending={grandTotalPending}
          grandTotalWeeklySales={grandTotalWeeklySales}
          grandTotalWeeklyCollections={grandTotalWeeklyCollections}
        />

        {/* Pagination Controls */}
        {shouldShowPagination(totalItems) && (
          <div className={paginationBarClass}>
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className={paginationNavBtnClass}
            >
              Previous
            </button>
            <span className={paginationPageBtnClass(true)}>
              {currentPage}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={paginationNavBtnClass}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectedShop && (
        <EditCollectionModal
          isOpen={isEditModalOpen}
          onClose={closeModal}
          shopName={selectedShop}
          mode="view"
          allCollections={allCollections}
          collection={getLatestCollection(selectedShop)}
          onRefresh={refreshData}
        />
      )}
    </div>
  );
}