const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Display weekday for Trip List from the stored PostgreSQL trip_date
 * (YYYY-MM-DD calendar date). Uses UTC calendar parts so the weekday is
 * not shifted by the browser timezone.
 */
export function formatTripListDay(tripDate: string | null | undefined): string {
  if (tripDate == null) return "—";
  const raw = String(tripDate).trim();
  if (!raw) return "—";

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
      utc.getUTCFullYear() !== year ||
      utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day
    ) {
      return "—";
    }
    return WEEKDAYS[utc.getUTCDay()];
  }

  return "—";
}
