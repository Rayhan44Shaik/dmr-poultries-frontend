/**
 * =============================================================================
 * DMR Poultries ERP — DatePicker public helpers
 * =============================================================================
 * The consumer-facing half of the shared DatePicker. These used to be exported
 * from `DatePicker.tsx`, which made that module export both a component and a
 * bag of helpers (react-refresh/only-export-components). They now live here and
 * the parsing/formatting primitives come from `./datePickerCore`, so the values
 * and formats handed to callers are unchanged.
 *
 * Import `DatePickerUtils`, `dateToPickerValue`, `pickerValueToDate`,
 * `isPickerValue` or `describePickerValue` from this module.
 * =============================================================================
 */

import {
  isValid,
  isSameDay,
  startOfDay,
  startOfWeek,
  endOfWeek,
  endOfDay,
} from "date-fns";
import {
  DISPLAY_FORMAT,
  VALUE_FORMAT,
  WEEK_STARTS_ON,
  MONTH_LABELS,
  MONTH_SHORT,
  toLocalISODate,
  parseISODateLocal,
  parseDisplayDate,
  formatDisplay,
  formatValue,
  isDateDisabled,
  clampToBounds,
} from "./datePickerCore";

/* =============================================================================
 * Re-exports / utilities for consumers
 * ============================================================================= */

export const DatePickerUtils = {
  DISPLAY_FORMAT,
  VALUE_FORMAT,
  WEEK_STARTS_ON,
  MONTH_LABELS,
  MONTH_SHORT,
  toLocalISODate,
  parseISODateLocal,
  parseDisplayDate,
  formatDisplay,
  formatValue,
  isDateDisabled,
  clampToBounds,
  startOfWeekMonday: (d: Date) => startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }),
  endOfWeekSunday: (d: Date) => endOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }),
  startOfDay,
  endOfDay,
};

/* =============================================================================
 * Optional: dual-bound helper used by forms that store Date objects
 * ============================================================================= */

export function dateToPickerValue(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "";
  return toLocalISODate(date);
}

export function pickerValueToDate(value: string | null | undefined): Date | null {
  const parsed = parseISODateLocal(value ?? "");
  return parsed ?? null;
}

/** True when `value` is a non-empty valid YYYY-MM-DD. */
export function isPickerValue(value: unknown): value is string {
  return typeof value === "string" && Boolean(parseISODateLocal(value));
}

/**
 * Build a short human label for chips / filter pills.
 * Examples: "Today", "12 Aug 2026", "Invalid date"
 */
export function describePickerValue(value: string, locale: string = "en-IN"): string {
  const d = parseISODateLocal(value);
  if (!d) return value ? "Invalid date" : "No date";
  if (isSameDay(d, startOfDay(new Date()))) return "Today";
  const yesterday = startOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
