// src/modules/accounts/pages/MarketRatePage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Save, Tag, ChevronLeft, ChevronRight, CheckCircle2, X, RefreshCw, AlertCircle } from "lucide-react";
import { DatePicker } from "../../../components/common/DatePicker";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { handleApiError } from "../../../api";
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

// Numeric field keys per backend column, grouped by the UI table.
const SUMMARY_FIELDS = ["vij", "gun", "rp"] as const;
const TABLE_ONE_FIELDS = ["sneha", "vencobRate", "vencobVii", "vencobGun", "associationVii"] as const;
const TABLE_TWO_FIELDS = ["c17", "c15", "c13", "c12", "c10"] as const;
const ALL_FIELDS = [...SUMMARY_FIELDS, ...TABLE_ONE_FIELDS, ...TABLE_TWO_FIELDS] as const;

export const MarketRatePage: React.FC<MarketRatePageProps> = ({ embedded = false }) => {
  const { showNotification } = useSafeNotification();

  // Filter tab state ("This Week" selected by default)
  const [activeTab, setActiveTab] = useState<'This Week' | 'Month' | 'Quarter' | 'Custom Range'>('This Week');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'Saved' | 'Saving...' | 'Error'>('Saved');

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
  const handleShiftTime = (direction: 'prev' | 'next') => {
    if (activeTab === 'Month') {
      const currentFrom = parseLocalDate(fromDate);
      currentFrom.setMonth(currentFrom.getMonth() + (direction === 'next' ? 1 : -1));
      const firstDay = formatLocalDate(new Date(currentFrom.getFullYear(), currentFrom.getMonth(), 1));
      const lastDay = formatLocalDate(new Date(currentFrom.getFullYear(), currentFrom.getMonth() + 1, 0));
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

  // Persistent storage structure for yearly data date-wise (typed records)
  const [tableOneData, setTableOneData] = useState<Record<string, Record<string, string>>>({});
  const [tableTwoData, setTableTwoData] = useState<Record<string, Record<string, string>>>({});
  const [summaryData, setSummaryData] = useState<Record<string, Record<string, string>>>({});

  // Load Market Rates from the PostgreSQL backend whenever the range changes.
  // The backend market_rates table is the single source of truth — the same
  // data Rate Entry reads through its own endpoint.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  // Handlers for updating specific date values dynamically
  const handleTableOneChange = (dateStr: string, field: string, value: string) => {
    setTableOneData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  const handleTableTwoChange = (dateStr: string, field: string, value: string) => {
    setTableTwoData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  const handleSummaryChange = (dateStr: string, field: string, value: string) => {
    setSummaryData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value,
      }
    }));
  };

  // Manual explicit save — upserts every non-empty date row into the backend
  // market_rates table (one row per business date; re-saving a date updates it).
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
      // Frontend state is refreshed from the backend's returned (persisted) values.
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
    }
  };

  // Clear custom range filter
  const handleClearCustomRange = () => {
    setFromDate('');
    setToDate('');
  };

  // Reusable compact navigation header component for tables
  const renderTableTimeHeader = () => (
    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
      <button
        onClick={() => handleShiftTime('prev')}
        className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 rounded font-medium text-xs transition-all border-r border-slate-200"
        title={activeTab === 'Month' ? 'Previous Month' : 'Previous Week'}
      >
        <ChevronLeft size={13} />
        <span>{activeTab === 'Month' ? 'Prev Month' : 'Prev'}</span>
      </button>
      <button
        onClick={() => handleShiftTime('next')}
        className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 rounded font-medium text-xs transition-all"
        title={activeTab === 'Month' ? 'Next Month' : 'Next Week'}
      >
        <span>{activeTab === 'Month' ? 'Next Month' : 'Next'}</span>
        <ChevronRight size={13} />
      </button>
    </div>
  );

  return (
    <div className={`w-full space-y-6 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'
    }`}>
      {/* Sticky Header with Filter Tabs, Navigation, and Integrated Auto-Save Status */}
      <div className="sticky top-0 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Integrated non-floating save status indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium ${
            autoSaveStatus === 'Error'
              ? 'text-red-700 bg-red-50 border-red-200'
              : 'text-slate-600 bg-slate-50 border-slate-200'
          }`}>
            {autoSaveStatus === 'Saving...' ? (
              <RefreshCw size={13} className="text-amber-500 animate-spin" />
            ) : autoSaveStatus === 'Error' ? (
              <AlertCircle size={13} className="text-red-600" />
            ) : (
              <CheckCircle2 size={13} className="text-emerald-600" />
            )}
            <span>
              {autoSaveStatus === 'Saving...'
                ? 'Saving changes...'
                : autoSaveStatus === 'Error'
                  ? 'Failed to sync with server'
                  : 'Synced with server'}
            </span>
          </div>

          {activeTab !== 'Custom Range' ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg text-xs font-semibold text-slate-700">
              <span>{fromDate}</span>
              <span className="text-slate-400">to</span>
              <span>{toDate}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DatePicker
                value={fromDate}
                onChange={(d) => setFromDate(d)}
                placeholder="From date"
              />
              <DatePicker
                value={toDate}
                onChange={(d) => setToDate(d)}
                placeholder="To date"
              />
              {(fromDate || toDate) && (
                <button
                  onClick={handleClearCustomRange}
                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-2.5 py-2 rounded-lg text-xs transition-colors"
                  title="Clear Range"
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleManualSave}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors shadow-sm"
          >
            <Save size={15} />
            Save Progress
          </button>
        </div>
      </div>

      {/* 1. Additional Metrics Entry (Vij, Gun, R.P) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Additional Metrics Entry (Vij, Gun, R.P)</h3>
          </div>
          {renderTableTimeHeader()}
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-center border border-slate-200 text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="text-slate-700 font-bold border-b border-slate-200">
                <th className="px-4 py-2.5 border-r border-slate-200 text-left">Date</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Vij</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Gun</th>
                <th className="px-4 py-2.5">R.P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {matrixDays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-slate-400 text-center">No dates selected in range.</td>
                </tr>
              ) : (
                matrixDays.map((dayObj) => {
                  const rowData = summaryData[dayObj.dateStr] || {};
                  return (
                    <tr key={dayObj.dateStr} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">
                        {dayObj.dateStr}
                      </td>
                      <td className="px-4 py-2.5 border-r border-slate-100">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rowData['vij'] || ''}
                          onChange={(e) => handleSummaryChange(dayObj.dateStr, 'vij', e.target.value)}
                          className="w-28 text-center px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2.5 border-r border-slate-100">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rowData['gun'] || ''}
                          onChange={(e) => handleSummaryChange(dayObj.dateStr, 'gun', e.target.value)}
                          className="w-28 text-center px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rowData['rp'] || ''}
                          onChange={(e) => handleSummaryChange(dayObj.dateStr, 'rp', e.target.value)}
                          className="w-28 text-center px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 text-xs font-medium text-blue-600"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Container for Company Rates & Category Breakdown Matrices */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* 2. Company Rates Matrix Entry */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Tag size={16} className="text-slate-500" />
              Company Rates Matrix Entry
            </h3>
            {renderTableTimeHeader()}
          </div>
          <div className="overflow-x-auto max-h-[500px] flex-1">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="text-slate-700 font-bold border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left border-r border-slate-200">Date</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">Sneha</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">VenCob Rate</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">VenCob Vii</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">VenCob Gun</th>
                  <th className="px-1 py-2.5">Association Vii</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {matrixDays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-slate-400 text-center">No dates selected in range.</td>
                  </tr>
                ) : (
                  matrixDays.map((dayObj) => {
                    const rowData = tableOneData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className="hover:bg-slate-50/65 transition-colors">
                        <td className="px-3 py-2.5 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">
                          {dayObj.dateStr}
                        </td>
                        {(['sneha', 'vencobRate', 'vencobVii', 'vencobGun', 'associationVii']).map((colKey) => (
                          <td key={colKey} className="px-1 py-2 border-r border-slate-100">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={rowData[colKey] || ''}
                              onChange={(e) => handleTableOneChange(dayObj.dateStr, colKey, e.target.value)}
                              className="w-16 text-center px-1 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Size & Category Breakdown Entry */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Tag size={16} className="text-slate-500" />
              Size & Category Breakdown Entry
            </h3>
            {renderTableTimeHeader()}
          </div>
          <div className="overflow-x-auto max-h-[500px] flex-1">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="text-slate-700 font-bold border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left border-r border-slate-200">Date</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">17</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">15</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">13</th>
                  <th className="px-1 py-2.5 border-r border-slate-200">12</th>
                  <th className="px-1 py-2.5">10</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {matrixDays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-slate-400 text-center">No dates selected in range.</td>
                  </tr>
                ) : (
                  matrixDays.map((dayObj) => {
                    const rowData = tableTwoData[dayObj.dateStr] || {};
                    return (
                      <tr key={dayObj.dateStr} className="hover:bg-slate-50/65 transition-colors">
                        <td className="px-3 py-2.5 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">
                          {dayObj.dateStr}
                        </td>
                        {(['c17', 'c15', 'c13', 'c12', 'c10']).map((colKey) => (
                          <td key={colKey} className="px-1 py-2 border-r border-slate-100">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={rowData[colKey] || ''}
                              onChange={(e) => handleTableTwoChange(dayObj.dateStr, colKey, e.target.value)}
                              className="w-16 text-center px-1 py-1 border border-slate-200 rounded focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MarketRatePage;