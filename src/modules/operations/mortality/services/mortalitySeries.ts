// src/modules/operations/mortality/services/mortalitySeries.ts
// -----------------------------------------------------------------------------
// Time-series + scatter input for the Trip Analysis charts on the Weight Loss /
// Mortality page.
//
// Numbers are NOT re-derived here. Every value comes straight from
// GET /api/operations/mortality-analysis rows (farm weight, delivered weight,
// mortality weight, weight loss) and is only SUMMED into time buckets — the
// same grouping the page's table applies. Percentages are derived from those
// server-supplied sums, so the charts can never disagree with the KPI cards.
//
// The rows endpoint is the only contract required, so this works unchanged
// against the real backend (no new endpoint needed).
// -----------------------------------------------------------------------------

import { fetchMortalityAnalysis, type MortalityKpis, type MortalityRow } from "./mortalityAnalysisApi";

/** One point per time bucket — every metric the analysis charts show. */
export interface MortalitySeriesPoint {
  /** Bucket key: `YYYY-MM-DD` (day), `YYYY-Www` (week) or `YYYY-MM` (month). */
  bucket: string;
  /** Short label for the X axis. */
  label: string;
  trips: number;
  farmWeight: number;
  deliveredWeight: number;
  mortalityWeight: number;
  mortalityCount: number;
  weightLoss: number;
  /** Share of farm weight, 0–100. Derived from the sums above. */
  deliveredPct: number;
  mortalityPct: number;
  weightLossPct: number;
  /** Mortality as a share of birds, 0–100 (backend metric, averaged). */
  mortalityBirdPct: number;
}

export type SeriesGranularity = "day" | "week" | "month";

export interface MortalitySeries {
  points: MortalitySeriesPoint[];
  granularity: SeriesGranularity;
  /** True when the backend held more trips than the fetch cap allowed. */
  truncated: boolean;
  /** Trips actually charted (after the cap). */
  countedTrips: number;
  /** Trips the current filter matches, regardless of the cap. */
  totalTrips: number;
  /** The rows behind `points`, for the per-trip risk chart. */
  rows: MortalityRow[];
  /** Server aggregates for the same filtered set — never recomputed here. */
  kpis: MortalityKpis;
}

/** Rows fetched for charting. Comfortably above a full quarter of trips. */
const SERIES_ROW_CAP = 2000;

export interface SeriesFilters {
  fromDate?: string;
  toDate?: string;
  farm?: string;
  supervisor?: string;
  search?: string;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (exported for tests)                                  */
/* ------------------------------------------------------------------ */

/** ISO week key (Monday-start), e.g. `2026-W37`. */
export function weekBucketOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7; // Sunday = 7
  date.setUTCDate(date.getUTCDate() + 4 - day); // Thursday of this week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** `YYYY-MM` for monthly buckets. */
export function monthBucketOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Readable axis label for a bucket key. */
export function bucketLabel(bucket: string, granularity: SeriesGranularity): string {
  if (granularity === "month") {
    const [year, month] = bucket.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  if (granularity === "week") {
    const week = bucket.split("W")[1];
    return `W${Number(week)}`;
  }
  const [y, m, d] = bucket.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Pick a granularity that keeps the chart readable: daily for short windows,
 * weekly for a quarter, monthly beyond that.
 */
export function chooseGranularity(distinctDays: number): SeriesGranularity {
  if (distinctDays <= 31) return "day";
  if (distinctDays <= 180) return "week";
  return "month";
}

const pctOf = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 10_000) / 100 : 0;

/**
 * Group rows into buckets. Pure: same rows in → same series out.
 */
export function buildSeries(rows: MortalityRow[], granularity: SeriesGranularity): MortalitySeriesPoint[] {
  const groups = new Map<
    string,
    {
      trips: number;
      farmWeight: number;
      deliveredWeight: number;
      mortalityWeight: number;
      mortalityCount: number;
      weightLoss: number;
      farmBirds: number;
    }
  >();

  for (const row of rows) {
    const date = row.tripDate?.slice(0, 10);
    if (!date) continue;
    const key =
      granularity === "day" ? date : granularity === "week" ? weekBucketOf(date) : monthBucketOf(date);
    const bucket =
      groups.get(key) ??
      {
        trips: 0,
        farmWeight: 0,
        deliveredWeight: 0,
        mortalityWeight: 0,
        mortalityCount: 0,
        weightLoss: 0,
        farmBirds: 0,
      };
    bucket.trips += 1;
    bucket.farmWeight += Number(row.farmWeight) || 0;
    bucket.deliveredWeight += Number(row.deliveredWeight) || 0;
    bucket.mortalityWeight += Number(row.mortalityWeight) || 0;
    bucket.mortalityCount += Number(row.mortalityCount) || 0;
    bucket.weightLoss += Number(row.weightLoss) || 0;
    bucket.farmBirds += Number(row.farmBirds) || 0;
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      // Round only for display; the sums stay exact so totals match the KPIs.
      const round = (n: number) => Math.round(n * 100) / 100;
      const farmWeight = round(value.farmWeight);
      const deliveredWeight = round(value.deliveredWeight);
      const mortalityWeight = round(value.mortalityWeight);
      const weightLoss = round(value.weightLoss);
      return {
        bucket: key,
        label: bucketLabel(key, granularity),
        trips: value.trips,
        farmWeight,
        deliveredWeight,
        mortalityWeight,
        mortalityCount: value.mortalityCount,
        weightLoss,
        deliveredPct: pctOf(deliveredWeight, farmWeight),
        mortalityPct: pctOf(mortalityWeight, farmWeight),
        weightLossPct: pctOf(weightLoss, farmWeight),
        mortalityBirdPct: pctOf(value.mortalityCount, value.farmBirds),
      };
    });
}

/**
 * Fetch every trip in the current filter and bucket it for the charts.
 * Sorting is ascending by date so bucket order never depends on the server.
 */
export async function fetchMortalitySeries(
  filters: SeriesFilters,
  signal?: AbortSignal
): Promise<MortalitySeries> {
  const response = await fetchMortalityAnalysis(
    {
      sortBy: "tripDate",
      sortDir: "asc",
      page: 1,
      limit: SERIES_ROW_CAP,
      ...filters,
    },
    signal
  );

  const rows = response.data;
  const distinctDays = new Set(rows.map((row) => row.tripDate?.slice(0, 10))).size;
  const granularity = chooseGranularity(distinctDays);

  return {
    points: buildSeries(rows, granularity),
    granularity,
    truncated: response.meta.total > rows.length,
    countedTrips: rows.length,
    totalTrips: response.meta.total,
    rows,
    kpis: response.kpis,
  };
}
