/**
 * Mortality & Weight Loss Analysis — API client.
 *
 * CONTRACT
 * --------
 *   GET /api/operations/mortality-analysis
 *   GET /api/operations/mortality-analysis/:tripId/deliveries
 *
 * The interfaces below mirror the backend response field-for-field. There is no
 * local re-derivation of any business number: every KPI, percentage and total is
 * computed by the backend from the same SQL expressions used everywhere else in
 * the app, so the page can never drift from Trip Entry or Shop Sales.
 *
 * Both calls accept an AbortSignal so a fast filter change cancels the previous
 * in-flight request instead of racing it (last-write-wins is not guaranteed
 * otherwise, and a slow earlier response could overwrite a newer one).
 */

import { apiGet } from "../../../../api";

const BASE = "/operations/mortality-analysis";

/** One row of the Completed Trips table. Mirrors MortalityRow on the server. */
export interface MortalityRow {
  tripId: number;
  tripNo: string;
  /** Local calendar date, `YYYY-MM-DD`. */
  tripDate: string;
  sourceFarm: string;
  supervisorName: string;
  vehicleNo: string;
  driverName: string;
  /** Crew names, straight off the trip record. */
  loaders: string[];
  helpers: string[];
  /** Always "Completed" — the endpoint is restricted to finished trips. */
  status: string;
  /** Birds loaded at the farm. */
  farmBirds: number;
  /** Weight loaded at the farm (kg). */
  farmWeight: number;
  /** Number of shops that received this trip. */
  deliveryShops: number;
  deliveredBirds: number;
  deliveredWeight: number;
  mortalityCount: number;
  mortalityWeight: number;
  weightLoss: number;
  weightLossPercentage: number;
  mortalityPercentage: number;
  /** 0–1 fraction, exactly as stored by the backend. */
  survivalRate: number;
}

/** Aggregates over the whole filtered set — never just the current page. */
export interface MortalityKpis {
  totalTrips: number;
  farmBirds: number;
  farmWeight: number;
  deliveryShops: number;
  deliveredBirds: number;
  deliveredWeight: number;
  mortalityCount: number;
  mortalityWeight: number;
  mortalityPercentage: number;
  weightLoss: number;
  weightLossPercentage: number;
}

export interface MortalityMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MortalityFilterOptions {
  farms: string[];
  supervisors: string[];
}

export interface MortalityAnalysisResponse {
  data: MortalityRow[];
  meta: MortalityMeta;
  kpis: MortalityKpis;
  filterOptions: MortalityFilterOptions;
}

/** Shop-level line for one expanded trip. */
export interface MortalityDelivery {
  id: number;
  serialNo: number | null;
  shopName: string;
  birdType: string;
  birds: number;
  weight: number;
  mortality: number;
  mortalityWeight: number;
  rate: number | null;
  amount: number;
  remarks: string;
}

/**
 * Query sent to the server. Every field maps 1:1 to a validated zod param —
 * the server rejects anything else with a 400, so no client-side sanitising
 * is needed or wanted here.
 */
export interface MortalityQuery {
  fromDate?: string;
  toDate?: string;
  farm?: string;
  supervisor?: string;
  search?: string;
  sortBy?: SortBy;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** Must stay in sync with MORTALITY_SORT_COLUMNS on the server. */
export type SortBy =
  | "tripDate"
  | "tripNo"
  | "sourceFarm"
  | "supervisorName"
  | "farmBirds"
  | "farmWeight"
  | "deliveryShops"
  | "deliveredBirds"
  | "deliveredWeight"
  | "mortalityCount"
  | "mortalityWeight"
  | "mortalityPercentage"
  | "weightLoss"
  | "weightLossPercentage";

/** Drop keys the user cleared, so defaults apply server-side. */
function cleanParams(query: MortalityQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = value;
  }
  return params;
}

/**
 * Fetch one screen-worth of analysis: rows + KPIs + dropdown options.
 * Rejects with the shared API error shape on failure.
 */
export async function fetchMortalityAnalysis(
  query: MortalityQuery,
  signal?: AbortSignal
): Promise<MortalityAnalysisResponse> {
  const { data } = await apiGet<MortalityAnalysisResponse>(BASE, {
    params: cleanParams(query),
    signal,
  });
  return data;
}

/**
 * Shop-level detail for a single expanded row. Fetched lazily on expand — the
 * table itself only needs the shop COUNT, which already ships with each row.
 */
/**
 * Shop-level delivery lines for ONE trip.
 *
 * Kept in the service layer next to the list call it belongs to. The mortality
 * page itself shows the shop COUNT from the row (and the trip panel shows trip
 * + weight detail only), so the shop-wise breakdown is read by the Delivery
 * screens; this stays the single typed accessor for that endpoint.
 */
export async function fetchTripDeliveries(
  tripId: number,
  signal?: AbortSignal
): Promise<MortalityDelivery[]> {
  const { data } = await apiGet<MortalityDelivery[]>(
    `${BASE}/${tripId}/deliveries`,
    { signal }
  );
  return data;
}
