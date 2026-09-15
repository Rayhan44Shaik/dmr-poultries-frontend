// src/modules/staff/hooks/usePerformanceDetail.ts
//
// ============================================================================
// READ-ONLY PER-PERSON PERFORMANCE DETAIL HOOK
// ============================================================================
// The details pop-up (PerformanceDrawer) shows one person's vehicle breakdown
// and recent trips. Selection is a pure-UI concern (row click, prev/next
// arrows), so the detail fetch is intentionally SEPARATE from the applied
// list query in `useStaffPerformance`:
//
//   • Navigating the pop-up (arrows) must never shrink or reshuffle the
//     loaded ranking table — only the detail follows the selection.
//   • Same read-only GET endpoints, same params — zero API-contract change.
//   • 60s TTL cache + in-flight dedupe (mirrors the list hook, so flipping
//     back and forth between people does not refetch).
//   • Stale-response generation guard + mounted guard, same as the list hook.
//   • `refreshNonce` (page Refresh) invalidates cached details so Refresh
//     really refreshes.
//   • `detail` is only returned when it belongs to the CURRENTLY selected
//     person — navigating can never flash the previous person's trips.
//   • No fabrication: `detail` stays null until a real response arrives.
//   • `prefetchPerformanceDetail` WARMS that same cache for a person the user
//     is only about to open (row hover / keyboard focus, or the ‹ › neighbour
//     of the open pop-up). It renders nothing, writes no React state and is a
//     no-op when the entry is already cached or already in flight — so a click
//     lands on a complete pop-up (no spinner, no reflow) and the number of
//     requests never grows.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { handleApiError, isCanceledError } from "../../../api/errors";
import { getDriverPerformance, getSupervisorPerformance } from "../services/performanceService";
import type { DriverPerformanceResponse, SupervisorPerformanceResponse } from "../types/performance";
import type {
  DriverPerformanceDetail,
  StaffPerformanceKind,
  SupervisorPerformanceDetail,
} from "../types/performance";

type PerformanceDetail = DriverPerformanceDetail | SupervisorPerformanceDetail;

/** Applied range the detail is fetched for (always the list's applied one). */
export interface PerformanceDetailRange {
  fromDate: string;
  toDate: string;
}

export interface UsePerformanceDetailResult<K extends StaffPerformanceKind> {
  /** Detail for the selected person — null while loading / when absent. */
  detail: (K extends "drivers" ? DriverPerformanceDetail : SupervisorPerformanceDetail) | null;
  /** True while the selected person's detail is being fetched. */
  loading: boolean;
  /** User-readable failure for the selected person (null when fine). */
  error: string | null;
  /** Re-fetch ignoring the TTL cache. */
  reload: () => void;
}

/* ------------------------------ shared cache ------------------------------ */

const TTL_MS = 60_000;
const detailCache = new Map<string, { value: PerformanceDetail; expiresAt: number }>();
const detailInflight = new Map<string, Promise<PerformanceDetail>>();

function detailCacheGet(key: string): PerformanceDetail | undefined {
  const entry = detailCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    detailCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function detailSharedGet(
  key: string,
  loader: () => Promise<DriverPerformanceResponse | SupervisorPerformanceResponse>,
): Promise<PerformanceDetail> {
  const existing = detailInflight.get(key);
  if (existing) return existing;
  const pending = loader()
    .then((value) => {
      const detail = (value.detail ?? null) as PerformanceDetail;
      detailCache.set(key, { value: detail, expiresAt: Date.now() + TTL_MS });
      return detail;
    })
    .finally(() => {
      detailInflight.delete(key);
    });
  detailInflight.set(key, pending);
  return pending;
}

/** One cache key shape for the hook AND the prefetch — never diverges. */
function detailCacheKey(
  kind: StaffPerformanceKind,
  range: PerformanceDetailRange,
  personId: number,
): string {
  return `staff-perf-detail:${kind}:${range.fromDate}|${range.toDate}|${personId}`;
}

function requestDetail(
  kind: StaffPerformanceKind,
  range: PerformanceDetailRange,
  personId: number,
): Promise<DriverPerformanceResponse | SupervisorPerformanceResponse> {
  return kind === "drivers"
    ? getDriverPerformance({
        fromDate: range.fromDate,
        toDate: range.toDate,
        driverId: personId,
      })
    : getSupervisorPerformance({
        fromDate: range.fromDate,
        toDate: range.toDate,
        supervisorId: personId,
      });
}

/**
 * Warm the detail cache for one person without rendering anything.
 *
 * Used by the pages on row hover / focus and for the open pop-up's ‹ ›
 * neighbours, so the pop-up is already complete when it opens. Never throws,
 * never touches React state, and does nothing when the entry is cached or
 * already loading (the caller can spray it — no duplicate request is possible).
 */
export function prefetchPerformanceDetail(
  kind: StaffPerformanceKind,
  personId: number | null | undefined,
  range: PerformanceDetailRange,
): void {
  if (personId == null) return;
  const key = detailCacheKey(kind, range, personId);
  if (detailCacheGet(key) || detailInflight.has(key)) return;
  void detailSharedGet(key, () => requestDetail(kind, range, personId)).catch(() => undefined);
}

/* ---------------------------------- hook ---------------------------------- */

interface DetailState {
  /** Person the stored detail belongs to (null = nothing stored). */
  personId: number | null;
  detail: PerformanceDetail | null;
  error: string | null;
}

const EMPTY_DETAIL_STATE: DetailState = { personId: null, detail: null, error: null };

export function usePerformanceDetail<K extends StaffPerformanceKind>(
  kind: K,
  personId: number | null,
  range: PerformanceDetailRange,
  refreshNonce = 0,
): UsePerformanceDetailResult<K> {
  const [retryNonce, setRetryNonce] = useState(0);
  // State is ONLY written from promise callbacks / microtasks — never
  // synchronously inside the effect body (repo react-hooks rule).
  const [state, setState] = useState<DetailState>(EMPTY_DETAIL_STATE);

  const loadGen = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Only the two date strings are read, so the memo (and the effect below) stay
  // keyed on primitives — a new `range` object literal per render is harmless.
  const cacheKey = useMemo(
    () =>
      personId == null
        ? null
        : detailCacheKey(kind, { fromDate: range.fromDate, toDate: range.toDate }, personId),
    [kind, personId, range.fromDate, range.toDate],
  );

  useEffect(() => {
    if (personId == null || cacheKey == null) return;
    const gen = ++loadGen.current;
    // Page-level Refresh drops cached details so they re-request.
    if (refreshNonce > 0) detailCache.clear();

    const hit = retryNonce === 0 ? detailCacheGet(cacheKey) : undefined;
    if (hit) {
      const snapshot = hit;
      void Promise.resolve().then(() => {
        if (!mounted.current || gen !== loadGen.current) return;
        setState({ personId, detail: snapshot, error: null });
      });
      return;
    }

    void detailSharedGet(cacheKey, () =>
      requestDetail(kind, { fromDate: range.fromDate, toDate: range.toDate }, personId),
    )
      .then((payload) => {
        if (!mounted.current || gen !== loadGen.current) return; // stale — discard
        setState({ personId, detail: payload ?? null, error: null });
      })
      .catch((cause) => {
        if (!mounted.current || isCanceledError(cause) || gen !== loadGen.current) return;
        setState({ personId, detail: null, error: handleApiError(cause) });
      });
  }, [cacheKey, kind, personId, range.fromDate, range.toDate, refreshNonce, retryNonce]);

  /** Event handler — allowed to setState directly. */
  const reload = useCallback(() => setRetryNonce((nonce) => nonce + 1), []);

  const fresh = state.personId != null && state.personId === personId;
  const detail = fresh ? state.detail : null;
  const error = fresh ? state.error : null;
  const loading = personId != null && !fresh;

  return { detail, loading, error, reload } as UsePerformanceDetailResult<K>;
}
