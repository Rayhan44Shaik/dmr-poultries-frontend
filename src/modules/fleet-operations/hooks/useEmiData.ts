import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCanceledError } from '../../../api/errors';
import emiApi from '../services/emiApi';
import { fleetCacheInvalidate } from '../services/fleetSessionCache';
import type { EmiOverview } from '../types';

/**
 * EMI Management data hook — READ ONLY.
 *
 * Consumes the backend-authoritative overview (GET /api/fleet/emis/overview).
 * The page never creates, edits or pays an EMI here — filters and KPIs are
 * arithmetic over the overview rows, so no schedule or write endpoints are used.
 */
export function useEmiData() {
  const [allRecords, setAllRecords] = useState<EmiOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const loadGen = useRef(0);
  const listInFlight = useRef(false);
  const hasLoaded = useRef(false);

  const refresh = useCallback(() => {
    if (listInFlight.current) return;
    fleetCacheInvalidate('emi:');
    setRefreshNonce((value) => value + 1);
  }, []);

  const clearRefreshStatus = useCallback(() => setRefreshStatus('idle'), []);

  // ---- Overview (single controlled list GET, no polling) ----------------
  useEffect(() => {
    const controller = new AbortController();
    const gen = ++loadGen.current;
    listInFlight.current = true;
    setError(null);
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);
    void emiApi
      .overview(controller.signal)
      .then((rows) => {
        if (gen !== loadGen.current) return;
        const wasRefresh = hasLoaded.current;
        hasLoaded.current = true;
        setAllRecords(rows);
        setLastRefreshed(new Date().toISOString());
        if (wasRefresh) setRefreshStatus('success');
      })
      .catch((cause) => {
        if (isCanceledError(cause) || gen !== loadGen.current) return;
        if (hasLoaded.current) {
          setRefreshStatus('error');
        } else {
          setAllRecords([]);
          setError('Unable to load EMI data.');
        }
      })
      .finally(() => {
        if (gen === loadGen.current) {
          listInFlight.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [refreshNonce]);

  // Local date key (yyyy-MM-dd) used for the Overdue derivation.
  const todayKey = useMemo(() => {
    const now = new Date();
    const pad2 = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }, []);

  return {
    allRecords,
    todayKey,
    loading,
    refreshing,
    error,
    refresh,
    refreshStatus,
    clearRefreshStatus,
    lastRefreshed,
  };
}