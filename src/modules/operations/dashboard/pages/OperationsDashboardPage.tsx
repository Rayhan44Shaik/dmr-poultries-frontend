// src/modules/operations/dashboard/pages/OperationsDashboardPage.tsx

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { addDays, subMonths } from "date-fns";
import { useDashboardData } from "../hooks/useDashboardData";
import KPICards from "../components/KPICards";
import TrendChart from "../components/TrendChart";
import CollectionsPie from "../components/CollectionsPie";
import RecentTripsTable from "../components/RecentTripsTable";
import ActiveCounts from "../components/ActiveCounts";
import PendingCollectionsByShop from "../components/PendingCollectionsByShop";
import PendingApprovalsPanel from "../components/PendingApprovalsPanel";
import { Calendar, CalendarRange, ChevronDown, ArrowRightLeft, RefreshCw } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useI18n } from "../../../../i18n";
import { kickApprovalSnapshot } from "../../../approvals/services/approvalSnapshot";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

// -------- Helper: get previous Monday–Sunday --------
const getPreviousWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day === 0 ? 6 : day - 1) + 7;
  const prevMonday = new Date(today);
  prevMonday.setDate(today.getDate() - diffToMonday);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  return { startDate: prevMonday, endDate: prevSunday };
};

// -------- Helper: today at local midnight (quick-range anchor) --------
const todayMidnight = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// -------- Helper: Format Date to YYYY-MM-DD safely --------
const toInputDateString = (date: Date | undefined): string => {
  if (!date || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// -------- Helper: Parse YYYY-MM-DD string to Date object safely --------
const parseInputDateString = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

// -------- RangeDatePicker Component --------
interface RangeDatePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onRangeChange: (start: Date | undefined, end: Date | undefined) => void;
  placement?: "top" | "bottom";
  className?: string;
}

function RangeDatePicker({
  startDate,
  endDate,
  onRangeChange,
  placement = "bottom",
  className = "",
}: RangeDatePickerProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleStartChange = (dateStr: string) => {
    const newStart = parseInputDateString(dateStr);
    onRangeChange(newStart, endDate);
  };

  const handleEndChange = (dateStr: string) => {
    const newEnd = parseInputDateString(dateStr);
    onRangeChange(startDate, newEnd);
  };

  const startDateStr = toInputDateString(startDate);
  const endDateStr = toInputDateString(endDate);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCalendar = () => setIsOpen(!isOpen);

  const dropdownPositionClass =
    placement === "top"
      ? "bottom-[calc(100%+8px)] mb-1"
      : "top-[calc(100%+8px)] mt-1";

  // ── Quick-range presets (segmented toggle) ────────────────────────────────
  const RANGE_PRESETS = [
    { key: "7d", label: "7D", title: "Last 7 days", start: () => addDays(todayMidnight(), -6) },
    { key: "15d", label: "15D", title: "Last 15 days", start: () => addDays(todayMidnight(), -14) },
    { key: "1m", label: "1M", title: "Last month", start: () => addDays(subMonths(todayMidnight(), 1), 1) },
    { key: "qtr", label: "QTR", title: "Last quarter (3 months)", start: () => addDays(subMonths(todayMidnight(), 3), 1) },
  ] as const;

  const activePreset = RANGE_PRESETS.find((preset) => {
    if (!startDate || !endDate) return false;
    const expected = preset.start();
    return (
      toInputDateString(startDate) === toInputDateString(expected) &&
      toInputDateString(endDate) === toInputDateString(todayMidnight())
    );
  })?.key;

  const applyPreset = (preset: (typeof RANGE_PRESETS)[number]) => {
    onRangeChange(preset.start(), todayMidnight());
    setIsOpen(false);
  };

  const slateCalendarIcon = <Calendar size={15} className="text-emerald-600" />;

  const rangeLabel =
    startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : null;
  const rangeDays =
    startDate && endDate
      ? Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
      : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={toggleCalendar}
        aria-label="Select date range"
        aria-expanded={isOpen}
        className={`group flex h-11 items-center gap-2.5 rounded-xl border bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-emerald-500/10 ${
          isOpen
            ? "border-emerald-400 ring-2 ring-emerald-500/15"
            : "border-slate-200 hover:border-emerald-300 hover:shadow-md"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 transition-transform duration-200 group-hover:scale-105">
          <CalendarRange size={16} strokeWidth={2.2} />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {t("ops.dashboard.select_range")}
          </span>
          <span className="mt-1 whitespace-nowrap text-[12.5px] font-bold tabular-nums text-slate-700">
            {rangeLabel ?? "—"}
          </span>
        </span>
        {rangeDays != null && (
          <span className="ml-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-100">
            {activePreset === "7d"
              ? "7D"
              : activePreset === "15d"
                ? "15D"
                : activePreset === "1m"
                  ? "1M"
                  : activePreset === "qtr"
                    ? "QTR"
                    : `${rangeDays}d`}
          </span>
        )}
        <ChevronDown
          size={15}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-600" : "group-hover:text-emerald-600"}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 w-[min(24rem,calc(100vw-2rem))] animate-scale-in rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-xl shadow-slate-900/10 backdrop-blur-xl ring-1 ring-emerald-500/10 ${dropdownPositionClass}`}
        >
          <div className="space-y-4">
            {/* Quick-range segmented toggle */}
            <div>
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Quick range
              </span>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                {RANGE_PRESETS.map((preset) => {
                  const active = activePreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      title={preset.title}
                      onClick={() => applyPreset(preset)}
                      aria-pressed={active}
                      className={`rounded-lg py-1.5 text-[12.5px] font-extrabold tracking-wide transition-all duration-150 active:scale-95 ${
                        active
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-500 hover:bg-white hover:text-emerald-700"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom dates */}
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                or pick custom dates
              </span>
              <span className="h-px flex-1 bg-slate-100" />
            </div>

            {/* Stacked full-width fields: the shared DatePicker reserves right
                space for its clear/calendar icons, so two narrow columns clip
                the DD/MM/YYYY value. */}
            <div className="grid grid-cols-1 gap-3.5">
              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  {t("ops.dashboard.start_date")}
                </label>
                <DatePicker
                  value={startDateStr}
                  onChange={handleStartChange}
                  placeholder={t("common.from")}
                  className="w-full text-sm"
                  icon={slateCalendarIcon}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  {t("ops.dashboard.end_date")}
                </label>
                <DatePicker
                  value={endDateStr}
                  onChange={handleEndChange}
                  placeholder={t("common.to")}
                  className="w-full text-sm"
                  icon={slateCalendarIcon}
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-3.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Main Dashboard View Page --------
function OperationsDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const initialRange = getPreviousWeekRange();
  const [startDate, setStartDate] = useState<Date | undefined>(initialRange.startDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialRange.endDate);
  const [comparisonPeriod] = useState<"7d" | "15d" | "30d">("7d");

  const { data, previousData, isLoading, error, refetch } = useDashboardData(
    startDate ?? null,
    endDate ?? null,
    comparisonPeriod
  );

  const isRangeSelected = startDate !== undefined && endDate !== undefined;
  const rangeDays = isRangeSelected
    ? Math.ceil((endDate!.getTime() - startDate!.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : undefined;

  const handleRangeChange = (s: Date | undefined, e: Date | undefined) => {
    setStartDate(s);
    setEndDate(e);
  };

  // Manual "refresh everything" — dashboard KPIs/charts AND pending counters.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([refetch(), kickApprovalSnapshot()]);
      showNotification("Dashboard refreshed — pending counts and charts are up to date", "success", 3200);
    } catch {
      showNotification("Could not refresh — please try again", "error", 3200);
    } finally {
      // Keep the spin visible briefly so the tap reads as an action.
      window.setTimeout(() => setRefreshing(false), 450);
    }
  };

  const rangePicker = (
    <RangeDatePicker
      startDate={startDate}
      endDate={endDate}
      onRangeChange={handleRangeChange}
    />
  );

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleRefreshAll}
        disabled={refreshing}
        title="Refresh all data"
        aria-label="Refresh all data"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/70 text-slate-600 transition-all hover:border-emerald-500/50 hover:bg-slate-100/80 hover:text-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 active:scale-[0.96] disabled:opacity-60"
      >
        <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
      </button>
      {rangePicker}
    </>
  );

  if (!isRangeSelected) {
    return (
      <div className={`min-w-0 space-y-4 ${embedded ? "" : "p-4 sm:p-5 lg:p-6"}`}>
        <PendingApprovalsPanel
          actions={headerActions}
        />
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 border border-blue-100 shadow-sm animate-bounce">
              📅
            </div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">{t("ops.dashboard.select_pipeline")}</h3>
            <p className="text-xs font-semibold text-slate-400 mt-2 leading-relaxed">
              {t("ops.dashboard.select_pipeline_hint")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`min-w-0 space-y-5 ${embedded ? "" : "p-4 sm:p-5 lg:p-6"}`}>
        <PendingApprovalsPanel
          actions={headerActions}
        />
        <div className="w-full flex flex-col items-center justify-center py-24 space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
          {t("ops.dashboard.syncing")}
        </p>
      </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-w-0 space-y-4 ${embedded ? "" : "p-4 sm:p-5 lg:p-6"}`}>
        <PendingApprovalsPanel
          actions={headerActions}
        />
        <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6">
          <p className="text-sm font-semibold text-red-700 text-center">{error}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 space-y-5 ${embedded ? "" : "p-4 sm:p-5 lg:p-6"}`}>
      {/* Pending-approval KPIs and date-range filter on one slim row. */}
      <PendingApprovalsPanel
        actions={headerActions}
      />

      <div className="relative z-10">
        <KPICards current={data} previous={previousData} rangeDays={rangeDays} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("ops.dashboard.time_series")}</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">{t("ops.dashboard.operational_trends")}</h3>
            </div>
            <Link to="/operations?tab=vehicle-trips" className="shrink-0 text-[11px] font-bold text-blue-600 hover:underline">View details →</Link>
          </div>
          <div className="w-full overflow-hidden">
            <TrendChart data={data?.trendData || []} />
          </div>
        </div>
        
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("ops.dashboard.credit_allocations")}</span>
            <h3 className="text-sm font-black text-slate-800 mt-0.5">{t("ops.dashboard.outstanding_balances")}</h3>
          </div>
          <div className="w-full overflow-hidden">
            <PendingCollectionsByShop data={data?.pendingCollectionsByShop || []} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("ops.dashboard.payment_breakdown")}</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">{t("ops.dashboard.collection_streams")}</h3>
            </div>
            <Link to="/operations?tab=collections" className="shrink-0 text-[11px] font-bold text-blue-600 hover:underline">View details →</Link>
          </div>
          <div className="w-full flex justify-center items-center py-2 overflow-hidden">
            <CollectionsPie data={data?.collectionsByMode || []} />
          </div>
        </div>
        
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("ops.dashboard.live_infrastructure")}</span>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">{t("ops.dashboard.recent_transit")}</h3>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
              <ArrowRightLeft size={10} className="text-slate-400" /> {t("ops.dashboard.auto_updates")}
            </div>
          </div>
          <div className="w-full overflow-x-auto text-xs rounded-xl border border-slate-100">
            <RecentTripsTable trips={data?.recentTrips || []} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm w-full min-w-0">
        <div className="mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("ops.dashboard.active_ecosystem")}</span>
          <h3 className="text-sm font-black text-slate-800 mt-0.5">{t("ops.dashboard.active_fleet")}</h3>
        </div>
        <ActiveCounts
          vehicles={data?.activeVehicles || 0}
          drivers={data?.activeDrivers || 0}
          helpers={data?.activeHelpers || 0}
          shops={data?.totalShops || 0}
          farms={data?.totalFarms || 0}
        />
      </div>
    </div>
  );
}

export default OperationsDashboardPage;