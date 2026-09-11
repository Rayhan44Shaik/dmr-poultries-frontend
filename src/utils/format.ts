// src/utils/format.ts
// -----------------------------------------------------------------------------
// Centralised display formatting for the DMR Poultries ERP.
// Indian locale conventions: ₹1,25,000.00 · 1,245.50 kg · 94,600
// -----------------------------------------------------------------------------

import { translate } from "../i18n";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,25,000.00 */
export function formatINR(value: number): string {
  return inrFormatter.format(Number.isFinite(value) ? value : 0);
}

/** ₹1.25L — compact Indian currency, useful for KPI cards. */
export function formatINRCompact(value: number): string {
  return inrCompactFormatter.format(Number.isFinite(value) ? value : 0);
}

/** 94,600 */
export function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

/** 1,245.50 kg — weights with two decimals. */
export function formatWeight(value: number, unit = "kg"): string {
  return `${decimalFormatter.format(Number.isFinite(value) ? value : 0)} ${unit}`;
}

/** 245 km */
export function formatKM(value: number): string {
  return `${numberFormatter.format(Number.isFinite(value) ? value : 0)} km`;
}

/** "14 Aug 2026" */
export function formatDateShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "14 Aug" */
export function formatDayMonth(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "Thursday, 14 August 2026" */
export function formatDateLong(value: string | Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "2:45 pm" */
export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** Relative time, e.g. "2h ago", "yesterday". */
export function formatRelativeTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return translate("time.just_now");
  if (minutes < 60) return translate("time.min_ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("time.hr_ago", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return translate("time.yesterday");
  if (days < 7) return translate("time.day_ago", { count: days });
  return formatDayMonth(date);
}

/** Greeting based on local time of day. */
export function greetingForHour(hour = new Date().getHours()): string {
  if (hour < 5) return translate("time.greeting_late");
  if (hour < 12) return translate("time.greeting_morning");
  if (hour < 17) return translate("time.greeting_afternoon");
  return translate("time.greeting_evening");
}

/**
 * Normalise an Indian vehicle registration to a spaced, readable form:
 * `TS07UB1222` → `TS 07 UB 1222`. Passes through values that don't match the
 * standard `ST NN XX NNNN` shape unchanged (e.g. already-spaced numbers or
 * older custom plates).
 */
export function formatVehicleNumber(value: string | null | undefined): string {
  if (!value) return "—";
  const raw = String(value).trim();
  const m = /^([A-Z]{2})\s*(\d{2})\s*([A-Z]{1,3})\s*(\d{4})$/i.exec(raw);
  return m ? `${m[1].toUpperCase()} ${m[2]} ${m[3].toUpperCase()} ${m[4]}` : raw;
}

/** ISO date for a day offset from today (e.g. -1 for yesterday). */
export function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
