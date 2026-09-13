// src/modules/accounts/pages/SummaryPage.tsx

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
  CalendarX2,
  ChartPie,
  GitCompareArrows,
  SlidersHorizontal,
  Banknote,
  Bird,
  Gauge,
} from 'lucide-react';
import { uiFocusRing, uiTransition } from '../../../shared/ui/uiTokens';
import { wrapIndex } from '../../../utils/interaction';
import { format } from 'date-fns';
import { summaryService } from '../services/summaryService';
import { DatePicker } from '../../../components/common/DatePicker';
import { exportPDF, exportExcel } from '../components/Summary';
import SummaryTripViewer from '../components/Summary/SummaryTripViewer';
import { PaymentService } from '../services/PaymentService';
import { FarmPaymentService } from '../services/FarmPaymentService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { WeeklyMetrics, ExpenseBreakdown } from '../types/summary.types';
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
  total: 'bg-slate-500 dark:bg-slate-400',
  netProfit: 'bg-emerald-600',
};

/** Column header: period name on one line, its date span on the next, never
    broken mid-range. `tone` matches the amber/emerald column tint. */
function PeriodHeaderLabel({ label, tone }: { label: string; tone: 'prev' | 'curr' | 'plain' }) {
  const { name, span } = splitPeriodLabel(label);
  const spanClass =
    tone === 'prev'
      ? 'text-amber-700/70'
      : tone === 'curr'
        ? 'text-emerald-700/70'
        : 'text-slate-400 dark:text-slate-500';
  return (
    <>
      <span className="block text-[10px] font-semibold leading-tight whitespace-nowrap">{name}</span>
      {span && <span className={`block text-[9px] font-normal leading-tight whitespace-nowrap ${spanClass}`}>{span}</span>}
    </>
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
      <span className={`truncate ${className}`}>{label}</span>
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

// ---- Custom-range helpers ---------------------------------------------------
// Quick ranges offered beside the date fields ("last N days, ending today").
const CUSTOM_PRESET_DAYS = [7, 30, 90] as const;

function presetRange(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from, to };
}

/* ---------------------------------------------------------------------------
 * KPI cards
 * ------------------------------------------------------------------------- */

type KpiTone = 'emerald' | 'teal' | 'amber' | 'violet' | 'sky' | 'indigo' | 'lime' | 'rose';

// One tone per KPI, so a card is recognisable by colour alone. Class strings are
// written out in full (never built from a template) so Tailwind's scanner keeps them.
const KPI_TONE: Record<KpiTone, { tile: string; bar: string; fill: string; rule: string }> = {
  emerald: { tile: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20', bar: 'bg-emerald-500/70', fill: 'bg-emerald-500', rule: 'from-emerald-500/25' },
  teal:    { tile: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20', bar: 'bg-teal-500/70', fill: 'bg-teal-500', rule: 'from-teal-500/25' },
  amber:   { tile: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20', bar: 'bg-amber-500/70', fill: 'bg-amber-500', rule: 'from-amber-500/25' },
  violet:  { tile: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20', bar: 'bg-violet-500/70', fill: 'bg-violet-500', rule: 'from-violet-500/25' },
  sky:     { tile: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20', bar: 'bg-sky-500/70', fill: 'bg-sky-500', rule: 'from-sky-500/25' },
  indigo:  { tile: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20', bar: 'bg-indigo-500/70', fill: 'bg-indigo-500', rule: 'from-indigo-500/25' },
  lime:    { tile: 'bg-lime-50 text-lime-700 ring-lime-100 dark:bg-lime-500/10 dark:text-lime-300 dark:ring-lime-500/20', bar: 'bg-lime-500/70', fill: 'bg-lime-500', rule: 'from-lime-500/25' },
  rose:    { tile: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20', bar: 'bg-rose-500/70', fill: 'bg-rose-500', rule: 'from-rose-500/25' },
};

/** Week-by-week shape of the metric, drawn as plain bars (no chart library,
    no measurable layout) with the newest week highlighted. */
function KpiSparkline({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values.map((v) => Math.abs(v)), 0);
  return (
    <div className="flex h-6 min-w-0 flex-1 items-end gap-1" aria-hidden="true" title={values.map((v) => formatCurrencyExact(v)).join('  ·  ')}>
      {values.map((v, i) => {
        const last = i === values.length - 1;
        const pct = max > 0 ? Math.max(10, (Math.abs(v) / max) * 100) : 10;
        return (
          <span
            key={i}
            className={`flex-1 rounded-sm ${v < 0 ? 'bg-rose-500/80' : tone} ${last ? 'opacity-100' : 'opacity-45'}`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

/** Change against the comparison period. Up is good, except for the measures
    where a fall is the win (cost, mortality, pending). */
function KpiDelta({
  current,
  previous,
  goodWhenDown = false,
}: {
  current: number;
  previous: number;
  goodWhenDown?: boolean;
}) {
  if (!previous && !current) return null;
  const diff = current - previous;
  const pct = previous !== 0 ? Math.abs(diff / previous) * 100 : null;
  const better = goodWhenDown ? diff <= 0 : diff >= 0;
  return (
    <span
      title={`${formatCurrencyExact(current)} vs ${formatCurrencyExact(previous)}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
        better
          ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
      }`}
    >
      {diff >= 0 ? <TrendingUp size={10} aria-hidden="true" /> : <TrendingDown size={10} aria-hidden="true" />}
      {pct == null ? formatSignedCurrency(diff) : `${pct.toFixed(1)}%`}
    </span>
  );
}

function KpiCard({
  tone,
  icon: Icon,
  label,
  sub,
  value,
  valueExact,
  series,
  progress,
  footer,
  children,
}: {
  tone: KpiTone;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  sub?: string;
  value: string;
  valueExact?: string;
  series?: number[];
  progress?: { pct: number; caption: string };
  footer?: string;
  children?: React.ReactNode;
}) {
  const t = KPI_TONE[tone];
  return (
    <div
      data-kpi={label}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${t.rule} to-transparent`} />
      <div className="flex items-start gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${t.tile}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">{label}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] leading-none text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        {children}
      </div>
      <p className="mt-3 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white" title={valueExact}>
        {value}
      </p>
      {progress && (
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${t.fill}`}
              style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">{progress.caption}</p>
        </div>
      )}
      {(footer || (series && series.length > 1)) && (
        <div className="mt-3 flex items-end justify-between gap-3">
          {footer ? (
            <p className="shrink-0 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{footer}</p>
          ) : (
            <span />
          )}
          {series && series.length > 1 && (
            <div className="flex max-w-[55%] min-w-0 flex-1 justify-end">
              <KpiSparkline values={series} tone={t.bar} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type SummaryPageProps = { embedded?: boolean };

export default function SummaryPage({ embedded = false }: SummaryPageProps) {
  const [period, setPeriod] = useState<PeriodId>('week');
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [comparePrevious, setComparePrevious] = useState(false);
  const [tripViewerOpen, setTripViewerOpen] = useState(false);
  const [tripViewerTrips, setTripViewerTrips] = useState<Trip[]>([]);
  const [tripViewerLabel, setTripViewerLabel] = useState('');
  const { t, language } = useI18n();

  useEffect(() => {
    const handleStorage = () => setRefreshKey((prev) => prev + 1);
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
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
      if (landing.monthDate) setSelectedMonthDate(landing.monthDate);
      setPeriod(landing.period);
      setComparePrevious(analysisLink.compare);
    }
  }

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

  const movePeriodSelection = useCallback(
    (delta: number, edge: 'first' | 'last' | null = null) => {
      const count = PERIOD_TABS.length;
      const found = PERIOD_TABS.findIndex((tab) => tab.id === period);
      const current = found === -1 ? 0 : found;
      const next =
        edge === 'first' ? 0 : edge === 'last' ? count - 1 : wrapIndex(current, count, delta);
      setPeriod(PERIOD_TABS[next].id);
      // Note: an explicit `querySelectorAll<T>()` type argument is avoided here —
      // in a .tsx file the parser reads the angle brackets as JSX.
      const radios: HTMLElement[] = periodGroupRef.current
        ? (Array.from(periodGroupRef.current.querySelectorAll('[role="radio"]')) as HTMLElement[])
        : [];
      radios[next]?.focus();
    },
    [period]
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

  /* Which dates the selected chip means. The bodies live in utils/periodRanges
     so a window arriving from a dashboard KPI can be matched against them (see
     the deep link below) rather than re-derived here. */
  const getDateRange = useCallback((): PeriodRange => {
    switch (period) {
      case 'week':
        return weekRange();
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
  }, [period, selectedMonthDate, customStart, customEnd]);

  const { start, end } = getDateRange();
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
  }, [start, end]);

  const resetCustomRange = useCallback(() => {
    setCustomStart('');
    setCustomEnd('');
    setPeriod('week');
  }, []);

  const applyPreset = useCallback((days: number) => {
    const { from, to } = presetRange(days);
    setCustomStart(toISODate(from));
    setCustomEnd(toISODate(to));
    setPeriod('custom');
  }, []);

  const activePreset = useMemo(() => {
    if (period !== 'custom') return null;
    return (
      CUSTOM_PRESET_DAYS.find((days) => {
        const { from, to } = presetRange(days);
        return customStart === toISODate(from) && customEnd === toISODate(to);
      }) ?? null
    );
  }, [period, customStart, customEnd]);

  const activeTone = PERIOD_TABS.find((tab) => tab.id === period) ?? PERIOD_TABS[0];
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
  }, [start, end, refreshKey]);

  const collections = useMemo(() => {
    void refreshKey;
    return summaryService.getApprovedCollectionsByDateRange(start, end);
  }, [start, end, refreshKey]);

  const previousTrips = useMemo(() => {
    void refreshKey;
    return summaryService.getCompletedTripsByDateRange(previousRange.start, previousRange.end);
  }, [previousRange, refreshKey]);

  const previousCollections = useMemo(() => {
    void refreshKey;
    return summaryService.getApprovedCollectionsByDateRange(previousRange.start, previousRange.end);
  }, [previousRange, refreshKey]);

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
  }, [previousTwoWeeksRange, refreshKey]);

  const previousTwoWeeksCollections = useMemo(() => {
    void refreshKey;
    if (!previousTwoWeeksRange) return [];
    return summaryService.getApprovedCollectionsByDateRange(previousTwoWeeksRange.start, previousTwoWeeksRange.end);
  }, [previousTwoWeeksRange, refreshKey]);

  const allPayments = useMemo(() => {
    void refreshKey;
    return PaymentService.getPayments();
  }, [refreshKey]);

  const computeEffectiveExpenses = useCallback(
    (rangeTrips: Trip[], rangeStart: Date, rangeEnd: Date): ExpenseBreakdown => {
      // Farm payments from FarmPaymentService (actual farm settlements)
      const farmPaymentsFromService = (() => {
        try {
          const allFarm = FarmPaymentService.getAll();
          return allFarm.filter((p: any) => {
            const d = new Date(p.paidDate || p.createdAt || '');
            return !isNaN(d.getTime()) && d >= rangeStart && d <= rangeEnd;
          });
        } catch {
          return [];
        }
      })();
      const expenses = summaryService.computeCombinedExpenses(rangeTrips, rangeStart, rangeEnd, farmPaymentsFromService as any);

      // Farm payments from PaymentService ledger (category/paymentType farm) – add, don't override trip farm
      const farmPaymentsFromLedger = allPayments.filter((p: any) => {
        if (!p.paymentDate) return false;
        const paymentDate = new Date(p.paymentDate);
        const isFarm = (p.paymentType && p.paymentType.toLowerCase().includes('farm')) || (p.category && p.category.toLowerCase().includes('farm'));
        return isFarm && paymentDate >= rangeStart && paymentDate <= rangeEnd;
      });
      const farmLedgerSum = farmPaymentsFromLedger.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
      // Trip farm (from getExpensesFromTrip) + FarmPaymentService already in expenses.farm, add ledger farm
      expenses.farm += farmLedgerSum;
      return expenses;
    },
    [allPayments]
  );

  const weeklyGroups = useMemo(() => {
    if (period === 'quarter') {
      const year = new Date().getFullYear();
      const groups = [];
      for (let q = 1; q <= 4; q++) {
        const { start: qStart, end: qEnd } = getQuarterRange(year, q);
        const qTrips = trips.filter((trip) => {
          const d = new Date(trip.tripDate);
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
            const d = new Date(trip.tripDate);
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
        if (current > new Date(year, month + 1, 0)) break;
      }
      return groups;
    }

    const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
    let current = new Date(start);
    const monday = getMonday(current);
    current = new Date(monday);
    let weekIndex = 1;
    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      const weekTrips = trips.filter((trip) => {
        const d = new Date(trip.tripDate);
        return d >= weekStart && d <= weekEnd;
      });

      const label = `Week ${weekIndex} (${formatSpanShort(weekStart, weekEnd)})`;
      groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      current = new Date(weekEnd);
      current.setDate(current.getDate() + 1);
      if (current > end) break;
      weekIndex++;
    }
    return groups;
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
          const d = new Date(trip.tripDate);
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
            const d = new Date(trip.tripDate);
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
          const d = new Date(trip.tripDate);
          return d >= weekStart && d <= weekEnd;
        });
        const prevIndex = 3 - offsetWeeks; // 1 for 14 days ago, 2 for 7 days ago
        const label = `Prev Week ${prevIndex} (${formatSpanShort(weekStart, weekEnd)})`;
        groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      }
      return groups;
    }
    // custom -> split previousRange into Mon-Sun weeks
    const groups: { label: string; startDate: Date; endDate: Date; trips: Trip[] }[] = [];
    let current = new Date(previousRange.start);
    const monday = getMonday(current);
    current = new Date(monday);
    let weekIndex = 1;
    while (current <= previousRange.end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > previousRange.end) weekEnd.setTime(previousRange.end.getTime());
      const weekTrips = previousTrips.filter((trip) => {
        const d = new Date(trip.tripDate);
        return d >= weekStart && d <= weekEnd;
      });
      const label = `Week ${weekIndex} (${formatSpanShort(weekStart, weekEnd)})`;
      groups.push({ label, startDate: weekStart, endDate: weekEnd, trips: weekTrips });
      current = new Date(weekEnd);
      current.setDate(current.getDate() + 1);
      if (current > previousRange.end) break;
      weekIndex++;
    }
    return groups;
  }, [period, selectedMonthDate, previousTrips, previousRange, previousTwoWeeksRange, previousTwoWeeksTrips, start]);

  const previousWeeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    const sourceCollections = period === 'week' ? previousTwoWeeksCollections : previousCollections;
    return previousWeeklyGroups.map((group) => {
      const groupCollections = sourceCollections.filter((c) => {
        const d = new Date(c.collectionDate);
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [previousWeeklyGroups, previousCollections, previousTwoWeeksCollections, period]);

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
  }, [period, comparePrevious, selectedMonthDate, refreshKey, computeEffectiveExpenses]);

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
  }, [period, comparePrevious, refreshKey, computeEffectiveExpenses]);

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
  }, [period, comparePrevious, customStart, customEnd, refreshKey, computeEffectiveExpenses]);

  const weeklyMetrics: WeeklyMetrics[] = useMemo(() => {
    return weeklyGroups.map((group) => {
      const groupCollections = collections.filter((c) => {
        const d = new Date(c.collectionDate);
        return d >= group.startDate && d <= group.endDate;
      });
      return summaryService.computeMetrics(group.trips, groupCollections);
    });
  }, [weeklyGroups, collections]);

  const weeklyExpenses: ExpenseBreakdown[] = useMemo(() => {
    return weeklyGroups.map((group) => computeEffectiveExpenses(group.trips, group.startDate, group.endDate));
  }, [weeklyGroups, computeEffectiveExpenses]);

  const totalExpenses = useMemo<ExpenseBreakdown>(() => {
    return computeEffectiveExpenses(trips, start, end);
  }, [trips, start, end, computeEffectiveExpenses]);

  const totalMetrics = useMemo<WeeklyMetrics>(() => {
    const total = { trips: 0, birds: 0, weight: 0, mortality: 0, weightLoss: 0, sales: 0, collection: 0, pending: 0 };
    weeklyMetrics.forEach((m) => {
      total.trips += m.trips;
      total.birds += m.birds;
      total.weight += m.weight;
      total.mortality += m.mortality;
      total.weightLoss += (m as any).weightLoss || 0;
      total.sales += m.sales;
      total.collection += m.collection;
      total.pending += m.pending;
    });
    return total;
  }, [weeklyMetrics]);

  const previousMetrics = useMemo<WeeklyMetrics>(() => {
    return summaryService.computeMetrics(previousTrips, previousCollections);
  }, [previousTrips, previousCollections]);

  const previousExpenses = useMemo<ExpenseBreakdown>(() => {
    return computeEffectiveExpenses(previousTrips, previousRange.start, previousRange.end);
  }, [previousTrips, previousRange, computeEffectiveExpenses]);

  const totalExpenseValue = useMemo(() => sumExpenseBreakdown(totalExpenses), [totalExpenses]);
  const previousExpenseValue = useMemo(() => sumExpenseBreakdown(previousExpenses), [previousExpenses]);

  const kpiSeries = useMemo(
    () => ({
      sales: weeklyMetrics.map((m) => m.sales),
      birds: weeklyMetrics.map((m) => m.birds),
      weight: weeklyMetrics.map((m) => m.weight),
    }),
    [weeklyMetrics]
  );

  // "per week" averages keep every card informative even when Compare is off.
  const kpiWeeks = Math.max(1, weeklyGroups.length);
  const avgWeek = (v: number) => `${formatCurrency(v / kpiWeeks)} / wk`;
  const avgCount = (v: number, unit = '') => `${(v / kpiWeeks).toFixed(1)}${unit} / wk`;

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
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportPDF(title, dateRange, weeklyGroups, weeklyMetrics, weeklyExpenses, totalMetrics, totalExpenses, { totalDistanceKm });
  };

  const handleExportExcel = () => {
    const title = getReportTitle();
    const dateRange = getDateRangeLabel();
    exportExcel(title, dateRange, weeklyGroups, weeklyMetrics, weeklyExpenses, totalMetrics, totalExpenses);
  };

  // Comparison shows up as the Previous columns inside the tables themselves —
  // no separate banner in the filter bar.

  return (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 dark:bg-slate-950 min-h-screen'
    }`}>
      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
            className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 dark:border-slate-700 dark:bg-slate-800/70"
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
                  onClick={() => setPeriod(tab.id)}
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
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

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
            <div className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-teal-500/25 dark:bg-teal-500/10 dark:text-slate-200">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <CalendarRange size={14} aria-hidden="true" className="shrink-0 text-teal-600 dark:text-teal-400" />
              <span className="whitespace-nowrap">{rangeLabel}</span>
              <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-200 dark:bg-slate-900 dark:text-teal-300 dark:ring-teal-500/25">{rangeDays}D</span>
            </div>
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
            <button
              type="button"
              role="switch"
              aria-checked={comparePrevious}
              onClick={() => setComparePrevious((prev) => !prev)}
              className={[
                'inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-semibold outline-none',
                uiTransition,
                uiFocusRing,
                comparePrevious
                  ? 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200'
                  : 'border-amber-200/70 bg-white text-slate-600 hover:border-amber-300/70 hover:bg-amber-50/50 hover:text-amber-800 dark:border-amber-400/20 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-400/10 dark:hover:text-amber-200',
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

        {period === 'custom' && (
          <div className="mt-2.5 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 p-2.5 dark:border-slate-700/70 dark:bg-slate-800/40">
            <div className="w-40">
              <DatePicker
                label={t('accounts.summary.start_date')}
                value={customStart}
                onChange={(v) => applyCustomRange(v, customEnd)}
                maxDate={customEnd || undefined}
                placement="bottom"
                hideThisWeek
                language={language}
              />
            </div>
            <div className="w-40">
              <DatePicker
                label={t('accounts.summary.end_date')}
                value={customEnd}
                onChange={(v) => applyCustomRange(customStart, v)}
                minDate={customStart || undefined}
                placement="bottom"
                hideThisWeek
                language={language}
              />
            </div>

            {/* Quick ranges — language-neutral labels, and they light up when the
                current selection matches one of them. */}
            <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
              {CUSTOM_PRESET_DAYS.map((days) => {
                const on = activePreset === days;
                const { from, to } = presetRange(days);
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => applyPreset(days)}
                    aria-pressed={on}
                    className={`flex h-10 flex-col items-start justify-center rounded-lg px-2.5 text-left outline-none ${uiTransition} ${uiFocusRing} ${
                      on
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className="text-xs font-bold leading-none">{days}D</span>
                    <span className={`mt-1 text-[9px] font-medium leading-none whitespace-nowrap ${on ? 'text-white/85' : 'text-slate-400 dark:text-slate-500'}`}>
                      {formatSpanShort(from, to)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={resetCustomRange}
              className={`ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-500 outline-none hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-300 ${uiFocusRing} ${uiTransition}`}
            >
              <CalendarX2 size={14} aria-hidden="true" />
              {t('accounts.summary.clear')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          tone="indigo" icon={Bird} label={t('accounts.summary.weekly_rows.birds')}
          sub={`${weeklyGroups.length} weeks in range`}
          value={formatNumber(totalMetrics.birds)}
          series={kpiSeries.birds}
          footer={avgCount(totalMetrics.birds)}
        >
          {comparePrevious && <KpiDelta current={totalMetrics.birds} previous={previousMetrics.birds} />}
        </KpiCard>

        <KpiCard
          tone="lime" icon={Gauge} label={t('accounts.summary.weekly_rows.weight')}
          sub={`${(totalMetrics.weight / (totalMetrics.birds || 1)).toFixed(1)} kg avg per bird`}
          value={`${totalMetrics.weight.toFixed(1)} kg`}
          series={kpiSeries.weight}
          footer={avgCount(totalMetrics.weight, ' kg')}
        >
          {comparePrevious && <KpiDelta current={totalMetrics.weight} previous={previousMetrics.weight} />}
        </KpiCard>

        <KpiCard
          tone="emerald" icon={Banknote} label={t('accounts.summary.weekly_rows.sales')}
          sub={`${rangeDays} days \u00b7 ${formatNumber(totalMetrics.trips)} trips`}
          value={formatCurrency(totalMetrics.sales)} valueExact={formatCurrencyExact(totalMetrics.sales)}
          series={kpiSeries.sales}
          footer={avgWeek(totalMetrics.sales)}
        >
          {comparePrevious && <KpiDelta current={totalMetrics.sales} previous={previousMetrics.sales} />}
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Cost / KG – soft light */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500/25 to-transparent" />
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                <Scale size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.14em] text-slate-700 dark:text-slate-200">{t('accounts.summary.cost_per_kg')}</p>
                <p className="text-[11px] leading-none text-slate-400 mt-0.5 truncate">{totalMetrics.weight.toFixed(2)} kg • {formatNumber(totalMetrics.birds)} birds</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 border border-slate-200 dark:border-slate-700">₹/KG</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-[22px] font-bold tracking-tight text-slate-900 leading-none">{formatCurrency(costPerKg)}</p>
              {comparePrevious && previousCostPerKg > 0 && costPerKg > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${costPerKg <= previousCostPerKg ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                  {costPerKg <= previousCostPerKg ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(((costPerKg - previousCostPerKg)/previousCostPerKg)*100).toFixed(1)}%
                </span>
              )}
            </div>
            {!comparePrevious ? (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{t('accounts.summary.cost_per_kg_desc')}</p>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50/70 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">{t('accounts.summary.vs_previous')}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{period === 'week' ? 'Prev W1 • Prev W2' : 'Prev 2 • Prev 1'}</span>
                </div>
                {period === 'week' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const c1 = previousWeeklyMetrics[0] && previousWeeklyExpenses[0] ? (previousWeeklyMetrics[0].weight > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[0]) / previousWeeklyMetrics[0].weight : 0) : 0;
                      const c2 = previousWeeklyMetrics[1] && previousWeeklyExpenses[1] ? (previousWeeklyMetrics[1].weight > 0 ? sumExpenseBreakdown(previousWeeklyExpenses[1]) / previousWeeklyMetrics[1].weight : 0) : 0;
                      return (
                        <>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W1</div>
                            <div className="text-[10px] text-slate-400">{groupSpanShort(previousWeeklyGroups[0])}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c1)}</div>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W2</div>
                            <div className="text-[10px] text-slate-400">{groupSpanShort(previousWeeklyGroups[1])}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c2)}</div>
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
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'quarter' && quarterComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {quarterComparisonData.slice(0, 2).map((q, idx) => {
                      const c = q.metrics.weight > 0 ? sumExpenseBreakdown(q.expenses) / q.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{q.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : period === 'custom' && customComparisonData ? (
                  <div className="grid grid-cols-2 gap-2">
                    {customComparisonData.slice(0, 2).map((c, idx) => {
                      const cost = c.metrics.weight > 0 ? sumExpenseBreakdown(c.expenses) / c.metrics.weight : 0;
                      return (
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{c.label.split('(')[0].trim()}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(cost)}</div>
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
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500/25 to-transparent" />
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                <Route size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.14em] text-slate-700 dark:text-slate-200">{t('accounts.summary.cost_per_km')}</p>
                <p className="text-[11px] leading-none text-slate-400 mt-0.5 truncate">{totalDistanceKm.toFixed(1)} km • {totalMetrics.trips} trips</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-slate-600 border border-slate-200 dark:border-slate-700">₹/KM</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-[22px] font-bold tracking-tight text-slate-900 leading-none">{formatCurrency(costPerKm)}</p>
              {comparePrevious && previousCostPerKm > 0 && costPerKm > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${costPerKm <= previousCostPerKm ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                  {costPerKm <= previousCostPerKm ? <TrendingDown size={11} /> : <TrendingUp size={11} />} {Math.abs(((costPerKm - previousCostPerKm)/previousCostPerKm)*100).toFixed(1)}%
                </span>
              )}
            </div>
            {!comparePrevious ? (
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{t('accounts.summary.cost_per_km_desc')}</p>
            ) : (
              <div className="mt-3 rounded-xl bg-slate-50/70 border border-slate-200 dark:border-slate-700 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">{t('accounts.summary.vs_previous')}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{period === 'week' ? 'Prev W1 • Prev W2' : 'Prev 2 • Prev 1'}</span>
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
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W1</div>
                            <div className="text-[10px] text-slate-400">{groupSpanShort(previousWeeklyGroups[0])}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c1)}</div>
                          </div>
                          <div className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                            <div className="text-[9px] font-semibold tracking-widest text-slate-500">PREV W2</div>
                            <div className="text-[10px] text-slate-400">{groupSpanShort(previousWeeklyGroups[1])}</div>
                            <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c2)}</div>
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
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
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
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{q.label}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(c)}</div>
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
                        <div key={idx} className="rounded-lg bg-white border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
                          <div className="text-[9px] font-semibold tracking-widest text-slate-500">{idx === 0 ? 'PREV 2' : 'PREV 1'}</div>
                          <div className="text-[10px] text-slate-400 truncate">{c.label.split('(')[0].trim()}</div>
                          <div className="mt-1 text-[13px] font-bold text-slate-800">{formatCurrency(cost)}</div>
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

      <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
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
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                title="View trips"
                              >
                                {fmt(prevVal)}
                              </button>
                            ) : (
                              <span className="text-slate-500" title={moneyHint(item.key, prevVal)}>{fmt(prevVal)}</span>
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
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
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
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-500" title={moneyHint(item.key, val)}>{fmt(val)}</span>
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
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
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
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-500" title={moneyHint(item.key, val)}>{fmt(val)}</span>
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
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
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
                                  className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
                                  title="View trips"
                                >
                                  {fmt(val)}
                                </button>
                              ) : (
                                <span className="text-slate-500" title={moneyHint(item.key, val)}>{fmt(val)}</span>
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
                                className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 shadow-sm hover:bg-emerald-600 hover:text-white transition active:scale-95"
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
                              className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
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
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition active:scale-95"
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
          <table className="w-full text-xs table-fixed">
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
                            <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(prevVal)}</td>
                          );
                        })}
                        {weeklyExpenses.map((currW, idx) => {
                          const currVal = (currW?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const prevValForDiff = (previousWeeklyExpenses[previousWeeklyExpenses.length - 1]?.[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = currVal - prevValForDiff;
                          const expPct = prevValForDiff !== 0 ? (expDiff / Math.abs(prevValForDiff)) * 100 : null;
                          return (
                            <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(currVal)}</div>
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
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(val)}</td>
                            );
                          }
                          const prevVal = (monthComparisonData[monthComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(val)}</div>
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
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(val)}</td>
                            );
                          }
                          const prevVal = (quarterComparisonData[quarterComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(val)}</div>
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
                              <td key={idx} className="w-28 px-3 py-2.5 text-center text-slate-500 bg-amber-50/30 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(val)}</td>
                            );
                          }
                          const prevVal = (customComparisonData[customComparisonData.length - 2]?.expenses[item.key as keyof ExpenseBreakdown] as number) || 0;
                          const expDiff = val - prevVal;
                          const expPct = prevVal !== 0 ? (expDiff / Math.abs(prevVal)) * 100 : null;
                          return (
                            <td key={idx} className="w-28 px-3 py-2.5 text-center font-medium bg-emerald-50/20 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                              <div className="text-slate-700 dark:text-slate-200">{formatCurrency(val)}</div>
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
                          <td key={idx} className="w-24 px-3 py-2.5 text-center text-slate-600" title={formatCurrencyExact(currVal)}>{formatCurrency(currVal)}</td>
                        );
                      })
                    )}
                    {period !== 'week' && !comparePrevious && (
                      <td
                        className="w-20 px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60"
                        title={formatCurrencyExact(total)}
                      >
                        {formatCurrency(total)}
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
                        <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(prevSum)}</td>
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
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(sum)}</td>
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
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(sum)}</td>
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
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-slate-500 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(sum)}</td>
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
              <tr className="group/row bg-emerald-50/30 transition-colors duration-150 hover:bg-emerald-100/70 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/15">
                <td className="relative w-56 px-4 py-2.5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-emerald-500 before:opacity-0 before:transition-opacity before:content-[''] group-hover/row:before:opacity-100">
                  <SummaryRowLabel
                    color={EXPENSE_ROW_DOT.netProfit}
                    label={t('accounts.summary.expense_rows.net_profit')}
                    className="font-bold text-emerald-700 dark:text-emerald-400"
                  />
                </td>
                {comparePrevious && period === 'week' ? (
                  <>
                    {previousWeeklyExpenses.map((_, idx) => {
                      const prevExp = Object.values(previousWeeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                      const prevProfit = (previousWeeklyMetrics[idx]?.sales || 0) - prevExp;
                      return (
                        <td key={`prev-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(prevProfit)}</td>
                      );
                    })}
                    {weeklyMetrics.map((_, idx) => {
                      const currExp = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                      const prevExp = Object.values(previousWeeklyExpenses[previousWeeklyExpenses.length - 1] || {}).reduce((a, b) => a + (b as number), 0);
                      const currProfit = (weeklyMetrics[idx]?.sales || 0) - currExp;
                      const prevProfit = (previousWeeklyMetrics[previousWeeklyMetrics.length - 1]?.sales || 0) - prevExp;
                      const profitDiff = currProfit - prevProfit;
                      const profitPct = prevProfit !== 0 ? (profitDiff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={`curr-${idx}`} className="w-24 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-emerald-700">{formatCurrency(currProfit)}</div>
                          {(prevProfit !== 0 || currProfit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${profitDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(profitDiff)}{profitPct == null ? '' : ` (${formatSignedPercent(profitPct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'month' && monthComparisonData ? (
                  <>
                    {monthComparisonData.map((m, idx) => {
                      const isCurrent = idx === monthComparisonData.length - 1;
                      const profit = m.metrics.sales - sumExpenseBreakdown(m.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(profit)}</td>
                        );
                      }
                      const prevProfit = monthComparisonData[monthComparisonData.length - 2].metrics.sales - sumExpenseBreakdown(monthComparisonData[monthComparisonData.length - 2].expenses);
                      const diff = profit - prevProfit;
                      const pct = prevProfit !== 0 ? (diff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-emerald-700">{formatCurrency(profit)}</div>
                          {(prevProfit !== 0 || profit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'quarter' && quarterComparisonData ? (
                  <>
                    {quarterComparisonData.map((q, idx) => {
                      const isCurrent = idx === quarterComparisonData.length - 1;
                      const profit = q.metrics.sales - sumExpenseBreakdown(q.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(profit)}</td>
                        );
                      }
                      const prevProfit = quarterComparisonData[quarterComparisonData.length - 2].metrics.sales - sumExpenseBreakdown(quarterComparisonData[quarterComparisonData.length - 2].expenses);
                      const diff = profit - prevProfit;
                      const pct = prevProfit !== 0 ? (diff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-emerald-700">{formatCurrency(profit)}</div>
                          {(prevProfit !== 0 || profit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : comparePrevious && period === 'custom' && customComparisonData ? (
                  <>
                    {customComparisonData.map((c, idx) => {
                      const isCurrent = idx === customComparisonData.length - 1;
                      const profit = c.metrics.sales - sumExpenseBreakdown(c.expenses);
                      if (!isCurrent) {
                        return (
                          <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/40 border-l border-amber-100 group-hover/row:bg-amber-100/60 dark:group-hover/row:bg-amber-500/15">{formatCurrency(profit)}</td>
                        );
                      }
                      const prevProfit = customComparisonData[customComparisonData.length - 2].metrics.sales - sumExpenseBreakdown(customComparisonData[customComparisonData.length - 2].expenses);
                      const diff = profit - prevProfit;
                      const pct = prevProfit !== 0 ? (diff / Math.abs(prevProfit)) * 100 : null;
                      return (
                        <td key={idx} className="w-28 px-3 py-2.5 text-center font-bold bg-emerald-100/40 border-l border-emerald-100 group-hover/row:bg-emerald-100/60 dark:group-hover/row:bg-emerald-500/15">
                          <div className="text-emerald-700">{formatCurrency(profit)}</div>
                          {(prevProfit !== 0 || profit !== 0) && (
                            <div className={`text-[9px] font-semibold leading-none mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatSignedCurrency(diff)}{pct == null ? '' : ` (${formatSignedPercent(pct)})`}</div>
                          )}
                        </td>
                      );
                    })}
                  </>
                ) : (
                  weeklyGroups.map((_, idx) => {
                    const currExp = Object.values(weeklyExpenses[idx] || {}).reduce((a, b) => a + (b as number), 0);
                    const currProfit = (weeklyMetrics[idx]?.sales || 0) - currExp;
                    return (
                      <td key={idx} className="w-24 px-3 py-2.5 text-center font-bold text-emerald-700">{formatCurrency(currProfit)}</td>
                    );
                  })
                )}
                {period !== 'week' && !comparePrevious && (
                  <td
                    className="w-20 px-3 py-2.5 text-center font-bold text-emerald-700 bg-slate-100 border-l border-slate-200 dark:border-slate-700 group-hover/row:bg-slate-200/70 dark:group-hover/row:bg-slate-700/60"
                    title={formatCurrencyExact(totalMetrics.sales - totalExpenseValue)}
                  >
                    {formatCurrency(totalMetrics.sales - totalExpenseValue)}
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <SummaryTripViewer open={tripViewerOpen} trips={tripViewerTrips} groupLabel={tripViewerLabel} onClose={closeTripViewer} />

      <div className="text-xs text-slate-400 text-center border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
        {t('accounts.summary.disclaimer')}
      </div>
    </div>
  );
}