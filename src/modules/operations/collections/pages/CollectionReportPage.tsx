// src/modules/collections/pages/CollectionReportPage.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { collectionService } from "../services/collectionService";
import type { CollectionApiEntry, CollectionReportSummary } from "../types/collection";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import {
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Wallet,
  Users,
  Search,
  Loader2,
  Inbox,
  Calendar,
  Store,
  CreditCard,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { DatePicker } from "../../../../components/common/DatePicker";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsEmptyStateClass,
  opsPrimaryButtonClass,
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

const compactINR = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

// ── Chart tooltip — polished card used by the stacked collector chart ──────
// White rounded card, color-coded dots, ₹ amounts and each row's share of
// the tooltip total, plus a total footer.
type CollectorDisplayRow = {
  collector: string;
  total: number;
  [paymentMode: string]: string | number;
};

type ChartTipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: { fill?: string };
};

function ChartTipBox({
  active,
  payload,
  totalLabel,
}: {
  active?: boolean;
  payload?: ChartTipEntry[];
  totalLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((p) => Number(p.value ?? 0) > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, p) => sum + Number(p.value ?? 0), 0);
  const inr = (v: number) => `₹ ${v.toLocaleString("en-IN")}`;
  const dotColor = (p: ChartTipEntry) => p.color ?? p.payload?.fill ?? "#94a3b8";
  const title = rows.length === 1 ? String(rows[0].name ?? "") : "";
  return (
    <div className="min-w-[11rem] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      {title ? (
        <div className="mb-1.5 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor(rows[0]) }} />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{title}</span>
        </div>
      ) : null}
      <div className="space-y-1">
        {rows.map((p, idx) => {
          const value = Number(p.value ?? 0);
          const share = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={idx} className="flex items-center gap-2 text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor(p) }} />
              <span className="mr-auto font-medium text-slate-600">
                {rows.length > 1 ? String(p.name ?? p.dataKey ?? "") : totalLabel}
              </span>
              <span className="font-bold tabular-nums text-slate-800">{inr(value)}</span>
              <span className="w-9 text-right font-semibold tabular-nums text-slate-400">{share.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
      {rows.length > 1 ? (
        <div className="mt-1.5 flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[11px]">
          <span className="mr-auto font-bold uppercase tracking-wide text-slate-500">{totalLabel}</span>
          <span className="font-extrabold tabular-nums text-slate-900">{inr(total)}</span>
          <span className="w-9" />
        </div>
      ) : null}
    </div>
  );
}

const KNOWN_MODES = ["Cash", "Union Bank", "HDFC Bank"];

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
      { value: "Others", label: t("common.other") },
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
    const paymentModes = Array.from(
      new Set(source.flatMap((row) => Object.keys(row.amounts))),
    ).sort();

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
  const collectorChartData = useMemo(
    () => collectorSummary.rows.filter((row) => row.collector !== "Total"),
    [collectorSummary]
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
      const doc = new jsPDF("p", "mm", "a4");
      const margin = 14;
      let y = 20;

      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(t("ops.collection.collection_report_title"), margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`${t("common.from")}: ${applied.fromDate || "N/A"} ${t("common.to")}: ${applied.toDate || "N/A"}`, margin, y);
      y += 10;

      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text(t("ops.collection.payment_mode_summary"), margin, y);
      y += 5;
      const pmData = paymentModeSummary.map((row) => [
        row.mode,
        row.count.toString(),
        row.amount.toFixed(2),
        row.percentage.toFixed(2) + "%",
      ]);
      autoTable(doc, {
        head: [[t("ops.collection.payment_mode"), t("ops.collection.no_of_collections"), t("operations.amount_received"), t("ops.collection.percentage")]],
        body: pmData,
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8 },
      });
      y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text(t("ops.collection.collector_summary"), margin, y);
      y += 5;
      const header = [t("common.collector"), ...collectorSummary.paymentModes, t("common.total")];
      const body = collectorSummary.rows.map((row) => {
        const rowData: (string | number)[] = [row.collector];
        collectorSummary.paymentModes.forEach((mode: string) => {
          rowData.push(Number(row[mode] || 0).toFixed(2));
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

      // ── Collection Details (transaction rows) ────────────────────────────
      // Rows come from the backend's /collection-entry/recent endpoint
      // (contract endpoint; per shop). Date-range filtering and ordering here
      // are presentation-only — summary totals above remain authoritative.
      try {
        const selectedShopId = applied.shopName
          ? collectionService.getShopIdForName(applied.shopName) ?? null
          : null;
        let detailRows: CollectionApiEntry[] = [];
        if (selectedShopId) {
          detailRows = await collectionService.fetchRecentCollectionsForShop(selectedShopId, 500);
        } else {
          const perShop = await Promise.all(
            shops.map((shop) =>
              collectionService
                .fetchRecentCollectionsForShop(shop.id, 500)
                .catch((): CollectionApiEntry[] => [])
            )
          );
          detailRows = perShop.flat();
        }
        detailRows = detailRows
          .filter(
            (row) =>
              (!row.collectionDate ||
                (row.collectionDate >= applied.fromDate && row.collectionDate <= applied.toDate))
          )
          .sort(
            (a, b) =>
              a.collectionDate.localeCompare(b.collectionDate) ||
              a.collectionNo.localeCompare(b.collectionNo, undefined, { numeric: true })
          );

        doc.addPage();
        let dy = 20;
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.text(`${t("ops.collection.details")} (${detailRows.length} ${t("ops.collection.records")})`, margin, dy);
        dy += 5;
        if (detailRows.length > 0) {
          const detailBody = detailRows.map((row) => [
            row.collectionDate || "—",
            row.collectionNo || "—",
            row.shopName || "—",
            row.paymentMode || "—",
            (row.amount ?? 0).toFixed(2),
          ]);
          detailBody.push([
            "",
            "",
            t("common.total"),
            "",
            detailRows.reduce((sum, row) => sum + (row.amount ?? 0), 0).toFixed(2),
          ]);
          autoTable(doc, {
            head: [[
              t("common.date"),
              t("ops.collection.collection_no_label"),
              t("operations.shop_name"),
              t("operations.payment_mode"),
              t("table.amount"),
            ]],
            body: detailBody,
            startY: dy,
            theme: "striped",
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
            styles: { fontSize: 8 },
            columnStyles: { 4: { halign: "right" } },
          });
        } else {
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t("ops.collection.empty.title"), margin, dy + 4);
        }
      } catch {
        // Detail section is best-effort; summary PDF still exports.
      }

      doc.save(getExportFileName("pdf"));
      showNotification(t("notification.export_success"), "success");
    } catch {
      showNotification(t("ops.collection.pdf_failed"), "error");
    }
  }, [report, paymentModeSummary, collectorSummary, showNotification, t, shops, getExportFileName]);

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

  const handleSearch = useCallback(() => {
    if (loading) return;
    if (!fromDate || !toDate) {
      void loadWeekBounds();
      return;
    }
    void loadReport({ fromDate, toDate, shopName, collector, paymentMode });
  }, [loading, fromDate, toDate, shopName, collector, paymentMode, loadReport, loadWeekBounds]);

  const handleRefresh = useCallback(() => {
    if (loading) return;
    void loadReport(appliedFiltersRef.current).then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  }, [loading, loadReport, showNotification, t]);

  if (loading && !report)
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-10 py-8 shadow-sm">
          <Loader2 size={28} className="animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-500">{t("common.loading")}</span>
        </div>
      </div>
    );
  if (reportError && !report) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-10 py-8 text-center shadow-sm">
          <span className="rounded-full bg-rose-100 p-3 text-rose-600">
            <AlertTriangle size={22} />
          </span>
          <p className="text-sm font-semibold text-rose-700">{reportError}</p>
          <button
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
      </div>
    );
  }

  // Content matching the precise structural layout and spacing of RatesEntryPage
  const content = (
    <div className="w-full space-y-5" data-embedded={embedded || undefined}>
      {/* Filter Bar Card — Excel / PDF / Reset / Search sit in the last grid
          cell, right after the Pay Mode filter */}
      <div className={opsFilterCardClass}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={opsFilterLabelClass}>
              <Calendar size={17} className="shrink-0 text-emerald-500" />
              <span>{t("common.from")}</span>
            </label>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
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
              onChange={setToDate}
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
              onChange={setShopName}
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
              onChange={setCollector}
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
              onChange={setPaymentMode}
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
            onClick={handleSearch}
            disabled={loading}
            className={`group relative ${opsPrimaryButtonClass}`}
            aria-label={t("common.search")}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {t("common.search")}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t("common.reset")}
          >
            <RotateCcw size={14} /> {t("common.reset")}
          </button>
          <BrandRefreshButton onClick={handleRefresh} loading={loading} />
          <button
            type="button"
            onClick={exportPDF}
            disabled={!report || report.totalCount === 0 || loading}
            className={`group relative ${opsPdfButtonClass}`}
            aria-label="PDF"
          >
            <FileText size={15} /> PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!report || report.totalCount === 0 || loading}
            className={`group relative ${opsExcelButtonClass}`}
            aria-label="Excel"
          >
            <FileSpreadsheet size={15} /> Excel
          </button>
        </div>
      </div>

      {/* Tables — friendly empty state when the period has no collections;
          dimmed + non-interactive while a refresh is in flight */}
      {(report?.totalCount ?? 0) === 0 ? (
        <div className={`${opsEmptyStateClass} flex flex-col items-center gap-2 py-14`}>
          <span className="rounded-full bg-slate-100 p-3 text-slate-400">
            <Inbox size={22} />
          </span>
          <p className="text-sm font-semibold text-slate-600">{t("ops.collection.empty.title")}</p>
          <p className="text-xs text-slate-400">{t("ops.collection.empty.hint")}</p>
        </div>
      ) : (
      <>
        {/* Row 1 — Payment Mode Summary: table with its mode-share chart */}
        <div className={`grid grid-cols-1 gap-6 lg:grid-cols-2 transition-opacity duration-200 ${loading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                  <Wallet size={14} />
                </span>
                {t("ops.collection.payment_mode_summary")}
              </h4>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("ops.collection.no_of_collections")}: {report?.totalCount ?? 0}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">{t("ops.collection.mode")}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("ops.collection.collectors")}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("ops.collection.no_short")}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("table.amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paymentModeSummary.map((row) => (
                    <tr
                      key={row.mode}
                      className={row.mode === "Total" ? "bg-amber-50/60 font-semibold" : "hover:bg-slate-50/50"}
                    >
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                            style={{ backgroundColor: row.mode === "Total" ? "#64748b" : modeColor(row.mode) }}
                          />
                          {row.mode === "Total" ? t("common.total") : modeDisplay(row.mode)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">
                        {row.mode === "Total"
                          ? totalCollectorsCount
                          : (collectorCountsByMode.find((c) => c.mode === row.mode)?.count ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{row.count}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="rounded-lg bg-sky-50 p-1.5 text-sky-600">
                  <BarChart3 size={14} />
                </span>
                {t("ops.collection.mode_share")}
              </h4>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("common.total")}: {formatCurrency(totalCollections)}
              </span>
            </div>
            <div className="flex p-4">
              <CollectionsPie
                data={modeChartData.map((row) => ({ name: row.name, value: row.value }))}
                animationKey={report?.totalCount ?? 0}
                compact
              />
            </div>
          </div>
        </div>

        {/* Row 2 — Collector Summary: table with its collector split chart */}
        <div className={`grid grid-cols-1 gap-6 lg:grid-cols-2 transition-opacity duration-200 ${loading ? "pointer-events-none opacity-50" : ""}`}>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
                  <Users size={14} />
                </span>
                {t("ops.collection.collector_summary")}
              </h4>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("ops.collection.total_collectors")}: {totalCollectorsCount}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">{t("common.collector")}</th>
                    {collectorSummary.paymentModes.map((mode: string) => (
                      <th key={mode} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
{modeDisplay(mode)}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("common.total")}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("ops.collection.share")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {collectorSummary.rows.map((row, idx) => {
                    const isTotal = row.collector === "Total";
                    const share = totalCollections > 0 ? (row.total / totalCollections) * 100 : 0;
                    return (
                      <tr
                        key={idx}
                        className={isTotal ? "bg-amber-50/60 font-semibold" : "hover:bg-slate-50/50"}
                      >
                        <td className="px-4 py-3 text-xs font-medium text-slate-800">
                          {row.collector === "Total" ? t("common.total") : row.collector}
                        </td>
                        {collectorSummary.paymentModes.map((mode: string) => (
                          <td key={mode} className="px-4 py-3 text-right text-xs text-slate-600">
                            {formatCurrency(Number(row[mode]) || 0)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
                          {formatCurrency(row.total)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600">{share.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="rounded-lg bg-sky-50 p-1.5 text-sky-600">
                  <BarChart3 size={14} />
                </span>
                {t("ops.collection.collector_split")}
              </h4>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("ops.collection.collectors")}: {collectorChartData.length}
              </span>
            </div>
            <div className="h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collectorChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="collector" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactINR(v)} />
                  <ChartTooltip
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    content={<ChartTipBox totalLabel={t("common.total")} />}
                  />
                  <ChartLegend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  {collectorSummary.paymentModes.map((mode: string, idx: number) => (
                    <Bar
                      key={mode}
                      dataKey={mode}
                      name={modeDisplay(mode)}
                      stackId="amount"
                      fill={modeColor(mode)}
                      radius={idx === collectorSummary.paymentModes.length - 1 ? [4, 4, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </>
      )}
    </div>
  );

  return content;
}