// src/shared/kpi/kpiRange.ts
/* Deep-linking a dashboard KPI to the page that analyses it.

   The Operations dashboard always shows a window (say the last 7 days) measured
   against the equal-length window before it. Clicking a KPI carries BOTH windows
   to the analysis page, so it opens filtered to exactly the same dates — and can
   flip to the previous window without walking back to the dashboard.

   The previous window is DERIVED from `from`/`to` (same arithmetic the dashboard
   hook uses: [from - days, from - 1]) rather than trusted from the URL, so
   "7 days here" can only ever mean "7 days there". */

export type KpiWindow = "current" | "previous";

export interface KpiRange {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
}

export interface KpiDrill extends KpiRange {
  /** KPI key, e.g. "trips" — see KPI_ANALYSIS_TAB. */
  kpi: string;
  /** Operations tab that analyses this KPI. */
  tab: string;
  /** Which of the two windows the URL asks for. */
  win: KpiWindow;
  /** Window the page must filter by right now. */
  activeFrom: string;
  activeTo: string;
  /** Window that `active` is being compared against (empty if unknown). */
  compareFrom: string;
  compareTo: string;
}

/** Which analysis page each KPI belongs to. */
export const KPI_ANALYSIS_TAB: Record<string, string> = {
  trips: "trip-list",
  birds: "trip-list",
  weight: "shop-sales",
  sales: "shop-sales",
  collections: "collection-report",
  pending: "pending-collections",
  expenses: "fuel-expenses",
};

/** i18n key holding each KPI's full name, for the range bar's caption. */
export const KPI_LABEL_KEY: Record<string, string> = {
  trips: "ops.dashboard.kpi_total_trips",
  birds: "ops.dashboard.kpi_total_birds",
  weight: "ops.dashboard.kpi_total_weight",
  sales: "ops.dashboard.kpi_total_sales",
  collections: "ops.dashboard.kpi_total_collections",
  pending: "ops.dashboard.kpi_pending_collections",
  expenses: "ops.dashboard.kpi_total_expenses",
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isDateKey = (value: string | null): value is string => !!value && DATE_KEY.test(value);

/** Local YYYY-MM-DD (the format every ops date filter compares against). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const shiftDays = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  if (isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/** The equal-length window immediately before [from, to]; null if invalid. */
export function windowBefore(
  from: string,
  to: string
): { prevFrom: string; prevTo: string; days: number } | null {
  if (!isDateKey(from) || !isDateKey(to)) return null;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days <= 0) return null;
  const prevFrom = shiftDays(from, -days);
  const prevTo = shiftDays(from, -1);
  if (!prevFrom || !prevTo) return null;
  return { prevFrom, prevTo, days };
}

/** Builds `/operations?tab=…&kpi=…&from=…&to=…&win=…` for a KPI tile. */
export function buildKpiAnalysisPath(
  kpi: string,
  range: { from: string; to: string },
  win: KpiWindow = "current"
): string | null {
  const tab = KPI_ANALYSIS_TAB[kpi];
  if (!tab || !isDateKey(range.from) || !isDateKey(range.to)) return null;
  const params = new URLSearchParams({
    tab,
    kpi,
    from: range.from,
    to: range.to,
    win,
  });
  return `/operations?${params.toString()}`;
}

/** Reads a KPI deep link back out of a query string; null when there is none. */
export function readKpiDrill(search: string): KpiDrill | null {
  const params = new URLSearchParams(search);
  const kpi = params.get("kpi");
  const from = params.get("from");
  const to = params.get("to");
  if (!kpi || !Object.prototype.hasOwnProperty.call(KPI_ANALYSIS_TAB, kpi)) return null;
  if (!isDateKey(from) || !isDateKey(to)) return null;

  const derived = windowBefore(from, to);
  if (!derived) return null;

  // The dashboard may spell the previous window out; otherwise derive it.
  const urlPrevFrom = params.get("prevFrom");
  const urlPrevTo = params.get("prevTo");
  const prevFrom = isDateKey(urlPrevFrom) ? urlPrevFrom : derived.prevFrom;
  const prevTo = isDateKey(urlPrevTo) ? urlPrevTo : derived.prevTo;

  const win: KpiWindow = params.get("win") === "previous" ? "previous" : "current";
  const activeFrom = win === "previous" ? prevFrom : from;
  const activeTo = win === "previous" ? prevTo : to;
  const compare = windowBefore(activeFrom, activeTo);

  return {
    kpi,
    tab: KPI_ANALYSIS_TAB[kpi],
    from,
    to,
    prevFrom,
    prevTo,
    days: derived.days,
    win,
    activeFrom,
    activeTo,
    compareFrom: compare?.prevFrom ?? "",
    compareTo: compare?.prevTo ?? "",
  };
}

/** Same query string with the other window selected. */
export function withKpiWindow(search: string, win: KpiWindow): string {
  const params = new URLSearchParams(search);
  params.set("win", win);
  return `?${params.toString()}`;
}

/** Query string with the KPI deep-link params removed (the tab stays). */
export function withoutKpiDrill(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ["kpi", "from", "to", "prevFrom", "prevTo", "days", "win"]) {
    params.delete(key);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
