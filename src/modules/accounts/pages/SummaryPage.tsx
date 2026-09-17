// src/modules/accounts/pages/SummaryPage.tsx

import './SummaryPage.css';
import { analysisWeeks } from '../utils/analysisWeeks';
import { parseBusinessDate } from '../../../utils/businessDate';
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Scale,
  Route,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Calendar,
  CalendarRange,
  ChartPie,
  GitCompareArrows,
  SlidersHorizontal,
} from 'lucide-react';
import { uiFocusRing, uiTransition } from '../../../shared/ui/uiTokens';
import { wrapIndex } from '../../../utils/interaction';
import { format } from 'date-fns';
import { createAnalysisService, EMPTY_ANALYSIS, loadAnalysisSnapshot } from '../services/analysisService';
import { BrandRefreshButton, FilterResetButton, countActiveFilters } from '../../../ui';
import { opsFilterCardClass, opsSecondaryButtonClass } from '../../../shared/ui/operationsStyles';
import { DatePicker } from '../../../components/common/DatePicker';
import { exportPDF, exportExcel } from '../components/Summary';
import SummaryTripViewer from '../components/Summary/SummaryTripViewer';
import SummaryFarmViewer, { SummaryFarmAmount } from '../components/Summary/SummaryFarmViewer';
import { FarmPaymentTripViewModal } from '../components/farm-payment/FarmPaymentTripViewModal';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { WeeklyMetrics, ExpenseBreakdown } from '../types/summary.types';
import type { TripFarmPayment } from '../types/farmPayment.types';
import { useI18n } from '../../../i18n';
import { useLocation } from 'react-router-dom';
import { analysisLinkKey, readAnalysisLink } from '../../../shared/kpi/analysisLink';
import {
  customRange,
  getMonday,
  getSunday,
  isSameMonth,
  monthRange,
  periodForWindow,
  quarterRange,
  toISODate,
  weekRange,
  type PeriodRange,
} from '../utils/periodRanges';

// ---- Helpers ----
const inrGrouped = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Full precision, Indian digit grouping: ₹2,34,500.00 */
const formatCurrencyExact = (amount: number): string => inrGrouped.format(amount || 0);

/** Exact rupees for the hover tip of a money cell (the cell itself shows the compact L/Cr form). */
const moneyHint = (key: string, value: number): string | undefined =>
  key === 'sales' || key === 'collection' || key === 'pending' ? formatCurrencyExact(value) : undefined;

/**
 * Readable magnitude first: ₹99,999 / ₹1.00L / ₹1.00Cr.
 * Anything under a lakh keeps the exact grouped figure, so nothing is rounded
 * away on the small numbers; from 1,00,000 up it switches to lakh, and from
 * 1,00,00,000 up to crore. Every money figure on this page goes through it, so
 * the totals, paid and balance columns always speak the same notation — hover a
 * figure for the exact rupees (see formatCurrencyExact).
 */
const formatCurrency = (amount: number): string => {
  const value = Number(amount) || 0;
  const sign = value < 0 ? '-' : '';
  // Round to paise first: 99,999.999 must not print as "₹1,00,000.00".
  const abs = Math.round(Math.abs(value) * 100) / 100;
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  return `${sign}${inrGrouped.format(abs)}`;
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

const formatSignedCurrency = (amount: number): string => {
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
};

const formatSignedPercent = (percent: number | null): string => {
  if (percent == null) return '—';
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

/* Ranges are written once, not twice: "Jun 19 – 24" rather than
   "Jun 19 - Jun 24", and the year appears only when it actually changes.
   Each variant is short enough to hold one table column on a single line. */
const isSameDay = (a: Date, b: Date): boolean => format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd');
const sameMonth = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const sameYear = (a: Date, b: Date): boolean => a.getFullYear() === b.getFullYear();

/** Compact, no year — table column headers and the small comparison boxes. */
const formatSpanShort = (from: Date, to: Date): string => {
  if (isSameDay(from, to)) return format(from, 'd MMM');
  if (sameMonth(from, to)) return `${format(from, 'd')} – ${format(to, 'd MMM')}`;
  if (sameYear(from, to)) return `${format(from, 'd MMM')} – ${format(to, 'd MMM')}`;
  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
};

/** Full, with the year written once at the end — the filter range chip. */
const formatSpanLong = (from: Date, to: Date): string => {
  if (isSameDay(from, to)) return format(from, 'd MMM yyyy');
  if (sameMonth(from, to)) return `${format(from, 'd')} – ${format(to, 'd MMM yyyy')}`;
  if (sameYear(from, to)) return `${format(from, 'd MMM')} – ${format(to, 'd MMM yyyy')}`;
  return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`;
};

/** "Week 1 (Aug 31 – Sep 6)" -> { name: "Week 1", span: "Aug 31 – Sep 6" }.
    Labels stay whole strings for exports and the trip viewer; only the display
    splits them, so a column can hold its period name and dates on separate
    single lines instead of wrapping one long line mid-range. */
function splitPeriodLabel(label: string): { name: string; span: string } {
  const m = /\s\(([^)]+)\)\s*(.*)$/.exec(label);
  if (!m) return { name: label.trim(), span: '' };
  return { name: label.slice(0, m.index).trim(), span: [m[1], m[2].trim()].filter(Boolean).join(' ') };
}

const getQuarterLabel = (quarter: number): string => {
  const labels = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];
  return labels[quarter - 1] || `Q${quarter}`;
};

const getQuarterRange = (year: number, quarter: number): { start: Date; end: Date } => {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getPreviousRange = (start: Date, end: Date): { start: Date; end: Date } => {
  const diffMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd.getTime() - diffMs);
  previousStart.setHours(0, 0, 0, 0);
  return { start: previousStart, end: previousEnd };
};

const sumExpenseBreakdown = (expense: ExpenseBreakdown): number =>
  Object.values(expense).reduce((a, b) => a + b, 0);

/** Zero-valued breakdown: keeps net profit arithmetic total when a period has
 * no expense row of its own yet. */
const EMPTY_EXPENSES: ExpenseBreakdown = { farm: 0, fuel: 0, trip: 0, salary: 0, maintenance: 0, office: 0 };

/** The trips that carry a farm payment, newest first, each paired with its own
 * farm bill. Used for the whole span and for a single expense-table column, so
 * both are built the same way. */
const buildFarmRows = (
  trips: readonly Trip[],
  summaryService: { getFarmPaymentForTrip: (tripId: number) => TripFarmPayment | undefined }
): { trip: Trip; farm: TripFarmPayment }[] =>
  trips
    .map((trip) => ({ trip, farm: summaryService.getFarmPaymentForTrip(trip.id) }))
    .filter((row): row is { trip: Trip; farm: TripFarmPayment } => Boolean(row.farm))
    .sort(
      (a, b) =>
        String(b.trip.tripDate).localeCompare(String(a.trip.tripDate)) ||
        (b.trip.id ?? 0) - (a.trip.id ?? 0)
    );

const netProfitOfPeriod = (
  metrics: WeeklyMetrics,
  expenses: ExpenseBreakdown | undefined
): number => metrics.sales - sumExpenseBreakdown(expenses ?? EMPTY_EXPENSES);

/**
 * Net-profit cells for the Month / Quarter / Custom comparison columns. The
 * last column is the current period, so it also carries the swing against the
 * period before it — the same treatment the expense rows give their current
 * column. Shared by all three comparison modes so they cannot drift apart.
 */
const netProfitComparisonCells = (
  rows: { metrics: WeeklyMetrics; expenses: ExpenseBreakdown }[]
) =>
  rows.map((row, idx) => {
    const value = netProfitOfPeriod(row.metrics, row.expenses);
    const isCurrent = idx === rows.length - 1;
    const tone = value >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-300';
    if (!isCurrent) {
      return (
        <td
          key={idx}
          title={formatCurrencyExact(value)}
          className={`w-28 px-3 py-2.5 text-center font-bold bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15 ${tone}`}
        >
          {formatCurrency(value)}
        </td>
      );
    }
    const previous = rows[rows.length - 2];
    const prevValue = previous ? netProfitOfPeriod(previous.metrics, previous.expenses) : 0;
    const diff = value - prevValue;
    const pct = prevValue !== 0 ? (diff / Math.abs(prevValue)) * 100 : null;
    return (
      <td
        key={idx}
        title={formatCurrencyExact(value)}
        className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15"
      >
        <div className={tone}>{formatCurrency(value)}</div>
        {(prevValue !== 0 || value !== 0) && (
          <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatSignedCurrency(diff)}
            {pct == null ? '' : ` (${formatSignedPercent(pct)})`}
          </div>
        )}
      </td>
    );
  });

const getTripDistanceKm = (trip: Trip): number => {
  const totalKm = Number(trip.totalKm || 0);
  if (totalKm > 0) return totalKm;

  const openingMeter = Number(trip.openingMeter || 0);
  const closingMeter = Number(trip.closingMeter || 0);
  if (openingMeter > 0 && closingMeter > openingMeter) {
    return closingMeter - openingMeter;
  }

  return 0;
};

// ---- Row colour dots (Accounts Dashboard row names) -------------------------
// Small decorative legend dots rendered beside each row name in the two summary
// tables. Keys match the `key` of each row item defined in the table bodies.
// Hues are chosen so money-in rows read green, loss rows read warm, and every
// name in a table gets its own distinct colour. Class strings are written out in
// full (never interpolated) so Tailwind's scanner picks them up.
const SUMMARY_ROW_DOT: Record<string, string> = {
  trips: 'bg-sky-500',
  birds: 'bg-indigo-500',
  weight: 'bg-violet-500',
  mortality: 'bg-rose-500',
  weightLoss: 'bg-orange-500',
  sales: 'bg-emerald-500',
  collection: 'bg-teal-500',
  pending: 'bg-amber-500',
};

const EXPENSE_ROW_DOT: Record<string, string> = {
  farm: 'bg-lime-600',
  fuel: 'bg-orange-500',
  trip: 'bg-sky-500',
  salary: 'bg-violet-500',
  maintenance: 'bg-cyan-600',
  office: 'bg-slate-400',
  netProfit: 'bg-emerald-600',
  total: 'bg-slate-500 dark:bg-slate-400',
};

/** Column header: period name and date span stay on one line. `tone` matches the amber/emerald column tint. */
function PeriodHeaderLabel({ label, tone }: { label: string; tone: 'prev' | 'curr' | 'plain' }) {
  const { name, span } = splitPeriodLabel(label);
  const badgeClass = tone === 'prev'
    ? 'border-amber-200 bg-amber-100 text-amber-900'
    : tone === 'curr' ? 'border-emerald-200 bg-emerald-100 text-emerald-900'
    : 'border-sky-200 bg-sky-100 text-sky-900';
  return (
    <span className="inline-flex items-center gap-1.5">
      {span && <span className="text-[12px] font-semibold normal-case leading-snug text-slate-700 dark:text-slate-200">{span}</span>}
      <span className={`inline-flex rounded-md border px-2.5 py-1 text-[12px] font-bold normal-case leading-tight ${badgeClass}`}>{name}</span>
    </span>
  );
}

function SummaryRowLabel({
  color,
  label,
  className = 'font-medium text-slate-700 dark:text-slate-200',
}: {
  color: string;
  label: string;
  className?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className={`whitespace-nowrap leading-snug ${className}`}>{label}</span>
    </span>
  );
}

// ---- Period selector: one option per segment --------------------------------
// `icon` is the component reference (not an element) so nothing is created at
// module scope. `labelKey` is resolved through i18n at render time so Telugu
// keeps working. Order here is also the Arrow/Home/End navigation order.
// Month names for the horizontal picker. Same locale/format the previous
// <select> used, so nothing new to translate.
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), 'MMM'));

const PERIOD_TABS = [
  { id: 'week',    labelKey: 'accounts.summary.period.this_week',   icon: CalendarDays,  dot: 'bg-sky-500',    text: 'text-sky-600 dark:text-sky-400' },
  { id: 'month',   labelKey: 'accounts.summary.period.month',       icon: Calendar,      dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'quarter', labelKey: 'accounts.summary.period.quarter',     icon: ChartPie,      dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  // Custom owns teal, deliberately NOT the amber the comparison control uses.
  { id: 'custom',  labelKey: 'accounts.summary.period.custom_range', icon: CalendarRange, dot: 'bg-teal-500',   text: 'text-teal-600 dark:text-teal-400' },
] as const;

type PeriodId = (typeof PERIOD_TABS)[number]['id'];

type SummaryPageProps = { embedded?: boolean };

export default function SummaryPage({ embedded = false }: SummaryPageProps) {
  const [period, setPeriod] = useState<PeriodId>('week');
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [snapshot, setSnapshot] = useState(EMPTY_ANALYSIS);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const summaryService = useMemo(() => createAnalysisService(snapshot), [snapshot]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) { setDataLoading(true); setDataError(null); } });
    void loadAnalysisSnapshot().then(next => {
      if (!cancelled) { setSnapshot(next); setHasLoaded(true); }
    }).catch(error => {
      if (!cancelled) setDataError(error instanceof Error ? error.message : 'Unable to load Account Analysis');
    }).finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [comparePrevious, setComparePrevious] = useState(false);
  const [tripViewerOpen, setTripViewerOpen] = useState(false);
  const [tripViewerTrips, setTripViewerTrips] = useState<Trip[]>([]);
  const [tripViewerLabel, setTripViewerLabel] = useState('');
  /* The farm payment pop-up, scoped to the figure that opened it: a column's own
     trips when an amount in the expense table is pressed, the whole span from
     the card. `null` keeps it shut. */
  const [farmScope, setFarmScope] = useState<{ label: string; trips: Trip[] } | null>(null);
  // The trip picked in that pop-up — opens the Farm Payment page's own trip
  // detail (Step 2 Farm Details + Step 3 Pickup Details).
  const [farmTripView, setFarmTripView] = useState<Trip | null>(null);
  const { t, language } = useI18n();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key && !['vehicleTrips', 'dmr-payments', 'farm_payments'].includes(event.key)) return;
      clearTimeout(timer);
      timer = setTimeout(() => setRefreshKey(value => value + 1), 250);
    };
    window.addEventListener('storage', handleStorage);
    return () => { clearTimeout(timer); window.removeEventListener('storage', handleStorage); };
  }, []);

  /* ---- Arrived from an Operations dashboard KPI tile -----------------------
     Every KPI tile there links here carrying the window it was showing and
     asking for the comparison: ?from=…&to=…&compare=1. The window is applied to
     this page's OWN controls, so the period chips, the custom pickers and the
     Compare toggle all say what the tile said — the chip that can show those
     dates without moving them, Custom otherwise (see periodForWindow), which is
     what keeps "7 days there" exactly 7 days here.
     Adjusting state while rendering (the pattern the operations dashboard uses)
     puts the right window on screen at the first paint, and because it comes
     from the URL a refresh or a shared link lands filtered too. */
  const location = useLocation();
  const analysisLink = useMemo(() => readAnalysisLink(location.search), [location.search]);
  const linkKey = analysisLinkKey(analysisLink);
  const [appliedLinkKey, setAppliedLinkKey] = useState<string | null>(null);
  if (linkKey !== appliedLinkKey) {
    setAppliedLinkKey(linkKey);
    const landing = analysisLink ? periodForWindow(analysisLink.from, analysisLink.to) : null;
    if (analysisLink && landing) {
      setCustomStart(landing.customStart);
      setCustomEnd(landing.customEnd);
      if (landing.weekAnchor) setWeekAnchor(landing.weekAnchor);
      if (landing.monthDate) setSelectedMonthDate(landing.monthDate);
      setPeriod(landing.period);
      setComparePrevious(analysisLink.compare);
    }
  }

  /* The Week chip is a week AROUND an anchor day, not permanently "this" week:
     a window arriving from a dashboard KPI can be last week, and the chevrons
     let anyone walk weeks the way the Month stepper walks months. The anchor
     starts on today, so the page still opens on the current week. */
  const goToPrevWeek = () =>
    setWeekAnchor((prev) => {
      const monday = getMonday(prev);
      monday.setDate(monday.getDate() - 7);
      return monday;
    });
  const goToNextWeek = () =>
    setWeekAnchor((prev) => {
      const monday = getMonday(prev);
      monday.setDate(monday.getDate() + 7);
      return monday;
    });
  const goToThisWeek = () => setWeekAnchor(new Date());

  const goToPrevMonth = () =>
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const selectMonth = (index: number) =>
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), index, 1));
  // ---- Period segmented control: WAI-ARIA radiogroup with automatic activation.
  // Arrow keys move the selection AND focus, so it behaves like a native radio
  // group; only the selected segment is a Tab stop (roving tabindex).
  const periodGroupRef = useRef<HTMLDivElement>(null);

  /* Which dates the selected chip means. The bodies live in utils/periodRanges
     so a window arriving from a dashboard KPI can be matched against them (see
     the deep link below) rather than re-derived here. */
  const getDateRange = useCallback((): PeriodRange => {
    switch (period) {
      case 'week':
        return weekRange(weekAnchor);
      case 'month':
        return monthRange(selectedMonthDate);
      case 'quarter':
        return quarterRange();
      case 'custom':
        return customRange(customStart, customEnd);
      default: {
        const now = new Date();
        return { start: now, end: now };
      }
    }
  }, [period, weekAnchor, selectedMonthDate, customStart, customEnd]);

  const { start, end } = useMemo(getDateRange, [getDateRange]);
  const previousRange = useMemo(() => getPreviousRange(start, end), [start, end]);

  // ---- Custom range wiring -------------------------------------------------
  // The range chip is always on screen; these make switching into Custom a
  // continuation instead of a reset. Entering Custom from This Week / Month /
  // Quarter seeds the pickers with the range already displayed (previously the
  // first click on Custom collapsed everything to today), and an inverted pair
  // is swapped rather than rejected.
  const applyCustomRange = useCallback(
    (nextStart: string, nextEnd: string) => {
      const inverted = Boolean(nextStart && nextEnd && nextStart > nextEnd);
      setCustomStart(inverted ? nextEnd : nextStart);
      setCustomEnd(inverted ? nextStart : nextEnd);
      setPeriod('custom');
    },
    []
  );

  const openCustomFromCurrentRange = useCallback(() => {
    setCustomStart(toISODate(start));
    setCustomEnd(toISODate(end));
    setPeriod('custom');
    setCustomEditorOpen(true);
  }, [start, end]);

  const movePeriodSelection = useCallback(
    (delta: number, edge: 'first' | 'last' | null = null) => {
      const count = PERIOD_TABS.length;
      const found = PERIOD_TABS.findIndex((tab) => tab.id === period);
      const current = found === -1 ? 0 : found;
      const next =
        edge === 'first' ? 0 : edge === 'last' ? count - 1 : wrapIndex(current, count, delta);
      const nextPeriod = PERIOD_TABS[next].id;
      if (nextPeriod === 'custom') openCustomFromCurrentRange();
      else { setPeriod(nextPeriod); setCustomEditorOpen(false); }
      // Note: an explicit `querySelectorAll<T>()` type argument is avoided here —
      // in a .tsx file the parser reads the angle brackets as JSX.
      const radios: HTMLElement[] = periodGroupRef.current
        ? (Array.from(periodGroupRef.current.querySelectorAll('[role="radio"]')) as HTMLElement[])
        : [];
      radios[next]?.focus();
    },
    [period, openCustomFromCurrentRange]
  );

  const handlePeriodGroupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        movePeriodSelection(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        movePeriodSelection(-1);
        break;
      case 'Home':
        event.preventDefault();
        movePeriodSelection(0, 'first');
        break;
      case 'End':
        event.preventDefault();
        movePeriodSelection(0, 'last');
        break;
      default:
        break;
    }
  };

  const activeTone = PERIOD_TABS.find((tab) => tab.id === period) ?? PERIOD_TABS[0];
  /* The week chip only calls itself "This Week" while it is on the current one;
     stepped back (or arrived from a dashboard KPI carrying last week) it reads
     "Week" and the stepper beside it names the dates. */
  const isCurrentWeek = toISODate(getMonday(weekAnchor)) === toISODate(getMonday(new Date()));
  const rangeLabel = formatSpanLong(start, end);
  const groupSpanShort = (group?: { startDate: Date; endDate: Date }): string =>
    group ? formatSpanShort(group.startDate, group.endDate) : '—';

  const rangeDays = useMemo(() => {
    const ms = end.getTime() - start.getTime();
    return ms <= 0 ? 1 : Math.floor(ms / 86400000) + 1;
  }, [start, end]);

  const trips = useMemo(() => {
    void refreshKey;
    return summaryService.getCompletedTripsByDateRange(start, end);
  }, [start, end, refreshKey, summaryService]);

  const collections = useMemo(() => {
    void refreshKey;
    return summaryService.getApprovedCollectionsByDateRange(start, end);
  }, [start, end, refreshKey, summaryService]);

  const previousTrips = useMemo(() => {
    void refreshKey;
    return summaryService.getCompletedTripsByDateRange(previousRange.start, previousRange.end);
  }, [previousRange, refreshKey, summaryService]);

  const previousCollections = useMemo(() => {
    void refreshKey;
    return summaryService.getApprovedCollectionsByDateRange(previousRange.start, previousRange.end);
  }, [previousRange, refreshKey, summaryService]);

  // Two previous weeks range for week-period comparison (Prev W1: 17-23, Prev W2: 24-30 when Current 31-06)
  const previousTwoWeeksRange = useMemo(() => {
    if (period !== 'week') return null;
    const curMonday = getMonday(start);
    const pStart = new Date(curMonday);
    pStart.setDate(curMonday.getDate() - 14);
    pStart.setHours(0, 0, 0, 0);
    const pEnd = new Date(curMonday);
    pEnd.setDate(curMonday.getDate() - 1);
    pEnd.setHours(23, 59, 59, 999);
    return { start: pStart, end: pEnd };
  }, [period, start]);

  const previousTwoWeeksTrips = useMemo(() => {
    void refreshKey;
    if (!previousTwoWeeksRange) return [] as Trip[];
    return summaryService.getCompletedTripsByDateRange(previousTwoWeeksRange.start, previousTwoWeeksRange.end);
  }, [previousTwoWeeksRange, refreshKey, summaryService]);

  const previousTwoWeeksCollections = useMemo(() => {
    void refreshKey;
    if (!previousTwoWeeksRange) return [];
    return summaryService.getApprovedCollectionsByDateRange(previousTwoWeeksRange.start, previousTwoWeeksRange.end);
  }, [previousTwoWeeksRange, refreshKey, summaryService]);

  const computeEffectiveExpenses = useCallback(
    (rangeTrips: Trip[], rangeStart: Date, rangeEnd: Date): ExpenseBreakdown =>
      summaryService.computeEffectiveExpenses(rangeTrips, rangeStart, rangeEnd),
    [summaryService]
  );

  const weeklyGroups = useMemo(() => {
    if (period === 'quarter') {
      const year = new Date().getFullYear();
      const groups = [];
      for (let q = 1; q <= 4; q++) {
        const { start: qStart, end: qEnd } = getQuarterRange(year, q);
        const qTrips = trips.filter((trip) => {
          const d = (parseBusinessDate(trip.tripDate.slice(0, 10)) ?? new Date(NaN));
          return d >= qStart && d <= qEnd;
        });
        groups.push({ label: getQuarterLabel(q), startDate: qStart, endDate: qEnd, trips: qTrips });
      }
      return groups;
    }

    if (period === 'month') {
      const year = selectedMonthDate.getFullYear();
      const month = selectedMonthDate.getMonth();
      const first = new Date(year, month, 1);
      let current = getMonday(first);
      const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
      let weekIndex = 1;
      while (true) {
        const weekStart = new Date(current);
        const weekEnd = getSunday(current);
        if (isSameMonth(weekEnd, new Date(year, month, 1))) {
          const weekTrips = trips.filter((trip) => {
            const d = (parseBusinessDate(trip.tripDate.slice(0, 10)) ?? new Date(NaN));
            return d >= weekStart && d <= weekEnd;
          });
          const label = `Week ${weekIndex} (${formatSpanShort(weekStart, weekEnd)})`;
          groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
          weekIndex++;
        } else {
          if (weekEnd > new Date(year, month + 1, 0)) break;
        }
        current = new Date(weekEnd);
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        if (current > new Date(year, month + 1, 0)) break;
      }
      return groups;
    }

    return analysisWeeks(start, end).map(({ start: weekStart, end: weekEnd }, index) => ({
      label: `Week ${index + 1} (${formatSpanShort(weekStart, weekEnd)})`,
      startDate: weekStart, endDate: weekEnd,
      trips: trips.filter(trip => {
        const date = parseBusinessDate(trip.tripDate.slice(0, 10));
        return date && date >= weekStart && date <= weekEnd;
      }),
    }));
  }, [trips, start, end, period, selectedMonthDate]);

  // ---- Previous week-by-week groups (for side-by-side comparison beside each Week) ----
  const previousWeeklyGroups = useMemo(() => {
    // Quarter: mirror current year quarters but for previous year (previousRange year)
    if (period === 'quarter') {
      const year = previousRange.start.getFullYear();
      const groups = [];
      for (let q = 1; q <= 4; q++) {
        const { start: qStart, end: qEnd } = getQuarterRange(year, q);
        const qTrips = previousTrips.filter((trip) => {
          const d = (parseBusinessDate(trip.tripDate.slice(0, 10)) ?? new Date(NaN));
          return d >= qStart && d <= qEnd;
        });
        groups.push({ label: getQuarterLabel(q), startDate: qStart, endDate: qEnd, trips: qTrips });
      }
      return groups;
    }
    if (period === 'month') {
      const prevMonthDate = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 1, 1);
      const year = prevMonthDate.getFullYear();
      const month = prevMonthDate.getMonth();
      const first = new Date(year, month, 1);
      let current = getMonday(first);
      const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
      let weekIndex = 1;
      while (true) {
        const weekStart = new Date(current);
        const weekEnd = getSunday(current);
        if (isSameMonth(weekEnd, new Date(year, month, 1))) {
          const weekTrips = previousTrips.filter((trip) => {
            const d = (parseBusinessDate(trip.tripDate.slice(0, 10)) ?? new Date(NaN));
            return d >= weekStart && d <= weekEnd;
          });
          const label = `Week ${weekIndex} (${formatSpanShort(weekStart, weekEnd)})`;
          groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
          weekIndex++;
        } else {
          if (weekEnd > new Date(year, month + 1, 0)) break;
        }
        current = new Date(weekEnd);
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        if (current > new Date(year, month + 1, 0)) break;
      }
      return groups;
    }
    if (period === 'week' && previousTwoWeeksRange) {
      // For weekly comparison show exactly two previous weeks beside current week
      // e.g. Current 31 Aug - 06 Sep, Prev W2 24-30 Aug, Prev W1 17-23 Aug
      const curMonday = getMonday(start);
      const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
      for (let offsetWeeks = 2; offsetWeeks >= 1; offsetWeeks--) {
        const weekStart = new Date(curMonday);
        weekStart.setDate(curMonday.getDate() - offsetWeeks * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const weekTrips = previousTwoWeeksTrips.filter((trip) => {
          const d = (parseBusinessDate(trip.tripDate.slice(0, 10)) ?? new Date(NaN));
          return d >= weekStart && d <= weekEnd;
        });
        const prevIndex = 3 - offsetWeeks; // 1 for 14 days ago, 2 for 7 days ago
        const label = `Prev Week ${prevIndex} (${formatSpanShort(weekStart, weekEnd)})`;
        groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      }
      return groups;
    }
    return analysisWeeks(previousRange.start, previousRange.end).map(({ start: weekStart, end: weekEnd }, index) => ({
      label: `Week ${index + 1} (${formatSpanShort(weekStart, weekEnd)})`,
      startDate: weekStart, endDate: weekEnd,
      trips: previousTrips.filter(trip => {
        const date = parseBusinessDate(trip.tripDate.slice(0, 10));
        return date && date >= weekStart && date <= weekEnd;
      }),
    }));
  }, [period, selectedMonthDate, previousTrips, previousRange, previousTwoWeeksRange, previousTwoWeeksTrips, start]);

  const previousWeeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    const sourceCollections = period === 'week' ? previousTwoWeeksCollections : previousCollections;
    return previousWeeklyGroups.map((group) => {
      const groupCollections = sourceCollections.filter((c) => {
        const d = (parseBusinessDate(c.collectionDate.slice(0, 10)) ?? new Date(NaN));
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [previousWeeklyGroups, previousCollections, previousTwoWeeksCollections, period, summaryService]);

  const previousWeeklyExpenses: ExpenseBreakdown[] = useMemo(() => {
    return previousWeeklyGroups.map((group) => computeEffectiveExpenses(group.trips, group.startDate, group.endDate));
  }, [previousWeeklyGroups, computeEffectiveExpenses]);

  // ---- Month / Quarter / Custom comparison: show only last two periods + current when Compare ON ----
  const monthComparisonData = useMemo(() => {
    if (period !== 'month' || !comparePrevious) return null;
    const result: { label: string; start: Date; end: Date; metrics: WeeklyMetrics; expenses: ExpenseBreakdown; distance: number; trips: Trip[] }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      const d = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - offset, 1);
      // Exactly the span the Month chip shows for that month.
      const { start: s, end: e } = monthRange(d);
      const tripsM = summaryService.getCompletedTripsByDateRange(s, e);
      const collM = summaryService.getApprovedCollectionsByDateRange(s, e);
      const metricsM = summaryService.computeMetrics(tripsM, collM);
      const expensesM = computeEffectiveExpenses(tripsM, s, e);
      const distance = tripsM.reduce((sum, tr) => sum + getTripDistanceKm(tr), 0);
      result.push({ label: format(d, 'MMM yyyy'), start: s, end: e, metrics: metricsM, expenses: expensesM, distance, trips: tripsM });
    }
    return result;
  }, [period, comparePrevious, selectedMonthDate, computeEffectiveExpenses, summaryService]);

  const quarterComparisonData = useMemo(() => {
    if (period !== 'quarter' || !comparePrevious) return null;
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const currentYear = now.getFullYear();
    const result: { label: string; start: Date; end: Date; metrics: WeeklyMetrics; expenses: ExpenseBreakdown; distance: number; trips: Trip[] }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      let q = currentQuarter - offset;
      let y = currentYear;
      while (q <= 0) { q += 4; y -= 1; }
      while (q > 4) { q -= 4; y += 1; }
      const { start: s, end: e } = getQuarterRange(y, q);
      const tripsQ = summaryService.getCompletedTripsByDateRange(s, e);
      const collQ = summaryService.getApprovedCollectionsByDateRange(s, e);
      const metricsQ = summaryService.computeMetrics(tripsQ, collQ);
      const expensesQ = computeEffectiveExpenses(tripsQ, s, e);
      const distance = tripsQ.reduce((sum, tr) => sum + getTripDistanceKm(tr), 0);
      result.push({ label: `${getQuarterLabel(q)} ${y}`, start: s, end: e, metrics: metricsQ, expenses: expensesQ, distance, trips: tripsQ });
    }
    return result;
  }, [period, comparePrevious, computeEffectiveExpenses, summaryService]);

  const customComparisonData = useMemo(() => {
    if (period !== 'custom' || !comparePrevious || !customStart || !customEnd) return null;
    const curStart = new Date(customStart); curStart.setHours(0,0,0,0);
    const curEnd = new Date(customEnd); curEnd.setHours(23,59,59,999);
    const days = Math.max(1, Math.floor((curEnd.getTime() - curStart.getTime()) / 86400000) + 1);
    const result: { label: string; start: Date; end: Date; metrics: WeeklyMetrics; expenses: ExpenseBreakdown; distance: number; trips: Trip[] }[] = [];
    for (let offset = 2; offset >= 0; offset--) {
      const s = new Date(curStart);
      s.setDate(curStart.getDate() - offset * days);
      s.setHours(0,0,0,0);
      const e = new Date(s);
      e.setDate(s.getDate() + days - 1);
      e.setHours(23,59,59,999);
      const tripsC = summaryService.getCompletedTripsByDateRange(s, e);
      const collC = summaryService.getApprovedCollectionsByDateRange(s, e);
      const metricsC = summaryService.computeMetrics(tripsC, collC);
      const expensesC = computeEffectiveExpenses(tripsC, s, e);
      const distance = tripsC.reduce((sum, tr) => sum + getTripDistanceKm(tr), 0);
      const simpleLabel = offset === 2 ? `Prev 2` : offset === 1 ? `Prev 1` : `Current`;
      const dateRange = `${format(s,'dd MMM')} - ${format(e,'dd MMM yyyy')}`;
      result.push({ label: `${simpleLabel} (${days}d: ${dateRange})`, start: s, end: e, metrics: metricsC, expenses: expensesC, distance, trips: tripsC });
    }
    return result;
  }, [period, comparePrevious, customStart, customEnd, computeEffectiveExpenses, summaryService]);

  const weeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    return weeklyGroups.map((group) => {
      const groupCollections = collections.filter((c) => {
        const d = (parseBusinessDate(c.collectionDate.slice(0, 10)) ?? new Date(NaN));
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [weeklyGroups, collections, summaryService]);

  const weeklyExpenses: ExpenseBreakdown[] = useMemo(() => {
    return weeklyGroups.map((group) => computeEffectiveExpenses(group.trips, group.startDate, group.endDate));
  }, [weeklyGroups, computeEffectiveExpenses]);

  const totalExpenses = useMemo<ExpenseBreakdown>(() => {
    return computeEffectiveExpenses(trips, start, end);
  }, [trips, start, end, computeEffectiveExpenses]);

  // Compute the range total directly. Pending is clamped per range and is
  // therefore not additive across weeks with excess collections.
  const totalMetrics = useMemo<WeeklyMetrics>(() =>
    summaryService.computeMetrics(trips, collections),
    [trips, collections, summaryService]
  );

  const previousMetrics = useMemo<WeeklyMetrics>(() => {
    return summaryService.computeMetrics(previousTrips, previousCollections);
  }, [previousTrips, previousCollections, summaryService]);

  const previousExpenses = useMemo<ExpenseBreakdown>(() => {
    return computeEffectiveExpenses(previousTrips, previousRange.start, previousRange.end);
  }, [previousTrips, previousRange, computeEffectiveExpenses]);

  const totalExpenseValue = useMemo(() => sumExpenseBreakdown(totalExpenses), [totalExpenses]);
  const previousExpenseValue = useMemo(() => sumExpenseBreakdown(previousExpenses), [previousExpenses]);

  /* ── Farm payments and net profit ──────────────────────────────────────────
     Net profit = shop sales − farm payment − every other expense. The farm
     payment is already the `farm` sector of the expense breakdown (see
     createAnalysisService.computeEffectiveExpenses), so subtracting the expense
     total subtracts it exactly once — never zero times, never twice.
     How much of it has been settled is the Farm Payment page's business — this
     analysis charges the cost, not the cash. */
  /* The rows behind whichever farm figure opened the pop-up: those trips, each
     with its own pickup (DC) weight × farm rate, newest first. Built by the same
     mapping the expense table's Farm Payment figures come from, so a column's
     amount and the trips it opens can never disagree. */
  const farmScopeRows = useMemo(
    () => buildFarmRows(farmScope?.trips ?? [], summaryService),
    [farmScope, summaryService]
  );

  /* Farm totals of a set of trips, cached by the trips array itself: every
     expense-table column asks for this on each render and its trips array is
     memoised, so the WeakMap keeps it to one pass per column. */
  const farmSummaryCache = useRef(new WeakMap<readonly Trip[], { trips: number; weightKg: number }>());
  const farmSummary = useCallback(
    (scopeTrips: readonly Trip[]) => {
      const cached = farmSummaryCache.current.get(scopeTrips);
      if (cached) return cached;
      const rows = buildFarmRows(scopeTrips, summaryService);
      const summary = {
        trips: rows.length,
        weightKg: rows.reduce((sum, row) => sum + (row.farm.dcWeight ?? row.trip.dcWeight ?? 0), 0),
      };
      farmSummaryCache.current.set(scopeTrips, summary);
      return summary;
    },
    [summaryService]
  );

  const totalNetProfit = totalMetrics.sales - totalExpenseValue;

  const weeklyNetProfit = useMemo(
    () => weeklyMetrics.map((metrics, index) => netProfitOfPeriod(metrics, weeklyExpenses[index])),
    [weeklyMetrics, weeklyExpenses]
  );
  const previousWeeklyNetProfit = useMemo(
    () =>
      previousWeeklyMetrics.map((metrics, index) =>
        netProfitOfPeriod(metrics, previousWeeklyExpenses[index])
      ),
    [previousWeeklyMetrics, previousWeeklyExpenses]
  );

  const totalDistanceKm = useMemo(() => trips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0), [trips]);
  const previousDistanceKm = useMemo(() => previousTrips.reduce((sum, trip) => sum + getTripDistanceKm(trip), 0), [previousTrips]);

  const costPerKg = totalMetrics.weight > 0 ? totalExpenseValue / totalMetrics.weight : 0;
  const previousCostPerKg = previousMetrics.weight > 0 ? previousExpenseValue / previousMetrics.weight : 0;
  const costPerKm = totalDistanceKm > 0 ? totalExpenseValue / totalDistanceKm : 0;
  const previousCostPerKm = previousDistanceKm > 0 ? previousExpenseValue / previousDistanceKm : 0;

  const getReportTitle = (): string => {
    const periodLabels: Record<string, string> = {
      week: t('accounts.summary.report_title.week'),
      month: t('accounts.summary.report_title.month', { month: format(selectedMonthDate, 'MMMM yyyy') }),
      quarter: t('accounts.summary.report_title.quarter'),
      custom: t('accounts.summary.report_title.custom'),
    };
    return periodLabels[period] || 'Business Summary';
  };

  const getDateRangeLabel = (): string => {
    return `${format(start, 'dd MMM yyyy')} - ${format(end, 'dd MMM yyyy')}`;
  };

  const openTripViewer = useCallback((viewerTrips: Trip[], label: string) => {
    // Deduplicate by id (defensive), stable order by tripDate then id
    const seen = new Set<number>();
    const deduped: Trip[] = [];
    for (const tr of viewerTrips) {
      if (tr && typeof tr.id === 'number' && !seen.has(tr.id)) {
        seen.add(tr.id);
        deduped.push(tr);
      }
    }
    deduped.sort((a, b) => String(a.tripDate).localeCompare(String(b.tripDate)) || a.id - b.id);
    setTripViewerTrips(deduped);
    setTripViewerLabel(label);
    setTripViewerOpen(true);
  }, []);

  const closeTripViewer = useCallback(() => {
    setTripViewerOpen(false);
  }, []);

  const handleExportPDF = () => {
    if (dataLoading || !hasLoaded) return;
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportPDF(title, dateRange, weeklyGroups, weeklyMetrics, weeklyExpenses, totalMetrics, totalExpenses, { totalDistanceKm });
  };

  const handleExportExcel = () => {
    if (dataLoading || !hasLoaded) return;
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportExcel(title, dateRange, weeklyGroups, weeklyMetrics, weeklyExpenses, totalMetrics, totalExpenses);
  };

  // Comparison shows up as the Previous columns inside the tables themselves —
  // no separate banner in the filter bar.

  return (
    <div className={`account-analysis w-full space-y-5 animate-in fade-in duration-200 ${
      embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 dark:bg-slate-950 min-h-screen'
    }`}>
      <section className={`${opsFilterCardClass} analysis-filters relative`} aria-label={t('common.filter')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 pr-1">
            <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <SlidersHorizontal size={14} strokeWidth={2.2} />
            </span>
            <span className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase dark:text-slate-500">
              {t('common.filter')}
            </span>
          </span>

          {/* Period selector — one segmented control instead of four loose pills.
              The contextual pickers are SIBLINGS of the radiogroup (a non-radio
              child inside role="radiogroup" would be an ARIA violation). */}
          <div
            ref={periodGroupRef}
            role="radiogroup"
            aria-label="Report period"
            onKeyDown={handlePeriodGroupKeyDown}
            className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-700 dark:bg-slate-800/70"
          >
            {PERIOD_TABS.map((tab) => {
              const active = period === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => { if (tab.id === 'custom') openCustomFromCurrentRange(); else { setPeriod(tab.id); setCustomEditorOpen(false); } }}
                  className={[
                    'group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none',
                    uiTransition,
                    uiFocusRing,
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${tab.dot}${active ? ' ring-2 ring-white/70' : ''}`}
                  />
                  <Icon
                    size={14}
                    strokeWidth={2}
                    className={active ? 'text-white' : `${tab.text} opacity-70 group-hover:opacity-100`}
                  />
                  <span>
                    {tab.id === 'week' && !isCurrentWeek
                      ? t('accounts.summary.period.week')
                      : t(tab.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Week stepper — Week period only. Same shape as the month stepper:
              colour dot, step back, the week, step forward. The middle button
              reads the week's own dates and jumps back to the current one, so a
              week arrived-at from a dashboard KPI says which week it is. */}
          {period === 'week' && (
            <div className="relative inline-flex items-center gap-1 rounded-xl border border-sky-200/80 bg-white px-1.5 py-1 dark:border-sky-500/25 dark:bg-slate-800">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
              <button
                type="button"
                onClick={goToPrevWeek}
                aria-label={t('accounts.summary.prev_week')}
                className={`shrink-0 rounded-lg p-1 text-sky-500 outline-none hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-500/15 dark:hover:text-sky-200 ${uiFocusRing} ${uiTransition}`}
              >
                <ChevronLeft size={14} />
              </button>

              <button
                type="button"
                onClick={goToThisWeek}
                title={t('accounts.summary.back_to_this_week')}
                aria-label={t('accounts.summary.back_to_this_week')}
                aria-pressed={isCurrentWeek}
                className={`inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[11px] font-bold outline-none ${uiFocusRing} ${uiTransition} ${
                  isCurrentWeek
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200'
                    : 'text-slate-700 hover:bg-sky-50 dark:text-slate-100 dark:hover:bg-sky-500/15'
                }`}
              >
                <span className="min-w-[4.75rem] whitespace-nowrap text-center">
                  {formatSpanShort(start, end)}
                </span>
              </button>

              <button
                type="button"
                onClick={goToNextWeek}
                aria-label={t('accounts.summary.next_week')}
                className={`shrink-0 rounded-lg p-1 text-sky-500 outline-none hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-500/15 dark:hover:text-sky-200 ${uiFocusRing} ${uiTransition}`}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Month stepper — Month period only, and deliberately month-only: the
              chevrons cross year boundaries, so a year selector is redundant and
              the year already reads in the range chip beside it. One flat box:
              colour dot, step back, the month, step forward. */}
          {period === 'month' && (
            <div
              className="relative inline-flex items-center gap-1 rounded-xl border border-indigo-200/80 bg-white px-1.5 py-1 dark:border-indigo-500/25 dark:bg-slate-800"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setMonthMenuOpen(false);
              }}
            >
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label={t('accounts.summary.prev_month')}
                className={`shrink-0 rounded-lg p-1 text-indigo-500 outline-none hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200 ${uiFocusRing} ${uiTransition}`}
              >
                <ChevronLeft size={14} />
              </button>

              {/* Compact trigger — the names live in the panel below, so the
                  filter bar never grows with the number of months. */}
              <button
                type="button"
                onClick={() => setMonthMenuOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={monthMenuOpen}
                className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-bold text-slate-700 outline-none hover:bg-indigo-50 dark:text-slate-100 dark:hover:bg-indigo-500/15 ${uiFocusRing} ${uiTransition}`}
              >
                <span className="min-w-[2.5rem] text-center">{MONTH_LABELS[selectedMonthDate.getMonth()]}</span>
                <ChevronDown size={11} aria-hidden="true" className={`text-slate-400 ${uiTransition} ${monthMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label={t('accounts.summary.next_month')}
                className={`shrink-0 rounded-lg p-1 text-indigo-500 outline-none hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200 ${uiFocusRing} ${uiTransition}`}
              >
                <ChevronRight size={14} />
              </button>

              {monthMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMonthMenuOpen(false)} />
                  {/* 4 months across × 3 rows — a grid, not a tall list */}
                  <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <div
                      role="group"
                      aria-label={t('accounts.summary.period.month')}
                      className="grid grid-cols-4 gap-1"
                    >
                      {MONTH_LABELS.map((label, index) => {
                        const on = selectedMonthDate.getMonth() === index;
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              selectMonth(index);
                              setMonthMenuOpen(false);
                            }}
                            aria-pressed={on}
                            className={`h-7 rounded-lg text-[11px] font-bold leading-none whitespace-nowrap outline-none ${uiTransition} ${uiFocusRing} ${
                              on
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- Calendar range: always visible and it follows the selection. ---- */}
          {period === 'custom' ? (
            <button type="button" onClick={() => setCustomEditorOpen(true)} aria-expanded={customEditorOpen} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-teal-500/25 dark:bg-teal-500/10 dark:text-slate-200">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <CalendarRange size={14} aria-hidden="true" className="shrink-0 text-teal-600 dark:text-teal-400" />
              <span className="whitespace-nowrap">{rangeLabel}</span>
              <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-200 dark:bg-slate-900 dark:text-teal-300 dark:ring-teal-500/25">{rangeDays}D</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openCustomFromCurrentRange}
              title={t('accounts.summary.period.custom_range')}
              aria-label={rangeLabel}
              className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 ${uiFocusRing} ${uiTransition}`}
            >
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${activeTone.dot}`} />
              <CalendarRange size={14} aria-hidden="true" className={`shrink-0 ${activeTone.text}`} />
              <span>{rangeLabel}</span>
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{rangeDays}D</span>
              <SlidersHorizontal size={12} aria-hidden="true" className="shrink-0 text-slate-300 group-hover:text-emerald-500 dark:text-slate-600" />
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Same animated reset as the Trip List: the icon spins on hover. */}
            <FilterResetButton
              count={countActiveFilters(
                period !== 'week' || !isCurrentWeek,
                comparePrevious,
                customStart !== '' || customEnd !== '',
              )}
              onClick={() => {
                setPeriod('week'); setWeekAnchor(new Date()); setComparePrevious(false);
                setCustomStart(''); setCustomEnd(''); setMonthMenuOpen(false); setExportDropdownOpen(false); setCustomEditorOpen(false);
              }}
            />
            <BrandRefreshButton loading={dataLoading} onClick={() => setRefreshKey(value => value + 1)} />

            <button
              type="button"
              role="switch"
              aria-checked={comparePrevious}
              onClick={() => setComparePrevious((prev) => !prev)}
              className={[
                'analysis-compare inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold outline-none',
                uiTransition,
                uiFocusRing,
                comparePrevious
                  ? 'border-amber-400 bg-amber-100 text-amber-950 ring-2 ring-amber-200/60 shadow-sm dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-100'
                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-400/10 dark:hover:text-amber-200',
              ].join(' ')}
            >
              <GitCompareArrows
                size={14}
                aria-hidden="true"
                className={comparePrevious ? 'text-amber-600 dark:text-amber-400' : 'text-amber-400 dark:text-amber-500'}
              />
              <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${comparePrevious ? 'bg-amber-500' : 'bg-amber-300 dark:bg-amber-400/60'}`}
            />
            <span>{t('accounts.summary.compare_previous')}</span>
              <span
                aria-hidden="true"
                className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 ${uiTransition} ${
                  comparePrevious ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-400/25'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow-sm ${uiTransition} ${
                    comparePrevious ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition whitespace-nowrap border border-emerald-200 dark:border-emerald-500/20"
              >
                <Download size={14} />
                {t('accounts.summary.export')}
                <ChevronDown size={14} className={exportDropdownOpen ? 'rotate-180' : ''} />
              </button>

              {exportDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 z-50 w-44 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        setExportDropdownOpen(false);
                        handleExportPDF();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition"
                    >
                      <FileText size={14} className="text-red-500" /> {t('accounts.summary.export_pdf')}
                    </button>
                    <button
                      onClick={() => {
                        setExportDropdownOpen(false);
                        handleExportExcel();
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700 transition border-t border-slate-100 dark:border-slate-700"
                    >
                      <FileSpreadsheet size={14} className="text-green-600" /> {t('accounts.summary.export_excel')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {customEditorOpen && <>
          <div className="fixed inset-0 z-40" onClick={() => setCustomEditorOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-label={t('accounts.summary.period.custom_range')} onKeyDown={event => { if (event.key === 'Escape') setCustomEditorOpen(false); }} className="absolute left-0 top-full z-50 mt-2 flex max-w-full flex-wrap items-end gap-3 rounded-xl border border-emerald-200 bg-white p-4 shadow-lg dark:bg-slate-900">
            <DatePicker label={t('accounts.summary.start_date')} value={toISODate(start)} onChange={value => { if (value) applyCustomRange(value, toISODate(end)); }} maxDate={toISODate(end)} hideThisWeek language={language} />
            <DatePicker label={t('accounts.summary.end_date')} value={toISODate(end)} onChange={value => { if (value) applyCustomRange(toISODate(start), value); }} minDate={toISODate(start)} hideThisWeek language={language} />
            <button type="button" className={opsSecondaryButtonClass} onClick={() => setCustomEditorOpen(false)}>{t('common.close')}</button>
          </div>
        </>}
      </section>

      {dataError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{dataError}</div>}
      <div className="relative space-y-5" aria-busy={dataLoading} hidden={Boolean(dataError && !hasLoaded)}>
      {dataLoading && <div role="status" aria-live="polite" className="flex min-h-[min(420px,60vh)] items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-16 dark:border-slate-700 dark:bg-slate-900">
        <span className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-500 dark:text-slate-300">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600 motion-reduce:animate-none" aria-hidden="true" />
          {t('accounts.summary.loading_data')}
        </span>
      </div>}
      <div inert={dataLoading} hidden={dataLoading} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Cost / KG – soft light */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500/25 to-transparent" />
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                <Scale size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold tracking-wide text-slate-700 dark:text-slate-200">{t('accounts.summary.cost_per_kg')}</p>
                <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1">{totalMetrics.weight.toFixed(2)} kg • {formatNumber(totalMetrics.birds)} birds</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold tracking-wide text-slate-600 border border-slate-200 dark:border-slate-700">₹/KG</span>
            </div>
            <div className="mt-5 flex flex-wrap items-baseline gap-2.5">
              <p className="text-[32px] font-bold tabular-nums tracking-tight text-slate-900 leading-tight dark:text-slate-50">{totalMetrics.weight > 0 ? formatCurrency(costPerKg) : '—'}</p>
              {comparePrevious && previousCostPerKg > 0 && costPerKg > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold border ${costPerKg <= previousCostPerKg ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                  {costPerKg <= previousCostPerKg ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(((costPerKg - previousCostPerKg)/previousCostPerKg)*100).toFixed(1)}%
                </span>
              )}
            </div>
            {!comparePrevious ? (
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{t('accounts.summary.cost_per_kg_desc')}</p>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">{t('accounts.summary.vs_previous')}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{period === 'week' ? 'Prev W1 • Prev W2' : 'Prev 2 • Prev 1'}</span>
                </div>
                {period === 'week' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const c1 = previousWeeklyMetrics[0] && previousWeeklyExpenses[0] ? (previousWeeklyMetrics[0].weight > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[0]) / previousWeeklyMetrics[0].weight : 0) : 0;
                      const c2 = previousWeeklyMetrics[1] && previousWeeklyExpenses[1] ? (previousWeeklyMetrics[1].weight > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[1]) / previousWeeklyMetrics[1].weight : 0) : 0;
                      return (
                        <>
                          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[11px] font-semibold tracking-widest text-slate-500">PREV W1</div>
                            <div className="text-[12px] text-slate-400">{groupSpanShort(previousWeeklyGroups[0])}</div>
                            <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c1)}</div>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[11px] font-semibold tracking-widest text-slate-500">PREV W2</div>
                            <div className="text-[12px] text-slate-400">{groupSpanShort(previousWeeklyGroups[1])}</div>
                            <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c2)}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : period === 'month' && monthComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {monthComparisonData.slice(0, 2).map((m, idx) => {
                      const c = m.metrics.weight > 0 ? sumExpenseBreakdown(m.expenses) / m.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[11px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[12px] text-slate-400 truncate">{m.label}</div>
                          <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'quarter' && quarterComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {quarterComparisonData.slice(0, 2).map((q, idx) => {
                      const c = q.metrics.weight > 0 ? sumExpenseBreakdown(q.expenses) / q.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[11px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[12px] text-slate-400 truncate">{q.label}</div>
                          <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'custom' && customComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {customComparisonData.slice(0, 2).map((c, idx) => {
                      const cost = c.metrics.weight > 0 ? sumExpenseBreakdown(c.expenses) / c.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[11px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[12px] text-slate-400 truncate">{c.label.split('(')[0].trim()}</div>
                          <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(cost)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Cost / KM – soft light */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500/40 to-transparent" />
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 border border-sky-100 text-sky-700">
                <Route size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold tracking-wide text-slate-700 dark:text-slate-200">{t('accounts.summary.cost_per_km')}</p>
                <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1">{totalDistanceKm.toFixed(1)} km • {totalMetrics.trips} trips</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold tracking-wide text-slate-600 border border-slate-200 dark:border-slate-700">₹/KM</span>
            </div>
            <div className="mt-5 flex flex-wrap items-baseline gap-2.5">
              <p className="text-[32px] font-bold tabular-nums tracking-tight text-slate-900 leading-tight dark:text-slate-50">{totalDistanceKm > 0 ? formatCurrency(costPerKm) : '—'}</p>
              {comparePrevious && previousCostPerKm > 0 && costPerKm > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold border ${costPerKm <= previousCostPerKm ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                  {costPerKm <= previousCostPerKm ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(((costPerKm - previousCostPerKm)/previousCostPerKm)*100).toFixed(1)}%
                </span>
              )}
            </div>
            {!comparePrevious ? (
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{t('accounts.summary.cost_per_km_desc')}</p>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">{t('accounts.summary.vs_previous')}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{period === 'week' ? 'Prev W1 • Prev W2' : 'Prev 2 • Prev 1'}</span>
                </div>
                {period === 'week' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const d1 = previousWeeklyGroups[0]?.trips.reduce((s, tr) => s + getTripDistanceKm(tr), 0) || 0;
                      const d2 = previousWeeklyGroups[1]?.trips.reduce((s, tr) => s + getTripDistanceKm(tr), 0) || 0;
                      const c1 = d1 > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[0] || {farm:0,fuel:0,trip:0,salary:0,maintenance:0,office:0}) / d1 : 0;
                      const c2 = d2 > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[1] || {farm:0,fuel:0,trip:0,salary:0,maintenance:0,office:0}) / d2 : 0;
                      return (
                        <>
                          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[11px] font-semibold tracking-widest text-slate-500">PREV W1</div>
                            <div className="text-[12px] text-slate-400">{groupSpanShort(previousWeeklyGroups[0])}</div>
                            <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c1)}</div>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[11px] font-semibold tracking-widest text-slate-500">PREV W2</div>
                            <div className="text-[12px] text-slate-400">{groupSpanShort(previousWeeklyGroups[1])}</div>
                            <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c2)}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : period === 'month' && monthComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {monthComparisonData.slice(0, 2).map((m, idx) => {
                      const dist = (m as any).distance || 0;
                      const c = dist > 0 ? sumExpenseBreakdown(m.expenses) / dist : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[11px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[12px] text-slate-400 truncate">{m.label}</div>
                          <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'quarter' && quarterComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {quarterComparisonData.slice(0, 2).map((q, idx) => {
                      const dist = (q as any).distance || 0;
                      const c = dist > 0 ? sumExpenseBreakdown(q.expenses) / dist : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[11px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[12px] text-slate-400 truncate">{q.label}</div>
                          <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'custom' && customComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {customComparisonData.slice(0, 2).map((c, idx) => {
                      const dist = (c as any).distance || 0;
                      const cost = dist > 0 ? sumExpenseBreakdown(c.expenses) / dist : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[11px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[12px] text-slate-400 truncate">{c.label.split('(')[0].trim()}</div>
                          <div className="mt-1 text-[14px] font-bold text-slate-800 dark:text-slate-100">{formatCurrency(cost)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('accounts.summary.scope_note')} <strong className="text-emerald-800 dark:text-emerald-300">{rangeLabel}</strong> · {formatNumber(totalMetrics.trips)} {t('accounts.summary.trip_navigation')}</p>
      <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="analysis-table w-full table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="w-56 px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">{t('accounts.summary.weekly_table.particulars')}</th>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyGroups.map((pg, idx) => (
                      <th key={`prev-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-slate-600 bg-amber-50/60 border-l border-amber-200">
                        <PeriodHeaderLabel label={pg.label} tone="prev" />
                        <span className="block text-[9px] font-normal text-amber-700/70">Previous</span>
                      </th>
                    ))}
                    {weeklyGroups.map((g, idx) => (
                      <th key={`curr-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-emerald-700 bg-emerald-50/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                        <PeriodHeaderLabel label={g.label} tone="curr" />
                        <span className="block text-[9px] font-normal text-emerald-700/70">Current</span>
                      </th>
                    ))}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <PeriodHeaderLabel label={m.label} tone="prev" />
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <PeriodHeaderLabel label={q.label} tone="prev" />
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <PeriodHeaderLabel label={c.label} tone="prev" />
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((g, i) => (
                    <th key={i} className="w-28 px-3 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                      <PeriodHeaderLabel label={g.label} tone="plain" />
                    </th>
                  ))
                )}
                {period !== 'week' && !comparePrevious && (
                  <th className="w-20 px-3 py-3 text-center font-semibold text-slate-600 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60">Total</th>
                )}
              </tr>
            </thead>
                        <tbody>
              {[
                { key: 'trips', label: t('accounts.summary.weekly_rows.trips') },
                { key: 'birds', label: t('accounts.summary.weekly_rows.birds') },
                { key: 'weight', label: t('accounts.summary.weekly_rows.weight') },
                { key: 'mortality', label: t('accounts.summary.weekly_rows.mortality') },
                { key: 'weightLoss', label: t('accounts.summary.weekly_rows.weightLoss') },
                { key: 'sales', label: t('accounts.summary.weekly_rows.sales') },
                { key: 'collection', label: t('accounts.summary.weekly_rows.collections') },
                { key: 'pending', label: t('accounts.summary.weekly_rows.pending') },
              ].map((item) => (
                <tr
                  key={item.key}
                  className="group/row border-b border-slate-100 transition-colors duration-150 hover:bg-emerald-50/70 dark:border-slate-800 dark:hover:bg-emerald-500/10"
                >
                  <td className="relative w-56 px-4 py-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-emerald-500 before:opacity-0 before:transition-opacity before:content-[''] group-hover/row:before:opacity-100">
                    <SummaryRowLabel color={SUMMARY_ROW_DOT[item.key]} label={item.label} />
                  </td>
                  {comparePrevious && period === 'week' ? (
                    <>
                      {previousWeeklyMetrics.map((prevM, idx) => {
                        const prevVal = (prevM?.[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        const tripsForCell = previousWeeklyGroups[idx]?.trips || [];
                        const labelForCell = previousWeeklyGroups[idx]?.label || 'Previous';
                        return (
                          <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer(tripsForCell, labelForCell)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(prevVal)}
                              </button>
                            ) : (
                              <span className="text-slate-800 dark:text-slate-200" title={moneyHint(item.key, prevVal)}>{fmt(prevVal)}</span>
                            )}
                          </td>
                        );
                      })}
                      {weeklyMetrics.map((currM, idx) => {
                        const currVal = (currM?.[item.key as keyof WeeklyMetrics] as number) || 0;
                        const prevValForDiff = (previousWeeklyMetrics[previousWeeklyMetrics.length - 1]?.[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        const diff = currVal - prevValForDiff;
                        const pct = prevValForDiff !== 0 ? (diff / Math.abs(prevValForDiff)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const isWeight = item.key === 'weight' || item.key === 'weightLoss';
                        const diffText = isCurrency
                          ? formatSignedCurrency(diff)
                          : `${diff > 0 ? '+' : ''}${isWeight ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        const tripsForCell = weeklyGroups[idx]?.trips || [];
                        const labelForCell = weeklyGroups[idx]?.label || 'Current';
                        return (
                          <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer(tripsForCell, labelForCell)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(currVal)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200" title={moneyHint(item.key, currVal)}>{fmt(currVal)}</div>
                            )}
                            {(prevValForDiff !== 0 || currVal !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevValForDiff !== 0 || currVal !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : comparePrevious && period === 'month' && monthComparisonData ? (
                    <>
                      {monthComparisonData.map((m, idx) => {
                        const isCurrent = idx === monthComparisonData.length - 1;
                        const val = (m.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        if (!isCurrent) {
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">
                              {item.key === 'trips' ? (
                                <button
                                  onClick={() => openTripViewer((m as any).trips || [], m.label)}
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-800 dark:text-slate-200" title={moneyHint(item.key, val)}>{fmt(val)}</span>
                              )}
                            </td>
                          );
                        }
                        const prevVal = (monthComparisonData[monthComparisonData.length - 2]?.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const diff = val - prevVal;
                        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const diffText = isCurrency ? formatSignedCurrency(diff) : `${diff > 0 ? '+' : ''}${ (item.key === 'weight' || item.key === 'weightLoss') ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer((m as any).trips || [], m.label)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(val)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200" title={moneyHint(item.key, val)}>{fmt(val)}</div>
                            )}
                            {(prevVal !== 0 || val !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevVal !== 0 || val !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                    <>
                      {quarterComparisonData.map((q, idx) => {
                        const isCurrent = idx === quarterComparisonData.length - 1;
                        const val = (q.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        if (!isCurrent) {
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">
                              {item.key === 'trips' ? (
                                <button
                                  onClick={() => openTripViewer((q as any).trips || [], q.label)}
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-800 dark:text-slate-200" title={moneyHint(item.key, val)}>{fmt(val)}</span>
                              )}
                            </td>
                          );
                        }
                        const prevVal = (quarterComparisonData[quarterComparisonData.length - 2]?.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const diff = val - prevVal;
                        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const diffText = isCurrency ? formatSignedCurrency(diff) : `${diff > 0 ? '+' : ''}${ (item.key === 'weight' || item.key === 'weightLoss') ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer((q as any).trips || [], q.label)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(val)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200" title={moneyHint(item.key, val)}>{fmt(val)}</div>
                            )}
                            {(prevVal !== 0 || val !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevVal !== 0 || val !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : comparePrevious && period === 'custom' && customComparisonData ? (
                    <>
                      {customComparisonData.map((c, idx) => {
                        const isCurrent = idx === customComparisonData.length - 1;
                        const val = (c.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const fmt = (v: number) => {
                          if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                          if (item.key === 'weight' || (item as any).key === 'weightLoss' || item.key === 'weightLoss') return v.toFixed(2);
                          return formatNumber(v);
                        };
                        if (!isCurrent) {
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">
                              {item.key === 'trips' ? (
                                <button
                                  onClick={() => openTripViewer((c as any).trips || [], c.label)}
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-800 dark:text-slate-200" title={moneyHint(item.key, val)}>{fmt(val)}</span>
                              )}
                            </td>
                          );
                        }
                        const prevVal = (customComparisonData[customComparisonData.length - 2]?.metrics[item.key as keyof WeeklyMetrics] as number) || 0;
                        const diff = val - prevVal;
                        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : null;
                        const isCurrency = item.key === 'sales' || item.key === 'collection' || item.key === 'pending';
                        const diffText = isCurrency ? formatSignedCurrency(diff) : `${diff > 0 ? '+' : ''}${ (item.key === 'weight' || item.key === 'weightLoss') ? diff.toFixed(2) : formatNumber(diff)}`;
                        const pctText = pct == null ? '' : ` (${formatSignedPercent(pct)})`;
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                            {item.key === 'trips' ? (
                              <button
                                onClick={() => openTripViewer((c as any).trips || [], c.label)}
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(val)}
                              </button>
                            ) : (
                              <div className="text-slate-700 dark:text-slate-200" title={moneyHint(item.key, val)}>{fmt(val)}</div>
                            )}
                            {(prevVal !== 0 || val !== 0) && item.key !== 'trips' && (
                              <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diffText}{pctText}</div>
                            )}
                            {item.key === 'trips' && (prevVal !== 0 || val !== 0) && (
                              <div className={`text-[9px] font-semibold leading-none mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{diff > 0 ? '+' : ''}{formatNumber(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                            )}
                          </td>
                        );
                      })}
                    </>
                  ) : (
                    weeklyGroups.map((_, idx) => {
                      const currM = weeklyMetrics[idx] as WeeklyMetrics | undefined;
                      const currVal = (currM?.[item.key as keyof WeeklyMetrics] as number) || 0;
                      const fmt = (v: number) => {
                        if (item.key === 'sales' || item.key === 'collection' || item.key === 'pending') return formatCurrency(v);
                        if (item.key === 'weight' || item.key === 'weightLoss') return v.toFixed(2);
                        return formatNumber(v);
                      };
                      const tripsForCell = weeklyGroups[idx]?.trips || [];
                      const labelForCell = weeklyGroups[idx]?.label || `Week ${idx+1}`;
                      return (
                        <td key={idx} className="w-24 px-3 py-2.5 text-center">
                          {item.key === 'trips' ? (
                            <button
                              onClick={() => openTripViewer(tripsForCell, labelForCell)}
                              className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-800 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                              title="View trips"
                            >
                              {fmt(currVal)}
                            </button>
                          ) : (
                            <span className="text-slate-600" title={moneyHint(item.key, currVal)}>{fmt(currVal)}</span>
                          )}
                        </td>
                      );
                    })
                  )}
                  {period !== 'week' && !comparePrevious && (
                    <td
                      className="w-20 px-3 py-2.5 text-center font-bold bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60"
                      title={moneyHint(item.key, (totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)}
                    >
                      {item.key === 'trips' ? (
                        <button
                          onClick={() => openTripViewer(trips, `Total – ${getDateRangeLabel()}`)}
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[13px] font-bold text-slate-800 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                          title="View all trips"
                        >
                          {formatNumber((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)}
                        </button>
                      ) : item.key === 'sales' || item.key === 'collection' || item.key === 'pending'
                        ? formatCurrency((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)
                        : item.key === 'weight' || item.key === 'weightLoss'
                          ? ((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0).toFixed(2)
                          : formatNumber((totalMetrics[item.key as keyof WeeklyMetrics] as number) || 0)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="analysis-table w-full table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="w-56 px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">{t('accounts.summary.expense_table.expense')}</th>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyGroups.map((pg, idx) => (
                      <th key={`prev-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-slate-600 bg-amber-50/60 border-l border-amber-200">
                        <PeriodHeaderLabel label={pg.label} tone="prev" />
                        <span className="block text-[9px] font-normal text-amber-700/70">Previous</span>
                      </th>
                    ))}
                    {weeklyGroups.map((g, idx) => (
                      <th key={`curr-${idx}`} className="w-24 px-3 py-3 text-center font-semibold text-emerald-700 bg-emerald-50/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                        <PeriodHeaderLabel label={g.label} tone="curr" />
                        <span className="block text-[9px] font-normal text-emerald-700/70">Current</span>
                      </th>
                    ))}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <PeriodHeaderLabel label={m.label} tone="prev" />
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <PeriodHeaderLabel label={q.label} tone="prev" />
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      return (
                        <th key={idx} className={`w-28 px-3 py-3 text-center font-semibold border-l ${isCurrent ? 'text-emerald-700 bg-emerald-50/40 border-emerald-100' : 'text-slate-600 bg-amber-50/60 border-amber-200'}`}>
                          <PeriodHeaderLabel label={c.label} tone="prev" />
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-emerald-700/70' : 'text-amber-700/70'}`}>{isCurrent ? 'Current' : idx === 0 ? 'Prev 2' : 'Prev 1'}</span>
                        </th>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((g, i) => (
                    <th key={i} className="w-28 px-3 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">
                      <PeriodHeaderLabel label={g.label} tone="plain" />
                    </th>
                  ))
                )}
                {period !== 'week' && !comparePrevious && (
                  <th className="w-20 px-3 py-3 text-center font-semibold text-slate-600 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60">Total</th>
                )}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'farm', label: t('accounts.summary.expense_rows.farm') },
                { key: 'fuel', label: t('accounts.summary.expense_rows.fuel') },
                { key: 'trip', label: t('accounts.summary.expense_rows.trip') },
                { key: 'salary', label: t('accounts.summary.expense_rows.salary') },
                { key: 'maintenance', label: t('accounts.summary.expense_rows.maintenance') },
                { key: 'office', label: t('accounts.summary.expense_rows.office') },
              ].map((item) => {
                const total = weeklyExpenses.reduce((a, b) => a + ((b[item.key as keyof ExpenseBreakdown] as number) || 0), 0);
                /* Farm Payment is the one expense that is not a Payment Register
                   total: it is the farm bill of exactly these trips (pickup
                   weight × farm rate). Only its amount behaves differently — it
                   opens those trips. The row itself looks like every other. */
                const isFarm = item.key === 'farm';
                /* The farm amount is the trigger: press it and the farm payment
                   view opens for exactly the trips behind that figure — the
                   column's own trips, or the whole span on the Total column. */
                const farmAmount = (value: number, scopeLabel: string, scopeTrips: Trip[]) => {
                  if (!isFarm) return formatCurrency(value);
                  const info = farmSummary(scopeTrips);
                  return (
                    <SummaryFarmAmount
                      value={value}
                      scopeLabel={scopeLabel}
                      trips={info.trips}
                      weightKg={info.weightKg}
                      onOpen={() => setFarmScope({ label: scopeLabel, trips: scopeTrips })}
                    />
                  );
                };
                return (
                  <tr
                  key={item.key}
                  className="group/row border-b border-slate-100 transition-colors duration-150 hover:bg-emerald-50/70 dark:border-slate-800 dark:hover:bg-emerald-500/10"
                >
                    <td className="relative w-56 px-4 py-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-emerald-500 before:opacity-0 before:transition-opacity before:content-[''] group-hover/row:before:opacity-100">
                      <SummaryRowLabel color={EXPENSE_ROW_DOT[item.key]} label={item.label} />
                    </td>
                    {comparePrevious && period === 'week' ? (
                      <>
                        {previousWeeklyExpenses.map((prevW, idx) => {
                          const prevVal = (prevW?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          return (
                            <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center text-slate-800 dark:text-slate-200 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{farmAmount(prevVal, previousWeeklyGroups[idx]?.label ?? '', previousWeeklyGroups[idx]?.trips ?? [])}</td>
                          );
                        })}
                        {weeklyExpenses.map((currW, idx) => {
                          const currVal = (currW?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const prevValForDiff = (previousWeeklyExpenses[previousWeeklyExpenses.length - 1]?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = currVal - prevValForDiff;
                          const expPct = prevValForDiff !== 0 ? (expDiff / Math.abs(prevValForDiff)) * 100 : null;
                          return (
                            <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{farmAmount(currVal, weeklyGroups[idx]?.label ?? '', weeklyGroups[idx]?.trips ?? [])}</div>
                              {(prevValForDiff !== 0 || currVal !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : comparePrevious && period === 'month' && monthComparisonData ? (
                      <>
                        {monthComparisonData.map((m, idx) => {
                          const isCurrent = idx === monthComparisonData.length - 1;
                          const val = (m.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          if (!isCurrent) {
                            return (
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-800 dark:text-slate-200 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{farmAmount(val, m.label, m.trips)}</td>
                            );
                          }
                          const prevVal = (monthComparisonData[monthComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{farmAmount(val, m.label, m.trips)}</div>
                              {(prevVal !== 0 || val !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                      <>
                        {quarterComparisonData.map((q, idx) => {
                          const isCurrent = idx === quarterComparisonData.length - 1;
                          const val = (q.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          if (!isCurrent) {
                            return (
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-800 dark:text-slate-200 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{farmAmount(val, q.label, q.trips)}</td>
                            );
                          }
                          const prevVal = (quarterComparisonData[quarterComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{farmAmount(val, q.label, q.trips)}</div>
                              {(prevVal !== 0 || val !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : comparePrevious && period === 'custom' && customComparisonData ? (
                      <>
                        {customComparisonData.map((c, idx) => {
                          const isCurrent = idx === customComparisonData.length - 1;
                          const val = (c.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          if (!isCurrent) {
                            return (
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-800 dark:text-slate-200 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{farmAmount(val, c.label, c.trips)}</td>
                            );
                          }
                          const prevVal = (customComparisonData[customComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{farmAmount(val, c.label, c.trips)}</div>
                              {(prevVal !== 0 || val !== 0) ? (
                                <div className={`text-[9px] font-semibold leading-none mt-0.5 ${expDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(expDiff)}{expPct == null ? '' : ` (${formatSignedPercent(expPct)})`}</div>
                              ) : null}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      weeklyGroups.map((_, idx) => {
                        const currVal = (weeklyExpenses[idx]?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                        return (
                          <td key={idx} className="w-24 px-3 py-2.5 text-center text-slate-600" title={formatCurrencyExact(currVal)}>{farmAmount(currVal, weeklyGroups[idx]?.label ?? '', weeklyGroups[idx]?.trips ?? [])}</td>
                        );
                      })
                    )}
                    {period !== 'week' && !comparePrevious && (
                      <td
                        className="w-20 px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60"
                        title={formatCurrencyExact(total)}
                      >
                        {farmAmount(total, rangeLabel, trips)}
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="group/row border-b border-slate-200 bg-slate-50/60 transition-colors duration-150 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-emerald-500/10">
                <td className="relative w-56 px-4 py-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-emerald-500 before:opacity-0 before:transition-opacity before:content-[''] group-hover/row:before:opacity-100">
                  <SummaryRowLabel
                    color={EXPENSE_ROW_DOT.total}
                    label={t('accounts.summary.expense_rows.total')}
                    className="font-bold text-slate-700 dark:text-slate-200"
                  />
                </td>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyExpenses.map((prevW, idx) => {
                      const prevSum = Object.values(prevW || {}).reduce((a, b) => a + (b as number), 0);
                      return (
                        <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(prevSum)}</td>
                      );
                    })}
                    {weeklyExpenses.map((currW, idx) => {
                      const currSum = Object.values(currW || {}).reduce((a, b) => a + (b as number), 0);
                      const prevSumForDiff = Object.values(previousWeeklyExpenses[previousWeeklyExpenses.length - 1] || {}).reduce((a, b) => a + (b as number), 0);
                      const totalDiff = currSum - prevSumForDiff;
                      const totalPct = prevSumForDiff !== 0 ? (totalDiff / Math.abs(prevSumForDiff)) * 100 : null;
                      return (
                        <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(currSum)}</div>
                          {(prevSumForDiff !== 0 || currSum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${totalDiff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(totalDiff)}{totalPct == null ? '' : ` (${formatSignedPercent(totalPct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      const sum = sumExpenseBreakdown(m.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(sum)}</td>
                        );
                      }
                      const prevSum = sumExpenseBreakdown(monthComparisonData[monthComparisonData.length - 2].expenses);
                      const diff = sum - prevSum;
                      const pct = prevSum !== 0 ? (diff / Math.abs(prevSum)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(sum)}</div>
                          {(prevSum !== 0 || sum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      const sum = sumExpenseBreakdown(q.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(sum)}</td>
                        );
                      }
                      const prevSum = sumExpenseBreakdown(quarterComparisonData[quarterComparisonData.length - 2].expenses);
                      const diff = sum - prevSum;
                      const pct = prevSum !== 0 ? (diff / Math.abs(prevSum)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(sum)}</div>
                          {(prevSum !== 0 || sum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      const sum = sumExpenseBreakdown(c.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-800 dark:text-slate-200 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(sum)}</td>
                        );
                      }
                      const prevSum = sumExpenseBreakdown(customComparisonData[customComparisonData.length - 2].expenses);
                      const diff = sum - prevSum;
                      const pct = prevSum !== 0 ? (diff / Math.abs(prevSum)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-50/30 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-slate-700 dark:text-slate-200">{formatCurrency(sum)}</div>
                          {(prevSum !== 0 || sum !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((_, idx) => {
                    const currSum = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                    return (
                      <td key={idx} className="w-24 px-3 py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">{formatCurrency(currSum)}</td>
                    );
                  })
                )}
                {period !== 'week' && !comparePrevious && (
                  <td
                    className="w-20 px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-100 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60"
                    title={formatCurrencyExact(totalExpenseValue)}
                  >
                    {formatCurrency(totalExpenseValue)}
                  </td>
                )}
              </tr>

              {/* Net profit: shop sales − farm payment − every other expense.
                  It lives in the table rather than in a KPI card of its own; the
                  formula rides along as the row's hover tip. */}
              <tr
                className="group/row border-b border-emerald-200 bg-emerald-50/70 transition-colors duration-150 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                title={`${t('accounts.summary.net_profit.formula')} — ${formatCurrencyExact(totalMetrics.sales)} − ${formatCurrencyExact(totalExpenseValue)}`}
              >
                <td className="relative w-56 px-4 py-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-emerald-600 before:opacity-0 before:transition-opacity before:content-[''] group-hover/row:before:opacity-100">
                  <SummaryRowLabel
                    color={EXPENSE_ROW_DOT.netProfit}
                    label={t('accounts.summary.expense_rows.net_profit')}
                    className="font-bold text-emerald-800 dark:text-emerald-200"
                  />
                </td>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyNetProfit.map((value, idx) => (
                      <td
                        key={`prev-${idx}`}
                        title={formatCurrencyExact(value)}
                        className="w-24 px-3 py-2.5 text-center font-bold bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15"
                      >
                        {formatCurrency(value)}
                      </td>
                    ))}
                    {weeklyNetProfit.map((value, idx) => {
                      const prevValue = previousWeeklyNetProfit[previousWeeklyNetProfit.length - 1] ?? 0;
                      const diff = value - prevValue;
                      const pct = prevValue !== 0 ? (diff / Math.abs(prevValue)) * 100 : null;
                      return (
                        <td
                          key={`curr-${idx}`}
                          title={formatCurrencyExact(value)}
                          className="w-24 px-3 py-2.5 text-center font-bold bg-emerald-50/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15"
                        >
                          <div className={value >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-300'}>{formatCurrency(value)}</div>
                          {(prevValue !== 0 || value !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>{netProfitComparisonCells(monthComparisonData)}</>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>{netProfitComparisonCells(quarterComparisonData)}</>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>{netProfitComparisonCells(customComparisonData)}</>
                ) : (
                  weeklyNetProfit.map((value, idx) => (
                    <td
                      key={idx}
                      title={formatCurrencyExact(value)}
                      className={`w-24 px-3 py-2.5 text-center font-bold ${value >= 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-300'}`}
                    >
                      {formatCurrency(value)}
                    </td>
                  ))
                )}
                {period !== 'week' && !comparePrevious && (
                  <td
                    title={formatCurrencyExact(totalNetProfit)}
                    className="w-20 px-3 py-2.5 text-center font-bold bg-emerald-100 border-l border-emerald-200 dark:border-emerald-900 group-hover/row:bg-emerald-200/70 dark:group-hover/row:bg-emerald-500/20"
                  >
                    <span className={totalNetProfit >= 0 ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-300'}>
                      {formatCurrency(totalNetProfit)}
                    </span>
                  </td>
                )}
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      </div>
      </div>

      {/* Farm payment pop-up: every trip of the span with its own bill. Picking
          a trip closes this list and opens that trip's farm payment detail, so
          only one pop-up is ever open. */}
      {farmScope && (
        <SummaryFarmViewer
          open
          rows={farmScopeRows}
          spanLabel={farmScope.label}
          onClose={() => setFarmScope(null)}
          onOpenTrip={(trip) => {
            setFarmScope(null);
            setFarmTripView(trip);
          }}
        />
      )}

      {/* Same read-only detail the Farm Payment page shows for a trip: Step 2
          (Farm Details) + Step 3 (Pickup Details), nothing else. */}
      <FarmPaymentTripViewModal
        open={Boolean(farmTripView)}
        trip={farmTripView}
        onClose={() => setFarmTripView(null)}
      />

      {tripViewerOpen && <SummaryTripViewer open trips={tripViewerTrips} groupLabel={tripViewerLabel} farmPayments={snapshot.farmPayments} onClose={closeTripViewer} />}

      <div className="text-xs text-slate-400 text-center border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
        {t('accounts.summary.disclaimer')}
      </div>
    </div>
  );
}