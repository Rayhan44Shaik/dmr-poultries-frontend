import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, isAfter, isBefore, startOfDay } from 'date-fns';
import { isCanceledError } from '../../../api/errors';
import emiApi from '../services/emiApi';
import { fleetCacheInvalidate } from '../services/fleetSessionCache';
import type {
  EmiOverview,
  EmiOverviewStatus,
  EmiPayInput,
  VehicleEmiInstallment,
} from '../types';

function matchesFilters(
  row: EmiOverview,
  vehicleId: string,
  status: EmiOverviewStatus | 'all',
  search: string
): boolean {
  if (vehicleId !== 'all' && String(row.vehicleId) !== vehicleId) return false;
  if (status !== 'all' && row.status !== status) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return row.vehicleNo.toLowerCase().includes(q) || row.financeCompany.toLowerCase().includes(q);
}

/**
 * EMI Management data hook.
 *
 * The page is a READ/VIEW surface: it consumes GET /api/fleet/emis/overview,
 * which derives every row from the Vehicle Master (active vehicles only) plus
 * the existing EMI payment schedule. There is no separate vehicle/EMI source,
 * no localStorage financial authority, and no create/edit/delete of a vehicle
 * from this hook. Only EMI payments advance the schedule via the existing
 * backend payment endpoint.
 */
export function useEmiData() {
  const [allRecords, setAllRecords] = useState<EmiOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('all');
  const [status, setStatus] = useState<EmiOverviewStatus | 'all'>('all');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const loadGen = useRef(0);
  const listInFlight = useRef(false);
  const savingRef = useRef(false);
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

  const records = useMemo(
    () => allRecords.filter((row) => matchesFilters(row, vehicleId, status, search)),
    [allRecords, vehicleId, status, search]
  );

  /** All active vehicles from the master, for the vehicle filter dropdown. */
  const vehicles = useMemo(
    () => allRecords.map((row) => ({ id: row.vehicleId, vehicleNumber: row.vehicleNo })),
    [allRecords]
  );

  /** Dashboard cards — aggregated from the same backend overview rows. */
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const upcomingLimit = addDays(today, 30);
    let monthly = 0;
    let paid = 0;
    let remaining = 0;
    let pending = 0;
    let upcoming = 0;
    let overdue = 0;
    for (const item of allRecords) {
      const emi = Number(item.monthlyEmi || 0);
      monthly += emi;
      paid += Number(item.completedEMIs || 0) * emi;
      remaining += Number(item.pendingEMIs || 0) * emi;
      if (item.status === 'pending') pending += 1;
      if (item.emiDate) {
        const due = startOfDay(new Date(item.emiDate));
        if (isAfter(due, today) && isBefore(due, upcomingLimit)) upcoming += 1;
        if (item.status === 'pending' && isBefore(due, today)) overdue += 1;
      }
    }
    return { monthly, paid, remaining, pending, upcoming, overdue };
  }, [allRecords]);

  /**
   * Record an EMI payment. The same logical retry (lost HTTP response) reuses
   * a stable idempotency key bound to this EMI record + completed count.
   */
  const paymentKeys = useRef<Map<string, string>>(new Map());

  const resolvePayKey = useCallback((id: number, paidEMIs: number, provided?: string) => {
    if (provided?.trim()) return provided.trim();
    const slot = `${id}:${paidEMIs}`;
    const cached = paymentKeys.current.get(slot);
    if (cached) return cached;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(`fleet:emi-pay:${slot}`);
    } catch {
      stored = null;
    }
    const key = stored || (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `emi-${id}-${paidEMIs}-${Date.now()}`);
    paymentKeys.current.set(slot, key);
    try {
      sessionStorage.setItem(`fleet:emi-pay:${slot}`, key);
    } catch {
      /* private mode */
    }
    return key;
  }, []);

  const recordPayment = useCallback(async (id: number, payload: EmiPayInput = {}) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const paidEMIs = Number(payload.paidEMIs ?? 0);
    const idempotencyKey = resolvePayKey(id, paidEMIs, payload.idempotencyKey);
    try {
      const paid = await emiApi.pay(id, { paidBy: payload.paidBy, idempotencyKey });
      fleetCacheInvalidate('analytics:');
      setAllRecords((prev) =>
        prev.map((row) => {
          if (row.emiRecordId !== id) return row;
          const total = row.totalEMIs;
          const completed = Math.min(Number(paid.paidEMIs) || 0, total);
          const pending = Math.max(0, total - completed);
          return {
            ...row,
            completedEMIs: completed,
            pendingEMIs: pending,
            emiDate: pending > 0 ? paid.nextEMIDate : null,
            status: total > 0 && completed < total ? 'pending' : 'completed',
          };
        })
      );
      paymentKeys.current.delete(`${id}:${paidEMIs}`);
      try {
        sessionStorage.removeItem(`fleet:emi-pay:${id}:${paidEMIs}`);
      } catch {
        /* ignore */
      }
      return paid;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [resolvePayKey]);

  const loadSchedule = useCallback(
    async (id: number, signal?: AbortSignal): Promise<VehicleEmiInstallment[]> => {
      return emiApi.listSchedule(id, signal);
    },
    []
  );

  return {
    records,
    allRecords,
    vehicles,
    loading,
    refreshing,
    saving,
    error,
    search,
    setSearch,
    vehicleId,
    setVehicleId,
    status,
    setStatus,
    stats,
    refresh,
    recordPayment,
    loadSchedule,
  };
}
