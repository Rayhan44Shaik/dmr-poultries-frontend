/**
 * Shared Shop Ledger date formatting — one implementation for the ledger
 * table, the cumulative view and the View Shop Ledger modal. Dates are
 * parsed LOCALLY: a UTC parse would roll the day back one in IST and label
 * Tuesday rows as Monday.
 */

/** yyyy-MM-dd → dd-MM-yyyy (day-month-year) for table cells and exports. */
export const formatDisplayDate = (value: string): string => {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
/** Telugu short weekdays — same order as WEEKDAY_SHORT (Sunday first). The
 *  active language decides which set renders; underlying dates never change. */
const WEEKDAY_SHORT_TE = [
  "ఆది",
  "సోమ",
  "మంగళ",
  "బుధ",
  "గురు",
  "శుక్ర",
  "శని",
] as const;

/** yyyy-MM-dd → short weekday ("Mon" / "సోమ"). */
export const weekdayOf = (value: string, language: "en" | "te" = "en"): string => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "";
  const [year, month, day] = parts;
  const dow = new Date(year, month - 1, day).getDay();
  return (language === "te" ? WEEKDAY_SHORT_TE : WEEKDAY_SHORT)[dow];
};

/** Compact ledger date: "Sun, 9 Aug 2026" (weekday follows UI language). */
export const formatLedgerDateWithDay = (
  value: string,
  language: "en" | "te" = "en",
): string => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return value;
  const [year, month, day] = parts;
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(
    new Date(year, month - 1, day),
  );
  return `${weekdayOf(value, language)}, ${day} ${monthLabel} ${year}`;
};
