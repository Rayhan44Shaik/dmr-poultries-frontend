// src/modules/order/utils/businessTime.ts
// -----------------------------------------------------------------------------
// Business-local time helpers for the Order module.
//
// The business operates in India (Asia/Kolkata, UTC+05:30, no DST). To keep
// every calculation deterministic and free of Date timezone pitfalls, all
// times are represented internally as *minutes since midnight* (business-local)
// and converted to/from "HH:mm" strings at the boundaries. UTC is never mixed
// into local business-time comparisons.
// -----------------------------------------------------------------------------

/** GPS staleness threshold (minutes). */
export const STALE_AFTER_MINUTES = 30;
/** Horizontal accuracy (metres) above which a fix is "poor accuracy". */
export const POOR_ACCURACY_METERS = 100;

/** Delivery buffer thresholds (minutes), as documented constants. */
export const BUFFER_HEALTHY_MIN = 30;
export const BUFFER_TIGHT_MIN = 10;

const MINUTES_PER_DAY = 24 * 60;

/** Parse "HH:mm" into minutes since midnight; null when malformed. */
export function parseHHmm(time: string | null | undefined): number | null {
  if (time == null) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Format minutes-since-midnight back to "HH:mm". */
export function formatHHmm(minutes: number): string {
  if (!Number.isFinite(minutes)) return "--";
  const safe = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Format minutes-since-midnight as a 12-hour clock, e.g. "10:15 AM". */
export function formatClock(minutes: number): string {
  if (!Number.isFinite(minutes)) return "--";
  const safe = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(safe / 60);
  const mins = safe % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  let hours = hours24 % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${String(mins).padStart(2, "0")} ${period}`;
}

/** Format a duration in minutes, e.g. "45m", "2h 00m", "1h 15m". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "--";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

/** Whether a parsed time exists and is valid (not null). */
export function isValidHHmm(time: string | null | undefined): boolean {
  return parseHHmm(time) != null;
}
