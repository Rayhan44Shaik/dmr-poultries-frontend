import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCanceledError } from '../../../api/errors';
import emiApi from '../services/emiApi';
import type { EmiOverview } from '../types';

/**
 * EMI Management data hook — READ ONLY.
 *
 * The page consumes GET /api/fleet/emis/overview, which derives every row from
 * the Vehicle Master (Active vehicles only) plus the existing EMI payment
 * schedule. The backend is the sole financial/EMI authority; this hook only
 * fetches, exposes the authoritative rows, and derives the three summary KPIs
 * (total / completed / pending) from that same dataset. There is no separate
 * vehicle/EMI source and no localStorage financial authority.
 */
export function useEmiData() {
  const [allRecords, setAllRecords] = useState<EmiOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const loadGen = useRef(0);
  const listInFlight = useRef(false);
  const hasLoaded = useRef(false);

  const refresh = useCallback(() => {
    if (listInFlight.current) return;
    setRefreshNonce((value) => value + 1);
  }, []);

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
        hasLoaded.current = true;
        setAllRecords(rows);
      })
      .catch((cause) => {
        if (isCanceledError(cause) || gen !== loadGen.current) return;
        if (!hasLoaded.current) setAllRecords([]);
        setError('Unable to load EMI data.');
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

  /** All active vehicles from the master, for the vehicle filter dropdown. */
  const vehicles = useMemo(
    () => allRecords.map((row) => ({ id: row.vehicleId, vehicleNumber: row.vehicleNo })),
    [allRecords]
  );

  /**
   * Three summary KPIs over ALL active vehicles (never the filtered table), so
   * the page summary stays stable regardless of the selected filters.
   *   total = active vehicles
   *   completed + pending = total
   */
  const kpis = useMemo(() => {
    let completed = 0;
    for (const item of allRecords) {
      if (item.status === 'completed') completed += 1;
    }
    return { total: allRecords.length, completed, pending: allRecords.length - completed };
  }, [allRecords]);

  return {
    allRecords,
    vehicles,
    loading,
    refreshing,
    error,
    refresh,
    kpis,
  };
}
