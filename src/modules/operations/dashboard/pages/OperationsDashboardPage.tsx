// src/modules/operations/dashboard/pages/OperationsDashboardPage.tsx

import { useState, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { addDays, startOfMonth, subMonths } from "date-fns";
import { useDashboardData } from "../hooks/useDashboardData";
import KPICards from "../components/KPICards";
import OperationalTrendsChart from "../components/OperationalTrendsChart";
import { useOperationalTrends } from "../hooks/useOperationalTrends";
import { granularityForRange, type Granularity } from "../utils/trendSeries";
import CollectionsPie from "../components/CollectionsPie";
import RecentTripsTable from "../components/RecentTripsTable";
import ActiveCounts from "../components/ActiveCounts";
import PendingCollectionsByShop from "../components/PendingCollectionsByShop";
import PendingApprovalsPanel from "../components/PendingApprovalsPanel";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Layers,
  ArrowRightLeft,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useI18n } from "../../../../i18n";
import { kickApprovalSnapshot } from "../../../approvals/services/approvalSnapshot";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

// -------- Helper: render a sample-dataset YYYY-MM-DD as "12 Sep 2026" --------
const formatSampleDate = (value: string, locale = "en-IN"): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
};

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
  // Each preset owns a distinct colour: the sliding thumb, hover tint, live
  // caption, trigger chip and Done button all take that colour when active.
  type PresetTheme = {
    from: string;
    to: string;
    soft: string;
    text: string;
    ring: string;
    hoverText: string;
    hoverIcon: string;
    hoverBg: string;
  };
  const FALLBACK_THEME: PresetTheme = {
    from: "#10b981", to: "#059669", soft: "#ecfdf5", text: "#047857", ring: "#a7f3d0",
    hoverText: "hover:text-emerald-700", hoverIcon: "group-hover/opt:text-emerald-600", hoverBg: "hover:bg-emerald-100/70",
  };
  const RANGE_PRESETS: ReadonlyArray<{
    key: string;
    label: string;
    word: string;
    Icon: typeof CalendarDays;
    start: () => Date;
    theme: PresetTheme;
  }> = [
    {
      key: "7d", label: "7D", word: "Last 7 days", Icon: CalendarDays,
      start: () => addDays(todayMidnight(), -6),
      theme: FALLBACK_THEME,
    },
    {
      key: "15d", label: "15D", word: "Last 15 days", Icon: CalendarClock,
      start: () => addDays(todayMidnight(), -14),
      theme: {
        from: "#0ea5e9", to: "#0284c7", soft: "#f0f9ff", text: "#0369a1", ring: "#bae6fd",
        hoverText: "hover:text-sky-700", hoverIcon: "group-hover/opt:text-sky-600", hoverBg: "hover:bg-sky-100/70",
      },
    },
    {
      key: "1m", label: "1M", word: "Last 1 month", Icon: CalendarRange,
      start: () => addDays(subMonths(todayMidnight(), 1), 1),
      theme: {
        from: "#8b5cf6", to: "#7c3aed", soft: "#f5f3ff", text: "#6d28d9", ring: "#ddd6fe",
        hoverText: "hover:text-violet-700", hoverIcon: "group-hover/opt:text-violet-600", hoverBg: "hover:bg-violet-100/70",
      },
    },
    {
      key: "qtr", label: "QTR", word: "Last quarter", Icon: Layers,
      start: () => addDays(subMonths(todayMidnight(), 3), 1),
      theme: {
        from: "#f59e0b", to: "#d97706", soft: "#fffbeb", text: "#b45309", ring: "#fde68a",
        hoverText: "hover:text-amber-700", hoverIcon: "group-hover/opt:text-amber-600", hoverBg: "hover:bg-amber-100/70",
      },
    },
  ];

  const activePreset = RANGE_PRESETS.find((preset) => {
    if (!startDate || !endDate) return false;
    const expected = preset.start();
    return (
      toInputDateString(startDate) === toInputDateString(expected) &&
      toInputDateString(endDate) === toInputDateString(todayMidnight())
    );
  });

  const applyPreset = (preset: (typeof RANGE_PRESETS)[number]) => {
    onRangeChange(preset.start(), todayMidnight());
    setIsOpen(false);
  };

  const activePresetIndex = RANGE_PRESETS.findIndex((p) => p.key === activePreset?.key);
  const themed = activePresetIndex >= 0;
  const activeTheme = themed ? activePreset!.theme : FALLBACK_THEME;
  const activeWord = themed ? activePreset!.word : "Custom range";

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
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105"
          style={{
            backgroundColor: activeTheme.soft,
            color: activeTheme.text,
            boxShadow: `inset 0 0 0 1px ${activeTheme.ring}`,
          }}
        >
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
          <span
            className="ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums ring-1 ring-inset transition-colors duration-200"
            style={{
              backgroundColor: activeTheme.soft,
              color: activeTheme.text,
              boxShadow: `inset 0 0 0 1px ${activeTheme.ring}`,
            }}
          >
            {themed ? activePreset!.label : `${rangeDays}d`}
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
            {/* Quick-range segmented toggle with a sliding indicator */}
            <div>
              <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Quick range
              </span>
              <div
                role="tablist"
                aria-label="Quick date range"
                className="relative grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 transition-colors duration-200"
                style={themed ? { backgroundColor: activeTheme.soft } : undefined}
              >
                {/* Sliding colour thumb (cell width + gap accounted for); its
                    gradient swaps to the active preset's colour as it slides. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-1.25rem)/4)] rounded-lg ring-1 ring-inset ring-white/25 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  style={{
                    ["--i" as string]: String(Math.max(activePresetIndex, 0)),
                    transform: "translateX(calc(var(--i) * (100% + 0.25rem)))",
                    backgroundImage: `linear-gradient(to bottom right, ${activeTheme.from}, ${activeTheme.to})`,
                    boxShadow: `0 2px 8px -2px ${activeTheme.from}99`,
                    opacity: themed ? 1 : 0,
                  } as CSSProperties}
                />
                {RANGE_PRESETS.map((preset) => {
                  const active = activePreset?.key === preset.key;
                  const PresetIcon = preset.Icon;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      role="tab"
                      title={preset.word}
                      onClick={() => applyPreset(preset)}
                      aria-pressed={active}
                      aria-selected={active}
                      className={`group/opt relative z-10 flex items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-extrabold tracking-wide transition-colors duration-200 active:scale-95 motion-reduce:transition-none ${
                        active
                          ? "text-white"
                          : `text-slate-500 ${preset.theme.hoverBg} ${preset.theme.hoverText}`
                      }`}
                    >
                      <PresetIcon
                        size={13}
                        strokeWidth={2.4}
                        className={
                          active
                            ? "text-white"
                            : `text-slate-400 transition-colors ${preset.theme.hoverIcon}`
                        }
                      />
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {/* Live description of the current selection */}
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                <span
                  className="h-1.5 w-1.5 rounded-full transition-colors duration-200"
                  style={{ backgroundColor: themed ? activeTheme.from : "#cbd5e1" }}
                />
                <span
                  className="font-bold transition-colors duration-200"
                  style={{ color: themed ? activeTheme.text : "#475569" }}
                >
                  {activeWord}
                </span>
                {rangeLabel && <span className="tabular-nums text-slate-400">· {rangeLabel}</span>}
              </p>
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
                className="rounded-lg px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${activeTheme.from}, ${activeTheme.to})`,
                  boxShadow: `0 2px 8px -2px ${activeTheme.from}80`,
                }}
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

/** The three quick windows the chips offer. */
type TrendPreset = "today" | "week" | "month";

/** The window the Operational Trends card reads. `null` means "follow the
 *  global calendar" — that is the default, and it is never remembered. */
type TrendView = TrendPreset | null;

/** Today is one day, a week is the last seven days, a month is the calendar
 *  month to date — the same windows the trip counters count, so the number on
 *  a chip is the number the card then totals. */
const windowForView = (view: TrendPreset): { from: string; to: string } => {
  const today = todayMidnight();
  const to = toInputDateString(today);
  if (view === "today") return { from: to, to };
  if (view === "week") return { from: toInputDateString(addDays(today, -6)), to };
  return { from: toInputDateString(startOfMonth(today)), to };
};

/** A day-by-day reading for today and a week, a week-by-week one for a month. */
const GRANULARITY_BY_VIEW: Record<TrendPreset, Granularity> = {
  today: "daily",
  week: "daily",
  month: "weekly",
};

/** "6 Sep – 12 Sep 2026", or a single day when the window is one day. */
const windowLabel = (from: string, to: string, locale = "en-IN"): string => {
  if (!from || !to) return "";
  if (from === to) return formatSampleDate(from, locale);
  const start = formatSampleDate(from, locale);
  const end = formatSampleDate(to, locale);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${start.replace(/\s*\d{4}$/, "")} – ${end}`
    : `${start} – ${end}`;
};

/** One soft accent per chip — today reads sky, week violet, month teal. */
const VIEW_ACCENT: Record<TrendPreset, { active: string; icon: typeof CalendarDays }> = {
  today: { active: "bg-sky-50 text-sky-700 ring-sky-200", icon: CalendarDays },
  week: { active: "bg-violet-50 text-violet-700 ring-violet-200", icon: CalendarRange },
  month: { active: "bg-teal-50 text-teal-700 ring-teal-200", icon: Calendar },
};

/** The calendar's own range reads slate — it is the default, not a preset. */
const CALENDAR_ACCENT = {
  active: "bg-slate-100 text-slate-700 ring-slate-200",
  icon: SlidersHorizontal,
};

/**
 * Segmented switcher sitting in the card header. Each option carries its trip
 * count, so the numbers people ask for first are also the control: pick one and
 * the chart re-buckets the calendar's window by day, week or month.
 */
interface TrendViewOption {
  /** `null` is the calendar's own range, offered whenever it is custom. */
  key: TrendView;
  label: string;
  /** `null` when the option is a range rather than a counted window. */
  count: number | null;
}

/**
 * The card's range switcher — a proper segmented control: a rounded track, one
 * solid accent per option, an icon that says which window it is, and the trip
 * count set into the same pill.
 */
function TrendViewSwitcher({
  views,
  active,
  onChange,
  label,
  calendarTitle,
}: {
  views: TrendViewOption[];
  active: TrendView;
  onChange: (next: TrendView) => void;
  label: string;
  calendarTitle: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/70 p-1 shadow-sm"
    >
      {views.map((view) => {
        const selected = view.key === active;
        const accent = view.key ? VIEW_ACCENT[view.key] : CALENDAR_ACCENT;
        const Icon = accent.icon;
        return (
          <button
            key={view.label}
            type="button"
            role="tab"
            aria-selected={selected}
            /* Tapping the lit chip lets go of the window: back to the calendar. */
            title={selected ? calendarTitle : undefined}
            onClick={() => onChange(selected ? null : view.key)}
            className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-tight ring-1 ring-inset transition-all duration-200 active:scale-[0.97] ${
              selected ? `${accent.active} shadow-sm` : "text-slate-500 ring-transparent hover:bg-white hover:text-slate-700"
            }`}
          >
            <Icon
              size={13}
              strokeWidth={2.4}
              className={
                selected ? "opacity-70" : "text-slate-400 transition-colors group-hover:text-slate-500"
              }
            />
            <span className="whitespace-nowrap">{view.label}</span>
            {view.count == null ? null : (
              <span
                className={`rounded-full px-1.5 py-px text-[10.5px] font-black tabular-nums ${
                  selected ? "bg-white/80" : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {view.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function OperationsDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const { t, language: uiLanguage } = useI18n();
  const trendLocale = uiLanguage === "te" ? "te-IN" : "en-IN";
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

  /* Counters for the chips. They count the SAME completed trips the card can
     weigh — a trip still in transit has no weights yet, so it cannot appear in
     the chart and must not inflate the count beside it. One fetch of the
     smallest window covering today, the week and the month supplies all three,
     so every chip agrees with the totals underneath. */
  const counterToday = toInputDateString(todayMidnight());
  const counterWeekFrom = toInputDateString(addDays(todayMidnight(), -6));
  const counterMonthFrom = toInputDateString(startOfMonth(todayMidnight()));
  const countersQuery = useOperationalTrends(
    (counterWeekFrom < counterMonthFrom ? counterWeekFrom : counterMonthFrom) || undefined,
    counterToday || undefined
  );

  const trendCounts = useMemo(() => {
    const rows = countersQuery.trends?.rows ?? [];
    const day = (value: string) => String(value).slice(0, 10);
    return {
      today: rows.filter((row) => day(row.tripDate) === counterToday).length,
      week: rows.filter((row) => day(row.tripDate) >= counterWeekFrom).length,
      month: rows.filter((row) => day(row.tripDate) >= counterMonthFrom).length,
    };
  }, [countersQuery.trends, counterToday, counterWeekFrom, counterMonthFrom]);

  // Trip counts ride along with the switcher, so the numbers and the control
  // are the same thing.
  const trendViews: TrendViewOption[] = [
    { key: "today", label: t("ops.dashboard.trend.today"), count: trendCounts.today },
    { key: "week", label: t("ops.dashboard.trend.week"), count: trendCounts.week },
    { key: "month", label: t("ops.dashboard.trend.month"), count: trendCounts.month },
  ];

  // The card reads the SAME calendar window as the KPI cards until a chip is
  // tapped; then the whole card — bars and the totals underneath — moves to
  // today, the last seven days or this calendar month. The choice is never
  // remembered, so a reload or a hard refresh lands on the calendar's window.
  const [trendView, setTrendView] = useState<TrendView>(null);
  const calendarFrom = toInputDateString(startDate);
  const calendarTo = toInputDateString(endDate);

  /* The window on screen, handed to the KPI tiles: each tile deep-links to its
     analysis page filtered to these exact dates, and the link also carries the
     equal-length window before them, so the analysis page can compare the same
     way the tiles do. */
  const kpiRange = useMemo(
    () => (calendarFrom && calendarTo ? { from: calendarFrom, to: calendarTo } : null),
    [calendarFrom, calendarTo]
  );

  const calendarKey = `${calendarFrom}:${calendarTo}`;
  const [lastCalendarKey, setLastCalendarKey] = useState(calendarKey);
  if (calendarKey !== lastCalendarKey) {
    setLastCalendarKey(calendarKey);
    setTrendView(null);
  }

  const trendWindow: { from: string; to: string } = trendView
    ? windowForView(trendView)
    : { from: calendarFrom, to: calendarTo };

  const trendsQuery = useOperationalTrends(trendWindow.from || undefined, trendWindow.to || undefined);
  const defaultGranularity = granularityForRange(rangeDays);
  const trendGranularity: Granularity = trendView
    ? GRANULARITY_BY_VIEW[trendView]
    : defaultGranularity;

  // Light the chip the calendar is already showing, so the card and the
  // calendar always agree: an exact match first, then any month-to-date range.
  const calendarMatchesPreset = (["today", "week", "month"] as const).find((view) => {
    const preset = windowForView(view);
    return preset.from === calendarFrom && preset.to === calendarTo;
  });
  /* A calendar that merely SPANS a day, a week or a month lights that chip too,
     even when its dates are not exactly the preset's — if the page is showing a
     week, this card reads a week. The card still totals the calendar's own
     dates until a chip is actually tapped. */
  const activeTrendView: TrendView =
    trendView ??
    calendarMatchesPreset ??
    (rangeDays === 1
      ? "today"
      : rangeDays === 7
        ? "week"
        : rangeDays != null && rangeDays >= 28 && rangeDays <= 31
          ? "month"
          : null);

  // Anything the calendar picked by hand is its own option, so this card can
  // read it too. It carries no count: the presets count trips, while this one
  // is whatever range the calendar holds.
  const trendViewsWithCalendar: TrendViewOption[] = calendarMatchesPreset
    ? trendViews
    : [
        ...trendViews,
        {
          key: null,
          label: t("ops.dashboard.trend.custom"),
          /* While the card is reading the calendar, it already holds the
             count for that range — no second request needed. */
          count: activeTrendView === null ? trendsQuery.trends?.totalTrips ?? null : null,
        },
      ];

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
        <KPICards
          current={data}
          previous={previousData}
          rangeDays={rangeDays}
          range={kpiRange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              {/* The title is the way through to the detail page — no second link. */}
              <Link
                to="/operations?tab=mortality"
                title={t("ops.dashboard.trend.view_mortality")}
                className="group/title mt-0.5 flex items-center gap-1.5"
              >
                <h3 className="text-sm font-black text-slate-800 transition-colors group-hover/title:text-emerald-600">
                  {t("ops.dashboard.trend.title")}
                </h3>
                <ArrowUpRight
                  size={13}
                  strokeWidth={2.6}
                  className="text-slate-300 transition-all duration-150 group-hover/title:-translate-y-[1px] group-hover/title:translate-x-[1px] group-hover/title:text-emerald-600"
                />
              </Link>
              {/* Which window the card is totalling — it moves with the chips.
                  A chip counts every trip in its window; the card can only
                  total the completed ones, so say so when the two differ. */}
              <p className="mt-0.5 text-[10.5px] font-semibold text-slate-400">
                {windowLabel(trendWindow.from, trendWindow.to, trendLocale)}
              </p>
            </div>
            <TrendViewSwitcher
              views={trendViewsWithCalendar}
              active={activeTrendView}
              onChange={setTrendView}
              label={t("ops.dashboard.trend.bucket_by")}
              calendarTitle={t("ops.dashboard.trend.back_to_calendar")}
            />
          </div>
          <div className="w-full overflow-hidden">
            <OperationalTrendsChart
              trends={trendsQuery.trends}
              granularity={trendGranularity}
              loading={trendsQuery.loading}
              error={trendsQuery.error}
              onRetry={trendsQuery.refetch}
            />
          </div>
        </div>
        
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-start gap-4 w-full min-w-0">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("ops.dashboard.credit_allocations")}</span>
            <h3 className="text-sm font-black text-slate-800 mt-0.5">{t("ops.dashboard.outstanding_balances")}</h3>
          </div>
          <div className="w-full overflow-hidden">
            <PendingCollectionsByShop data={data?.pendingCollectionsByShop || []} />
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