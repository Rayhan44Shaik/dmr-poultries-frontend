// src/modules/operations/dashboard/hooks/useOperationalTrends.ts
// Loads the completed trips behind the Operational Trends chart for whatever
// range the global calendar is showing.
//
// The range is the dashboard's single source of truth: moving the calendar
// refetches (debounced, and the previous request is aborted so a slow response
// can never overwrite a newer one).
//
// Windows already fetched are remembered for the session, so flicking between
// Today / Week / Month / Custom paints instantly instead of waiting on the
// network — the data is still refetched behind it, so it can never go stale.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchOperationalTrends,
  type OperationalTrends,
} from "../services/operationalTrends";

const DEBOUNCE_MS = 120;

/** Session cache — small, and bounded so a long session cannot grow it. */
const CACHE_LIMIT = 12;
const cache = new Map<string, OperationalTrends>();

const keyOf = (fromDate?: string, toDate?: string): string => `${fromDate ?? ""}..${toDate ?? ""}`;

const remember = (key: string, value: OperationalTrends): void => {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
};

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Could not load the weight trend";
}

export interface OperationalTrendsState {
  trends: OperationalTrends | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface TrendsState {
  key: string;
  trends: OperationalTrends | null;
  loading: boolean;
  error: string | null;
}

export function useOperationalTrends(fromDate?: string, toDate?: string): OperationalTrendsState {
  const key = keyOf(fromDate, toDate);
  const cached = cache.get(key) ?? null;

  const [state, setState] = useState<TrendsState>(() => ({
    key,
    trends: null,
    loading: true,
    error: null,
  }));

  // Switching windows is a render-time switch, not an effect: a window we
  // already hold paints at once, and one we do not keeps the previous data on
  // screen while the new figures load (no blank flash, no skeleton).
  if (state.key !== key) {
    setState(
      cached
        ? { key, trends: cached, loading: false, error: null }
        : { key, trends: state.trends, loading: true, error: null }
    );
  }

  const [reloadToken, setReloadToken] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      fetchOperationalTrends({ fromDate, toDate }, controller.signal)
        .then((result) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          remember(key, result);
          setState({ key, trends: result, loading: false, error: null });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setState((current) => ({ ...current, loading: false, error: messageOf(err) }));
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fromDate, toDate, key, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { trends: state.trends, loading: state.loading, error: state.error, refetch };
}
