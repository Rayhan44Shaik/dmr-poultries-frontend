/**
 * =============================================================================
 * DMR Poultries ERP — DatePicker date primitives
 * =============================================================================
 * Pure, component-free half of the shared DatePicker: the CD/ISO formats, the
 * month labels and the local (UTC-shift-free) parse/format helpers.
 *
 * They live here rather than in `DatePicker.tsx` so that the component module
 * exports only components (react-refresh/only-export-components), and so the
 * public helpers in `./datePickerUtils` can share the exact same parsing code.
 *
 * Nothing in this file may import React or any component.
 * =============================================================================
 */

import { format, isValid, parse, startOfDay, isBefore, isAfter } from "date-fns";

/* =============================================================================
 * Constants
 * ============================================================================= */

export const DISPLAY_FORMAT = "dd/MM/yyyy";
export const VALUE_FORMAT = "yyyy-MM-dd";
export const WEEK_STARTS_ON = 1 as const; // Monday — Indian ERP convention

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/* =============================================================================
 * Date helpers (local calendar — no UTC shift)
 * ============================================================================= */

export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODateLocal(iso: string | undefined | null): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return undefined;
  const [y, m, d] = iso.trim().split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (!isValid(date)) return undefined;
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return undefined;
  }
  return date;
}

export function parseDisplayDate(text: string): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Strict DD/MM/YYYY
  const strict = parse(trimmed, DISPLAY_FORMAT, new Date());
  if (isValid(strict) && format(strict, DISPLAY_FORMAT) === trimmed) {
    return strict;
  }

  // Tolerant: D/M/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const normalized = trimmed.replace(/[-.]/g, "/");
  const parts = normalized.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map((p) => p.trim());
    if (dd && mm && yyyy && yyyy.length === 4) {
      const candidate = parse(
        `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`,
        DISPLAY_FORMAT,
        new Date()
      );
      if (isValid(candidate)) return candidate;
    }
  }

  // Also accept YYYY-MM-DD typed manually
  const iso = parseISODateLocal(trimmed);
  if (iso) return iso;

  return undefined;
}

export function formatDisplay(date: Date | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, DISPLAY_FORMAT);
}

export function formatValue(date: Date | undefined): string {
  if (!date || !isValid(date)) return "";
  return toLocalISODate(date);
}

export function isDateDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date
): boolean {
  const day = startOfDay(date);
  if (minDate && isBefore(day, startOfDay(minDate))) return true;
  if (maxDate && isAfter(day, startOfDay(maxDate))) return true;
  return false;
}

export function clampToBounds(date: Date, minDate?: Date, maxDate?: Date): Date {
  let result = date;
  if (minDate && isBefore(startOfDay(result), startOfDay(minDate))) {
    result = minDate;
  }
  if (maxDate && isAfter(startOfDay(result), startOfDay(maxDate))) {
    result = maxDate;
  }
  return result;
}
