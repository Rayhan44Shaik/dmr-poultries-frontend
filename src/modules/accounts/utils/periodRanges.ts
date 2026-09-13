// src/modules/accounts/utils/periodRanges.ts
/* The Analysis page's period chips, as pure date math.

   SummaryPage owns the UI; this file owns the answer to "which dates does this
   chip mean", so the same question can be asked from outside the page. That
   matters because a dashboard KPI arrives with a window of its own (say
   07 Sep → 13 Sep) and the page has to decide which chip can show that window
   WITHOUT moving it — `periodForWindow` picks the chip only when the dates it
   would produce are exactly the dates that arrived, and falls back to Custom
   otherwise, because Custom is the only chip that honours arbitrary dates to
   the day (a 7-day window stays 7 days, a custom range stays that range).

   The week/month/quarter bodies below are the ones SummaryPage has always used,
   lifted verbatim so the page and this helper cannot drift apart:
   - week    → the current Monday to Sunday
   - month   → the selected month, snapped OUT to whole Mon–Sun weeks that still
               end inside the month (so September can read 31 Aug → 27 Sep)
   - quarter → the whole of the current year, 1 Jan → 31 Dec
   - custom  → exactly the two dates given
*/

import { format } from 'date-fns';

export type SummaryPeriodId = 'week' | 'month' | 'quarter' | 'custom';

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

/** "This Week": the current Monday through the current Sunday. */
export function weekRange(now: Date = new Date()): PeriodRange {
  const start = getMonday(now);
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

/** "Custom range": exactly the two dates given, empty ones falling back to today. */
export function customRange(startKey: string, endKey: string): PeriodRange {
  const start = startKey ? new Date(startKey) : new Date();
  const end = endKey ? new Date(endKey) : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export interface WindowLanding {
  /** The chip that shows the window; 'custom' unless a chip matches it exactly. */
  period: SummaryPeriodId;
  /** Present when `period` is 'month' — the month that chip should display. */
  monthDate?: Date;
  /** The window itself, which is what the Custom chip shows. */
  customStart: string;
  customEnd: string;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** First-of-month dates for the two months a window could belong to. */
function candidateMonths(from: string, to: string): Date[] {
  const monthOf = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  const start = monthOf(from);
  const end = monthOf(to);
  return start.getTime() === end.getTime() ? [start] : [start, end];
}

/**
 * Which chip can show the window [from, to] without changing it.
 *
 * A chip is chosen only when the dates it produces are EXACTLY the dates that
 * arrived; otherwise the window lands on Custom, which keeps them to the day.
 * Returns null for a window that is not two well-ordered YYYY-MM-DD dates.
 */
export function periodForWindow(
  from: string,
  to: string,
  now: Date = new Date()
): WindowLanding | null {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) return null;

  const landing: WindowLanding = { period: 'custom', customStart: from, customEnd: to };
  const isExact = (range: PeriodRange) => toISODate(range.start) === from && toISODate(range.end) === to;

  if (isExact(weekRange(now))) return { ...landing, period: 'week' };
  if (isExact(quarterRange(now))) return { ...landing, period: 'quarter' };

  /* The Month chip is the only other one that could match. It is keyed by a
     month but shows that month snapped out to whole weeks, so its span can start
     in the month before and end before the month's last day — which means the
     window could belong to either the month it starts in or the month it ends
     in. Both are tried; neither is assumed. */
  for (const monthDate of candidateMonths(from, to)) {
    if (isExact(monthRange(monthDate))) return { ...landing, period: 'month', monthDate };
  }

  return landing;
}
