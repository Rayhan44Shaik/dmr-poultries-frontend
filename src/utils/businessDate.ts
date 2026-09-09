/**
 * =============================================================================
 * BUSINESS DATE HELPERS — calendar-safe date handling for API payloads
 * =============================================================================
 * ONE place for constructing and validating the `YYYY-MM-DD` business dates the
 * app sends to existing APIs. The backend contract is untouched; these helpers
 * only guarantee the frontend never produces a date that does not exist.
 *
 * THE TWO BUGS THIS PREVENTS
 *
 * 1. Invalid calendar dates from string concatenation.
 *    `` `${year}-${month}-31` `` yields `2026-09-31` for September, which is
 *    not a real date. Everything here derives the last day from the calendar
 *    (`endOfMonth`) instead of hard-coding 30/31.
 *
 * 2. `Date.prototype.setMonth` overflow.
 *    `new Date(2025, 2, 31).setMonth(getMonth() + 1)` becomes **1 May**, not
 *    April, because 31 April does not exist and JS silently rolls over. That
 *    made MarketRatePage's "next month" skip a whole month whenever the anchor
 *    day exceeded the target month's length (e.g. Monday 31 March).
 *    `shiftMonths()` below clamps to the last valid day of the target month,
 *    which is the behaviour users expect from a month stepper.
 *
 * TIMEZONE
 *   Business dates are local calendar dates. `toISOString()` is NEVER used
 *   here: it converts to UTC and shifts the day for non-UTC timezones, which
 *   would send yesterday's/tomorrow's date to the API.
 * ===========================================================================*/

import {
  addMonths,
  endOfMonth,
  endOfWeek,
  isValid,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/** Monday-first week, matching the Indian ERP convention used elsewhere. */
export const WEEK_STARTS_ON = 1 as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Format a Date as a LOCAL `YYYY-MM-DD` string. Invalid → empty string. */
export function toBusinessDate(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` string as LOCAL midnight.
 *
 * Rejects dates that do not exist on the calendar: `2026-09-31`, `2026-02-30`
 * and `2026-13-01` all return `undefined` rather than silently rolling over
 * into the next month.
 */
export function parseBusinessDate(value: string | null | undefined): Date | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!ISO_DATE_RE.test(text)) return undefined;

  const [yearPart, monthPart, dayPart] = text.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return undefined;

  // Round-trip check: proves the calendar actually has that day in that month.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** True only for a real, existing `YYYY-MM-DD` calendar date. */
export function isBusinessDate(value: unknown): value is string {
  return typeof value === "string" && parseBusinessDate(value) !== undefined;
}

/**
 * Shift a date by whole months, clamping to the target month's last day.
 *
 * `shiftMonths(31 Jan, 1)` → 28 Feb (or 29 in a leap year), never 3 Mar.
 * Falls back to `reference` when it is not a valid date, so a stepper can never
 * propagate an invalid value into an API call.
 */
export function shiftMonths(
  reference: Date | string | null | undefined,
  months: number,
): Date {
  const base =
    typeof reference === "string"
      ? (parseBusinessDate(reference) ?? new Date())
      : (reference && isValid(reference) ? reference : new Date());

  const shifted = addMonths(startOfMonth(base), Math.trunc(months) || 0);
  // Anchor to the 1st before shifting, then keep the day clamped: this is what
  // makes the operation independent of the anchor day's length.
  const day = Math.min(base.getDate(), endOfMonth(shifted).getDate());
  return new Date(shifted.getFullYear(), shifted.getMonth(), day);
}

/** First day of the month containing `reference`, as `YYYY-MM-DD`. */
export function startOfMonthDate(reference: Date | string): string {
  const base =
    typeof reference === "string"
      ? (parseBusinessDate(reference) ?? new Date())
      : reference;
  return toBusinessDate(startOfMonth(base));
}

/** Last day of the month containing `reference`, as `YYYY-MM-DD`.
 *  Derived from the calendar — never a hard-coded 30/31. */
export function endOfMonthDate(reference: Date | string): string {
  const base =
    typeof reference === "string"
      ? (parseBusinessDate(reference) ?? new Date())
      : reference;
  return toBusinessDate(endOfMonth(base));
}

/**
 * Expand a `YYYY-MM` month-picker value into a valid inclusive date range.
 *
 * Month filters across the app store `"2026-09"`; the API needs real from/to
 * dates. This guarantees the `to` value is the true last day (30 for
 * September, 28/29 for February) instead of an impossible `-31`.
 */
export function monthRange(
  yearMonth: string | null | undefined,
): { from: string; to: string } | null {
  if (typeof yearMonth !== "string") return null;
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  const first = new Date(year, month - 1, 1);
  if (!isValid(first)) return null;

  return { from: toBusinessDate(first), to: toBusinessDate(endOfMonth(first)) };
}

/** Monday–Sunday week containing `reference`, as `YYYY-MM-DD` strings. */
export function weekRange(reference: Date | string = new Date()): { from: string; to: string } {
  const base =
    typeof reference === "string"
      ? (parseBusinessDate(reference) ?? new Date())
      : (isValid(reference) ? reference : new Date());
  return {
    from: toBusinessDate(startOfWeek(base, { weekStartsOn: WEEK_STARTS_ON })),
    to: toBusinessDate(endOfWeek(base, { weekStartsOn: WEEK_STARTS_ON })),
  };
}

/** Today as a `YYYY-MM-DD` local business date. */
export function todayBusinessDate(): string {
  return toBusinessDate(new Date());
}

/**
 * Clamp a date string into an inclusive `[min, max]` window.
 * Used by filter presets so a stored/default value can never fall outside the
 * bounds a DatePicker or report accepts.
 */
export function clampBusinessDate(
  value: string | null | undefined,
  min?: string | null,
  max?: string | null,
): string {
  const parsed = parseBusinessDate(value ?? "");
  if (!parsed) return "";

  let result = parsed;
  const minDate = parseBusinessDate(min ?? "");
  const maxDate = parseBusinessDate(max ?? "");
  if (minDate && result.getTime() < minDate.getTime()) result = minDate;
  if (maxDate && result.getTime() > maxDate.getTime()) result = maxDate;
  return toBusinessDate(result);
}
