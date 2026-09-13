// src/shared/kpi/analysisLink.ts
/* Where a dashboard KPI tile goes.

   Every Operations KPI tile opens the same place — Accounts → Analysis
   (`/accounts?tab=summary`), which is the trip analysis behind all of them —
   carrying the window the dashboard is showing and asking for the comparison to
   be on:

     /accounts?tab=summary&from=2026-09-07&to=2026-09-13&compare=1

   The window travels as plain dates, so "7 days here" is 7 days there, a custom
   calendar range arrives as that exact range, and a month arrives as that month.
   The Analysis page then decides which of its own period chips can show those
   dates without moving them (see modules/accounts/utils/periodRanges.ts) and
   uses its Custom range when none can — so the figures it shows are always the
   figures the tile was showing.

   Keeping this in `shared` is what lets the operations dashboard build the link
   and the accounts page read it back without either module importing the other.
*/

/** Route of the Accounts module; the Analysis page is its `summary` tab. */
export const ANALYSIS_ROUTE = "/accounts";
export const ANALYSIS_TAB = "summary";

export interface AnalysisLink {
  /** Window the dashboard was showing, as local YYYY-MM-DD dates. */
  from: string;
  to: string;
  /** Whether "Compare previous" should be switched on when the page opens. */
  compare: boolean;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isDateKey = (value: string | null): value is string => !!value && DATE_KEY.test(value);

/** Builds the Analysis deep link for a window; null when the window is unusable. */
export function buildAnalysisPath(
  range: { from: string; to: string },
  compare = true
): string | null {
  if (!isDateKey(range.from) || !isDateKey(range.to) || range.from > range.to) return null;
  const params = new URLSearchParams({
    tab: ANALYSIS_TAB,
    from: range.from,
    to: range.to,
    compare: compare ? "1" : "0",
  });
  return `${ANALYSIS_ROUTE}?${params.toString()}`;
}

/** Reads a deep link back out of a query string; null when there is none. */
export function readAnalysisLink(search: string): AnalysisLink | null {
  const params = new URLSearchParams(search);
  const from = params.get("from");
  const to = params.get("to");
  if (!isDateKey(from) || !isDateKey(to) || from > to) return null;
  const compare = params.get("compare");
  return { from, to, compare: compare !== "0" && compare !== "false" };
}

/** A stable key for a link, so a page can tell "same window" from "new window". */
export function analysisLinkKey(link: AnalysisLink | null): string {
  return link ? `${link.from}/${link.to}/${link.compare ? 1 : 0}` : "";
}
