// src/modules/accounts/pages/MarketRatePage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Save, Tag, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw, AlertCircle, Table2, Sigma, Layers, CalendarRange, RotateCcw } from "lucide-react";
import { DatePicker } from "../../../components/common/DatePicker";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { handleApiError } from "../../../api";
import { useI18n } from "../../../i18n";
import { shiftMonths, toBusinessDate } from "../../../utils/businessDate";
import {
  listMarketRates,
  saveMarketRates,
  marketRateNum,
  type MarketRateInput,
} from "../services/marketRateService";

interface MarketRatePageProps {
  embedded?: boolean;
}

/** Local-timezone date formatter (business dates must never use toISOString,
 * which shifts dates by a day for non-UTC timezones). */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD business date as LOCAL midnight (never UTC). */
function parseLocalDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim());
  if (!match) return new Date(dateStr);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Display a YYYY-MM-DD business date as DD-MM-YYYY (e.g. 31-08-2026). */
function formatDisplayDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${mon}-${d.getFullYear()}`;
}

// Numeric field keys per backend column, grouped by the UI table.
// Backend field order is preserved; only display order/labels are refined.
const SUMMARY_FIELDS = ["vij", "gun", "rp"] as const;
// Company Rates columns in the required display order:
// Sneha / Farmer -> sneha, Ven Vij -> vencobVii, Ven Gun -> vencobGun,
// Ass Vij -> associationVii, Ass Gun -> vencobRate (existing field, relabeled).
const TABLE_ONE_FIELDS = ["sneha", "vencobVii", "vencobGun", "associationVii", "vencobRate"] as const;
const TABLE_TWO_FIELDS = ["c17", "c15", "c13", "c12", "c10"] as const;
const ALL_FIELDS = [...SUMMARY_FIELDS, ...TABLE_ONE_FIELDS, ...TABLE_TWO_FIELDS] as const;

export const MarketRatePage: React.FC<MarketRatePageProps> = ({ embedded = false }) => {
  const { showNotification } = useSafeNotification();
  const { t } = useI18n();

  // Filter tab state ("This Week" selected by default)
  const [activeTab, setActiveTab] = useState<'This Week' | 'Month' | 'Quarter' | 'Custom Range'>('This Week');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'Saved' | 'Saving...' | 'Error'>('Saved');

  // Feedback for Refresh / Clear goes through the ONE global notification
  // system (rendered by <NotificationHost /> in App.tsx). This page previously
  // kept a second, page-local corner toast alongside `showNotification`, so the
  // same screen had two different notification styles. The local state and its
  // JSX have been removed; messages and timing are unchanged.

  // Helper to get current Monday to Sunday dates (local, date-safe)
  const getCurrentWeekRange = (dateObj: Date = new Date()) => {
    const curr = new Date(dateObj);
    const day = curr.getDay();
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);

    const monday = new Date(curr.setDate(diffToMonday));
    const sunday = new Date(curr.setDate(monday.getDate() + 6));

    return { from: formatLocalDate(monday), to: formatLocalDate(sunday) };
  };

  const weekRange = getCurrentWeekRange();
  const [fromDate, setFromDate] = useState(weekRange.from);
  const [toDate, setToDate] = useState(weekRange.to);

  // Function to navigate weeks or months back or forward using the table headers
  //
  // Month/quarter stepping uses `shiftMonths` (calendar-aware) instead of
  // `Date.prototype.setMonth`. `setMonth` silently rolls over when the anchor
  // day does not exist in the target month — e.g. Monday 31 March + 1 month
  // became 1 May, so "Next Month" skipped April entirely and requested a range
  // the user never asked for. `shiftMonths` anchors on the 1st and clamps to
  // the real month length, so every emitted YYYY-MM-DD is a valid calendar
  // date. The API contract (local YYYY-MM-DD strings) is unchanged.
  const handleShiftTime = (direction: 'prev' | 'next') => {
    if (activeTab === 'Month') {
      const shifted = shiftMonths(fromDate, direction === 'next' ? 1 : -1);
      const firstDay = toBusinessDate(new Date(shifted.getFullYear(), shifted.getMonth(), 1));
      // Day 0 of the next month === the last day of this month (never a
      // hard-coded 30/31, so February and 30-day months stay correct).
      const lastDay = toBusinessDate(new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0));
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (activeTab === 'Quarter') {
      const shifted = shiftMonths(fromDate, direction === 'next' ? 3 : -3);
      const firstDay = toBusinessDate(new Date(shifted.getFullYear(), shifted.getMonth(), 1));
      // last day of the (start month + 2) month
      const lastMonth = new Date(shifted.getFullYear(), shifted.getMonth() + 3, 0);
      const lastDay = toBusinessDate(lastMonth);
      setFromDate(firstDay);
      setToDate(lastDay);
    } else {
      const currentMonday = parseLocalDate(fromDate);
      currentMonday.setDate(currentMonday.getDate() + (direction === 'next' ? 7 : -7));
      const newRange = getCurrentWeekRange(currentMonday);
      setFromDate(newRange.from);
      setToDate(newRange.to);
    }
  };

  // Generate date labels dynamically based on date range (Week or Month)
  const [matrixDays, setMatrixDays] = useState<Array<{ label: string; dateStr: string }>>([]);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setMatrixDays([]);
      return;
    }
    const days = [];
    let currentDate = parseLocalDate(fromDate);
    const endDate = parseLocalDate(toDate);

    while (currentDate <= endDate) {
      const dayNum = currentDate.getDate().toString();
      const dateStr = formatLocalDate(currentDate);
      days.push({ label: dayNum, dateStr });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setMatrixDays(days);
  }, [fromDate, toDate]);

  // Large ranges (more than a quarter) are rendered in a vertically
  // scrollable container — the user drags the scrollbar down to reach
  // the remaining days. No "Show more" button; the scrollbar is the
  // affordance. Each table gets a consistent max height.
  const TABLE_MAX_H = "max-h-[520px]";

  // Persistent storage structure for yearly data date-wise (typed records)
  const [tableOneData, setTableOneData] = useState<Record<string, Record<string, string>>>({});
  const [tableTwoData, setTableTwoData] = useState<Record<string, Record<string, string>>>({});
  const [summaryData, setSummaryData] = useState<Record<string, Record<string, string>>>({});

  // Load Market Rates from the PostgreSQL backend whenever the range changes.
  useEffect(() => {
    let cancelled = false;
    if (!fromDate || !toDate) {
      setTableOneData({});
      setTableTwoData({});
      setSummaryData({});
      return;
    }
    setAutoSaveStatus("Saving...");
    void listMarketRates(fromDate, toDate)
      .then((rows) => {
        if (cancelled) return;
        const summary: Record<string, Record<string, string>> = {};
        const tableOne: Record<string, Record<string, string>> = {};
        const tableTwo: Record<string, Record<string, string>> = {};
        for (const row of rows) {
          const date = row.businessDate;
          summary[date] = {};
          for (const key of SUMMARY_FIELDS) summary[date][key] = String(row[key] ?? "");
          tableOne[date] = {};
          for (const key of TABLE_ONE_FIELDS) tableOne[date][key] = String(row[key] ?? "");
          tableTwo[date] = {};
          for (const key of TABLE_TWO_FIELDS) tableTwo[date][key] = String(row[key] ?? "");
        }
        setSummaryData(summary);
        setTableOneData(tableOne);
        setTableTwoData(tableTwo);
        setAutoSaveStatus("Saved");
      })
      .catch((err) => {
        if (cancelled) return;
        setAutoSaveStatus("Error");
        showNotification(
          `Unable to load market rates: ${handleApiError(err)}`,
          "error"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate]);

  // Handlers for updating specific date values dynamically
  const handleTableOneChange = (dateStr: string, field: string, value: string) => {
    setTableOneData(prev => ({
      ...prev,
      [dateStr]: { ...(prev[dateStr] || {}), [field]: value }
    }));
  };

  const handleTableTwoChange = (dateStr: string, field: string, value: string) => {
    setTableTwoData(prev => ({
      ...prev,
      [dateStr]: { ...(prev[dateStr] || {}), [field]: value }
    }));
  };

  const handleSummaryChange = (dateStr: string, field: string, value: string) => {
    setSummaryData(prev => ({
      ...prev,
      [dateStr]: { ...(prev[dateStr] || {}), [field]: value }
    }));
  };

  // Manual explicit save — upserts every non-empty date row into the backend
  const handleManualSave = useCallback(async () => {
    const rows: MarketRateInput[] = [];
    for (const dayObj of matrixDays) {
      const date = dayObj.dateStr;
      const merged = {
        ...(summaryData[date] || {}),
        ...(tableOneData[date] || {}),
        ...(tableTwoData[date] || {}),
      };
      const hasAny = ALL_FIELDS.some((field) => String(merged[field] ?? "").trim() !== "");
      if (!hasAny) continue;

      const payload: MarketRateInput = { businessDate: date };
      for (const field of ALL_FIELDS) {
        const raw = merged[field];
        if (String(raw ?? "").trim() !== "") {
          payload[field] = marketRateNum(raw);
        }
      }
      rows.push(payload);
    }

    if (rows.length === 0) {
      showNotification("Nothing to save. Enter at least one rate first.", "info");
      return;
    }

    setAutoSaveStatus("Saving...");
    try {
      const saved = await saveMarketRates(rows);
      const summary: Record<string, Record<string, string>> = {};
      const tableOne: Record<string, Record<string, string>> = {};
      const tableTwo: Record<string, Record<string, string>> = {};
      for (const row of saved) {
        const date = row.businessDate;
        summary[date] = {};
        for (const key of SUMMARY_FIELDS) summary[date][key] = String(row[key] ?? "");
        tableOne[date] = {};
        for (const key of TABLE_ONE_FIELDS) tableOne[date][key] = String(row[key] ?? "");
        tableTwo[date] = {};
        for (const key of TABLE_TWO_FIELDS) tableTwo[date][key] = String(row[key] ?? "");
      }
      setSummaryData(summary);
      setTableOneData(tableOne);
      setTableTwoData(tableTwo);
      setAutoSaveStatus("Saved");
      showNotification("Market rates saved successfully.", "success");
    } catch (err) {
      setAutoSaveStatus("Error");
      showNotification(`Unable to save market rates: ${handleApiError(err)}`, "error");
    }
  }, [matrixDays, summaryData, tableOneData, tableTwoData, showNotification]);

  // Handle Tab Switching behavior
  const handleTabClick = (tab: 'This Week' | 'Month' | 'Quarter' | 'Custom Range') => {
    setActiveTab(tab);
    if (tab === 'This Week') {
      const range = getCurrentWeekRange();
      setFromDate(range.from);
      setToDate(range.to);
    } else if (tab === 'Month') {
      const date = new Date();
      const firstDay = formatLocalDate(new Date(date.getFullYear(), date.getMonth(), 1));
      const lastDay = formatLocalDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (tab === 'Quarter') {
      const date = new Date();
      const firstDay = formatLocalDate(new Date(date.getFullYear(), date.getMonth(), 1));
      // End of (current month + 2)
      const lastDay = formatLocalDate(new Date(date.getFullYear(), date.getMonth() + 3, 0));
      setFromDate(firstDay);
      setToDate(lastDay);
    }
  };

  const handleClearCustomRange = () => {
    // Clear = reset back to the current week AND flip back to the "This Week"
    // tab so the user immediately sees the default view, not the empty custom
    // range controls.
    const range = getCurrentWeekRange();
    setFromDate(range.from);
    setToDate(range.to);
    setActiveTab('This Week');
    showNotification('Cleared. Showing this week.', 'info');
  };

  // Reusable compact navigation header component for tables
  const prevLabel =
    activeTab === 'Month' ? 'Prev Month' :
    activeTab === 'Quarter' ? 'Prev Quarter' : 'Prev';
  const nextLabel =
    activeTab === 'Month' ? 'Next Month' :
    activeTab === 'Quarter' ? 'Next Quarter' : 'Next';
  const renderTableTimeHeader = () => (
    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
      <button
        onClick={() => handleShiftTime('prev')}
        className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 rounded font-medium text-xs transition-all border-r border-slate-200"
        title={`Previous ${activeTab === 'Month' ? 'Month' : activeTab === 'Quarter' ? 'Quarter' : 'Week'}`}
      >
        <ChevronLeft size={13} />
        <span>{prevLabel}</span>
      </button>
      <button
        onClick={() => handleShiftTime('next')}
        className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 rounded font-medium text-xs transition-all"
        title={`Next ${activeTab === 'Month' ? 'Month' : activeTab === 'Quarter' ? 'Quarter' : 'Week'}`}
      >
        <span>{nextLabel}</span>
        <ChevronRight size={13} />
      </button>
    </div>
  );

  // Shared matrix section header: a coloured icon "logo" chip + title +
  // navigation. `accent` = Tailwind classes for chip bg + icon colour, so each
  // section gets its own identity while staying visually consistent.
  const renderSectionHeader = (
    title: string,
    Icon: React.ComponentType<{ size?: number; className?: string }>,
    accent: { chip: string; icon: string }
  ) => (
    <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
      <div className="flex items-center gap-3">
        <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${accent.chip}`}>
          <Icon size={18} className={accent.icon} />
        </span>
        <h3 className="font-semibold text-slate-800 text-sm leading-tight">{title}</h3>
      </div>
      {renderTableTimeHeader()}
    </div>
  );

  // Shared editable numeric cell
  const renderRateInput = (
    value: string | undefined,
    onChange: (val: string) => void,
    emphasize = false,
    widthClass = 'w-24',
    bold = false
  ) => (
    <input
      type="text"
      inputMode="numeric"
      placeholder="0"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`${widthClass} text-right px-1.5 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-xs ${
        emphasize ? (bold ? 'font-bold text-emerald-600' : 'font-semibold text-emerald-600') : bold ? 'font-bold text-slate-900' : 'text-slate-700'
      }`}
    />
  );

  // Only TODAY's row is highlighted — a single, neat indigo tint + bold so
  // the current day's entries stand out (no "Today" label, just the colour).
  // Computed once from the local business date.
  const todayStr = formatLocalDate(new Date());
  const isToday = (dateStr: string) => dateStr === todayStr;
  const rowClassFor = (dateStr: string) =>
    isToday(dateStr) ? 'bg-indigo-50 font-bold' : 'hover:bg-slate-50/40';

  // Date cell — plain date display.
  const renderDateCell = (dayObj: { label: string; dateStr: string }) => (
    <td className="px-2 py-1.5 border-r border-slate-100 font-medium text-slate-900 text-left whitespace-nowrap">
      {formatDisplayDate(dayObj.dateStr)}
    </td>
  );

  return (
    <div className={`w-full space-y-6 animate-in fade-in duration-500 ${embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'}`}>

      {/* Top Toolbar: search, date range, tabs, refresh, save, status.
         The page-level "Market Rate" title and subtitle live in the
         application's global header, so they are intentionally omitted here. */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-sm rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-[1480px] mx-auto">

          {/* Left group: Date range + Tabs */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-2">
            {/* Date range selector */}
            {activeTab !== 'Custom Range' ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
                <span>{fromDate}</span>
                <span className="text-slate-400">to</span>
                <span>{toDate}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <CalendarRange size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Custom Range</span>
                </div>
                <div className="h-5 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">From</span>
                  <DatePicker value={fromDate} onChange={(d) => setFromDate(d)} placeholder="From date" className="min-w-[140px]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500">To</span>
                  <DatePicker value={toDate} onChange={(d) => setToDate(d)} placeholder="To date" className="min-w-[140px]" />
                </div>
                <button
                  onClick={handleClearCustomRange}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg text-xs transition-colors"
                  title="Clear and show this week"
                >
                  <RotateCcw size={12} /> Clear
                </button>
              </div>
            )}

            {/* Tab navigator */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
              {(['This Week', 'Month', 'Quarter', 'Custom Range'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Right group: auto-save status, refresh, save */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {autoSaveStatus === 'Saved' && <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 size={12}/> Saved</span>}
            {autoSaveStatus === 'Saving...' && <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full"><RefreshCw size={12} className="animate-spin"/> Saving</span>}
            {autoSaveStatus === 'Error' && <span className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-full"><AlertCircle size={12}/> Error</span>}

            {/* Refresh button */}
            <button
              onClick={() => {
                if (fromDate && toDate) {
                  setAutoSaveStatus("Saving...");
                  void listMarketRates(fromDate, toDate)
                    .then((rows) => {
                      // Re-apply the freshly loaded rows to the page state so
                      // the user sees the latest persisted values, then show
                      // one non-blocking global notification.
                      const summary: Record<string, Record<string, string>> = {};
                      const tableOne: Record<string, Record<string, string>> = {};
                      const tableTwo: Record<string, Record<string, string>> = {};
                      for (const row of rows) {
                        const date = row.businessDate;
                        summary[date] = {};
                        for (const key of SUMMARY_FIELDS) summary[date][key] = String(row[key] ?? "");
                        tableOne[date] = {};
                        for (const key of TABLE_ONE_FIELDS) tableOne[date][key] = String(row[key] ?? "");
                        tableTwo[date] = {};
                        for (const key of TABLE_TWO_FIELDS) tableTwo[date][key] = String(row[key] ?? "");
                      }
                      setSummaryData(summary);
                      setTableOneData(tableOne);
                      setTableTwoData(tableTwo);
                      setAutoSaveStatus("Saved");
                      showNotification('Market rates refreshed.', 'success');
                    })
                    .catch((err) => {
                      setAutoSaveStatus("Error");
                      showNotification(
                        `Unable to refresh: ${handleApiError(err)}`,
                        'error'
                      );
                    });
                }
              }}
              className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>

            {/* Save Market Rate button */}
            <button
              onClick={handleManualSave}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Save size={14} />
              <span>Save Rates</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty state when no date range is selected */}
      {(!fromDate || !toDate || matrixDays.length === 0) && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-8 text-center animate-fade-in">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Tag size={24} className="text-slate-500" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base mb-2">No market rates found</h3>
          <p className="text-slate-500 text-sm mb-6">Set a date range to view and manage market rates.</p>
          <button
            onClick={() => {
              setFromDate(weekRange.from);
              setToDate(weekRange.to);
            }}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Save size={14} />
            <span>Select This Week</span>
          </button>
        </div>
      )}

      {/* Tables rendering only when we have dates */}
      {matrixDays.length > 0 && (
        <div className="space-y-6">

          {/* ============================================================ */}
          {/* SECTIONS 1 & 2 — side by side on desktop (Company Rates +    */}
          {/* Additional Metrics), full width stacked on small screens.     */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

          {/* ============================================================ */}
          {/* SECTION 1 — COMPANY RATES MATRIX ENTRY                       */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
            {renderSectionHeader(
              t('marketRates.section.companyRates'),
              Table2,
              { chip: 'bg-emerald-50', icon: 'text-emerald-600' }
            )}
            <div className={`overflow-auto ${TABLE_MAX_H}`}>
              <table className="w-full table-fixed text-center border-collapse sm:text-xs">
                <colgroup>
                  <col className="w-[88px]" />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-2 border-r border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.date')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.snehaFarmer')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.venVij')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.venGun')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.assVij')}</th>
                    <th className="px-1 py-2 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.assGun')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixDays.map((dayObj) => {
                    const rowData = tableOneData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className={`border-b border-slate-100/65 transition-colors ${rowClassFor(dayObj.dateStr)}`}>
                        {renderDateCell(dayObj)}
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['sneha'], (v) => handleTableOneChange(dayObj.dateStr, 'sneha', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['vencobVii'], (v) => handleTableOneChange(dayObj.dateStr, 'vencobVii', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['vencobGun'], (v) => handleTableOneChange(dayObj.dateStr, 'vencobGun', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['associationVii'], (v) => handleTableOneChange(dayObj.dateStr, 'associationVii', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 text-center">{renderRateInput(rowData['vencobRate'], (v) => handleTableOneChange(dayObj.dateStr, 'vencobRate', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================ */}
          {/* SECTION 2 — ADDITIONAL METRICS ENTRY                         */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
            {renderSectionHeader(
              t('marketRates.section.additionalMetrics'),
              Sigma,
              { chip: 'bg-sky-50', icon: 'text-sky-600' }
            )}
            <div className={`overflow-auto ${TABLE_MAX_H}`}>
              <table className="w-full table-fixed text-center border-collapse sm:text-xs">
                <colgroup>
                  <col className="w-[88px]" />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-2 border-r border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.date')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.vij')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.gun')}</th>
                    <th className="px-1 py-2 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.rp')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixDays.map((dayObj) => {
                    const rowData = summaryData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className={`border-b border-slate-100/65 transition-colors ${rowClassFor(dayObj.dateStr)}`}>
                        {renderDateCell(dayObj)}
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['vij'], (v) => handleSummaryChange(dayObj.dateStr, 'vij', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['gun'], (v) => handleSummaryChange(dayObj.dateStr, 'gun', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 text-center">{renderRateInput(rowData['rp'], (v) => handleSummaryChange(dayObj.dateStr, 'rp', v), true, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          </div>
          {/* end of side-by-side grid (Company Rates + Additional Metrics) */}

          {/* ============================================================ */}
          {/* SECTION 3 — SHOP RATES LESS BREAKDOWN ENTRY (full width)         */}
          {/* ============================================================ */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {renderSectionHeader(
              t('marketRates.section.sizeCategoryBreakdown'),
              Layers,
              { chip: 'bg-violet-50', icon: 'text-violet-600' }
            )}
            <div className={`overflow-auto ${TABLE_MAX_H}`}>
              <table className="w-full table-fixed text-center border-collapse sm:text-xs">
                <colgroup>
                  <col className="w-[88px]" />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-2 border-r border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.date')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.c17')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.c15')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.c13')}</th>
                    <th className="px-1 py-2 border-r border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.c12')}</th>
                    <th className="px-1 py-2 text-center font-semibold text-slate-700 whitespace-nowrap">{t('marketRates.col.c10')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixDays.map((dayObj) => {
                    const rowData = tableTwoData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className={`border-b border-slate-100/65 transition-colors ${rowClassFor(dayObj.dateStr)}`}>
                        {renderDateCell(dayObj)}
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['c17'], (v) => handleTableTwoChange(dayObj.dateStr, 'c17', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['c15'], (v) => handleTableTwoChange(dayObj.dateStr, 'c15', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['c13'], (v) => handleTableTwoChange(dayObj.dateStr, 'c13', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 border-r border-slate-100 text-center">{renderRateInput(rowData['c12'], (v) => handleTableTwoChange(dayObj.dateStr, 'c12', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
                        <td className="px-1 py-1.5 text-center">{renderRateInput(rowData['c10'], (v) => handleTableTwoChange(dayObj.dateStr, 'c10', v), false, 'w-full max-w-[60px]', isToday(dayObj.dateStr))}</td>
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
};

export default MarketRatePage;
