// src/modules/accounts/utils/periodRanges.ts
/* The Analysis page's period chips, as pure date math.

   SummaryPage owns the UI; this file owns the answer to "which dates does this
   chip mean", so the same question can be asked from outside the page. That
   matters because a dashboard KPI arrives with a window of its own (say
   31 Aug → 06 Sep) and the page has to decide which chip shows it.
   `periodForWindow` answers with the NEAREST chip — a week or less goes to Week
   (anchored to the week that overlaps the window most), a month-ish window goes
   to Month, a longer one inside this year goes to Quarter, an exact 1 Apr →
   31 Mar span goes to FY — and only a window no chip can represent (15 days,
   say, or one from another year) falls to Custom, which honours arbitrary
   dates to the day. The window's own dates always come back alongside the
   choice, so the Custom pickers are seeded with exactly what the tile was
   showing even when a chip is selected.

   The week/month/quarter/fy bodies below are the ones SummaryPage has always
   used (fy is the newer Indian-financial-year chip), lifted verbatim so the
   page and this helper cannot drift apart:
   - week    → the Monday to Sunday around an anchor day (today by default; the
               page can step it, which is what lets it show a week that a
               dashboard KPI arrived with)
   - month   → the selected month, snapped OUT to whole Mon–Sun weeks that still
               end inside the month (so September can read 31 Aug → 27 Sep)
   - quarter → the whole of the current year, 1 Jan → 31 Dec
   - fy      → the whole Indian financial year, 1 Apr → 31 Mar
   - custom  → exactly the two dates given
*/

import { format } from 'date-fns';

export type SummaryPeriodId = 'week' | 'month' | 'quarter' | 'fy' | 'custom';

export interface PeriodRange {
  start: Date;
  end: Date;
}

/** Local YYYY-MM-DD — the format the date pickers and the deep links use. */
export const toISODate = (date: Date): string => format(date, 'yyyy-MM-dd');

export const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getSunday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const isSameMonth = (d1: Date, d2: Date): boolean => {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
};

/** "Week": the Monday through the Sunday around `anchor` (today by default). */
export function weekRange(anchor: Date = new Date()): PeriodRange {
  const start = getMonday(anchor);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** "Month": the selected month, snapped out to whole Mon–Sun weeks inside it. */
export function monthRange(monthDate: Date): PeriodRange {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = getMonday(first);
  const last = new Date(year, month + 1, 0);
  let end = getSunday(last);
  if (!isSameMonth(end, first)) {
    end = new Date(end);
    end.setDate(end.getDate() - 7);
  }
  return { start, end };
}

/** "Quarter": the whole of the current year (this is what the chip has always shown). */
export function quarterRange(now: Date = new Date()): PeriodRange {
  const year = now.getFullYear();
  const end = new Date(year, 11, 31);
  end.setHours(23, 59, 59, 999);
  return { start: new Date(year, 0, 1), end };
}

/**
 * Indian financial year containing `anchor`: 1 Apr → 31 Mar.
 * The FY the date falls in starts in April of the same calendar year when the
 * month is April or later, otherwise in April of the previous calendar year.
 */
export function fyStartYearContaining(anchor: Date = new Date()): number {
  return anchor.getMonth() >= 3 ? anchor.getFullYear() : anchor.getFullYear() - 1;
}

/** "FY": the whole financial year 1 Apr → 31 Mar containing `now`. */
export function financialYearRange(now: Date = new Date()): PeriodRange {
  return financialYearRangeOf(fyStartYearContaining(now));
}

/** "FY" for an explicit FY start year: 1 Apr (fyStartYear) → 31 Mar (fyStartYear + 1). */
export function financialYearRangeOf(fyStartYear: number): PeriodRange {
  const end = new Date(fyStartYear + 1, 2, 31);
  end.setHours(23, 59, 59, 999);
  const start = new Date(fyStartYear, 3, 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Short Indian FY label: 2025 → "FY 2025–26". */
export function financialYearLabel(fyStartYear: number): string {
  return `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`;
}

/**
 * Fiscal quarter of a financial year. Q1 = Apr–Jun, Q2 = Jul–Sep,
 * Q3 = Oct–Dec, Q4 = Jan–Mar (of fyStartYear + 1).
 */
export function fiscalQuarterRange(fyStartYear: number, quarter: number): PeriodRange {
  const q = Math.min(4, Math.max(1, Math.floor(quarter)));
  const startMonth = 3 + (q - 1) * 3;
  const startYear = fyStartYear + Math.floor(startMonth / 12);
  const month = startMonth % 12;
  const start = new Date(startYear, month, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(startYear, month + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Fiscal quarter label: 1 → "Q1 (Apr–Jun)", 4 → "Q4 (Jan–Mar)". */
export function fiscalQuarterLabel(quarter: number): string {
  const labels = ['Q1 (Apr–Jun)', 'Q2 (Jul–Sep)', 'Q3 (Oct–Dec)', 'Q4 (Jan–Mar)'];
  return labels[quarter - 1] || `Q${quarter}`;
}

/** "Custom range": exactly the two dates given, empty ones falling back to today. */
export function customRange(startKey: string, endKey: string): PeriodRange {
  const start = startKey ? new Date(startKey) : new Date();
  const end = endKey ? new Date(endKey) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export interface WindowLanding {
  /** The chip that shows the window — the nearest one, Custom if none fits. */
  period: SummaryPeriodId;
  /** Present when `period` is 'week' — a day inside the week to display. */
  weekAnchor?: Date;
  /** Present when `period` is 'month' — the month to display. */
  monthDate?: Date;
  /** Present when `period` is 'fy' — the FY start year to display. */
  fyStartYear?: number;
  /** The window itself, which is what the Custom chip shows. */
  customStart: string;
  customEnd: string;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Days in a window, inclusive of both ends. */
export function daysInWindow(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

const firstOfMonth = (dateKey: string) =>
  new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, 1);

/** The FY start year when `from` is the 1st of April, otherwise null. */
const fyStartYearOfKey = (from: string): number | null => {
  const m = /^(\d{4})-04-01$/.exec(from);
  return m ? Number(m[1]) : null;
};

/**
 * The Mon–Sun week that overlaps a window most — the week a rolling "last 7
 * days" belongs to. A window inside one week returns that week; one straddling
 * two returns whichever holds more of its days (the earlier one on a tie).
 */
export function weekAnchorFor(from: string, to: string): Date {
  const startMonday = getMonday(new Date(`${from}T00:00:00`));
  const endMonday = getMonday(new Date(`${to}T00:00:00`));
  if (startMonday.getTime() === endMonday.getTime()) return startMonday;

  const overlap = (monday: Date): number => {
    let days = 0;
    const cursor = new Date(monday);
    for (let i = 0; i < 7; i += 1) {
      const key = toISODate(cursor);
      if (key >= from && key <= to) days += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };
  return overlap(endMonday) > overlap(startMonday) ? endMonday : startMonday;
}

/**
 * Which chip a window arriving from a dashboard KPI lands on.
 *
 * The nearest chip wins, so a week reads as a week and a month as a month
 * instead of everything dropping into Custom:
 *
 *   1 Apr → 31 Mar (exact FY) → FY, the financial year the window opens
 *   up to 7 days      → Week, anchored to the week that overlaps it most
 *   8 – 27 days       → Custom (no chip means "fifteen days")
 *   28 – 45 days      → Month, the month the window ends in
 *   46 days and more  → Quarter, which on this page is the whole current year —
 *                       only when the window is inside this year, since the chip
 *                       cannot show another one
 *
 * A chip is still chosen when it shows the window exactly (a Mon–Sun week, the
 * month whose snapped span is the window), so nothing is needlessly widened.
 * The exact dates always come back as customStart/customEnd, which is what the
 * Custom pickers are seeded with.
 *
 * Returns null for a window that is not two well-ordered YYYY-MM-DD dates.
 */
export function periodForWindow(
  from: string,
  to: string,
  now: Date = new Date()
): WindowLanding | null {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) return null;

  const landing = { customStart: from, customEnd: to };

  // An exact financial-year span belongs to the FY chip, which shows it
  // without moving any date — checked before the day-count rules so a 365-day
  // FY is never widened to the calendar-year chip or dropped into Custom.
  const fyStart = fyStartYearOfKey(from);
  if (fyStart != null && to === `${fyStart + 1}-03-31`) {
    return { ...landing, period: 'fy', fyStartYear: fyStart };
  }

  const days = daysInWindow(from, to);

  if (days <= 7) return { ...landing, period: 'week', weekAnchor: weekAnchorFor(from, to) };
  if (days <= 27) return { ...landing, period: 'custom' };
  if (days <= 45) return { ...landing, period: 'month', monthDate: firstOfMonth(to) };

  const year = quarterRange(now);
  const insideThisYear = from >= toISODate(year.start) && to <= toISODate(year.end);
  if (insideThisYear) return { ...landing, period: 'quarter' };

  return { ...landing, period: 'custom' };
}
