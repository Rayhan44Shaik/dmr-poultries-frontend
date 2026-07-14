import { useState, useEffect, useMemo } from "react";
import { collectionService } from "../services/collectionService";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { useShopSearch } from "../../../../core/hooks/useShopSearch";
import {
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Calendar,
  Wallet,
  Users,
  X,
  ChevronDown,
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

const getBarColor = (percentage: number) => {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 50) return "bg-blue-500";
  if (percentage >= 30) return "bg-yellow-500";
  return "bg-red-500";
};

const KNOWN_MODES = ["Cash", "Union Bank", "HDFC Bank"];

export default function CollectionReportPage() {
  const [allCollections, setAllCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { shops } = useShops();
  const allShopNames = shops.map((s) => s.shopName).sort();

  const { employees } = useEmployees();
  const collectors = useMemo(
    () =>
      employees
        .filter((emp) => emp.department === "Collection")
        .map((emp) => emp.employeeName)
        .sort(),
    [employees]
  );

  // Filter state
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [shopName, setShopName] = useState("");
  const [collector, setCollector] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  // Load data
  useEffect(() => {
    const loadData = () => {
      const all = collectionService.getCollections();
      setAllCollections(all);
      setLoading(false);
    };
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  // ---- Filtered data (only Approved) ----
  const filteredData = useMemo(() => {
    let data = allCollections.filter((c) => c.status === "Approved");

    if (fromDate) {
      data = data.filter((c) => c.collectionDate >= fromDate);
    }
    if (toDate) {
      data = data.filter((c) => c.collectionDate <= toDate);
    }
    if (shopName) {
      data = data.filter((c) =>
        c.shopName.toLowerCase().startsWith(shopName.toLowerCase())
      );
    }
    if (collector) {
      data = data.filter((c) => c.collectorName === collector);
    }
    if (paymentMode === "Others") {
      data = data.filter((c) => !KNOWN_MODES.includes(c.paymentModeName));
    } else if (paymentMode) {
      data = data.filter((c) => c.paymentModeName === paymentMode);
    }
    return data;
  }, [allCollections, fromDate, toDate, shopName, collector, paymentMode]);

  // ---- Summary Cards ----
  const totalCollections = filteredData.reduce((sum, c) => sum + c.amount, 0);
  const totalCollectorsCount = new Set(filteredData.map((c) => c.collectorName)).size;

  // ---- Collector counts per payment mode ----
  const collectorCountsByMode = useMemo(() => {
    const map = new Map<string, Set<string>>();
    filteredData.forEach((c) => {
      if (!map.has(c.paymentModeName)) {
        map.set(c.paymentModeName, new Set());
      }
      map.get(c.paymentModeName)!.add(c.collectorName);
    });
    const result: { mode: string; count: number }[] = [];
    map.forEach((set, mode) => {
      result.push({ mode, count: set.size });
    });
    result.sort((a, b) => b.count - a.count);
    const knownSet = new Set(KNOWN_MODES);
    const others = result.filter((r) => !knownSet.has(r.mode));
    const othersCount = others.reduce((sum, r) => sum + r.count, 0);
    const filteredResult = result.filter((r) => knownSet.has(r.mode));
    if (othersCount > 0) {
      filteredResult.push({ mode: "Others", count: othersCount });
    }
    KNOWN_MODES.forEach((mode) => {
      if (!filteredResult.some((r) => r.mode === mode)) {
        filteredResult.push({ mode, count: 0 });
      }
    });
    const order = ["Cash", "Union Bank", "HDFC Bank", "Others"];
    filteredResult.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode));
    return filteredResult;
  }, [filteredData]);

  // ---- Payment Mode Summary Table ----
  const paymentModeSummary = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    filteredData.forEach((c) => {
      if (!map.has(c.paymentModeName)) {
        map.set(c.paymentModeName, { count: 0, amount: 0 });
      }
      const entry = map.get(c.paymentModeName)!;
      entry.count += 1;
      entry.amount += c.amount;
    });
    const total = filteredData.reduce((sum, c) => sum + c.amount, 0);
    const result = Array.from(map.entries()).map(([mode, data]) => ({
      mode,
      count: data.count,
      amount: data.amount,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
    }));
    result.sort((a, b) => b.amount - a.amount);
    result.push({
      mode: "Total",
      count: filteredData.length,
      amount: total,
      percentage: 100,
    });
    return result;
  }, [filteredData]);

  // ---- Collector Summary Table ----
  const collectorSummary = useMemo(() => {
    const paymentModes = Array.from(
      new Set(filteredData.map((c) => c.paymentModeName))
    ).sort();

    const map = new Map<
      string,
      { [mode: string]: number; total: number }
    >();
    filteredData.forEach((c) => {
      if (!map.has(c.collectorName)) {
        map.set(c.collectorName, { total: 0 });
      }
      const entry = map.get(c.collectorName)!;
      if (!entry[c.paymentModeName]) {
        entry[c.paymentModeName] = 0;
      }
      entry[c.paymentModeName] += c.amount;
      entry.total += c.amount;
    });

    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total);

    const rows: any[] = [];
    const top4 = sorted.slice(0, 4);
    const rest = sorted.slice(4);

    top4.forEach(([collector, data]) => {
      const row: any = { collector, total: data.total };
      paymentModes.forEach((mode) => {
        row[mode] = data[mode] || 0;
      });
      rows.push(row);
    });

    if (rest.length > 0) {
      const othersRow: any = { collector: `Others (${rest.length})`, total: 0 };
      paymentModes.forEach((mode) => {
        othersRow[mode] = 0;
      });
      rest.forEach(([_, data]) => {
        paymentModes.forEach((mode) => {
          othersRow[mode] += data[mode] || 0;
        });
        othersRow.total += data.total;
      });
      rows.push(othersRow);
    }

    const totalRow: any = { collector: "Total", total: 0 };
    paymentModes.forEach((mode) => {
      totalRow[mode] = 0;
    });
    rows.forEach((row) => {
      paymentModes.forEach((mode) => {
        totalRow[mode] += row[mode] || 0;
      });
      totalRow.total += row.total;
    });
    rows.push(totalRow);

    return { rows, paymentModes };
  }, [filteredData]);

  // ---- Export Helpers ----
  const getExportFileName = (ext: "xlsx" | "pdf") => {
    const dateStr = fromDate && toDate ? `${fromDate}_to_${toDate}` : "report";
    return `Collection_Report_${dateStr}.${ext}`;
  };

  const exportExcel = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }
    const wb = XLSX.utils.book_new();

    const pmData = paymentModeSummary.map((row) => ({
      "Payment Mode": row.mode,
      "No. of Collections": row.count,
      "Amount Received": row.amount,
      "Percentage (%)": row.percentage.toFixed(2),
    }));
    const ws1 = XLSX.utils.json_to_sheet(pmData);
    XLSX.utils.book_append_sheet(wb, ws1, "Payment Mode Summary");

    const collectorRows = collectorSummary.rows.map((row: any) => {
      const obj: any = { Collector: row.collector };
      collectorSummary.paymentModes.forEach((mode: string) => {
        obj[mode] = row[mode] || 0;
      });
      obj["Total"] = row.total;
      return obj;
    });
    const ws2 = XLSX.utils.json_to_sheet(collectorRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Collector Summary");

    XLSX.writeFile(wb, getExportFileName("xlsx"));
  };

  const exportPDF = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text("Collection Report", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Period: ${fromDate || "N/A"} to ${toDate || "N/A"}`, margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("Collection Summary by Payment Mode", margin, y);
    y += 5;
    const pmData = paymentModeSummary.map((row) => [
      row.mode,
      row.count.toString(),
      row.amount.toFixed(2),
      row.percentage.toFixed(2) + "%",
    ]);
    autoTable(doc, {
      head: [["Payment Mode", "No. of Collections", "Amount Received", "Percentage (%)"]],
      body: pmData,
      startY: y,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("Collection Summary by Collector", margin, y);
    y += 5;
    const header = ["Collector", ...collectorSummary.paymentModes, "Total"];
    const body = collectorSummary.rows.map((row: any) => {
      const rowData: any[] = [row.collector];
      collectorSummary.paymentModes.forEach((mode: string) => {
        rowData.push(row[mode] ? row[mode].toFixed(2) : "0.00");
      });
      rowData.push(row.total.toFixed(2));
      return rowData;
    });
    autoTable(doc, {
      head: [header],
      body: body,
      startY: y,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 8 },
    });

    doc.save(getExportFileName("pdf"));
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setShopName("");
    setCollector("");
    setPaymentMode("");
    shopSearch.setQuery("");
  };

  const shopSearch = useShopSearch(allShopNames, shopName, setShopName);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-6 pb-10">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">From Date *</label>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">To Date *</label>
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
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-green-500"
            >
              <option value="">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="Union Bank">Union Bank</option>
              <option value="HDFC Bank">HDFC Bank</option>
              <option value="Others">Others</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-green-200 bg-white p-4 shadow">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2 text-blue-600">
              <Wallet size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Total Collections</div>
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(totalCollections)}</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-green-200 bg-white p-4 shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
              <Users size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Total Collectors</div>
              <div className="text-2xl font-bold text-slate-800">{totalCollectorsCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {collectorCountsByMode.map(({ mode, count }) => (
              <div key={mode} className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-600">{mode}</span>
                <span className="font-medium text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
        {/* Payment Mode Summary Table */}
        <div className="overflow-x-auto rounded-lg border border-green-200 bg-white shadow">
          <div className="px-4 py-2 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700">Payment Mode Summary</h4>
          </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-green-50">
              <tr>
                <th className="px-3 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-600">Payment Mode</th>
                <th className="px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-600">No.</th>
                <th className="px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-600">Amount</th>
                <th className="px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-600">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {paymentModeSummary.map((row) => (
                <tr
                  key={row.mode}
                  className={row.mode === "Total" ? "bg-yellow-50 font-semibold" : "hover:bg-green-50"}
                >
                  <td className="px-3 py-1.5 text-[10px] text-slate-800">{row.mode}</td>
                  <td className="px-3 py-1.5 text-right text-[10px] text-slate-600">{row.count}</td>
                  <td className="px-3 py-1.5 text-right text-[10px] text-slate-600">{formatCurrency(row.amount)}</td>
                  <td className="px-3 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[9px] font-medium text-slate-700">
                        {row.percentage.toFixed(1)}%
                      </span>
                      <div className="w-8 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getBarColor(row.percentage)} transition-all duration-500`}
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Collector Summary Table */}
        <div className="overflow-x-auto rounded-lg border border-green-200 bg-white shadow">
          <div className="px-4 py-2 border-b border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700">Collector Summary</h4>
          </div>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-green-50">
              <tr>
                <th className="px-3 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-600">Collector</th>
                {collectorSummary.paymentModes.map((mode: string) => (
                  <th key={mode} className="px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    {mode}
                  </th>
                ))}
                <th className="px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {collectorSummary.rows.map((row: any, idx: number) => {
                const isTotal = row.collector === "Total";
                return (
                  <tr
                    key={idx}
                    className={isTotal ? "bg-yellow-50 font-semibold" : "hover:bg-green-50"}
                  >
                    <td className="px-3 py-1.5 text-[10px] text-slate-800">{row.collector}</td>
                    {collectorSummary.paymentModes.map((mode: string) => (
                      <td key={mode} className="px-3 py-1.5 text-right text-[10px] text-slate-600">
                        {formatCurrency(row[mode] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-slate-800">
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}