// src/modules/staff/hooks/usePerformanceRowWarmup.ts
//
// ============================================================================
// ROW WARM-UP — make a row click land on ALREADY-LOADED details
// ============================================================================
// The driver / supervisor pages load one person's detail (vehicle breakdown +
// recent trips) when a row is opened. That is one request, and it is fast — but
// it still means a skeleton frame between the click and the data.
//
// This hook removes that frame by warming the SAME shared detail cache the
// pop-up reads (see `prefetchPerformanceDetail`), with two entry points:
//
//   • `warmOnHover(id)`  — pointer rests on a row. DEBOUNCED, so sweeping the
//     mouse down the table does not spray requests: every enter restarts the
//     timer and leaving the row cancels it, so at most ONE row is warmed.
//   • `warmNow(id)`      — explicit intent (keyboard focus, or the open pop-up's
//     ‹ › neighbours). Cancels any pending hover timer and warms immediately.
//
// Guarantees: no React state (so it can never re-render the table), no request
// when the entry is cached or already in flight, no request after unmount, and
// no error ever escapes — warm-up is best-effort by definition.
// ============================================================================

import { useCallback, useEffect, useRef } from "react";
import { prefetchPerformanceDetail } from "./usePerformanceDetail";
import type { StaffPerformanceKind } from "../types/performance";

/** How long the pointer must REST on a row before its detail is requested. */
const HOVER_SETTLE_MS = 140;

export interface PerformanceRowWarmup {
  /** Pointer entered a row — warm it only if the pointer settles there. */
  warmOnHover: (personId: number | null) => void;
  /** Pointer left the row — cancel a pending warm-up. */
  cancelWarmup: () => void;
  /** Explicit intent (focus / neighbours / opening) — warm right away. */
  warmNow: (personId: number | null) => void;
}

export function usePerformanceRowWarmup(
  kind: StaffPerformanceKind,
  fromDate: string,
  toDate: string,
): PerformanceRowWarmup {
  const timer = useRef<number | null>(null);

  const cancelWarmup = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Never fire a warm-up after the page unmounts.
  useEffect(() => cancelWarmup, [cancelWarmup]);

  const warmNow = useCallback(
    (personId: number | null) => {
      cancelWarmup();
      prefetchPerformanceDetail(kind, personId, { fromDate, toDate });
    },
    [cancelWarmup, kind, fromDate, toDate],
  );

  const warmOnHover = useCallback(
    (personId: number | null) => {
      cancelWarmup();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        prefetchPerformanceDetail(kind, personId, { fromDate, toDate });
      }, HOVER_SETTLE_MS);
    },
    [cancelWarmup, kind, fromDate, toDate],
  );

  return { warmOnHover, cancelWarmup, warmNow };
}
