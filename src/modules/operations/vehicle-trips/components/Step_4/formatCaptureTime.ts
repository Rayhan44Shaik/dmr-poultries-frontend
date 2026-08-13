/**
 * Normalizes a Shop Delivery capture timestamp into the fixed display
 * format "M/D/YYYY, h:mm:ss AM/PM" — never ISO/Z/UTC.
 *
 * Accepts a fresh Date (new capture), an ISO string (as returned by the
 * backend's auto_capture_time TIMESTAMPTZ column on trip resume/edit), or
 * an already-formatted locale string (from an earlier capture in the same
 * session). It only ever reformats for display — it never invents a new
 * timestamp, so the original captured instant is preserved through edits.
 */
export function formatCaptureTime(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Normalizes any previously-captured value (ISO string from the backend,
 * or a display-formatted locale string) back to a canonical ISO string —
 * the only representation that is safe to persist to the backend's
 * TIMESTAMPTZ column. Falls back to "now" only when there is truly no
 * existing value to preserve.
 */
export function toIsoOrNow(value?: string | Date | null): string {
  if (value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}
