// src/sample/quarterSample.ts
// -----------------------------------------------------------------------------
// Detection helper for the in-repo quarter SAMPLE API
// (`scripts/quarter-sample-data.mjs`, started by `npm run dev`).
//
// It exists so the UI can tell sample numbers apart from production numbers —
// it never fabricates, caches or substitutes business data. When the sample
// server is not running (or in a production build) every helper resolves to
// `null` and callers render exactly as they did before.
// -----------------------------------------------------------------------------

import { apiClient } from "../api";

/** Quarter window advertised by the sample server. */
export interface SampleQuarter {
  code: string;
  label: string;
  fromDate: string;
  toDate: string;
  today: string;
}

/** GET /api/quarter-summary payload, reduced to what the UI needs. */
export interface QuarterSampleInfo {
  quarter: SampleQuarter;
  counts: Record<string, number>;
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
        return { quarter, counts } satisfies QuarterSampleInfo;
      })
      .catch(() => null);
  }
  return inflight;
}

/** Test/refresh escape hatch — drops the cached probe result. */
export function resetQuarterSampleCache(): void {
  inflight = null;
}
