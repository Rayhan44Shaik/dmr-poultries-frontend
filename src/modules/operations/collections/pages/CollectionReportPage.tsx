// src/modules/collections/pages/CollectionReportPage.tsx

import { useState, useEffect, useMemo, useCallback } from "react";
import { collectionService } from "../services/collectionService";
import type { CollectionReportSummary } from "../types/collection";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import Select from "react-select";
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

const getBarColor = (percentage: number) => {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 50) return "bg-blue-500";
  if (percentage >= 30) return "bg-yellow-500";
  return "bg-red-500";
};

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
  const [weekBounds, setWeekBounds] = useState({ from: "", to: "" });
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
    return collectionService
      .fetchWeekBounds()
      .then((bounds) => {
        setWeekBounds({ from: bounds.weekStart, to: bounds.weekEnd });
        setFromDate((prev) => prev || bounds.weekStart);
        setToDate((prev) => prev || bounds.weekEnd);
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
  const totalCount = report?.totalCount ?? 0;
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

  const exportPDF = useCallback(() => {
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

      doc.save(getExportFileName("pdf"));
      showNotification(t("notification.export_success"), "success");
    } catch (error) {
      showNotification(t("ops.collection.pdf_failed"), "error");
    }
  }, [report, paymentModeSummary, collectorSummary, showNotification, fromDate, toDate, t]);

  const resetFilters = useCallback(() => {
    setFromDate(weekBounds.from);
    setToDate(weekBounds.to);
    setShopName("");
    setCollector("");
    setPaymentMode("");
    setExportOpen(false);
    showNotification(t("ops.collection.filters_reset_default"), "info");
  }, [weekBounds, showNotification, t]);

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
            label={t("common.from") + " *"}
            className="w-full"
            placeholder={t("placeholder.enter_date")}
            required
          />
          <DatePicker
            value={toDate}
            onChange={setToDate}
            label={t("common.to") + " *"}
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

      {/* KPI Cards — all values backend-authoritative */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <Wallet size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("ops.collection.total_collections")}</div>
            <div className="mt-0.5 truncate text-xl font-bold text-slate-800 md:text-2xl">{formatCurrency(totalCollections)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
            <FileText size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("ops.collection.no_of_collections")}</div>
            <div className="mt-0.5 text-xl font-bold text-slate-800 md:text-2xl">{totalCount}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
            <Users size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("ops.collection.total_collectors")}</div>
            <div className="mt-0.5 text-xl font-bold text-slate-800 md:text-2xl">{totalCollectorsCount}</div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">{t("ops.collection.payment_mode")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("ops.collection.no_short")}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("table.amount")}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paymentModeSummary.map((row) => (
                  <tr
                    key={row.mode}
                    className={row.mode === "Total" ? "bg-amber-50/60 font-semibold" : "hover:bg-slate-50/50"}
                  >
                    <td className="px-4 py-3 text-xs text-slate-800">
                      <div className="font-medium">{row.mode === "Total" ? t("common.total") : row.mode}</div>
                      {row.mode !== "Total" && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <Users size={10} />
                          {collectorCountsByMode.find((c) => c.mode === row.mode)?.count ?? 0}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">{row.count}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs font-medium text-slate-700 w-10 text-right">
                          {row.percentage.toFixed(1)}%
                        </span>
                        <div className="w-12 h-2 rounded-full bg-slate-100 overflow-hidden">
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
        </div>

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
                      {mode}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">{t("common.total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {collectorSummary.rows.map((row: any, idx: number) => {
                  const isTotal = row.collector === "Total";
                  return (
                    <tr
                      key={idx}
                      className={isTotal ? "bg-amber-50/60 font-semibold" : "hover:bg-slate-50/50"}
                    >
                      <td className="px-4 py-3 text-xs text-slate-800">{row.collector === "Total" ? t("common.total") : row.collector}</td>
                      {collectorSummary.paymentModes.map((mode: string) => (
                        <td key={mode} className="px-4 py-3 text-right text-xs text-slate-600">
                          {formatCurrency(row[mode] || 0)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800">
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
      )}
    </div>
  );

  return content;
}