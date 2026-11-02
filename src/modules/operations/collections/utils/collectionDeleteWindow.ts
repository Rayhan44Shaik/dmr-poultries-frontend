/**
 * Collection deletion window.
 *
 * Pending (never-approved) entries may be deleted on their entry day only.
 * Approved entries follow Shop Sales: 14 days from the moment of approval
 * (`approvedAt`), never from the original collection date.
 *
 * The backend re-checks the same window on DELETE and answers 409, so this
 * module is a convenience for disabling the button and explaining why —
 * never the enforcement point.
 */

/** Inclusive calendar window for pending entries: the entry day only. */
export const PENDING_DELETE_WINDOW_DAYS = 0;

/** Two weeks after approval, matching Shop Sales' 14-day edit window. */
export const COLLECTION_DELETE_WINDOW_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC for a `YYYY-MM-DD` (or ISO) date string, so DST never shifts a day count. */
function startOfDayUtc(value: string | Date): number | null {
  if (value instanceof Date) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function asTimestamp(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/** Whole days elapsed since the entry date. Negative for future-dated entries. */
export function daysSinceEntry(entryDate: string | Date, now: Date = new Date()): number | null {
  const from = startOfDayUtc(entryDate);
  const to = startOfDayUtc(now);
  if (from == null || to == null) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

export interface DeleteWindowState {
  /** True only while the entry is inside the delete window. */
  canDelete: boolean;
  /** Whole days since the window start, or null when the date is unusable. */
  ageInDays: number | null;
  /** Days still remaining, clamped at 0. 0 with canDelete means today is the last day. */
  daysRemaining: number;
  /** Last date on which deletion is permitted, as `YYYY-MM-DD`. */
  deadline: string | null;
}

/**
 * Resolve a calendar-day delete window from an entry date.
 *
 * An unparseable or missing date is treated as NOT deletable: when we cannot
 * prove the entry is inside the window, the safe answer is to refuse.
 */
export function getDeleteWindow(
  entryDate: string | Date | null | undefined,
  now: Date = new Date(),
  windowDays: number = COLLECTION_DELETE_WINDOW_DAYS,
): DeleteWindowState {
  if (!entryDate) {
    return { canDelete: false, ageInDays: null, daysRemaining: 0, deadline: null };
  }
  const ageInDays = daysSinceEntry(entryDate, now);
  if (ageInDays == null) {
    return { canDelete: false, ageInDays: null, daysRemaining: 0, deadline: null };
  }

  const from = startOfDayUtc(entryDate);
  const deadline =
    from == null ? null : new Date(from + windowDays * MS_PER_DAY).toISOString().slice(0, 10);

  const canDelete = ageInDays <= windowDays;
  const daysRemaining = Math.max(0, windowDays - Math.max(0, ageInDays));

  return { canDelete, ageInDays, daysRemaining, deadline };
}

/**
 * 14-day window from the approval instant — Shop Sales' exclusive end:
 * `now < approvedAt + 14 days`. Missing timestamps refuse deletion.
 */
export function getApprovedDeleteWindow(
  approvedAt: string | Date | null | undefined,
  now: Date = new Date(),
): DeleteWindowState {
  const start = asTimestamp(approvedAt);
  if (start == null) {
    return { canDelete: false, ageInDays: null, daysRemaining: 0, deadline: null };
  }
  const expires = start + COLLECTION_DELETE_WINDOW_DAYS * MS_PER_DAY;
  const remainingMs = expires - now.getTime();
  const canDelete = remainingMs > 0;
  const ageInDays = Math.max(0, Math.floor((now.getTime() - start) / MS_PER_DAY));
  const daysRemaining = canDelete ? Math.max(0, Math.ceil(remainingMs / MS_PER_DAY)) : 0;
  const deadline = new Date(expires - MS_PER_DAY).toISOString().slice(0, 10);
  return { canDelete, ageInDays, daysRemaining, deadline };
}

/**
 * Window for one collection, chosen by its status.
 *
 * Pending → the entry day only. Approved → 14 days from `approvedAt`
 * (falls back to the entry date for legacy rows without an approval stamp).
 */
export function getDeleteWindowForStatus(
  entryDate: string | Date | null | undefined,
  status: string | null | undefined,
  now: Date = new Date(),
  approvedAt?: string | Date | null,
): DeleteWindowState {
  const isPending = String(status ?? "").toLowerCase().startsWith("pending");
  if (isPending) {
    return getDeleteWindow(entryDate, now, PENDING_DELETE_WINDOW_DAYS);
  }
  return getApprovedDeleteWindow(approvedAt ?? entryDate, now);
}
