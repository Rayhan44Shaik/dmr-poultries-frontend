// src/modules/dashboard/services/operationalTrends.ts
// Trip-level weight data for the Operational Trends chart.
//
// The dashboard's own endpoint only carries trips / sales weight / mortality
// birds per day, so farm weight, delivered weight and weight loss have to come
// from the completed-trips analysis endpoint — the SAME one the Weight Loss /
// Mortality page uses. That is deliberate: the chart and that page can then
// never disagree, and nothing is re-derived on the client beyond summing the
// server's own per-trip numbers into buckets.
//
// Every filtered page is read and bucketed in the component, so switching
// daily / weekly / monthly never costs another request or drops part of a
// custom range.

import { apiGet, ApiError } from "../../../api";
import type { MortalityRow } from "../../operations/mortality/services/mortalityAnalysisApi";

const BASE = "/operations/mortality-analysis";

/** A responsive page size; all pages in the selected range are followed. */
export const TREND_PAGE_SIZE = 500;

export interface OperationalTrends {
  /** Every completed trip in the requested inclusive date range. */
  rows: MortalityRow[];
  /** Server-reported count for the same filtered range. */
  totalTrips: number;
}

const EMPTY_TRENDS: OperationalTrends = { rows: [], totalTrips: 0 };

/** Endpoint missing or no trips in range → empty chart, not a hard error. */
function isEmptyRangeFailure(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 404) return true;
  const status = (err as { status?: number } | null)?.status;
  if (status === 404) return true;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  return /not\s*found|no\s*(completed\s*)?trips|empty/i.test(message);
}

interface OperationalTrendsPage {
  data?: MortalityRow[];
  meta?: {
    total?: number;
    totalPages?: number;
  };
}

export interface OperationalTrendsQuery {
  fromDate?: string;
  toDate?: string;
}

/** The window's bird counts, as the server totals them. */
export interface TrendBirdTotals {
  /** Birds loaded at the farm — what the KPI row calls "Total Birds". */
  farmBirds: number;
  deliveredBirds: number;
  mortalityCount: number;
  totalTrips: number;
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
  signal?: AbortSignal,
): Promise<OperationalTrends> {
  const baseParams: Record<string, string | number> = {
    limit: TREND_PAGE_SIZE,
    sortBy: "tripDate",
    // Ascending keeps chart buckets naturally ordered even before aggregation.
    sortDir: "asc",
  };
  if (query.fromDate) baseParams.fromDate = query.fromDate;
  if (query.toDate) baseParams.toDate = query.toDate;

  const fetchPage = async (
    page: number,
  ): Promise<OperationalTrendsPage | MortalityRow[]> => {
    const { data } = await apiGet<OperationalTrendsPage | MortalityRow[]>(
      BASE,
      {
        params: { ...baseParams, page },
        signal,
        quiet404: true,
      },
    );
    return data;
  };

  try {
    const first = await fetchPage(1);
    // Older backends may return a bare array. It has no pagination metadata, so
    // it is necessarily the complete response supplied by that backend.
    if (Array.isArray(first)) {
      return { rows: first, totalTrips: first.length };
    }

    const rows = Array.isArray(first.data) ? [...first.data] : [];
    const totalTrips = Number(first.meta?.total);
    const totalPages = Number(first.meta?.totalPages);
    if (
      !Number.isSafeInteger(totalTrips) ||
      totalTrips < 0 ||
      !Number.isSafeInteger(totalPages) ||
      totalPages < 1
    ) {
      // Missing / unimplemented endpoint often returns an empty JSON body with
      // 200, or a bare 404 — treat both as "no trips in this window".
      if (rows.length === 0 && (!totalTrips || totalTrips === 0)) {
        return EMPTY_TRENDS;
      }
      throw new Error(
        "The completed-trips API did not provide valid pagination metadata",
      );
    }

    // Read every page sequentially so an AbortSignal can stop the work between
    // requests. A chart never presents a partial custom-range total as final.
    for (let page = 2; page <= totalPages; page += 1) {
      const result = await fetchPage(page);
      if (Array.isArray(result)) {
        throw new Error(
          "The completed-trips API changed its pagination response",
        );
      }
      if (!Array.isArray(result.data)) {
        throw new Error("The completed-trips API returned an incomplete page");
      }
      rows.push(...result.data);
    }

    const distinctTrips = new Set(rows.map((row) => row.tripId));
    if (rows.length !== totalTrips || distinctTrips.size !== totalTrips) {
      throw new Error("The completed-trips API returned an incomplete range");
    }

    return { rows, totalTrips };
  } catch (err) {
    if (isEmptyRangeFailure(err)) return EMPTY_TRENDS;
    throw err;
  }
}

/**
 * Bird totals for a window, straight from the endpoint's own aggregates (a
 * one-row request — the kpis cover the whole filtered set, not the page). Used
 * by the KPI row, which counts birds rather than weighing them.
 */
export async function fetchTrendBirds(
  query: OperationalTrendsQuery,
  signal?: AbortSignal,
): Promise<TrendBirdTotals> {
  const params: Record<string, string | number> = { limit: 1 };
  if (query.fromDate) params.fromDate = query.fromDate;
  if (query.toDate) params.toDate = query.toDate;

  const { data } = await apiGet<Record<string, unknown>>(BASE, {
    params,
    signal,
  });
  const kpis = (data as { kpis?: Record<string, unknown> } | null)?.kpis ?? {};

  return {
    farmBirds: toNumber(kpis.farmBirds),
    deliveredBirds: toNumber(kpis.deliveredBirds),
    mortalityCount: toNumber(kpis.mortalityCount),
    totalTrips: toNumber(kpis.totalTrips),
  };
}
