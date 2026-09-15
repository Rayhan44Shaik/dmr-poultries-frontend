// src/modules/collections/pages/CollectionReportPage.tsx

import { useState, useEffect, useMemo, useCallback } from "react";
import { collectionService } from "../services/collectionService";
import type { CollectionApiEntry, CollectionReportSummary } from "../types/collection";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import Select from "react-select";
import {
  PieChart,
  Pie,
  Cell,
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
  ChevronDown,
  Search,
  Loader2,
  Download,
  Inbox,
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
  opsInputClass,
  opsReactSelectStyles,
  opsEmptyStateClass,
} from "../../../../shared/ui/operationsStyles";
import { useI18n } from "../../../../i18n";
import { getQuarterSampleInfo } from "../../../../sample/quarterSample";
import VehicleAnalyticsPage from "../../../fleet-operations/pages/VehicleAnalyticsPage";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

// Soft-toned toolbar buttons: Search (light green), Export (light blue),
// Reset (light red) — consistent shell, tone differs per action.
const searchButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-100 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-200 active:scale-95 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed";
const exportButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-100 px-3.5 py-2.5 text-xs font-semibold text-sky-700 transition-all hover:bg-sky-200 active:scale-95 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed";
const resetButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-100 px-3.5 py-2.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-200 active:scale-95 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed";

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

// ── Chart tooltip — polished card shared by the donut and stacked bars ──────
// White rounded card, color-coded dots, ₹ amounts and each row's share of
// the tooltip total, plus a total footer.
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

export default function CollectionReportPage({ embedded: _embedded = false }: Props) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();

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
  const [exportOpen, setExportOpen] = useState(false);

  // Shop picker: same master shop list + searchable select used across the app
  // (Pending Collections filters, Shop Ledger) — options come from
  // GET /api/masters/shops via useShops.
  const selectStyles = useMemo(() => opsReactSelectStyles(), []);
  const shopOptions = useMemo(
    () => [
      { value: "", label: t("ops.collection.all_shops") },
      ...shops
        .map((s) => ({ value: s.shopName, label: s.shopName }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [shops, t]
  );

  // Backend-authoritative report: totals/percentages/breakdowns come from
  // GET /collection-entry/report. This page only formats and displays them —
  // it must never recompute totals from raw collection rows.
  const [report, setReport] = useState<CollectionReportSummary | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const loadWeekBounds = useCallback(() => {
    return Promise.all([
      collectionService.fetchWeekBounds(),
      getQuarterSampleInfo(),
    ])
      .then(([bounds, sampleInfo]) => {
        // Production keeps the established Monday–Sunday report. The sample
        // preview opens on its complete rolling quarter so the Collection
        // Report and Operations Overview describe the same dataset by default.
        const defaults = sampleInfo
          ? { from: sampleInfo.quarter.fromDate, to: sampleInfo.quarter.toDate }
          : { from: bounds.weekStart, to: bounds.weekEnd };
        setDefaultBounds(defaults);
        setFromDate((prev) => prev || defaults.from);
        setToDate((prev) => prev || defaults.to);
      })
      .catch(() => {
        // Backend unreachable: resolve the initial loading state and surface
        // the error/retry UI below instead of spinning forever.
        setLoading(false);
        setReportError(t("ops.collection.report_load_failed"));
      });
  }, [t]);

  useEffect(() => {
    void loadWeekBounds();
  }, [loadWeekBounds]);

  const loadReport = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setReportError(null);
    try {
      const shopId = shopName ? collectionService.getShopIdForName(shopName) ?? undefined : undefined;
      const data = await collectionService.fetchCollectionReport({
        fromDate,
        toDate,
        shopId,
        collector: collector || undefined,
        paymentMode: paymentMode || undefined,
      });
      setReport(data);
    } catch (error) {
      console.error("Failed to load collection report:", error);
      setReportError(t("ops.collection.report_load_failed"));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, shopName, collector, paymentMode]);

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
    if (othersCount > 0 || paymentMode === "Others") {
      result.push({ mode: "Others", count: othersCount });
    }
    return result;
  }, [report, paymentMode]);

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
      new Set(source.flatMap((r) => Object.keys(r.amounts)))
    ).sort();

    const sorted = [...source].sort((a, b) => b.total - a.total);
    const top4 = sorted.slice(0, 4);
    const rest = sorted.slice(4);

    const rows: any[] = top4.map((r) => {
      const row: any = { collector: r.collector, total: r.total };
      paymentModes.forEach((mode) => {
        row[mode] = r.amounts[mode] || 0;
      });
      return row;
    });

    if (rest.length > 0) {
      const othersRow: any = { collector: `${t("common.other")} (${rest.length})`, total: 0 };
      paymentModes.forEach((mode) => {
        othersRow[mode] = 0;
      });
      rest.forEach((r) => {
        paymentModes.forEach((mode) => {
          othersRow[mode] += r.amounts[mode] || 0;
        });
        othersRow.total += r.total;
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

  const getExportFileName = (ext: "xlsx" | "pdf") => {
    const dateStr = fromDate && toDate ? `${fromDate}_to_${toDate}` : "report";
    return `Collection_Report_${dateStr}.${ext}`;
  };

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

      const collectorRows = collectorSummary.rows.map((row: any) => {
        const obj: any = { [t("common.collector")]: row.collector };
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
    } catch (error) {
      showNotification(t("ops.collection.excel_failed"), "error");
    }
  }, [report, paymentModeSummary, collectorSummary, showNotification, fromDate, toDate, t]);

  const exportPDF = useCallback(async () => {
    if (!report || report.totalCount === 0) {
      showNotification(t("ops.collection.no_data_export"), "error");
      return;
    }
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const margin = 14;
      let y = 20;

      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(t("ops.collection.collection_report_title"), margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`${t("common.from")}: ${fromDate || "N/A"} ${t("common.to")}: ${toDate || "N/A"}`, margin, y);
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
      y = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138);
      doc.text(t("ops.collection.collector_summary"), margin, y);
      y += 5;
      const header = [t("common.collector"), ...collectorSummary.paymentModes, t("common.total")];
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

      // ── Collection Details (transaction rows) ────────────────────────────
      // Rows come from the backend's /collection-entry/recent endpoint
      // (contract endpoint; per shop). Date-range filtering and ordering here
      // are presentation-only — summary totals above remain authoritative.
      try {
        const selectedShopId = shopName
          ? collectionService.getShopIdForName(shopName) ?? null
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
                (row.collectionDate >= fromDate && row.collectionDate <= toDate))
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
    } catch (error) {
      showNotification(t("ops.collection.pdf_failed"), "error");
    }
  }, [report, paymentModeSummary, collectorSummary, showNotification, fromDate, toDate, t, shopName, shops]);

  const resetFilters = useCallback(() => {
    setFromDate(defaultBounds.from);
    setToDate(defaultBounds.to);
    setShopName("");
    setCollector("");
    setPaymentMode("");
    setExportOpen(false);
    showNotification(t("ops.collection.filters_reset_default"), "info");
  }, [defaultBounds, showNotification, t]);

  // Manual Search: re-run the report for the current filters. If the date
  // range is not set yet (week bounds never loaded), re-fetch bounds first —
  // the date-change effect then loads the report automatically.
  const handleSearch = () => {
    if (loading) return;
    setReportError(null);
    if (fromDate && toDate) {
      void loadReport();
    } else {
      setLoading(true);
      void loadWeekBounds();
    }
  };

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
              if (fromDate && toDate) {
                void loadReport();
              } else {
                setLoading(true);
                void loadWeekBounds();
              }
            }}
            className={resetButtonClass}
          >
            <RotateCcw size={14} /> {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  // Content matching the precise structural layout and spacing of RatesEntryPage
  const content = (
    <div className="w-full space-y-5">
      {/* Filter Bar Card — Excel / PDF / Reset / Search sit in the last grid
          cell, right after the Pay Mode filter */}
      <div className={opsFilterCardClass}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            label={t("common.from")}
            className="w-full"
            placeholder={t("placeholder.enter_date")}
            required
          />
          <DatePicker
            value={toDate}
            onChange={setToDate}
            label={t("common.to")}
            className="w-full"
            placeholder={t("placeholder.enter_date")}
            required
          />
          <div>
            <label className={opsFilterLabelClass}>{t("operations.shop_name")}</label>
            <Select
              options={shopOptions}
              value={shopOptions.find((o) => o.value === shopName) ?? shopOptions[0]}
              onChange={(selected) => setShopName(selected?.value || "")}
              isSearchable
              isClearable={false}
              placeholder={t("ops.collection.all_shops")}
              styles={selectStyles}
              menuPortalTarget={document.body}
            />
          </div>
          <div>
            <label className={opsFilterLabelClass}>{t("common.collector")}</label>
            <select
              value={collector}
              onChange={(e) => setCollector(e.target.value)}
              className={opsInputClass}
            >
              <option value="">{t("ops.collection.all_collectors")}</option>
              {collectors.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={opsFilterLabelClass}>{t("operations.payment_mode")}</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className={opsInputClass}
            >
              <option value="">{t("ops.collection.all_modes")}</option>
              <option value="Cash">{t("accounts.cash")}</option>
              <option value="Union Bank">Union Bank</option>
              <option value="HDFC Bank">HDFC Bank</option>
              <option value="Others">{t("common.other")}</option>
            </select>
          </div>

          {/* Actions — after Pay Mode, bottom-aligned with the inputs.
              Search = light green, Export = light blue (Excel & PDF inside),
              Reset = light red. */}
          <div className="flex flex-wrap items-end justify-start gap-2 lg:justify-end">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className={searchButtonClass}
              title={t("common.search")}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {t("common.search")}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                disabled={!report || report.totalCount === 0}
                className={exportButtonClass}
                title={t("common.export")}
              >
                <Download size={15} />
                {t("common.export")}
                <ChevronDown size={14} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setExportOpen(false);
                      exportExcel();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setExportOpen(false);
                      exportPDF();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50"
                  >
                    <FileText size={14} className="text-rose-600" />
                    PDF
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              disabled={loading}
              className={resetButtonClass}
            >
              <RotateCcw size={14} /> {t("common.reset")}
            </button>
          </div>
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
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">{row.mode === "Total" ? t("common.total") : modeDisplay(row.mode)}</td>
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
            <div className="relative h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={modeChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={95}
                    paddingAngle={2}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {modeChartData.map((row) => (
                      <Cell key={row.mode} fill={modeColor(row.mode)} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTipBox totalLabel={t("common.total")} />} />
                  <ChartLegend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("common.total")}</div>
                  <div className="text-sm font-bold text-slate-800">{compactINR(totalCollections)}</div>
                </div>
              </div>
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
                  {collectorSummary.rows.map((row: any, idx: number) => {
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
                            {formatCurrency(row[mode] || 0)}
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

  return (
    <>
      {content}
      <section aria-label="Vehicle analytics" className="w-full px-4 pb-8 sm:px-5 lg:px-6">
        <div className="mx-auto w-full max-w-[1600px]">
          <VehicleAnalyticsPage embedded />
        </div>
      </section>
    </>
  );
}