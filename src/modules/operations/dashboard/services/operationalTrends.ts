// src/modules/operations/dashboard/services/operationalTrends.ts
// Trip-level weight data for the Operational Trends chart.
//
// The dashboard's own endpoint only carries trips / sales weight / mortality
// birds per day, so farm weight, delivered weight and weight loss have to come
// from the completed-trips analysis endpoint — the SAME one the Weight Loss /
// Mortality page uses. That is deliberate: the chart and that page can then
// never disagree, and nothing is re-derived on the client beyond summing the
// server's own per-trip numbers into buckets.
//
// Rows are returned whole (capped) and bucketed in the component, so switching
// daily / weekly / monthly never costs another request.

import { apiGet } from "../../../../api";
import type { MortalityRow } from "../../mortality/services/mortalityAnalysisApi";

const BASE = "/operations/mortality-analysis";

/** Hard ceiling on rows pulled for the chart. */
export const TREND_ROW_CAP = 2000;

export interface OperationalTrends {
  rows: MortalityRow[];
  /** Trips in the API's whole filtered set (may exceed `rows.length`). */
  totalTrips: number;
  /** Trips actually bucketed into the chart. */
  countedTrips: number;
  /** True when the cap bit and the chart covers only the newest trips. */
  truncated: boolean;
}

export interface OperationalTrendsQuery {
  fromDate?: string;
  toDate?: string;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Completed trips for the dashboard's global calendar range.
 * Passes the range straight through, so the chart always describes the same
 * window as the KPI cards above it.
 */
export async function fetchOperationalTrends(
  query: OperationalTrendsQuery,
  signal?: AbortSignal
): Promise<OperationalTrends> {
  const params: Record<string, string | number> = {
    limit: TREND_ROW_CAP,
    sortBy: "tripDate",
    sortDir: "asc",
  };
  if (query.fromDate) params.fromDate = query.fromDate;
  if (query.toDate) params.toDate = query.toDate;

  const { data } = await apiGet<Record<string, unknown>>(BASE, { params, signal });

  const rows = (Array.isArray(data) ? data : ((data?.data as MortalityRow[] | undefined) ?? [])) as MortalityRow[];
  const total = toNumber((data as { meta?: { total?: number } } | null)?.meta?.total) || rows.length;

  return {
    rows,
    totalTrips: total,
    countedTrips: rows.length,
    truncated: rows.length < total,
  };
}
