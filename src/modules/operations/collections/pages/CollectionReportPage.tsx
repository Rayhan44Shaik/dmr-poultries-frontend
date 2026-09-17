// src/modules/collections/pages/CollectionReportPage.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { collectionService } from "../services/collectionService";
import type { CollectionReportSummary } from "../types/collection";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import {
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Wallet,
  Users,
  User,
  Inbox,
  Calendar,
  Store,
  CreditCard,
  AlertTriangle,
  BarChart3,
  Hash,
  IndianRupee,
  Percent,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import {
  createDmrPoultryPdf,
  drawDmrPoultryHeader,
} from "../../../../utils/drawDmrPoultryHeader";
import henImage from "../../../../assets/dmr-hen.jpg";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsEmptyStateClass,
  opsSecondaryButtonClass,
  opsPdfButtonClass,
  opsExcelButtonClass,
} from "../../../../shared/ui/operationsStyles";
import { BrandRefreshButton } from "../../../../ui";
import MasterDropdown, {
  type MasterDropdownOption,
} from "../../../masters/components/MasterDropdown";
import CollectionsPie from "../../dashboard/components/CollectionsPie";
import { useI18n } from "../../../../i18n";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

// Chart palette: stable brand colors for the known modes, hashed fallback
// for any other mode the backend returns.
const MODE_CHART_COLORS: Record<string, string> = {
  Cash: "#10b981",
  "Union Bank": "#0ea5e9",
  "HDFC Bank": "#8b5cf6",
  Others: "#f59e0b",
};
const MODE_CHART_PALETTE = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6", "#f97316", "#6366f1"];
const modeColor = (mode: string) =>
  MODE_CHART_COLORS[mode] ??
  MODE_CHART_PALETTE[(mode.length + mode.charCodeAt(0)) % MODE_CHART_PALETTE.length];

// 2D logo chips — flat color badges that tie table rows/columns to the
// chart colors (Cash = emerald, Union Bank = sky, HDFC Bank = violet).
// Display names for payment modes — short forms for tables/charts only;
// filter values and API payloads keep the full backend names.
const MODE_DISPLAY: Record<string, string> = {
  "HDFC Bank": "HDFC",
  "Union Bank": "Union",
};
const modeDisplay = (mode: string) => MODE_DISPLAY[mode] ?? mode;

// yyyy-MM-dd → dd-MM-yyyy for the branded PDF (matches the other DMR reports).
const formatPdfDate = (value: string): string => {
  const parts = (value ?? "").split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

// Row shape for the collector summary table (dynamic per-mode amount columns).
type CollectorDisplayRow = {
  collector: string;
  total: number;
  [paymentMode: string]: string | number;
};

const KNOWN_MODES = ["Cash", "Union Bank", "HDFC Bank"];

// Trip-List-style sort direction arrows for sortable table headers.
type SortDir = "asc" | "desc";
function SortArrows({ active, dir }: { active: boolean; dir?: SortDir }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

// Sort keys for the collector summary table (the money-authoritative table).
type CollectorSortKey = "collector" | "total" | "share" | string;

type Props = {
  embedded?: boolean;
};

export default function CollectionReportPage({ embedded = false }: Props) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const reportTRef = useRef(t);
  useEffect(() => {
    reportTRef.current = t;
  }, [t]);

  const [loading, setLoading] = useState(true);
  const { shops } = useShops();

  const { employees } = useEmployees();
  const collectors = useMemo(
    () =>
      employees
        .filter((emp) => emp.department === "Collection")
        .map((emp) => emp.employeeName)
        .sort(),
    [employees]
  );

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [defaultBounds, setDefaultBounds] = useState({ from: "", to: "" });
  const [shopName, setShopName] = useState("");
  const [collector, setCollector] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [collectorSortBy, setCollectorSortBy] = useState<CollectorSortKey | null>("total");
  const [collectorSortDir, setCollectorSortDir] = useState<SortDir>("desc");
  const requestSequenceRef = useRef(0);
  const initialLoadStartedRef = useRef(false);
  const appliedFiltersRef = useRef({
    fromDate: "",
    toDate: "",
    shopName: "",
    collector: "",
    paymentMode: "",
  });

  // Every selector uses the same searchable MasterDropdown as Trip List.
  const shopOptions = useMemo<MasterDropdownOption[]>(
    () =>
      shops
        .map((shop) => ({
          value: shop.shopName,
          label: shop.shopName,
          searchText: shop.shopName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [shops],
  );
  const collectorOptions = useMemo<MasterDropdownOption[]>(
    () => collectors.map((name) => ({ value: name, label: name, searchText: name })),
    [collectors],
  );
  const paymentModeOptions = useMemo<MasterDropdownOption[]>(
    () => [
      { value: "Cash", label: t("accounts.cash") },
      { value: "Union Bank", label: "Union Bank" },
      { value: "HDFC Bank", label: "HDFC Bank" },
    ],
    [t],
  );

  // Backend-authoritative report: totals/percentages/breakdowns come from
  // GET /collection-entry/report. This page only formats and displays them —
  // it must never recompute totals from raw collection rows.
  const [report, setReport] = useState<CollectionReportSummary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const loadReport = useCallback(
    async (filters: {
      fromDate: string;
      toDate: string;
      shopName: string;
      collector: string;
      paymentMode: string;
    }): Promise<boolean> => {
      if (!filters.fromDate || !filters.toDate) return false;
      const request = ++requestSequenceRef.current;
      setLoading(true);
      setReportError(null);
      try {
        const shopId = filters.shopName
          ? collectionService.getShopIdForName(filters.shopName) ?? undefined
          : undefined;
        const data = await collectionService.fetchCollectionReport({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          shopId,
          collector: filters.collector || undefined,
          paymentMode: filters.paymentMode || undefined,
        });
        if (request !== requestSequenceRef.current) return false;
        appliedFiltersRef.current = filters;
        setReport(data);
        return true;
      } catch (error) {
        if (request !== requestSequenceRef.current) return false;
        console.error("Failed to load collection report:", error);
        setReportError(reportTRef.current("ops.collection.report_load_failed"));
        setReport(null);
        return false;
      } finally {
        if (request === requestSequenceRef.current) setLoading(false);
      }
    },
    [],
  );

  const loadWeekBounds = useCallback(async () => {
    try {
      const bounds = await collectionService.fetchWeekBounds();
      const defaults = { from: bounds.weekStart, to: bounds.weekEnd };
      setDefaultBounds(defaults);
      setFromDate(defaults.from);
      setToDate(defaults.to);
      await loadReport({
        fromDate: defaults.from,
        toDate: defaults.to,
        shopName: "",
        collector: "",
        paymentMode: "",
      });
    } catch {
      setLoading(false);
      setReportError(reportTRef.current("ops.collection.report_load_failed"));
    }
  }, [loadReport]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadWeekBounds();
  }, [loadWeekBounds]);

  const totalCollections = report?.totalAmount ?? 0;
  const totalCollectorsCount = report?.totalCollectors ?? 0;

  // Presentation-only: bucket the backend's already-aggregated per-mode
  // distinct-collector counts into Known modes + "Others", in a fixed
  // display order. No amounts/sums are recomputed here.
  const collectorCountsByMode = useMemo(() => {
    const rows = report?.collectorsByPaymentMode ?? [];
    const knownSet = new Set(KNOWN_MODES);
    const result: { mode: string; count: number }[] = [];
    KNOWN_MODES.forEach((mode) => {
      const found = rows.find((r) => r.paymentMode === mode);
      result.push({ mode, count: found?.collectorCount ?? 0 });
    });
    const othersCount = rows
      .filter((r) => !knownSet.has(r.paymentMode))
      .reduce((sum, r) => sum + r.collectorCount, 0);
    if (othersCount > 0) {
      result.push({ mode: "Others", count: othersCount });
    }
    return result;
  }, [report]);

  // Backend-authoritative payment-mode totals, with a display-only "Total" row appended.
  const paymentModeSummary = useMemo(() => {
    const rows = (report?.paymentModeSummary ?? []).map((r) => ({
      mode: r.paymentMode,
      count: r.count,
      amount: r.amount,
      percentage: r.percentage,
    }));
    rows.push({
      mode: "Total",
      count: report?.totalCount ?? 0,
      amount: report?.totalAmount ?? 0,
      percentage: 100,
    });
    return rows;
  }, [report]);

  // Backend-authoritative collector totals; only the "top 4 + Others (N)"
  // grouping for display is done here, summing already-authoritative
  // per-collector totals rather than raw transaction rows.
  const collectorSummary = useMemo(() => {
    const source = report?.collectorSummary ?? [];
    // Column order MUST match the Payment Mode Summary table exactly so the
    // Cash / Union Bank / HDFC Bank columns line up across both tables. Use the
    // backend-authoritative payment-mode order first, then append any extra
    // mode that only appears in the collector rows (kept stable, not sorted).
    const authoritativeOrder = (report?.paymentModeSummary ?? []).map((r) => r.paymentMode);
    const seen = new Set<string>();
    const paymentModes: string[] = [];
    const pushMode = (mode: string) => {
      if (!seen.has(mode)) {
        seen.add(mode);
        paymentModes.push(mode);
      }
    };
    authoritativeOrder.forEach(pushMode);
    source.forEach((row) => Object.keys(row.amounts).forEach(pushMode));

    // Preserve every backend collector row in the on-screen table and exports.
    // Only the final Total row is presentation-only.
    const rows: CollectorDisplayRow[] = source.map((sourceRow) => {
      const row: CollectorDisplayRow = {
        collector: sourceRow.collector,
        total: sourceRow.total,
      };
      paymentModes.forEach((mode) => {
        row[mode] = sourceRow.amounts[mode] || 0;
      });
      return row;
    });

    const totalRow: CollectorDisplayRow = {
      collector: "Total",
      total: report?.totalAmount ?? 0,
    };
    paymentModes.forEach((mode) => {
      totalRow[mode] = rows.reduce(
        (sum, row) => sum + Number(row[mode] || 0),
        0,
      );
    });
    rows.push(totalRow);

    return { rows, paymentModes };
  }, [report]);

  // Presentation-only sort of the collector table. The Total row always stays
  // pinned to the bottom; only the collector rows above it are reordered.
  const sortedCollectorRows = useMemo(() => {
    const dataRows = collectorSummary.rows.filter((r) => r.collector !== "Total");
    const totalRow = collectorSummary.rows.find((r) => r.collector === "Total");
    if (collectorSortBy) {
      const dir = collectorSortDir === "asc" ? 1 : -1;
      dataRows.sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (collectorSortBy === "collector") {
          av = a.collector;
          bv = b.collector;
        } else if (collectorSortBy === "total" || collectorSortBy === "share") {
          av = a.total;
          bv = b.total;
        } else {
          av = Number(a[collectorSortBy] || 0);
          bv = Number(b[collectorSortBy] || 0);
        }
        if (typeof av === "string" && typeof bv === "string") {
          return av.localeCompare(bv) * dir;
        }
        return (Number(av) - Number(bv)) * dir;
      });
    }
    return totalRow ? [...dataRows, totalRow] : dataRows;
  }, [collectorSummary, collectorSortBy, collectorSortDir]);

  const handleCollectorSort = useCallback((key: CollectorSortKey) => {
    setCollectorSortBy((prevKey) => {
      if (prevKey === key) {
        setCollectorSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setCollectorSortDir(key === "collector" ? "asc" : "desc");
      return key;
    });
  }, []);

  // Chart-ready views of the authoritative report rows (presentation-only).
  const modeChartData = useMemo(
    () =>
      (report?.paymentModeSummary ?? []).map((r) => ({
        name: modeDisplay(r.paymentMode),
        mode: r.paymentMode,
        value: r.amount,
        count: r.count,
        percentage: r.percentage,
      })),
    [report]
  );

  const getExportFileName = useCallback((ext: "xlsx" | "pdf") => {
    const dateStr = report?.fromDate && report?.toDate
      ? `${report.fromDate}_to_${report.toDate}`
      : "report";
    return `Collection_Report_${dateStr}.${ext}`;
  }, [report]);

  const exportExcel = useCallback(() => {
    if (!report || report.totalCount === 0) {
      showNotification(t("ops.collection.no_data_export"), "error");
      return;
    }
    try {
      const wb = XLSX.utils.book_new();

      const pmData = paymentModeSummary.map((row) => ({
        [t("ops.collection.payment_mode")]: row.mode,
        [t("ops.collection.no_of_collections")]: row.count,
        [t("operations.amount_received")]: row.amount,
        [t("ops.collection.percentage")]: row.percentage.toFixed(2),
      }));
      const ws1 = XLSX.utils.json_to_sheet(pmData);
      XLSX.utils.book_append_sheet(wb, ws1, t("ops.collection.payment_mode_summary"));

      const collectorRows = collectorSummary.rows.map((row) => {
        const obj: Record<string, string | number> = { [t("common.collector")]: row.collector };
        collectorSummary.paymentModes.forEach((mode: string) => {
          obj[mode] = row[mode] || 0;
        });
        obj[t("common.total")] = row.total;
        return obj;
      });
      const ws2 = XLSX.utils.json_to_sheet(collectorRows);
      XLSX.utils.book_append_sheet(wb, ws2, t("ops.collection.collector_summary"));

      XLSX.writeFile(wb, getExportFileName("xlsx"));
      showNotification(t("notification.export_success"), "success");
    } catch {
      showNotification(t("ops.collection.excel_failed"), "error");
    }
  }, [report, paymentModeSummary, collectorSummary, showNotification, t, getExportFileName]);

  const exportPDF = useCallback(async () => {
    if (!report || report.totalCount === 0) {
      showNotification(t("ops.collection.no_data_export"), "error");
      return;
    }
    try {
      const applied = appliedFiltersRef.current;

      // Branded palette — same as the global DMR letterhead so every report
      // document looks identical across modules.
      const NAVY: [number, number, number] = [52, 68, 115];
      const RED: [number, number, number] = [222, 96, 110];
      const MUTED: [number, number, number] = [110, 118, 132];
      const HEAD_BG: [number, number, number] = [52, 68, 115];
      const TOTAL_BG: [number, number, number] = [238, 242, 249];
      const ZEBRA_BG: [number, number, number] = [248, 250, 252];

      const MARGIN = 12;
      const inr = (v: number) =>
        new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

      // A4 portrait with the shared branded letterhead (proprietor block,
      // centred DMR POULTRIES wordmark, hen mark, decorative divider).
      const doc: jsPDF = createDmrPoultryPdf("portrait");
      doc.setProperties({
        title: "Collection Report",
        subject: "DMR POULTRIES collection report",
        author: "DMR POULTRIES",
        creator: "DMR POULTRIES",
      });

      const headerBottom = await drawDmrPoultryHeader(doc, { margin: MARGIN, top: 8, henUrl: henImage });
      const pageWidth = doc.internal.pageSize.getWidth();

      // ── Report title + applied-filter meta line ──────────────────────────
      let y = headerBottom + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(t("ops.collection.collection_report_title"), pageWidth / 2, y, { align: "center" });
      y += 6;

      const metaParts = [
        `${t("common.from")}: ${formatPdfDate(applied.fromDate) || "N/A"}`,
        `${t("common.to")}: ${formatPdfDate(applied.toDate) || "N/A"}`,
      ];
      if (applied.shopName) metaParts.push(`${t("operations.shop_name")}: ${applied.shopName}`);
      if (applied.collector) metaParts.push(`${t("common.collector")}: ${applied.collector}`);
      if (applied.paymentMode) metaParts.push(`${t("operations.payment_mode")}: ${applied.paymentMode}`);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(metaParts.join("    •    "), pageWidth / 2, y, { align: "center" });
      y += 6;

      // ── Section 1: Payment Mode Summary ──────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(t("ops.collection.payment_mode_summary"), MARGIN, y);
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + 1.6, MARGIN + 46, y + 1.6);
      y += 5;

      const pmBody = paymentModeSummary.map((row) => {
        const share = totalCollections > 0 ? (row.amount / totalCollections) * 100 : 0;
        return [
          row.mode === "Total" ? t("common.total") : modeDisplay(row.mode),
          row.mode === "Total"
            ? String(totalCollectorsCount)
            : String(collectorCountsByMode.find((c) => c.mode === row.mode)?.count ?? 0),
          String(row.count),
          inr(row.amount),
          `${share.toFixed(1)}%`,
        ];
      });
      autoTable(doc, {
        head: [[
          t("ops.collection.mode"),
          t("ops.collection.collectors"),
          t("ops.collection.no_short"),
          t("table.amount"),
          t("ops.collection.share"),
        ]],
        body: pmBody,
        startY: y,
        theme: "grid",
        margin: { left: MARGIN, right: MARGIN },
        headStyles: { fillColor: HEAD_BG, textColor: 255, fontStyle: "bold", fontSize: 8.5, halign: "center", cellPadding: 2.2, lineWidth: 0.1, lineColor: [255, 255, 255] },
        bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30], cellPadding: 2.2, lineWidth: 0.1, lineColor: [214, 220, 230] },
        alternateRowStyles: { fillColor: ZEBRA_BG },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "center" },
        },
        didParseCell: (hook) => {
          if (hook.row.index === pmBody.length - 1) {
            hook.cell.styles.fillColor = TOTAL_BG;
            hook.cell.styles.fontStyle = "bold";
            hook.cell.styles.textColor = NAVY;
          }
        },
      });
      y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

      // ── Section 2: Collector Summary ─────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(t("ops.collection.collector_summary"), MARGIN, y);
      doc.setDrawColor(RED[0], RED[1], RED[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y + 1.6, MARGIN + 40, y + 1.6);
      y += 5;

      const collectorHead = [
        t("common.collector"),
        ...collectorSummary.paymentModes.map((m) => modeDisplay(m)),
        t("common.total"),
        t("ops.collection.share"),
      ];
      const collectorBody = sortedCollectorRows.map((row) => {
        const share = totalCollections > 0 ? (row.total / totalCollections) * 100 : 0;
        return [
          row.collector === "Total" ? t("common.total") : row.collector,
          ...collectorSummary.paymentModes.map((mode: string) => inr(Number(row[mode]) || 0)),
          inr(row.total),
          `${share.toFixed(1)}%`,
        ];
      });
      const modeColCount = collectorSummary.paymentModes.length;
      autoTable(doc, {
        head: [collectorHead],
        body: collectorBody,
        startY: y,
        theme: "grid",
        margin: { left: MARGIN, right: MARGIN },
        headStyles: { fillColor: HEAD_BG, textColor: 255, fontStyle: "bold", fontSize: 8.5, halign: "center", cellPadding: 2.2, lineWidth: 0.1, lineColor: [255, 255, 255] },
        bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30], cellPadding: 2.2, lineWidth: 0.1, lineColor: [214, 220, 230] },
        alternateRowStyles: { fillColor: ZEBRA_BG },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          [modeColCount + 1]: { halign: "right", fontStyle: "bold" },
          [modeColCount + 2]: { halign: "center" },
        },
        didParseCell: (hook) => {
          if (hook.column.index >= 1 && hook.column.index <= modeColCount) {
            hook.cell.styles.halign = "right";
          }
          if (hook.row.index === collectorBody.length - 1) {
            hook.cell.styles.fillColor = TOTAL_BG;
            hook.cell.styles.fontStyle = "bold";
            hook.cell.styles.textColor = NAVY;
          }
        },
      });

      // ── Footer page numbers on every page ────────────────────────────────
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 7, { align: "right" });
        doc.text("DMR POULTRIES — Collection Report", MARGIN, pageHeight - 7);
      }

      doc.save(getExportFileName("pdf"));
      showNotification(t("notification.export_success"), "success");
    } catch {
      showNotification(t("ops.collection.pdf_failed"), "error");
    }
  }, [
    report,
    paymentModeSummary,
    collectorSummary,
    sortedCollectorRows,
    collectorCountsByMode,
    totalCollections,
    totalCollectorsCount,
    showNotification,
    t,
    getExportFileName,
  ]);

  const resetFilters = useCallback(() => {
    const defaults = {
      fromDate: defaultBounds.from,
      toDate: defaultBounds.to,
      shopName: "",
      collector: "",
      paymentMode: "",
    };
    setFromDate(defaults.fromDate);
    setToDate(defaults.toDate);
    setShopName("");
    setCollector("");
    setPaymentMode("");
    void loadReport(defaults).then((ok) => {
      if (ok) showNotification(t("ops.collection.filters_reset_default"), "info");
    });
  }, [defaultBounds, loadReport, showNotification, t]);

  // Filters apply instantly — no Search button. Every selector change sets its
  // own state and immediately reloads the report from the applied filter set,
  // merged with the new value (like the Trip List instant filters).
  const applyFilterChange = useCallback(
    (patch: Partial<{ fromDate: string; toDate: string; shopName: string; collector: string; paymentMode: string }>) => {
      const next = { ...appliedFiltersRef.current, ...patch };
      if (!next.fromDate || !next.toDate) return;
      void loadReport(next);
    },
    [loadReport],
  );

  const handleFromDateChange = useCallback((value: string) => {
    setFromDate(value);
    applyFilterChange({ fromDate: value });
  }, [applyFilterChange]);

  const handleToDateChange = useCallback((value: string) => {
    setToDate(value);
    applyFilterChange({ toDate: value });
  }, [applyFilterChange]);

  const handleShopChange = useCallback((value: string) => {
    setShopName(value);
    applyFilterChange({ shopName: value });
  }, [applyFilterChange]);

  const handleCollectorChange = useCallback((value: string) => {
    setCollector(value);
    applyFilterChange({ collector: value });
  }, [applyFilterChange]);

  const handlePaymentModeChange = useCallback((value: string) => {
    setPaymentMode(value);
    applyFilterChange({ paymentMode: value });
  }, [applyFilterChange]);

  const handleRefresh = useCallback(() => {
    if (loading) return;
    void loadReport(appliedFiltersRef.current).then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  }, [loading, loadReport, showNotification, t]);

  // Trip-List-style sortable header: an icon + label button with arrows.
  const collectorSortHeader = useCallback(
    (key: CollectorSortKey, content: ReactNode, center = false) => {
      const active = collectorSortBy === key;
      return (
        <button
          type="button"
          onClick={() => handleCollectorSort(key)}
          aria-sort={active ? (collectorSortDir === "asc" ? "ascending" : "descending") : "none"}
          className={`group/sort flex w-full items-center gap-2 text-[12px] font-bold uppercase tracking-wider transition-colors hover:text-emerald-700 ${
            center ? "justify-center" : ""
          } ${active ? "text-emerald-700" : ""}`}
        >
          {content}
          <SortArrows active={active} dir={collectorSortDir} />
        </button>
      );
    },
    [collectorSortBy, collectorSortDir, handleCollectorSort],
  );

  // Content matching the precise structural layout and spacing of RatesEntryPage
  const content = (
    <div className="w-full space-y-5" data-embedded={embedded || undefined}>
      {/* Filter Bar Card — filters apply instantly; only Reset / Refresh /
          PDF / Excel actions sit after the Pay Mode filter (no Search). */}
      <div className={opsFilterCardClass}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="shrink-0 text-emerald-500" />
              <span>{t("common.from")}</span>
            </label>
            <DatePicker
              value={fromDate}
              onChange={handleFromDateChange}
              placeholder={t("placeholder.enter_date")}
              className="w-full text-xs font-medium"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="shrink-0 text-emerald-500" />
              <span>{t("common.to")}</span>
            </label>
            <DatePicker
              value={toDate}
              onChange={handleToDateChange}
              placeholder={t("placeholder.enter_date")}
              className="w-full text-xs font-medium"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <Store size={17} className="shrink-0 text-emerald-500" />
              <span>{t("operations.shop_name")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("operations.shop_name")}
              value={shopName}
              options={shopOptions}
              onChange={handleShopChange}
              placeholder={t("ops.collection.all_shops")}
              searchable
              allowClear
              className="w-full"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <Users size={17} className="shrink-0 text-blue-500" />
              <span>{t("common.collector")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("common.collector")}
              value={collector}
              options={collectorOptions}
              onChange={handleCollectorChange}
              placeholder={t("ops.collection.all_collectors")}
              searchable
              allowClear
              className="w-full"
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>
              <CreditCard size={17} className="shrink-0 text-violet-500" />
              <span>{t("operations.payment_mode")}</span>
            </label>
            <MasterDropdown
              hideLabel
              label={t("operations.payment_mode")}
              value={paymentMode}
              options={paymentModeOptions}
              onChange={handlePaymentModeChange}
              placeholder={t("ops.collection.all_modes")}
              searchable
              allowClear
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t("common.reset")}
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={14} /></span>
            {t("common.reset")}
          </button>
          <BrandRefreshButton onClick={handleRefresh} loading={loading} />
          <button
            type="button"
            onClick={exportPDF}
            disabled={!report || report.totalCount === 0 || loading}
            className={`group relative ${opsPdfButtonClass}`}
            aria-label="PDF"
          >
            <span className={`inline-flex ${!report || report.totalCount === 0 || loading ? "" : "motion-safe:group-hover:animate-[var(--animate-action-pdf)]"}`}><FileText size={15} /></span>
            PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!report || report.totalCount === 0 || loading}
            className={`group relative ${opsExcelButtonClass}`}
            aria-label="Excel"
          >
            <span className={`inline-flex ${!report || report.totalCount === 0 || loading ? "" : "motion-safe:group-hover:animate-[var(--animate-action-excel)]"}`}><FileSpreadsheet size={15} /></span>
            Excel
          </button>
        </div>
      </div>

      {/* Tables — the filter bar above always stays constant. Loading, error
          and empty states render inline here (never a full-page takeover),
          exactly like the Trip List table surface. */}
      {loading && !report ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white py-16 shadow-sm">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
              aria-hidden="true"
            />
            {t("ops.collection.loading_report")}
          </span>
        </div>
      ) : reportError && !report ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 py-14 text-center shadow-sm">
          <span className="rounded-full bg-rose-100 p-3 text-rose-600">
            <AlertTriangle size={22} />
          </span>
          <p className="text-sm font-semibold text-rose-700">{reportError}</p>
          <button
            type="button"
            onClick={() => {
              setReportError(null);
              if (appliedFiltersRef.current.fromDate && appliedFiltersRef.current.toDate) {
                void loadReport(appliedFiltersRef.current);
              } else {
                setLoading(true);
                void loadWeekBounds();
              }
            }}
            className={opsSecondaryButtonClass}
          >
            <RotateCcw size={14} /> {t("common.retry")}
          </button>
        </div>
      ) : (report?.totalCount ?? 0) === 0 ? (
        <div className={`${opsEmptyStateClass} flex flex-col items-center gap-2 py-14`}>
          <span className="rounded-full bg-slate-100 p-3 text-slate-400">
            <Inbox size={22} />
          </span>
          <p className="text-sm font-semibold text-slate-600">{t("ops.collection.empty.title")}</p>
          <p className="text-xs text-slate-400">{t("ops.collection.empty.hint")}</p>
        </div>
      ) : (
      <div className={`space-y-6 transition-opacity duration-200 ${loading ? "pointer-events-none opacity-50" : ""}`}>
        {/* Section 1 — Mode-wise Share chart on top, Payment Mode Summary below */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-sky-50/70 via-white to-sky-50/40 px-6 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-100 bg-sky-50/70 text-sky-500 shadow-inner">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-slate-800">{t("ops.collection.mode_share")}</h3>
            <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("common.total")}: {formatCurrency(totalCollections)}
            </span>
          </div>
          <div className="flex items-center justify-center px-5 py-6">
            <div className="w-full max-w-lg">
              <CollectionsPie
                data={modeChartData.map((row) => ({ name: row.name, value: row.value }))}
                animationKey={report?.totalCount ?? 0}
                hideStats
              />
            </div>
          </div>

          <div className="flex items-center gap-3 border-y border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 px-6 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500 shadow-inner">
              <Wallet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-slate-800">{t("ops.collection.payment_mode_summary")}</h3>
            <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("ops.collection.no_of_collections")}: {report?.totalCount ?? 0}
            </span>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <tr className="whitespace-nowrap">
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <CreditCard size={14} className="flex-shrink-0 text-violet-500" />
                      <span>{t("ops.collection.mode")}</span>
                    </div>
                  </th>
                  <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1.5">
                      <Users size={14} className="flex-shrink-0 text-indigo-500" />
                      <span>{t("ops.collection.collectors")}</span>
                    </div>
                  </th>
                  <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1.5">
                      <Hash size={14} className="flex-shrink-0 text-slate-400" />
                      <span>{t("ops.collection.no_short")}</span>
                    </div>
                  </th>
                  <th className="px-4 py-4 text-right text-[12px] font-bold uppercase tracking-wider">
                    <div className="flex items-center justify-end gap-1.5">
                      <IndianRupee size={14} className="flex-shrink-0 text-emerald-500" />
                      <span>{t("table.amount")}</span>
                    </div>
                  </th>
                  <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1.5">
                      <Percent size={14} className="flex-shrink-0 text-amber-500" />
                      <span>{t("ops.collection.share")}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentModeSummary.map((row, idx) => {
                  const isTotal = row.mode === "Total";
                  const share = totalCollections > 0 ? (row.amount / totalCollections) * 100 : 0;
                  return (
                    <tr
                      key={row.mode}
                      className={
                        isTotal
                          ? "border-t-2 border-slate-200 bg-amber-50/60 font-semibold"
                          : `transition-colors duration-150 hover:bg-slate-50/60 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-5 text-[13px] font-medium text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                            style={{ backgroundColor: isTotal ? "#64748b" : modeColor(row.mode) }}
                          />
                          {isTotal ? t("common.total") : modeDisplay(row.mode)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-medium text-slate-600">
                        {isTotal
                          ? totalCollectorsCount
                          : (collectorCountsByMode.find((c) => c.mode === row.mode)?.count ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold text-slate-700">{row.count}</td>
                      <td className="whitespace-nowrap px-4 py-5 text-right text-[13px] font-bold text-emerald-600 tabular-nums">{formatCurrency(row.amount)}</td>
                      <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-semibold text-amber-600 tabular-nums">{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2 — Collector Summary table on top, Collector-wise Split chart below */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 px-6 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50/70 text-indigo-500 shadow-inner">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-slate-800">{t("ops.collection.collector_summary")}</h3>
            <span className="ml-auto text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("ops.collection.total_collectors")}: {totalCollectorsCount}
            </span>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <tr className="whitespace-nowrap">
                  <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                    {collectorSortHeader("collector", (
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="flex-shrink-0 text-emerald-500" />
                        <span>{t("common.collector")}</span>
                      </div>
                    ))}
                  </th>
                  {collectorSummary.paymentModes.map((mode: string) => (
                    <th key={mode} className="px-4 py-4 text-right text-[12px] font-bold uppercase tracking-wider">
                      {collectorSortHeader(mode, (
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full ring-2 ring-white"
                            style={{ backgroundColor: modeColor(mode) }}
                          />
                          <span>{modeDisplay(mode)}</span>
                        </div>
                      ), false)}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-right text-[12px] font-bold uppercase tracking-wider">
                    {collectorSortHeader("total", (
                      <div className="flex items-center justify-end gap-1.5">
                        <IndianRupee size={14} className="flex-shrink-0 text-emerald-500" />
                        <span>{t("common.total")}</span>
                      </div>
                    ))}
                  </th>
                  <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                    {collectorSortHeader("share", (
                      <div className="flex items-center justify-center gap-1.5">
                        <Percent size={14} className="flex-shrink-0 text-amber-500" />
                        <span>{t("ops.collection.share")}</span>
                      </div>
                    ), true)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCollectorRows.map((row, idx) => {
                  const isTotal = row.collector === "Total";
                  const share = totalCollections > 0 ? (row.total / totalCollections) * 100 : 0;
                  return (
                    <tr
                      key={isTotal ? "total" : `${row.collector}-${idx}`}
                      className={
                        isTotal
                          ? "border-t-2 border-slate-200 bg-amber-50/60 font-semibold"
                          : `transition-colors duration-150 hover:bg-slate-50/60 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-5 text-[13px] font-medium text-slate-800">
                        {isTotal ? t("common.total") : row.collector}
                      </td>
                      {collectorSummary.paymentModes.map((mode: string) => (
                        <td key={mode} className="whitespace-nowrap px-4 py-5 text-right text-[13px] text-slate-600 tabular-nums">
                          {formatCurrency(Number(row[mode]) || 0)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-5 text-right text-[13px] font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-semibold text-amber-600 tabular-nums">{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  );

  return content;
}