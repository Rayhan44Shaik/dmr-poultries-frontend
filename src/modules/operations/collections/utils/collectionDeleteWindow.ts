/**
 * Collection deletion window — one definition of the 10-day rule.
 *
 * A collection may only be deleted within 10 days of its ENTRY DATE (the
 * collection date). Day 0 is the entry date itself, so the last permissible
 * day is entry date + 10. After that the delete affordance is disabled and
 * must stay disabled; there is no override in the UI.
 *
 * The backend re-checks the same window on DELETE and answers 409
 * `delete_window_closed`, so this module is a convenience for disabling the
 * button and explaining why — never the enforcement point.
 */

/** Inclusive number of days after the entry date during which delete is allowed. */
export const COLLECTION_DELETE_WINDOW_DAYS = 10;

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

/** Whole days elapsed since the entry date. Negative for future-dated entries. */
export function daysSinceEntry(entryDate: string | Date, now: Date = new Date()): number | null {
  const from = startOfDayUtc(entryDate);
  const to = startOfDayUtc(now);
  if (from == null || to == null) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

export interface DeleteWindowState {
  /** True only while the entry is inside the 10-day window. */
  canDelete: boolean;
  /** Whole days since the entry date, or null when the date is unusable. */
  ageInDays: number | null;
  /** Days still remaining, clamped at 0. 0 means today is the last day. */
  daysRemaining: number;
  /** Last date on which deletion is permitted, as `YYYY-MM-DD`. */
  deadline: string | null;
}

/**
 * Resolve the delete window for one collection.
 *
 * An unparseable or missing date is treated as NOT deletable: when we cannot
 * prove the entry is inside the window, the safe answer is to refuse.
 */
export function getDeleteWindow(
  entryDate: string | Date | null | undefined,
  now: Date = new Date(),
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
    from == null
      ? null
      : new Date(from + COLLECTION_DELETE_WINDOW_DAYS * MS_PER_DAY).toISOString().slice(0, 10);

  // Future-dated entries (ageInDays < 0) are still inside the window.
  const canDelete = ageInDays <= COLLECTION_DELETE_WINDOW_DAYS;
  const daysRemaining = Math.max(0, COLLECTION_DELETE_WINDOW_DAYS - Math.max(0, ageInDays));

  return { canDelete, ageInDays, daysRemaining, deadline };
}
