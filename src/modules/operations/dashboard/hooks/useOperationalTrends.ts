// src/modules/operations/dashboard/hooks/useOperationalTrends.ts
// Loads the completed trips behind the Operational Trends chart for whatever
// range the global calendar is showing.
//
// The range is the dashboard's single source of truth: moving the calendar
// refetches (debounced, and the previous request is aborted so a slow response
// can never overwrite a newer one).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchOperationalTrends,
  type OperationalTrends,
} from "../services/operationalTrends";

const DEBOUNCE_MS = 200;

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

export function useOperationalTrends(fromDate?: string, toDate?: string): OperationalTrendsState {
  const [trends, setTrends] = useState<OperationalTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      fetchOperationalTrends({ fromDate, toDate }, controller.signal)
        .then((result) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setTrends(result);
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
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fromDate, toDate, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { trends, loading, error, refetch };
}
