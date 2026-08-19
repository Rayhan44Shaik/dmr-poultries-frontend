// src/modules/accounts/pages/MarketRatePage.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Save, Tag, X } from "lucide-react";
import { DatePicker } from "../../../components/common/DatePicker";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import {
  listMarketRates,
  saveMarketRates,
  type MarketRateInput,
  type MarketRateRecord,
} from "../services/marketRateApiService";

interface MarketRatePageProps {
  embedded?: boolean;
}

type Tab = "This Week" | "Month" | "Quarter" | "Custom Range";
type DraftRow = Record<string, string>;
type DraftStore = Record<string, DraftRow>;

const NUMERIC_FIELDS = [
  "vij",
  "gun",
  "rp",
  "sneha",
  "vencobRate",
  "vencobVii",
  "vencobGun",
  "associationVii",
  "c17",
  "c15",
  "c13",
  "c12",
  "c10",
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getWeekRange(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + mondayOffset);
  const sunday = new Date(current);
  sunday.setDate(sunday.getDate() + 6);
  return { from: toIso(current), to: toIso(sunday) };
}

function getMonthRange(date = new Date()) {
  return {
    from: toIso(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

function getQuarterRange(date = new Date()) {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return {
    from: toIso(new Date(date.getFullYear(), quarterStartMonth, 1)),
    to: toIso(new Date(date.getFullYear(), quarterStartMonth + 3, 0)),
  };
}

function buildDays(from: string, to: string) {
  if (!from || !to || from > to) return [] as Array<{ label: string; dateStr: string }>;
  const days: Array<{ label: string; dateStr: string }> = [];
  const current = parseDate(from);
  const end = parseDate(to);
  while (current <= end) {
    const dateStr = toIso(current);
    days.push({ label: String(current.getDate()), dateStr });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function emptyDraft(): DraftRow {
  return Object.fromEntries(NUMERIC_FIELDS.map((field) => [field, ""]));
}

function recordToDraft(row: MarketRateRecord): DraftRow {
  const draft = emptyDraft();
  for (const field of NUMERIC_FIELDS) {
    const value = row[field];
    draft[field] = value === 0 || value == null ? "" : String(value);
  }
  return draft;
}

function draftValue(draft: DraftRow, field: string): string {
  return draft[field] ?? "";
}

function numericValue(value: string): number {
  if (value.trim() === "") return 0;
  return Number(value);
}

function isValidNumeric(value: string): boolean {
  if (value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function toInput(date: string, draft: DraftRow): MarketRateInput {
  return {
    businessDate: date,
    vij: numericValue(draft.vij),
    gun: numericValue(draft.gun),
    rp: numericValue(draft.rp),
    sneha: numericValue(draft.sneha),
    vencobRate: numericValue(draft.vencobRate),
    vencobVii: numericValue(draft.vencobVii),
    vencobGun: numericValue(draft.vencobGun),
    associationVii: numericValue(draft.associationVii),
    c17: numericValue(draft.c17),
    c15: numericValue(draft.c15),
    c13: numericValue(draft.c13),
    c12: numericValue(draft.c12),
    c10: numericValue(draft.c10),
  };
}

export const MarketRatePage: React.FC<MarketRatePageProps> = ({ embedded = false }) => {
  const { showNotification } = useSafeNotification();
  const week = useMemo(() => getWeekRange(), []);
  const [activeTab, setActiveTab] = useState<Tab>("This Week");
  const [fromDate, setFromDate] = useState(week.from);
  const [toDate, setToDate] = useState(week.to);
  const [drafts, setDrafts] = useState<DraftStore>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedRows, setLoadedRows] = useState<MarketRateRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const matrixDays = useMemo(() => buildDays(fromDate, toDate), [fromDate, toDate]);

  const loadRates = useCallback(async () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      setDrafts({});
      setLoadedRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listMarketRates(fromDate, toDate);
      const next: DraftStore = {};
      for (const row of rows) next[row.businessDate] = recordToDraft(row);
      setLoadedRows(rows);
      setDrafts(next);
      setDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load market rates.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const updateCell = useCallback((date: string, field: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [date]: { ...(prev[date] ?? emptyDraft()), [field]: value },
    }));
    setDirty(true);
  }, []);

  const invalidCells = useMemo(() => {
    let count = 0;
    for (const date of matrixDays.map((day) => day.dateStr)) {
      const row = drafts[date] ?? emptyDraft();
      for (const field of NUMERIC_FIELDS) if (!isValidNumeric(row[field] ?? "")) count += 1;
    }
    return count;
  }, [drafts, matrixDays]);

  const handleSave = useCallback(async () => {
    if (invalidCells > 0) {
      showNotification("Please correct invalid market rate values before saving.", "error");
      return;
    }
    if (!matrixDays.length) return;

    setSaving(true);
    try {
      const payload = matrixDays.map((day) => toInput(day.dateStr, drafts[day.dateStr] ?? emptyDraft()));
      const saved = await saveMarketRates(payload);
      const next: DraftStore = {};
      for (const row of saved) next[row.businessDate] = recordToDraft(row);
      setLoadedRows(saved);
      setDrafts(next);
      setDirty(false);
      showNotification("Market rates saved successfully.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save market rates.";
      showNotification(message, "error");
    } finally {
      setSaving(false);
    }
  }, [drafts, invalidCells, matrixDays, showNotification]);

  const setRangeForTab = useCallback((tab: Tab) => {
    const now = new Date();
    if (tab === "This Week") {
      const range = getWeekRange(now);
      setFromDate(range.from);
      setToDate(range.to);
    } else if (tab === "Month") {
      const range = getMonthRange(now);
      setFromDate(range.from);
      setToDate(range.to);
    } else if (tab === "Quarter") {
      const range = getQuarterRange(now);
      setFromDate(range.from);
      setToDate(range.to);
    }
  }, []);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== "Custom Range") setRangeForTab(tab);
  };

  const handleShiftTime = (direction: "prev" | "next") => {
    const base = parseDate(fromDate || toIso(new Date()));
    const sign = direction === "next" ? 1 : -1;
    if (activeTab === "This Week") {
      base.setDate(base.getDate() + sign * 7);
      const range = getWeekRange(base);
      setFromDate(range.from);
      setToDate(range.to);
    } else if (activeTab === "Month") {
      base.setMonth(base.getMonth() + sign);
      const range = getMonthRange(base);
      setFromDate(range.from);
      setToDate(range.to);
    } else if (activeTab === "Quarter") {
      base.setMonth(base.getMonth() + sign * 3);
      const range = getQuarterRange(base);
      setFromDate(range.from);
      setToDate(range.to);
    }
  };

  const rangeLabel = activeTab === "Month" ? "Month" : activeTab === "Quarter" ? "Quarter" : "Week";
  const existingCount = loadedRows.length;

  const renderNavigation = () => (
    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
      <button
        type="button"
        onClick={() => handleShiftTime("prev")}
        disabled={activeTab === "Custom Range" || loading || saving}
        className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white rounded font-medium text-xs transition-all border-r border-slate-200 disabled:opacity-40"
      >
        <ChevronLeft size={13} /> Prev {rangeLabel}
      </button>
      <button
        type="button"
        onClick={() => handleShiftTime("next")}
        disabled={activeTab === "Custom Range" || loading || saving}
        className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:bg-white rounded font-medium text-xs transition-all disabled:opacity-40"
      >
        Next {rangeLabel} <ChevronRight size={13} />
      </button>
    </div>
  );

  const renderMatrix = (
    title: string,
    fields: Array<{ key: string; label: string }>,
    columnsClass = "grid-cols-1 xl:grid-cols-2"
  ) => (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        </div>
        {renderNavigation()}
      </div>
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-center border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-100 z-10">
            <tr className="text-slate-700 font-bold border-b border-slate-200">
              <th className="px-3 py-2.5 text-left border-r border-slate-200">Date</th>
              {fields.map((field) => (
                <th key={field.key} className="px-2 py-2.5 border-r border-slate-200 last:border-r-0">{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {matrixDays.length === 0 ? (
              <tr><td colSpan={fields.length + 1} className="py-6 text-slate-400">No dates selected in range.</td></tr>
            ) : (
              matrixDays.map((day) => {
                const row = drafts[day.dateStr] ?? emptyDraft();
                return (
                  <tr key={day.dateStr} className="hover:bg-slate-50/65 transition-colors">
                    <td className="px-3 py-2.5 border-r border-slate-100 text-left font-bold text-slate-900 bg-slate-50/50">{day.dateStr}</td>
                    {fields.map((field) => {
                      const value = draftValue(row, field.key);
                      const invalid = !isValidNumeric(value);
                      return (
                        <td key={field.key} className="px-1 py-2 border-r border-slate-100 last:border-r-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            placeholder="0"
                            disabled={loading || saving}
                            onChange={(event) => updateCell(day.dateStr, field.key, event.target.value)}
                            className={`w-20 text-center px-1.5 py-1.5 rounded-md border text-xs outline-none transition-colors ${
                              invalid
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={`w-full space-y-6 animate-in fade-in duration-500 ${embedded ? "" : "px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen"}`}>
      <div className="sticky top-0 z-30 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {(["This Week", "Month", "Quarter", "Custom Range"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabClick(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeTab === tab ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
            {loading ? <RefreshCw size={13} className="text-amber-500 animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600" />}
            <span>{loading ? "Loading from server..." : dirty ? "Unsaved changes" : `Backend synced · ${existingCount} saved date${existingCount === 1 ? "" : "s"}`}</span>
          </div>

          {activeTab !== "Custom Range" ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
              <span>{fromDate}</span><span className="text-slate-400">to</span><span>{toDate}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DatePicker value={fromDate} onChange={setFromDate} placeholder="From date" />
              <DatePicker value={toDate} onChange={setToDate} placeholder="To date" />
              {(fromDate || toDate) && (
                <button type="button" onClick={() => { setFromDate(""); setToDate(""); }} className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-2.5 py-2 rounded-lg text-xs">
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadRates()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium px-3.5 py-2 rounded-lg text-xs disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving || !dirty || invalidCells > 0}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Saving..." : "Save Progress"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {renderMatrix("Additional Metrics Entry (Vij, Gun, R.P)", [
        { key: "vij", label: "Vij" },
        { key: "gun", label: "Gun" },
        { key: "rp", label: "R.P" },
      ])}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {renderMatrix("Company Rates Matrix Entry", [
          { key: "sneha", label: "Sneha" },
          { key: "vencobRate", label: "VenCob Rate" },
          { key: "vencobVii", label: "VenCob Vii" },
          { key: "vencobGun", label: "VenCob Gun" },
          { key: "associationVii", label: "Association Vii" },
        ])}
        {renderMatrix("Size & Category Breakdown Entry", [
          { key: "c17", label: "17" },
          { key: "c15", label: "15" },
          { key: "c13", label: "13" },
          { key: "c12", label: "12" },
          { key: "c10", label: "10" },
        ])}
      </div>

      {dirty && (
        <div className="text-xs text-slate-500 text-right">
          Changes are held in memory until <span className="font-semibold text-emerald-700">Save Progress</span>; saved values are read back from PostgreSQL and are available to Rate Entry.
        </div>
      )}
    </div>
  );
};

export default MarketRatePage;
