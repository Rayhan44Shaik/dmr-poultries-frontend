import { useState, useEffect, useMemo, useRef } from "react";
import { collectionService } from "../services/collectionService";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import type { PendingCollection, Collection } from "../types/collection";
import { EditCollectionModal } from "../components/pending/EditCollectionModal";
import { useShopSearch } from "../../../../core/hooks/useShopSearch";
import {
  Store,
  IndianRupee,
  Clock,
  TrendingUp,
  Eye,
  Pencil,
  Trash2,
  FileSpreadsheet,
  FileText,
  X,
  Filter,
  RotateCcw,
  Calendar,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN");
};

export default function PendingCollectionsPage() {
  const [pendingData, setPendingData] = useState<PendingCollection[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const { shops } = useShops();
  const allShopNames = shops.map((s) => s.shopName).sort();

  const tableRef = useRef<HTMLTableElement>(null);

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

  // Modal state
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"view" | "edit">("view");

  // Load data
  useEffect(() => {
    const loadData = () => {
      const pending = collectionService.getPendingCollections();
      const all = collectionService.getCollections();
      setPendingData(pending);
      setAllCollections(all);
      setLoading(false);
    };
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  // ---- Filtered & sorted data ----
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
          .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
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
        const recovery = shop.totalSales > 0
          ? (shop.totalCollections / shop.totalSales) * 100
          : 0;
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
  }, [pendingData, shopName, collector, fromDate, toDate, asOnDate, sortBy, allCollections, recoveryThreshold]);

  // ---- Summary stats ----
  const totalShops = filteredData.length;
  const totalPending = filteredData.reduce((sum, s) => sum + s.currentPending, 0);
  const overdueShops = filteredData.filter((s) => s.overdueDays > 0).length;
  const totalSales = filteredData.reduce((sum, s) => sum + s.totalSales, 0);
  const totalCollections = filteredData.reduce((sum, s) => sum + s.totalCollections, 0);
  const overallRecovery = totalSales > 0 ? (totalCollections / totalSales) * 100 : 0;

  // ---- Helper: Get latest collection for a shop ----
  const getLatestCollection = (shopName: string): Collection | null => {
    const shopCollections = allCollections
      .filter((c) => c.shopName === shopName)
      .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
    return shopCollections.length > 0 ? shopCollections[0] : null;
  };

  // ---- Helper: Check if collection is editable (within 10 days) ----
  const isCollectionEditable = (createdDate: string): boolean => {
    const now = new Date();
    const created = new Date(createdDate);
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 10;
  };

  // ---- Export helpers ----
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
      alert("No data to export.");
      return;
    }

    const tableData: any[] = filteredData.map((shop, idx) => ({
      "#": idx + 1,
      "Shop Name": shop.shopName,
      "Last Collection": formatDate(shop.lastCollectionDate),
      "Total Sales": shop.totalSales,
      "Total Collections": shop.totalCollections,
      Pending: shop.currentPending,
      "Recovery %": shop.totalSales > 0
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
      { wch: 6 }, { wch: 30 }, { wch: 18 }, { wch: 15 },
      { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Pending Collections");
    XLSX.writeFile(wb, getExportFileName("xlsx"));
  };

  const exportPDF = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4");
    const margin = 14;

    const title = `Pending Collections - As On ${asOnDate}${shopName ? ` (${shopName})` : ""}`;
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
      (shop.totalSales > 0 ? ((shop.totalCollections / shop.totalSales) * 100).toFixed(2) : "0.00"),
      shop.overdueDays.toString(),
    ]);

    const totalSalesSum = filteredData.reduce((sum, s) => sum + s.totalSales, 0);
    const totalCollectionsSum = filteredData.reduce((sum, s) => sum + s.totalCollections, 0);
    const totalPendingSum = filteredData.reduce((sum, s) => sum + s.currentPending, 0);
    const totalRecovery = totalSalesSum > 0 ? ((totalCollectionsSum / totalSalesSum) * 100).toFixed(2) : "0.00";

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
      0: 12, 1: 55, 2: 28, 3: 28, 4: 28, 5: 28, 6: 22, 7: 20
    };

    autoTable(doc, {
      head: [["#", "Shop Name", "Last Collection", "Total Sales", "Total Collections", "Pending", "Recovery %", "Overdue Days"]],
      body: rows,
      startY: 25,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold", halign: "center" },
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
      tableWidth: 'auto',
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
  };

  // ---- CRUD Handlers ----
  const handleView = (shopName: string) => {
    setSelectedShop(shopName);
    setEditMode("view");
    setIsEditModalOpen(true);
  };

  const handleEdit = (shopName: string) => {
    const latest = getLatestCollection(shopName);
    if (!latest) {
      alert("No collection to edit.");
      return;
    }
    setSelectedShop(shopName);
    setEditMode(isCollectionEditable(latest.createdDate) ? "edit" : "view");
    setIsEditModalOpen(true);
  };

  const handleDelete = (shopName: string) => {
    const latest = getLatestCollection(shopName);
    if (!latest) {
      alert("No collection to delete.");
      return;
    }
    const now = new Date();
    const created = new Date(latest.createdDate);
    const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 10) {
      alert("Cannot delete – collection is older than 10 days.");
      return;
    }
    if (window.confirm(`Delete collection for ${shopName}?`)) {
      const success = collectionService.deleteCollection(latest.id);
      if (success) {
        refreshData();
      } else {
        alert("Delete failed.");
      }
    }
  };

  const closeModal = () => {
    setIsEditModalOpen(false);
    setSelectedShop(null);
  };

  const refreshData = () => {
    const pending = collectionService.getPendingCollections();
    const all = collectionService.getCollections();
    setPendingData(pending);
    setAllCollections(all);
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
  };

  const shopSearch = useShopSearch(allShopNames, shopName, setShopName);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-6">
      {/* Action Buttons */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={exportExcel}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
        >
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button
          onClick={exportPDF}
          className="inline-flex items-center gap-2 rounded-md border border-green-600 bg-white px-3 py-2 text-sm font-medium text-green-600 shadow-sm hover:bg-green-50"
        >
          <FileText size={16} /> PDF
        </button>
        <button
          onClick={resetFilters}
          className="inline-flex items-center gap-2 rounded-md border border-red-600 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 rounded-lg border border-green-200 bg-white p-4 shadow">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-3">
          {/* As On Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">As On Date *</label>
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
            />
          </div>
          {/* Shop Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Shop Name</label>
            <div className="relative">
              <input
                type="text"
                value={shopSearch.query}
                onChange={(e) => shopSearch.handleInputChange(e.target.value)}
                onFocus={() => shopSearch.setIsOpen(true)}
                placeholder="Search shop..."
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
              />
              {shopSearch.isOpen && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 text-sm shadow-lg">
                  {shopSearch.filteredShops.length > 0 ? (
                    shopSearch.filteredShops.slice(0, 5).map((shop) => (
                      <li
                        key={shop}
                        className="cursor-pointer px-3 py-2 hover:bg-green-50"
                        onClick={() => shopSearch.handleSelect(shop)}
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
          {/* Sort By */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
            >
              <option value="highestBalance">Highest Balance</option>
              <option value="lowestBalance">Lowest Balance</option>
              <option value="alphabeticalAZ">Alphabetical A–Z</option>
              <option value="alphabeticalZA">Alphabetical Z–A</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-800"
          >
            <Filter size={16} />
            {showMoreFilters ? "Hide" : "More"} Filters
          </button>
          {showMoreFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-700"
            >
              <X size={16} /> Clear All
            </button>
          )}
        </div>

        {showMoreFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t border-green-200 pt-4 lg:grid-cols-3">
            {/* Left Column: From Date & To Date stacked vertically */}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">From Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 pl-3 pr-10 text-sm outline-none focus:border-green-500"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">To Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 pl-3 pr-10 text-sm outline-none focus:border-green-500"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                </div>
              </div>
            </div>

            {/* Middle Column: Collector */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Collector</label>
              <select
                value={collector}
                onChange={(e) => setCollector(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
              >
                <option value="">All Collectors</option>
                {collectors.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Right Column: Recovery card – unchanged */}
            <div className="rounded-xl border border-green-200 bg-gradient-to-br from-white to-green-50 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">
                    Recovery %
                  </label>
                  <p className="text-xs text-slate-500">
                    Show shops with at least this recovery percentage
                  </p>
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

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-white p-4 shadow">
          <div className="rounded-full bg-green-100 p-3 text-green-600">
            <Store size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Shops</div>
            <div className="text-2xl font-bold text-slate-800">{totalShops}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-white p-4 shadow">
          <div className="rounded-full bg-green-100 p-3 text-green-600">
            <IndianRupee size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Total Pending</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-white p-4 shadow">
          <div className="rounded-full bg-green-100 p-3 text-green-600">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Shops Overdue</div>
            <div className="text-2xl font-bold text-orange-600">{overdueShops}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-white p-4 shadow">
          <div className="rounded-full bg-green-100 p-3 text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Recovery %</div>
            <div className="text-2xl font-bold text-green-600">{overallRecovery.toFixed(2)}%</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-green-200 bg-white shadow">
        <table ref={tableRef} id="pending-table" className="min-w-full divide-y divide-slate-200">
          <thead className="bg-green-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Shop Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Last Collection</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Total Sales</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Total Collections</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Pending</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Recovery %</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Overdue (Days)</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No pending collections found.
                </td>
              </tr>
            ) : (
              filteredData.map((shop, idx) => {
                const recovery = shop.totalSales > 0
                  ? (shop.totalCollections / shop.totalSales) * 100
                  : 0;
                const latest = getLatestCollection(shop.shopName);
                const hasCollection = latest !== null;
                const isEditable = hasCollection && isCollectionEditable(latest!.createdDate);

                return (
                  <tr key={shop.shopName} className="hover:bg-green-50">
                    <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{shop.shopName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(shop.lastCollectionDate)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(shop.totalSales)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(shop.totalCollections)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">{formatCurrency(shop.currentPending)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{recovery.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-center text-sm">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          shop.overdueDays > 7
                            ? "bg-red-100 text-red-700"
                            : shop.overdueDays > 3
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {shop.overdueDays}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {hasCollection && (
                          <button
                            onClick={() => handleView(shop.shopName)}
                            className="rounded p-1 text-blue-600 hover:bg-blue-50"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {hasCollection && isEditable && (
                          <button
                            onClick={() => handleEdit(shop.shopName)}
                            className="rounded p-1 text-green-600 hover:bg-green-50"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {hasCollection && isEditable && (
                          <button
                            onClick={() => handleDelete(shop.shopName)}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {!hasCollection && (
                          <span className="text-xs text-slate-400">No collection</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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