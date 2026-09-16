// src/sample/quarterSample.ts
// -----------------------------------------------------------------------------
// Detection & sync helper for the in-repo quarter SAMPLE API
// (`scripts/quarter-sample-data.mjs`, started by `npm run dev`).
//
// It exists so the UI can tell sample numbers apart from production numbers —
// it never fabricates, caches or substitutes business data. When the sample
// server is not running (or in a production build) every helper resolves to
// `null` and callers render exactly as they did before.
//
// Perfectly mapped & synced to the Operations module pages:
// - Dashboard Overview
// - Trip Entry & Trip List
// - Rates Entry & Shop Sales
// - Collection Entry, Pending Collections & Collection Report
// - Fuel Expenses
// - Mortality & Weight Loss Analysis
// - Orders (Collection, Assignment, Tracking)
// -----------------------------------------------------------------------------

import { apiClient } from "../api";

/** Quarter window advertised by the sample server. */
export interface SampleQuarter {
  code: string;
  label: string;
  fromDate: string;
  toDate: string;
  today: string;
  months?: string[];
  days?: number;
  rolling?: boolean;
}

/** Operations-specific item counts returned by the sample backend. */
export interface QuarterOperationsCounts {
  tripRecords?: number;
  rateEntries?: number;
  shopSales?: number;
  collections?: number;
  pendingShops?: number;
  mortalityTrips?: number;
  fuelBills?: number;
  orders?: number;
  shops?: number;
  farms?: number;
  vehicles?: number;
  employees?: number;
}

/** GET /api/quarter-summary payload, fully mapped for Operations pages. */
export interface QuarterSampleInfo {
  quarter: SampleQuarter;
  counts: Record<string, number>;
  operationsCounts: QuarterOperationsCounts;
  generatedAt?: string;
  sample: boolean;
}

/** Cached for the session: the answer cannot change while the tab is open. */
let inflight: Promise<QuarterSampleInfo | null> | null = null;

function toQuarter(raw: unknown): SampleQuarter | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const code = typeof q.code === "string" ? q.code : "";
  const fromDate = typeof q.fromDate === "string" ? q.fromDate : "";
  const toDate = typeof q.toDate === "string" ? q.toDate : "";
  if (!fromDate || !toDate) return null;
  return {
    code,
    label:
      typeof q.label === "string" && q.label
        ? q.label
        : `Sample quarter (${fromDate} → ${toDate})`,
    fromDate,
    toDate,
    today: typeof q.today === "string" && q.today ? q.today : toDate,
    months: Array.isArray(q.months) ? (q.months as string[]) : undefined,
    days: typeof q.days === "number" ? q.days : undefined,
    rolling: typeof q.rolling === "boolean" ? q.rolling : undefined,
  };
}

/**
 * Resolve the active sample quarter, or `null` when this deployment is backed
 * by a real backend. Dev/preview only — a production build never probes.
 */
export function getQuarterSampleInfo(): Promise<QuarterSampleInfo | null> {
  if (!import.meta.env.DEV) return Promise.resolve(null);
  if (!inflight) {
    // apiClient (not apiGet) so an absent sample server stays silent: the
    // shared helpers log every failure, and "no sample data here" is a normal
    // outcome rather than an error worth reporting.
    inflight = apiClient
      .get<Record<string, unknown>>("/quarter-summary", { timeout: 2500 })
      .then(({ data }) => {
        if (!data || data.sample !== true) return null;
        const quarter = toQuarter(data.quarter);
        if (!quarter) return null;

        const counts: Record<string, number> = {};
        for (const [key, value] of Object.entries(data)) {
          if (key === "quarter" || key === "sample" || key === "generatedAt") continue;
          if (typeof value === "number") counts[key] = value;
        }

        const operationsCounts: QuarterOperationsCounts = {
          tripRecords: counts.trips ?? counts.tripRecords,
          rateEntries: counts.marketRates ?? counts.rateEntries,
          shopSales: counts.deliveries ?? counts.shopSales,
          collections: counts.collections,
          pendingShops: counts.shops ?? counts.pendingShops,
          mortalityTrips: counts.trips ?? counts.mortalityTrips,
          fuelBills: counts.fuelBills,
          orders: counts.trips ? Math.min(counts.trips, 8) : counts.orders,
          shops: counts.shops,
          farms: counts.farms,
          vehicles: counts.vehicles,
          employees: counts.employees,
        };

        return {
          quarter,
          counts,
          operationsCounts,
          generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : undefined,
          sample: true,
        } satisfies QuarterSampleInfo;
      })
      .catch(() => null);
  }
  return inflight;
}

/**
 * Returns the active quarter sample start date, end date, and business today date,
 * or null if the sample server is not active.
 */
export async function getQuarterSampleRange(): Promise<{ fromDate: string; toDate: string; today: string } | null> {
  const info = await getQuarterSampleInfo();
  if (!info) return null;
  return {
    fromDate: info.quarter.fromDate,
    toDate: info.quarter.toDate,
    today: info.quarter.today,
  };
}

/**
 * Returns the business anchor "today" date from the active sample quarter if active,
 * or null if unavailable.
 */
export async function getQuarterToday(): Promise<string | null> {
  const info = await getQuarterSampleInfo();
  return info?.quarter.today ?? null;
}

/**
 * Check if the sample quarter dataset is currently active.
 */
export async function isSampleQuarterActive(): Promise<boolean> {
  const info = await getQuarterSampleInfo();
  return Boolean(info && info.sample);
}

/** Test/refresh escape hatch — drops the cached probe result. */
export function resetQuarterSampleCache(): void {
  inflight = null;
}
