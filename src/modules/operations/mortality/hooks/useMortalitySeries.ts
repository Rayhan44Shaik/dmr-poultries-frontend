// src/modules/operations/mortality/hooks/useMortalitySeries.ts
// Series + per-trip scatter input for the Trip Analysis charts.
//
// Follows the page's filter model exactly: the charts follow the APPLIED
// filters (what Search committed), so they always describe the same trip set
// as the table and the KPI cards. One request feeds both the time series and
// the trip-level bubbles, so the page still costs a single round trip.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMortalitySeries,
  type MortalitySeries,
} from "../services/mortalitySeries";
import type { LossFilters } from "./useTripLossAnalysis";

/** One bubble in the trip-risk chart. */
export interface TripRiskPoint {
  tripId: number;
  tripNo: string;
  tripDate: string;
  farm: string;
  vehicleNo: string;
  supervisorName: string;
  /** X axis — shrink from farm to delivered, as a share of farm weight. */
  weightLossPct: number;
  /** Y axis — mortality as a share of birds loaded. */
  mortalityPct: number;
  /** Bubble size — how much weight the trip carried. */
  farmWeight: number;
  farmBirds: number;
  deliveredWeight: number;
  mortalityWeight: number;
  mortalityCount: number;
  weightLoss: number;
}

export interface MortalitySeriesState {
  series: MortalitySeries | null;
  /** Worst-loss trips in the current filter (capped for readability). */
  riskPoints: TripRiskPoint[];
  loading: boolean;
  error: string | null;
}

/** Bubbles beyond this overlap into mush; the worst offenders are kept. */
const RISK_POINT_CAP = 150;

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "Unable to load trip analysis";
}

/** Highest mortality first, with heavy shrinkage breaking ties. */
function riskScore(mortalityPct: number, weightLossPct: number): number {
  return mortalityPct * 2 + Math.max(weightLossPct, 0);
}

export function useMortalitySeries(
  appliedFilters: LossFilters,
  reloadToken: number
): MortalitySeriesState {
  const [series, setSeries] = useState<MortalitySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    const filters = {
      fromDate: appliedFilters.fromDate || undefined,
      toDate: appliedFilters.toDate || undefined,
      farm: appliedFilters.sourceFarm || undefined,
      supervisor: appliedFilters.supervisor || undefined,
      search: appliedFilters.search.trim() || undefined,
    };

    const timer = setTimeout(() => {
      fetchMortalitySeries(filters, controller.signal)
        .then((result) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setSeries(result);
          setError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setError(messageOf(err));
        })
        .finally(() => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [appliedFilters, reloadToken]);

  const riskPoints = useMemo<TripRiskPoint[]>(() => {
    if (!series) return [];
    return series.rows
      .map((row) => ({
        tripId: row.tripId,
        tripNo: row.tripNo,
        tripDate: row.tripDate,
        farm: row.sourceFarm,
        vehicleNo: row.vehicleNo,
        supervisorName: row.supervisorName,
        weightLossPct: Number(row.weightLossPercentage) || 0,
        mortalityPct: Number(row.mortalityPercentage) || 0,
        farmWeight: Number(row.farmWeight) || 0,
        farmBirds: Number(row.farmBirds) || 0,
        deliveredWeight: Number(row.deliveredWeight) || 0,
        mortalityWeight: Number(row.mortalityWeight) || 0,
        mortalityCount: Number(row.mortalityCount) || 0,
        weightLoss: Number(row.weightLoss) || 0,
      }))
      .sort(
        (a, b) => riskScore(b.mortalityPct, b.weightLossPct) - riskScore(a.mortalityPct, a.weightLossPct)
      )
      .slice(0, RISK_POINT_CAP);
  }, [series]);

  return { series, riskPoints, loading, error };
}
