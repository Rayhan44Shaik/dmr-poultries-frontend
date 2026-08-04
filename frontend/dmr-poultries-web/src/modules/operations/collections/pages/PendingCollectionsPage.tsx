// src/modules/collections/pages/PendingCollectionsPage.tsx

import { useState, useEffect, useMemo, useRef } from "react";
import { collectionService } from "../services/collectionService";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import type { PendingCollection, Collection } from "../types/collection";
import { EditCollectionModal } from "../components/pending/EditCollectionModal";
import { useShopSearch } from "../../../../core/hooks/useShopSearch";
import {
  FileSpreadsheet,
  FileText,
  X,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import OutstandingSummary from "../components/entry/OutstandingSummary";
import { PendingKPICards } from "../components/pending/PendingKPICards";
import { PendingTable } from "../components/pending/PendingTable";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { DatePicker } from "../../../../components/common/DatePicker";

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN");
};

const getAllShopSales = () => {
  try {
    const raw = localStorage.getItem("shopSales");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
};

const PAGE_SIZE = 15;

export default function PendingCollectionsPage() {
  const { showNotification } = useSafeNotification();

  const [pendingData, setPendingData] = useState<PendingCollection[]>([]);
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
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
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
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"view" | "edit">("view");

  const [summary, setSummary] = useState({
    openingBalance: 0,
    weeklySales: 0,
    weeklyCollections: 0,
    currentPending: 0,
    shopName: "",
    dateRange: "",
    showSummary: false,
  });

  const loadData = () => {
    try {
      const pending = collectionService.getPendingCollections();
      const all = collectionService.getCollections();
      setPendingData(pending);
      setAllCollections(all);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setSelectedShopName(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredData = useMemo(() => {
    let data = [...pendingData];

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
      data = data.filter((s) => s.lastCollectionDate >= fromDate);
    }
    if (toDate) {
      data = data.filter((s) => s.lastCollectionDate <= toDate);
    }
    if (asOnDate) {
      data = data.filter((s) => s.lastCollectionDate <= asOnDate);
    }

    if (recoveryThreshold > 0) {
      data = data.filter((shop) => {
        const recovery =
          shop.totalSales > 0 ? (shop.totalCollections / shop.totalSales) * 100 : 0;
        return recovery >= recoveryThreshold;
      });
    }

    switch (sortBy) {
      case "highestBalance":
        data.sort((a, b) => b.currentPending - a.currentPending);
        break;
      case "lowestBalance":
        data.sort((a, b) => a.currentPending - b.currentPending);
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
    pendingData,
    shopName,
    collector,
    fromDate,
    toDate,
    asOnDate,
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

  const totalPending = filteredData.reduce((sum, s) => sum + s.currentPending, 0);

  const weeklyStats = useMemo(() => {
    const { monday, sunday } = getCurrentWeekRange();

    const sales = getAllShopSales();
    let weeklySales = 0;
    const shopSet = new Set<string>();
    sales.forEach((s: any) => {
      const saleDate = new Date(s.tripDate);
      if (saleDate >= monday && saleDate <= sunday) {
        weeklySales += Number(s.amount) || 0;
        shopSet.add(s.shopName);
      }
    });

    let weeklyCollections = 0;
    allCollections.forEach((c) => {
      const colDate = new Date(c.collectionDate);
      if (colDate >= monday && colDate <= sunday && c.status === "Approved") {
        weeklyCollections += Number(c.amount) || 0;
      }
    });

    return { weeklySales, weeklyCollections };
  }, [allCollections]);

  const weeklyRecovery =
    weeklyStats.weeklySales > 0
      ? (weeklyStats.weeklyCollections / weeklyStats.weeklySales) * 100
      : 0;

  const weeklySalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    const { monday, sunday } = getCurrentWeekRange();
    const sales = getAllShopSales();
    sales.forEach((s: any) => {
      const saleDate = new Date(s.tripDate);
      if (saleDate >= monday && saleDate <= sunday) {
        map[s.shopName] = (map[s.shopName] || 0) + Number(s.amount);
      }
    });
    return map;
  }, []);

  const weeklyCollectionsMap = useMemo(() => {
    const map: Record<string, number> = {};
    const { monday, sunday } = getCurrentWeekRange();
    allCollections.forEach((c) => {
      const colDate = new Date(c.collectionDate);
      if (colDate >= monday && colDate <= sunday && c.status === "Approved") {
        map[c.shopName] = (map[c.shopName] || 0) + Number(c.amount);
      }
    });
    return map;
  }, [allCollections]);

  const grandTotalPending = filteredData.reduce((sum, s) => sum + s.currentPending, 0);
  const grandTotalWeeklySales = filteredData.reduce(
    (sum, s) => sum + (weeklySalesMap[s.shopName] || 0),
    0
  );
  const grandTotalWeeklyCollections = filteredData.reduce(
    (sum, s) => sum + (weeklyCollectionsMap[s.shopName] || 0),
    0
  );

  const periodSalesMap = useMemo(() => {
    const map: Record<string, number> = {};
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    const sales = getAllShopSales();
    sales.forEach((s: any) => {
      const saleDate = new Date(s.tripDate);
      if (from && saleDate < from) return;
      if (to && saleDate > to) return;
      map[s.shopName] = (map[s.shopName] || 0) + Number(s.amount);
    });
    return map;
  }, [fromDate, toDate]);

  const periodCollectionsMap = useMemo(() => {
    const map: Record<string, number> = {};
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    allCollections.forEach((c) => {
      const colDate = new Date(c.collectionDate);
      if (from && colDate < from) return;
      if (to && colDate > to) return;
      if (c.status === "Approved") {
        map[c.shopName] = (map[c.shopName] || 0) + Number(c.amount);
      }
    });
    return map;
  }, [allCollections, fromDate, toDate]);

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

  const isCollectionEditable = (createdDate: string): boolean => {
    const now = new Date();
    const created = new Date(createdDate);
    const diffDays = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays <= 10;
  };

  const updateSummaryForShop = (shopName: string) => {
    const shopData = pendingData.find((s) => s.shopName === shopName);
    if (!shopData) {
      setSummary((prev) => ({ ...prev, showSummary: false }));
      return;
    }
    setSummary({
      openingBalance: shopData.totalSales,
      weeklySales: shopData.totalSales,
      weeklyCollections: shopData.totalCollections,
      currentPending: shopData.currentPending,
      shopName: shopData.shopName,
      dateRange: `As on ${asOnDate}`,
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

    const tableData: any[] = filteredData.map((shop, idx) => ({
      "#": idx + 1,
      "Shop Name": shop.shopName,
      "Last Collection": formatDate(shop.lastCollectionDate),
      "Total Sales": shop.totalSales,
      "Total Collections": shop.totalCollections,
      Pending: shop.currentPending,
      "Recovery %":
        shop.totalSales > 0
          ? Number(((shop.totalCollections / shop.totalSales) * 100).toFixed(2))
          : 0,
      "Overdue (Days)": shop.overdueDays,
    }));

    const summaryRow: any = {
      "#": "",
      "Shop Name": "TOTAL",
      "Last Collection": "",
      "Total Sales": filteredData.reduce((sum, s) => sum + s.totalSales, 0),
      "Total Collections": filteredData.reduce((sum, s) => sum + s.totalCollections, 0),
      Pending: filteredData.reduce((sum, s) => sum + s.currentPending, 0),
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

    const rows = filteredData.map((shop, idx) => [
      (idx + 1).toString(),
      shop.shopName,
      formatDate(shop.lastCollectionDate),
      shop.totalSales.toFixed(2),
      shop.totalCollections.toFixed(2),
      shop.currentPending.toFixed(2),
      shop.totalSales > 0
        ? ((shop.totalCollections / shop.totalSales) * 100).toFixed(2)
        : "0.00",
      shop.overdueDays.toString(),
    ]);

    const totalSalesSum = filteredData.reduce((sum, s) => sum + s.totalSales, 0);
    const totalCollectionsSum = filteredData.reduce(
      (sum, s) => sum + s.totalCollections,
      0
    );
    const totalPendingSum = filteredData.reduce((sum, s) => sum + s.currentPending, 0);
    const totalRecovery =
      totalSalesSum > 0
        ? ((totalCollectionsSum / totalSalesSum) * 100).toFixed(2)
        : "0.00";

    rows.push([
      "",
      "TOTAL",
      "",
      totalSalesSum.toFixed(2),
      totalCollectionsSum.toFixed(2),
      totalPendingSum.toFixed(2),
      totalRecovery,
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
    setEditMode("view");
    setIsEditModalOpen(true);
    updateSummaryForShop(shopName);
  };

  const handleEdit = (shopName: string) => {
    const latest = getLatestCollection(shopName);
    if (!latest) {
      showNotification("No collection to edit.", "error");
      return;
    }
    setSelectedShop(shopName);
    setEditMode(isCollectionEditable(latest.collectionDate) ? "edit" : "view");
    setIsEditModalOpen(true);
    updateSummaryForShop(shopName);
  };

  const handleDelete = (shopName: string) => {
    const latest = getLatestCollection(shopName);
    if (!latest) {
      showNotification("No collection to delete.", "error");
      return;
    }
    const now = new Date();
    const created = new Date(latest.createdDate);
    const diffDays = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 10) {
      showNotification("Cannot delete – collection is older than 10 days.", "error");
      return;
    }
    if (window.confirm(`Delete collection for ${shopName}?`)) {
      const success = collectionService.deleteCollection(latest.id);
      if (success) {
        refreshData();
        setSummary((prev) => ({ ...prev, showSummary: false }));
        setSelectedShopName(null);
        showNotification("Collection deleted successfully.", "success");
      } else {
        showNotification("Delete failed.", "error");
      }
    }
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setSelectedShop(null);
    setSummary((prev) => ({ ...prev, showSummary: false }));
  };

  const refreshData = () => {
    try {
      const pending = collectionService.getPendingCollections();
      const all = collectionService.getCollections();
      setPendingData(pending);
      setAllCollections(all);
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
    setAsOnDate(new Date().toISOString().split("T")[0]);
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
    <div className="space-y-6">
      {summary.showSummary && (
        <OutstandingSummary
          openingBalance={summary.openingBalance}
          weeklySales={summary.weeklySales}
          weeklyCollections={summary.weeklyCollections}
          currentPending={summary.currentPending}
          shopName={summary.shopName}
          dateRange={summary.dateRange}
          showSummary={summary.showSummary}
        />
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={exportExcel}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 cursor-pointer"
        >
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-white px-3 py-2 text-sm font-medium text-green-600 shadow-sm hover:bg-green-50 cursor-pointer"
        >
          <FileText size={16} /> PDF
        </button>
        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 cursor-pointer"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      {/* Filter Bar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-6">
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Shop Name</label>
            <div className="relative">
              <input
                type="text"
                value={shopSearch.query}
                onChange={(e) => shopSearch.handleInputChange(e.target.value)}
                onFocus={() => shopSearch.setIsOpen(true)}
                onBlur={() => setTimeout(() => shopSearch.setIsOpen(false), 200)}
                placeholder="All Shops"
                className="h-10 w-full rounded-md border border-slate-300 pl-3 pr-8 text-sm outline-none focus:border-green-500"
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500 bg-white"
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
            className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-800 cursor-pointer"
          >
            <Filter size={16} />
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
              className="inline-flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-700 cursor-pointer"
            >
              <X size={16} /> Clear More Filters
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Collector</label>
              <select
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500 bg-white"
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
                  <label className="block text-sm font-semibold text-slate-700">Recovery %</label>
                  <p className="text-xs text-slate-500">Show shops with at least this recovery percentage</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
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
                className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-green-600"
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
          weeklySalesMap={weeklySalesMap}
          weeklyCollectionsMap={weeklyCollectionsMap}
          periodSalesMap={periodSalesMap}
          periodCollectionsMap={periodCollectionsMap}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          grandTotalPending={grandTotalPending}
          grandTotalWeeklySales={grandTotalWeeklySales}
          grandTotalWeeklyCollections={grandTotalWeeklyCollections}
        />

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <div className="text-sm text-slate-600">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className={`rounded-md p-2 transition cursor-pointer ${
                  currentPage === 1
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className={`rounded-md p-2 transition cursor-pointer ${
                  currentPage === totalPages
                    ? "cursor-not-allowed text-slate-300"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedShop && (
        <EditCollectionModal
          isOpen={isEditModalOpen}
          onClose={closeModal}
          shopName={selectedShop}
          mode={editMode}
          allCollections={allCollections}
          onRefresh={refreshData}
        />
      )}
    </div>
  );
}