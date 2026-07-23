import React, { useState, useMemo, useCallback } from "react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { Download } from "lucide-react";
import Select from "react-select";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { shopSalesService } from "../../operations/shop-sales/services/shopSalesService";
import { collectionService } from "../../operations/collections/services/collectionService";
import { useShops } from "../../masters/shops/hooks/useShops";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { DatePicker } from "../../../components/common/DatePicker";
import * as XLSX from "xlsx";

interface LedgerTransaction {
  date: string;
  particulars: string;
  birds: number;
  weight: number;
  rate: number;
  debit: number;
  credit: number;
  balance: number;
  type: "sale" | "collection";
  paymentMode?: string;
}

interface ShopLedgerProps {
  embedded?: boolean;
}

// ─── Helper to generate ledger for a single shop ───
const getLedgerForShop = (
  shopName: string,
  allSales: any[],
  allCollections: any[],
  dateFrom: string,
  dateTo: string
): LedgerTransaction[] => {
  const filterByShop = (items: any[]) => items.filter((item) => item.shopName === shopName);

  // Opening balance
  const salesBefore = filterByShop(allSales).filter((s) => s.tripDate < dateFrom);
  const collectionsBefore = filterByShop(allCollections).filter((c) => c.collectionDate < dateFrom);
  const openingBalance =
    salesBefore.reduce((sum, s) => sum + (s.amount || 0), 0) -
    collectionsBefore.reduce((sum, c) => sum + (c.amount || 0), 0);

  const filterDate = (item: any) => {
    const d = item.tripDate || item.collectionDate;
    if (!d) return false;
    return isWithinInterval(parseISO(d), {
      start: parseISO(dateFrom),
      end: parseISO(dateTo),
    });
  };

  let filteredSales = filterByShop(allSales).filter(filterDate);
  let filteredCollections = filterByShop(allCollections).filter(filterDate);

  const salesTx: LedgerTransaction[] = filteredSales.map((s) => ({
    date: s.tripDate,
    particulars: String(s.tripNo || "Sale"),
    birds: s.totalBirds || 0,
    weight: s.totalWeight || 0,
    rate: s.rate || 0,
    debit: s.amount || 0,
    credit: 0,
    balance: 0,
    type: "sale",
    paymentMode: undefined,
  }));

  const collectionTx: LedgerTransaction[] = filteredCollections.map((c) => ({
    date: c.collectionDate,
    particulars: c.paymentModeName || "Cash",
    birds: 0,
    weight: 0,
    rate: 0,
    debit: 0,
    credit: c.amount || 0,
    balance: 0,
    type: "collection",
    paymentMode: undefined,
  }));

  const allTx = [...salesTx, ...collectionTx].sort((a, b) => a.date.localeCompare(b.date));

  let balance = openingBalance;
  const ledgerWithBalance = allTx.map((tx) => {
    balance = balance + tx.debit - tx.credit;
    return { ...tx, balance };
  });

  const openingRow: LedgerTransaction = {
    date: dateFrom,
    particulars: "Opening Balance",
    birds: 0,
    weight: 0,
    rate: 0,
    debit: 0,
    credit: 0,
    balance: openingBalance,
    type: "sale",
    paymentMode: undefined,
  };

  return [openingRow, ...ledgerWithBalance];
};

const ShopLedgerPage: React.FC<ShopLedgerProps> = ({ embedded = false }) => {
  const { showNotification } = useSafeNotification();
  const { shops } = useShops();

  const [dateFrom, setDateFrom] = useState(
    format(new Date(new Date().setDate(1)), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedShop, setSelectedShop] = useState<string>("All Shops");

  const shopOptions = useMemo(() => {
    const all = [{ value: "All Shops", label: "All Shops" }];
    const shopList = shops.map((shop: any) => ({
      value: shop.shopName,
      label: shop.shopName,
    }));
    return [...all, ...shopList];
  }, [shops]);

  // ── Data for the current view (merged) ──
  const ledgerData = useMemo(() => {
    const allSales = shopSalesService.getAll();
    const allCollections = collectionService
      .getCollections()
      .filter((c) => c.status === "Approved");

    const filterByShop = (items: any[]) => {
      if (selectedShop === "All Shops") return items;
      return items.filter((item) => item.shopName === selectedShop);
    };

    const salesBefore = filterByShop(allSales).filter((s) => s.tripDate < dateFrom);
    const collectionsBefore = filterByShop(allCollections).filter((c) => c.collectionDate < dateFrom);
    const openingBalance =
      salesBefore.reduce((sum, s) => sum + (s.amount || 0), 0) -
      collectionsBefore.reduce((sum, c) => sum + (c.amount || 0), 0);

    const filterDate = (item: any) => {
      const d = item.tripDate || item.collectionDate;
      if (!d) return false;
      return isWithinInterval(parseISO(d), {
        start: parseISO(dateFrom),
        end: parseISO(dateTo),
      });
    };

    let filteredSales = filterByShop(allSales).filter(filterDate);
    let filteredCollections = filterByShop(allCollections).filter(filterDate);

    const salesTx: LedgerTransaction[] = filteredSales.map((s) => ({
      date: s.tripDate,
      particulars: String(s.tripNo || "Sale"),
      birds: s.totalBirds || 0,
      weight: s.totalWeight || 0,
      rate: s.rate || 0,
      debit: s.amount || 0,
      credit: 0,
      balance: 0,
      type: "sale",
      paymentMode: undefined,
    }));

    const collectionTx: LedgerTransaction[] = filteredCollections.map((c) => ({
      date: c.collectionDate,
      particulars: c.paymentModeName || "Cash",
      birds: 0,
      weight: 0,
      rate: 0,
      debit: 0,
      credit: c.amount || 0,
      balance: 0,
      type: "collection",
      paymentMode: undefined,
    }));

    const allTx = [...salesTx, ...collectionTx].sort((a, b) => a.date.localeCompare(b.date));

    let balance = openingBalance;
    const ledgerWithBalance = allTx.map((tx) => {
      balance = balance + tx.debit - tx.credit;
      return { ...tx, balance };
    });

    const openingRow: LedgerTransaction = {
      date: dateFrom,
      particulars: "Opening Balance",
      birds: 0,
      weight: 0,
      rate: 0,
      debit: 0,
      credit: 0,
      balance: openingBalance,
      type: "sale",
      paymentMode: undefined,
    };

    return [openingRow, ...ledgerWithBalance];
  }, [dateFrom, dateTo, selectedShop]);

  // ── Summary for the current view ──
  const summary = useMemo(() => {
    const tx = ledgerData.slice(1);
    const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
    const totalBirds = tx
      .filter((t) => t.type === "sale")
      .reduce((sum, t) => sum + t.birds, 0);
    const totalWeight = tx
      .filter((t) => t.type === "sale")
      .reduce((sum, t) => sum + t.weight, 0);
    const closingBalance = ledgerData.length > 0 ? ledgerData[ledgerData.length - 1].balance : 0;
    return { totalDebit, totalCredit, totalBirds, totalWeight, closingBalance };
  }, [ledgerData]);

  // ─── Export Functions ──────────────────────────────────────

  const handleExportPDF = useCallback(() => {
    const allSales = shopSalesService.getAll();
    const allCollections = collectionService.getCollections().filter((c) => c.status === "Approved");

    // Determine which shops to include
    let shopNames: string[] = [];
    if (selectedShop === "All Shops") {
      const filterDate = (item: any) => {
        const d = item.tripDate || item.collectionDate;
        if (!d) return false;
        return isWithinInterval(parseISO(d), {
          start: parseISO(dateFrom),
          end: parseISO(dateTo),
        });
      };
      const salesInRange = allSales.filter(filterDate);
      const collectionsInRange = allCollections.filter(filterDate);
      const allShops = new Set<string>();
      salesInRange.forEach((s) => allShops.add(s.shopName));
      collectionsInRange.forEach((c) => allShops.add(c.shopName));
      shopNames = Array.from(allShops).filter(Boolean).sort();
    } else {
      shopNames = [selectedShop];
    }

    if (shopNames.length === 0) {
      showNotification("No shops found in the selected date range.", "error");
      return;
    }

    // Build ledger data per shop
    const allLedgers: { shop: string; data: LedgerTransaction[] }[] = [];
    for (const shop of shopNames) {
      const ledger = getLedgerForShop(shop, allSales, allCollections, dateFrom, dateTo);
      if (ledger.length > 1) { // has transactions
        allLedgers.push({ shop, data: ledger });
      }
    }

    if (allLedgers.length === 0) {
      showNotification("No transaction data to export.", "error");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const headers = ["Date", "Particulars", "Birds", "Weight", "Rate", "Debit", "Credit", "Balance", "Payment Mode"];

    allLedgers.forEach(({ shop, data }, index) => {
      if (index > 0) doc.addPage();

      // Header
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(`Shop Ledger – ${shop}`, 10, 12);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Statement Period: ${dateFrom} to ${dateTo}`, 10, 18);
      doc.text(`Generated On: ${format(new Date(), "dd MMM yyyy, HH:mm")}`, doc.internal.pageSize.getWidth() - 10, 18, { align: "right" });

      // Build rows
      const rows = data.map((t) => [
        t.date,
        t.particulars,
        t.type === "sale" ? String(t.birds) : "-",
        t.type === "sale" ? t.weight.toFixed(2) : "-",
        t.type === "sale" ? t.rate.toFixed(2) : "-",
        t.debit.toFixed(2),
        t.credit.toFixed(2),
        t.balance.toFixed(2),
        t.paymentMode || "-",
      ]);

      // Totals for this shop
      const tx = data.slice(1);
      const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
      const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
      const totalBirds = tx.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.birds, 0);
      const totalWeight = tx.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.weight, 0);
      const closingBalance = data.length > 0 ? data[data.length - 1].balance : 0;

      rows.push([
        "TOTAL",
        "",
        String(totalBirds),
        totalWeight.toFixed(2),
        "",
        totalDebit.toFixed(2),
        totalCredit.toFixed(2),
        closingBalance.toFixed(2),
        "",
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 26,
        margin: { top: 26, bottom: 15, left: 10, right: 10 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold", halign: "center" },
        bodyStyles: { valign: "middle", fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 22, halign: "center" },
          1: { cellWidth: 38, halign: "left" },
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 18, halign: "right" },
          4: { cellWidth: 16, halign: "right" },
          5: { cellWidth: 20, halign: "right" },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 22, halign: "right" },
          8: { cellWidth: 20, halign: "center" },
        },
        didDrawPage: (data) => {
          const docInstance = data.doc;
          const pageWidth = docInstance.internal.pageSize.getWidth();
          const pageHeight = docInstance.internal.pageSize.getHeight();
          docInstance.setFontSize(8);
          docInstance.setTextColor(150, 150, 150);
          docInstance.text(`Page ${data.pageNumber}`, pageWidth - 10, pageHeight - 8, { align: "right" });
        },
      });
    });

    const filename = `ShopLedger_${selectedShop === "All Shops" ? "AllShops" : selectedShop.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(filename);
    showNotification("PDF downloaded successfully.", "success");
  }, [selectedShop, dateFrom, dateTo, showNotification]);

  const handleExportExcel = useCallback(() => {
    const allSales = shopSalesService.getAll();
    const allCollections = collectionService.getCollections().filter((c) => c.status === "Approved");

    // Determine shops
    let shopNames: string[] = [];
    if (selectedShop === "All Shops") {
      const filterDate = (item: any) => {
        const d = item.tripDate || item.collectionDate;
        if (!d) return false;
        return isWithinInterval(parseISO(d), {
          start: parseISO(dateFrom),
          end: parseISO(dateTo),
        });
      };
      const salesInRange = allSales.filter(filterDate);
      const collectionsInRange = allCollections.filter(filterDate);
      const allShops = new Set<string>();
      salesInRange.forEach((s) => allShops.add(s.shopName));
      collectionsInRange.forEach((c) => allShops.add(c.shopName));
      shopNames = Array.from(allShops).filter(Boolean).sort();
    } else {
      shopNames = [selectedShop];
    }

    if (shopNames.length === 0) {
      showNotification("No shops found in the selected date range.", "error");
      return;
    }

    const headers = ["Date", "Particulars", "Birds", "Weight (KG)", "Rate (₹)", "Debit (₹)", "Credit (₹)", "Balance (₹)", "Payment Mode"];
    const workbook = XLSX.utils.book_new();

    // Sheet per shop
    shopNames.forEach((shop) => {
      const ledger = getLedgerForShop(shop, allSales, allCollections, dateFrom, dateTo);
      if (ledger.length <= 1) return; // skip empty

      const rows = ledger.map((t) => [
        t.date,
        t.particulars,
        t.type === "sale" ? t.birds : "-",
        t.type === "sale" ? t.weight.toFixed(2) : "-",
        t.type === "sale" ? t.rate.toFixed(2) : "-",
        t.debit.toFixed(2),
        t.credit.toFixed(2),
        t.balance.toFixed(2),
        t.paymentMode || "-",
      ]);

      // Totals
      const tx = ledger.slice(1);
      const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
      const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
      const totalBirds = tx.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.birds, 0);
      const totalWeight = tx.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.weight, 0);
      const closingBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
      rows.push([
        "TOTAL",
        "",
        totalBirds,
        totalWeight.toFixed(2),
        "",
        totalDebit.toFixed(2),
        totalCredit.toFixed(2),
        closingBalance.toFixed(2),
        "",
      ]);

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(workbook, ws, shop.slice(0, 31)); // Excel sheet name max 31 chars
    });

    // Summary sheet
    const summaryRows = [
      ["Shop", "Total Debit", "Total Credit", "Closing Balance"],
    ];
    shopNames.forEach((shop) => {
      const ledger = getLedgerForShop(shop, allSales, allCollections, dateFrom, dateTo);
      if (ledger.length <= 1) return;
      const tx = ledger.slice(1);
      const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
      const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
      const closingBalance = ledger[ledger.length - 1].balance;
      summaryRows.push([shop, totalDebit.toFixed(2), totalCredit.toFixed(2), closingBalance.toFixed(2)]);
    });
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summaryWs, "Summary");

    const filename = `ShopLedger_${selectedShop === "All Shops" ? "AllShops" : selectedShop.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, filename);
    showNotification("Excel downloaded successfully.", "success");
  }, [selectedShop, dateFrom, dateTo, showNotification]);

  // ─── React‑Select styles (unchanged) ───
  const selectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: 8,
      borderColor: "#cbd5e1",
      boxShadow: "none",
      minHeight: 38,
      fontSize: "14px",
      "&:hover": { borderColor: "#94a3b8" },
      "&:focus-within": {
        borderColor: "#3b82f6",
        boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.15)",
      },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#eff6ff" : "white",
      color: isSelected ? "white" : "#1e293b",
      fontSize: "13px",
      padding: "6px 12px",
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
      border: "1px solid #f1f5f9",
    }),
    menuList: (base: any) => ({
      ...base,
      maxHeight: "200px",
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "#94a3b8",
    }),
  };

  // ─── UI (unchanged) ──────────────────────────────────────
  const content = (
    <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200/85 shadow-sm space-y-4 text-slate-800">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Shop Ledger</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <Download size={16} />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
          >
            <Download size={16} />
            Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 bg-slate-50/70 rounded-xl p-3 border border-slate-200/60">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Date From</label>
          <DatePicker
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From date"
            className="w-full"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Date To</label>
          <DatePicker
            value={dateTo}
            onChange={setDateTo}
            placeholder="To date"
            className="w-full"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Shop</label>
          <Select
            options={shopOptions}
            value={shopOptions.find((opt) => opt.value === selectedShop)}
            onChange={(selected) => setSelectedShop(selected?.value || "All Shops")}
            isSearchable
            placeholder="Search or select shop..."
            styles={selectStyles}
            maxMenuHeight={200}
          />
        </div>
        <button
          onClick={() => {
            setDateFrom(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
            setDateTo(format(new Date(), "yyyy-MM-dd"));
            setSelectedShop("All Shops");
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition"
        >
          Reset Filters
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Total Debit (Sales)</p>
          <p className="text-xl font-bold text-emerald-600">₹ {summary.totalDebit.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Total Credit (Collections)</p>
          <p className="text-xl font-bold text-blue-600">₹ {summary.totalCredit.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Total Birds</p>
          <p className="text-xl font-bold text-slate-800">{summary.totalBirds}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Total Weight (KG)</p>
          <p className="text-xl font-bold text-slate-800">{summary.totalWeight.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">Closing Balance</p>
          <p className={`text-xl font-bold ${summary.closingBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            ₹ {summary.closingBalance.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-700 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Particulars</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Birds</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Weight (KG)</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Debit</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Credit</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Payment Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                <>
                  {ledgerData.map((tx, idx) => {
                    const isOpening = idx === 0;
                    const isSale = tx.type === "sale";
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${isOpening ? "bg-amber-50/50 font-semibold" : "hover:bg-slate-50/80"}`}
                      >
                        <td className="px-4 py-3 text-xs font-medium text-slate-600">{tx.date}</td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">
                          {tx.particulars}
                          {!isOpening && (
                            <span className={`ml-2 text-[10px] font-semibold ${isSale ? "text-emerald-600" : "text-blue-600"}`}>
                              {isSale ? "(Sale)" : "(Collection)"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">{isSale ? tx.birds : "-"}</td>
                        <td className="px-4 py-3 text-center text-xs">{isSale ? tx.weight.toFixed(2) : "-"}</td>
                        <td className="px-4 py-3 text-center text-xs">{isSale ? tx.rate.toFixed(2) : "-"}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600">
                          {tx.debit > 0 ? `₹ ${tx.debit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-blue-600">
                          {tx.credit > 0 ? `₹ ${tx.credit.toFixed(2)}` : "-"}
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-bold ${tx.balance >= 0 ? "text-slate-800" : "text-rose-600"}`}>
                          ₹ {tx.balance.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">{tx.paymentMode || "-"}</td>
                      </tr>
                    );
                  })}
                  {ledgerData.length > 1 && (
                    <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                      <td className="px-4 py-3 text-xs text-slate-700" colSpan={2}>
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">{summary.totalBirds}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">{summary.totalWeight.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">-</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-emerald-700">
                        ₹ {summary.totalDebit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-blue-700">
                        ₹ {summary.totalCredit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-800">
                        ₹ {summary.closingBalance.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-800">-</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <div className="px-3 md:px-6 py-4 max-w-[1600px] mx-auto bg-slate-50/50 min-h-screen text-slate-800">
      {content}
    </div>
  );
};

export default ShopLedgerPage;