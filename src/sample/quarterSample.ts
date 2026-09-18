// src/sample/quarterSample.ts
// -----------------------------------------------------------------------------
// Detection & mapping layer between the in-repo quarter SAMPLE API
// (`scripts/quarter-sample-data.mjs`, opt-in via `npm run dev:sample` only —
// NOT started by normal `npm run dev`) and the Operations module pages.
//
// It exists so the UI can tell sample numbers apart from production numbers —
// it never fabricates, caches or substitutes business data. When the sample
// server is not running (or in a production build) every helper resolves to
// `null` and callers render exactly as they did before.
//
// ── HOW THE MAPPING STAYS IN SYNC ───────────────────────────────────────────
// Nothing here adds data: the two endpoints below are already published by the
// sample server, this file only reads them.
//
//   GET /api/quarter-summary      quarter window + dataset row counts
//   GET /api/operations/dashboard `moduleCounts` — the Operations quarter map
//
// `moduleCounts` (built by `operationModuleCounts()` in
// scripts/quarter-sample-data.mjs) is the server's own definition of each
// Operations tab's row count, and scripts/verify-quarter-sample-data.mjs already
// audits it against the manifest and the live endpoints. Reading it — instead of
// re-deriving numbers from the manifest — is what keeps this file honest: each
// field below is the same number the corresponding page renders.
//
//   Operations page             moduleCounts field   the page's own endpoint
//   ─────────────────────────   ──────────────────   ────────────────────────────────────────
//   Trip Entry · Trip List      tripRecords          GET /trips · GET /operations/trip-list
//   Rates Entry                 rateEntries          GET /operations/rate-entry
//   Shop Sales                  shopSales            GET /operations/shop-sales
//   Collection Entry · Report   collections          GET /operations/collection-entry(/report)
//   Pending Collections         pendingShops         GET /operations/collection-entry/pending-summary
//   Mortality & Weight Loss     mortalityTrips       GET /operations/mortality-analysis
//   Fuel Expenses               fuelBills            GET /operations/fuel-expenses
//   Orders (day containers)     orders               GET /trips?full=true (ORD-* containers)
//
// Two invariants make the mapping exact rather than approximate, and both are
// asserted live by `npm run check:operations-sync`:
//   · tripRecords = Completed vehicle trips (what Trip List renders); ORD-*
//     containers are never trips, so tripRecords + orders <= manifest.trips
//   · every field equals that page's endpoint total for the same quarter window
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

/**
 * Per-page Operations counts, straight from the sample server's
 * `moduleCounts` block. A field is `undefined` when the sample server did not
 * report it — it is never estimated from another count.
 */
export interface QuarterOperationsCounts {
  /* ── one field per Operations page (source: moduleCounts) ── */
  /** Trip Entry · Trip List · Overview KPI — non-container trips in range. */
  tripRecords?: number;
  /** Rates Entry — delivered trips whose rates are still open. */
  rateEntries?: number;
  /** Shop Sales — live sale/delivery lines in range. */
  shopSales?: number;
  /** Collection Entry · Collection Report — approved collection rows. */
  collections?: number;
  /** Pending Collections — shops carrying an outstanding balance. */
  pendingShops?: number;
  /** Mortality & Weight Loss — completed trips with in-transit losses. */
  mortalityTrips?: number;
  /** Fuel Expenses — fuel bills in range. */
  fuelBills?: number;
  /** Orders — ORD-* day containers holding the order plan. */
  orders?: number;

  /* ── reference data the same pages build their filters from ── */
  shops?: number;
  farms?: number;
  vehicles?: number;
  employees?: number;
}

/** GET /api/quarter-summary payload (quarter window + raw row counts). */
export interface QuarterSampleInfo {
  quarter: SampleQuarter;
  /** Every numeric manifest field, exactly as the sample server published it. */
  counts: Record<string, number>;
  /**
   * Reference-data counts read from the manifest. The per-page Operations
   * counts need `getOperationsSampleCounts()` — the manifest does not carry
   * them, and guessing them from it is what made earlier numbers wrong.
   */
  operationsCounts: Pick<QuarterOperationsCounts, "shops" | "farms" | "vehicles" | "employees">;
  generatedAt?: string;
  sample: boolean;
}

/** Cached for the session: neither answer can change while the tab is open. */
let inflight: Promise<QuarterSampleInfo | null> | null = null;
let countsInflight: Promise<QuarterOperationsCounts | null> | null = null;

/**
 * Dev/preview only. Written defensively (like `src/api/config.ts`) so this
 * module is also importable under plain Node — `import.meta.env` does not
 * exist there, and the probe must stay off rather than throw.
 */
function isDev(): boolean {
  return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}

/** Parse a manifest number: finite and non-negative, else `undefined`. */
function toCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Parse the `quarter` block of the manifest. Pure — unit tested. */
export function parseSampleQuarter(raw: unknown): SampleQuarter | null {
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
 * Map a raw GET /api/quarter-summary payload. Pure — unit tested.
 * Only manifest-truthful values are carried; anything the manifest does not
 * publish stays `undefined` instead of being inferred from a sibling count.
 */
export function mapSampleManifest(raw: unknown): QuarterSampleInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (data.sample !== true) return null;
  const quarter = parseSampleQuarter(data.quarter);
  if (!quarter) return null;

  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "quarter" || key === "sample" || key === "generatedAt") continue;
    const count = toCount(value);
    if (count !== undefined) counts[key] = count;
  }

  return {
    quarter,
    counts,
    operationsCounts: {
      shops: toCount(counts.shops),
      farms: toCount(counts.farms),
      vehicles: toCount(counts.vehicles),
      employees: toCount(counts.employees),
    },
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : undefined,
    sample: true,
  } satisfies QuarterSampleInfo;
}

/**
 * Map the per-page Operations counts out of a GET /api/operations/dashboard
 * payload. Pure — unit tested.
 *
 * Every field is read from the server's own `moduleCounts` block. Reference
 * counts (shops/farms/vehicles/employees) come from the already-resolved
 * manifest, which is where the sample server publishes them.
 */
export function mapOperationsCounts(
  raw: unknown,
  manifest: Pick<QuarterSampleInfo, "operationsCounts">
): QuarterOperationsCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const moduleCounts = (raw as Record<string, unknown>).moduleCounts;
  if (!moduleCounts || typeof moduleCounts !== "object") return null;
  const m = moduleCounts as Record<string, unknown>;

  return {
    tripRecords: toCount(m.tripRecords),
    rateEntries: toCount(m.rateEntries),
    shopSales: toCount(m.shopSales),
    collections: toCount(m.collections),
    pendingShops: toCount(m.pendingShops),
    mortalityTrips: toCount(m.mortalityTrips),
    fuelBills: toCount(m.fuelBills),
    orders: toCount(m.orders),
    ...manifest.operationsCounts,
  } satisfies QuarterOperationsCounts;
}

/**
 * Resolve the active sample quarter, or `null` when this deployment is backed
 * by a real backend. Dev/preview only — a production build never probes.
 */
export function getQuarterSampleInfo(): Promise<QuarterSampleInfo | null> {
  if (!isDev()) return Promise.resolve(null);
  if (!inflight) {
    // apiClient (not apiGet) so an absent sample server stays silent: the
    // shared helpers log every failure, and "no sample data here" is a normal
    // outcome rather than an error worth reporting.
    inflight = apiClient
      .get<Record<string, unknown>>("/quarter-summary", { timeout: 2500 })
      .then(({ data }) => mapSampleManifest(data))
      .catch(() => null);
  }
  return inflight;
}

/**
 * Per-page Operations counts for the active sample quarter, read from the same
 * `moduleCounts` block the Operations Overview renders — so a page's headline
 * number and this file can never drift apart.
 *
 * `null` when the sample server is not active, or when the dashboard endpoint
 * did not answer: a missing count is reported as missing, never estimated.
 */
export function getOperationsSampleCounts(): Promise<QuarterOperationsCounts | null> {
  if (!isDev()) return Promise.resolve(null);
  if (!countsInflight) {
    countsInflight = (async () => {
      const info = await getQuarterSampleInfo();
      if (!info) return null;
      const { data } = await apiClient.get<Record<string, unknown>>("/operations/dashboard", {
        params: { fromDate: info.quarter.fromDate, toDate: info.quarter.toDate },
        timeout: 5000,
      });
      return mapOperationsCounts(data, info);
    })().catch(() => null);
  }
  return countsInflight;
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

/** Test/refresh escape hatch — drops the cached probe results. */
export function resetQuarterSampleCache(): void {
  inflight = null;
  countsInflight = null;
}
