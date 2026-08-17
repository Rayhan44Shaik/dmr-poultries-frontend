import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, isAfter, isBefore, startOfDay } from 'date-fns';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { handleApiError } from '../../../api/errors';
import emiApi, { type EmiListParams } from '../services/emiApi';
import type { EmiPaymentInput, EmiSchedule, EmiScheduleInput, EmiStatus } from '../types';

export function useEmiData() {
  const { vehicles } = useVehicles();
  const [records, setRecords] = useState<EmiSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('all');
  const [status, setStatus] = useState<EmiStatus | 'all'>('all');
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: EmiListParams = {
      vehicleId: vehicleId === 'all' ? undefined : vehicleId,
      status,
      search: search.trim() || undefined,
      limit: 250,
    };
    try {
      setRecords(await emiApi.list(params));
    } catch (cause) {
      setRecords([]);
      setError(handleApiError(cause));
    } finally {
      setLoading(false);
    }
  }, [search, status, vehicleId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshToken, search]);

  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);

  const saveSchedule = useCallback(async (payload: EmiScheduleInput, id?: string) => {
    setSaving(true);
    try {
      if (id) await emiApi.update(id, payload);
      else await emiApi.create(payload);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const recordPayment = useCallback(async (id: string, payload: EmiPaymentInput) => {
    setSaving(true);
    try {
      await emiApi.recordPayment(id, payload);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const upcomingLimit = addDays(today, 30);
    const totalEmi = records.reduce((sum, item) => sum + Number(item.emiAmount || 0), 0);
    const paid = records.reduce(
      (sum, item) => sum + Number(item.paidEmis || 0) * Number(item.emiAmount || 0),
      0
    );
    const remaining = records.reduce(
      (sum, item) => sum + Number(item.remainingEmis || 0) * Number(item.emiAmount || 0),
      0
    );
    const overdue = records.filter((item) => item.status === 'overdue').length;
    const upcoming = records.filter((item) => {
      if (!item.nextEmiDate || item.status === 'paid' || item.status === 'closed') return false;
      const due = startOfDay(new Date(item.nextEmiDate));
      return isAfter(due, today) && isBefore(due, upcomingLimit);
    }).length;
    const pending = records.filter((item) => item.status === 'active' || item.status === 'overdue').length;
    return { totalEmi, paid, remaining, overdue, upcoming, pending };
  }, [records]);

  return {
    records,
    vehicles,
    loading,
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
    saveSchedule,
    recordPayment,
  };
}
