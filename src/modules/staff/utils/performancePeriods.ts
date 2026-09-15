// src/modules/staff/utils/performancePeriods.ts
//
// ============================================================================
// WEEKLY REPORTING PERIODS — Driver/Supervisor Performance
// ============================================================================
// ONE deterministic source for the Monday → Saturday weekly reporting periods
// shown on the performance pages (default range, chart sub-header, axis
// labels). Dates are local calendar business dates (`YYYY-MM-DD`, see
// `utils/businessDate`); no UTC conversion, so a period can never shift by a
// day and impossible dates (2026-09-31) can never be produced.
//
// CONVENTION
//   A reporting week is Monday → Saturday (6 days). Sunday is treated as
//   belonging to the reporting week that ENDED the day before, which matches
//   the six-day operational week used across the ERP. The periods are always
//   calculated from the calendar — nothing is hard-coded.
// ============================================================================

import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import type { Locale } from "date-fns";
import {
  WEEK_STARTS_ON,
  parseBusinessDate,
  toBusinessDate,
} from "../../../utils/businessDate";

/** A Monday → Saturday reporting period as local business dates. */
export interface WeekPeriod {
  /** Monday, `YYYY-MM-DD`. */
  from: string;
  /** Saturday, `YYYY-MM-DD`. */
  to: string;
}

const DAY_MS = 86_400_000;

/** Parse a `YYYY-MM-DD` business date, or return `fallback` when absent/invalid. */
function parseOrToday(value: string | null | undefined, fallback: Date): Date {
  return parseBusinessDate(value ?? "") ?? fallback;
}

/** Monday of the week containing `reference`. */
export function mondayOf(reference: Date | string): Date {
  const base =
    typeof reference === "string"
      ? (parseBusinessDate(reference) ?? new Date())
      : reference;
  return startOfWeek(base, { weekStartsOn: WEEK_STARTS_ON });
}

/** The Monday → Saturday period containing `reference`. */
export function weekPeriodContaining(reference: Date | string): WeekPeriod {
  const monday = mondayOf(reference);
  return {
    from: toBusinessDate(monday),
    to: toBusinessDate(addDays(monday, 5)), // Saturday
  };
}

/**
 * The last `count` Monday → Saturday periods, ending with the week that
 * contains `today`. Fully dynamic — never hard-coded dates.
 */
export function lastWeekPeriods(
  count: number,
  today: Date | string = new Date(),
): WeekPeriod[] {
  const total = Math.max(1, Math.trunc(count));
  // `mondayOf` already understands both a business-date string and a Date —
  // passing the reference straight through keeps an explicit `today` honest
  // (the old Date branch silently fell back to the real current day).
  const anchor = mondayOf(today);
  const periods: WeekPeriod[] = [];
  for (let offset = total - 1; offset >= 0; offset -= 1) {
    const monday = subWeeks(anchor, offset);
    periods.push({
      from: toBusinessDate(monday),
      to: toBusinessDate(addDays(monday, 5)),
    });
  }
  return periods;
}

/**
 * Default filter window for the performance pages: the span of the last four
 * Monday → Saturday periods up to and including today (~one month of data).
 */
export function defaultPerformancePeriod(
  count = 4,
  today: Date | string = new Date(),
): { fromDate: string; toDate: string } {
  const now = parseOrToday(typeof today === "string" ? today : "", new Date());
  const periods = lastWeekPeriods(count, now);
  return { fromDate: periods[0].from, toDate: toBusinessDate(now) };
}

/**
 * Every Monday → Saturday period intersecting `[fromDate, toDate]`, oldest
 * first. Capped at `max` periods so a multi-year range can never render an
 * unbounded list; when capped, the NEWEST periods are kept.
 */
export function periodsForRange(
  fromDate: string,
  toDate: string,
  max = 8,
): WeekPeriod[] {
  const from = parseOrToday(fromDate, new Date());
  const to = parseOrToday(toDate, from);
  const collected: WeekPeriod[] = [];
  let cursor = mondayOf(from);
  const lastMonday = mondayOf(to);
  // Guard against pathological ranges (bad from/to order or huge spans).
  for (let guard = 0; guard < 520; guard += 1) {
    collected.push({
      from: toBusinessDate(cursor),
      to: toBusinessDate(addDays(cursor, 5)),
    });
    if (cursor.getTime() >= lastMonday.getTime()) break;
    cursor = addDays(cursor, 7);
  }
  return collected.length > max ? collected.slice(collected.length - max) : collected;
}

/** Format a business date for display (`10 Aug 2026`). Invalid → `—`. */
export function formatBusinessDate(
  value: string | null | undefined,
  pattern = "d MMM yyyy",
  locale?: Locale,
): string {
  const parsed = parseBusinessDate(value ?? "");
  return parsed ? format(parsed, pattern, { locale }) : "—";
}

/**
 * Short period label: `17 Aug – 22 Aug`. The year is appended when the period
 * crosses a year boundary (`29 Dec 2025 – 3 Jan 2026`).
 */
export function formatPeriodLabel(period: WeekPeriod, locale?: Locale): string {
  const from = parseBusinessDate(period.from);
  const to = parseBusinessDate(period.to);
  if (!from || !to) return "—";
  if (from.getFullYear() !== to.getFullYear()) {
    return `${format(from, "d MMM yyyy", { locale })} – ${format(to, "d MMM yyyy", { locale })}`;
  }
  return `${format(from, "d MMM", { locale })} – ${format(to, "d MMM", { locale })}`;
}

/** Compact axis label for one period: `17 Aug` (start day carries the week). */
export function formatPeriodAxisLabel(period: WeekPeriod, locale?: Locale): string {
  const from = parseBusinessDate(period.from);
  const to = parseBusinessDate(period.to);
  if (!from || !to) return "—";
  if (from.getMonth() !== to.getMonth() || from.getFullYear() !== to.getFullYear()) {
    return `${format(from, "d MMM", { locale })}–${format(to, "d MMM", { locale })}`;
  }
  return `${format(from, "d", { locale })}–${format(to, "d MMM", { locale })}`;
}

const INLINE_ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/;

/**
 * Human label for one `weekly[]` bucket returned by the API.
 *
 * The backend owns the weekly bucketing; its label is preserved untouched as
 * data. For display only: when the label contains a real calendar date (the
 * common case — the bucket's week-start date), the label becomes that bucket's
 * Monday → Saturday window (`7–12 Sep`). Numeric labels render as `W1`, and
 * anything else is shown verbatim so no backend meaning is invented here.
 */
export function weeklyBucketLabel(
  rawWeek: string | number | null | undefined,
  locale?: Locale,
): string {
  if (rawWeek == null || rawWeek === "") return "—";
  if (typeof rawWeek === "number" && Number.isFinite(rawWeek)) {
    return `W${rawWeek}`;
  }
  const text = String(rawWeek).trim();
  const match = INLINE_ISO_DATE.exec(text);
  if (match) {
    const parsed = parseBusinessDate(match[0]);
    if (parsed) {
      return formatPeriodAxisLabel(weekPeriodContaining(parsed), locale);
    }
  }
  if (/^\d+$/.test(text)) return `W${Number(text)}`;
  return text;
}

/**
 * Map API weekly buckets onto axis rows, keeping every bucket the API sent —
 * in the order the API returned them, with its own values untouched. The
 * label is display-only (see `weeklyBucketLabel`).
 */
export function toWeeklyAxisRows<T extends { week: string | number }>(
  weekly: readonly T[] | undefined,
  locale?: Locale,
): Array<T & { label: string }> {
  if (!Array.isArray(weekly)) return [];
  return weekly.map((point) => ({ ...point, label: weeklyBucketLabel(point.week, locale) }));
}

/** Milliseconds in a day (exported for tests). */
export const PERIOD_DAY_MS = DAY_MS;
