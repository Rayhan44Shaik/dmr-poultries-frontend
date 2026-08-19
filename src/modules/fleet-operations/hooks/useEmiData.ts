import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { handleApiError, isCanceledError } from '../../../api/errors';
import emiApi from '../services/emiApi';
import { fleetCacheGet, fleetCacheInvalidate, fleetCacheSet, fleetSharedGet } from '../services/fleetSessionCache';
import type { EmiOverview, EmiOverviewStatus, VehicleEmiInstallment } from '../types';

const pad2 = (value: number) => String(value).padStart(2, '0');
const monthKeyOf = (dateStr: string) => dateStr.slice(0, 7);

export interface EmiTrendPoint {
  key: string;
  label: string;
  due: number;
  paid: number;
  outstanding: number;
}

export interface UpcomingEmiRow {
  id: string;
  vehicleId: number;
  vehicleNo: string;
  emiRecordId: number | null;
  dueDate: string;
  amount: number;
  daysRemaining: number;
  status: 'overdue' | 'due-soon' | 'upcoming';
}

export interface EmiAttentionItem {
  id: string;
  kind: 'overdue' | 'due-soon' | 'highest-outstanding' | 'highest-emi';
  tone: string;
  title: string;
  detail: string;
  value: string;
}

export interface EmiPlanning {
  rows: EmiOverview[];
  hasAnyData: boolean;
  hasSchedules: boolean;
  monthlyCommitment: number;
  activeLoans: number;
  dueThisMonth: number;
  paidThisMonth: number;
  pendingThisMonth: number;
  overdueAmount: number;
  remainingCommitment: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  trend: EmiTrendPoint[];
  upcoming: UpcomingEmiRow[];
  attention: EmiAttentionItem[];
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export interface EmiFilterState {
  vehicleId: string | number;
  status: EmiOverviewStatus | 'all';
  year: number;
  month: number;
}

/**
 * EMI Management data hook — READ ONLY.
 *
 * Consumes the backend-authoritative overview (GET /api/fleet/emis/overview)
 * plus the persisted installment schedules (GET /api/fleet/emis/:id/schedule)
 * for every pending EMI record. Schedules are fetched once, in parallel,
 * deduplicated and cached (60s TTL) so filters never trigger network traffic.
 *
 * Every planning figure below is arithmetic over those authoritative values:
 * nothing is invented — due/paid/overdue come from installment statuses and
 * monthly commitments come from the overview's monthly EMI amounts.
 */
export function useEmiData() {
  const [allRecords, setAllRecords] = useState<EmiOverview[]>([]);
  const [schedules, setSchedules] = useState<Record<string, VehicleEmiInstallment[]>>({});
  const [loading, setLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [scheduleNonce, setScheduleNonce] = useState(0);

  const loadGen = useRef(0);
  const listInFlight = useRef(false);
  const hasLoaded = useRef(false);
  const schedulesRef = useRef<Record<string, VehicleEmiInstallment[]>>({});
  const scheduleInFlight = useRef(false);

  const refresh = useCallback(() => {
    if (listInFlight.current) return;
    fleetCacheInvalidate('emi:');
    setRefreshNonce((value) => value + 1);
    setScheduleNonce((value) => value + 1);
  }, []);

  const clearRefreshStatus = useCallback(() => setRefreshStatus('idle'), []);

  // ---- Pay EMI (idempotency-guarded single pay POST) --------------------
  const [payError, setPayError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const resolvePayKey = (id: number) => `fleet:emi-pay:${id}`;

  const payEMI = useCallback(async (emiRecordId: number, paidBy?: string): Promise<boolean> => {
    if (savingRef.current) return false;
    const key = resolvePayKey(emiRecordId);
    if (fleetCacheGet(key)) {
      // Already submitted in this session — refresh to show the result.
      setRefreshNonce((value) => value + 1);
      setScheduleNonce((value) => value + 1);
      return false;
    }
    savingRef.current = true;
    setPayError(null);
    try {
      await emiApi.pay(emiRecordId, {
        paidBy,
        idempotencyKey: `emi-pay-${emiRecordId}-${Date.now()}`,
      });
      fleetCacheSet(key, { paidAt: new Date().toISOString() });
      fleetCacheInvalidate('emi:');
      setScheduleNonce((value) => value + 1);
      setRefreshNonce((value) => value + 1);
      return true;
    } catch (cause) {
      setPayError(handleApiError(cause));
      return false;
    } finally {
      savingRef.current = false;
    }
  }, []);

  // ---- Overview ---------------------------------------------------------
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

  // ---- Installment schedules (parallel, deduped, cached) ---------------
  useEffect(() => {
    const ids = Array.from(
      new Set(
        allRecords
          .filter((row) => row.emiRecordId != null && row.status === 'pending')
          .map((row) => row.emiRecordId as number)
      )
    );
    if (ids.length === 0) {
      schedulesRef.current = {};
      setSchedules({});
      setSchedulesLoading(false);
      return;
    }

    const force = scheduleNonce > 0;
    if (scheduleInFlight.current && !force) return;
    const needed = force ? ids : ids.filter((id) => !schedulesRef.current[String(id)]);
    if (needed.length === 0) {
      setSchedulesLoading(false);
      return;
    }

    scheduleInFlight.current = true;
    setSchedulesLoading(true);
    setScheduleError(null);
    let cancelled = false;

    void Promise.all(
      needed.map((id) =>
        fleetSharedGet(`emi:schedule:${id}`, () => emiApi.listSchedule(id))
          .then((rows) => ({ id, rows }))
          .catch(() => ({ id, rows: null }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, VehicleEmiInstallment[]> = { ...schedulesRef.current };
        let failures = 0;
        results.forEach(({ id, rows }) => {
          if (rows && rows.length) next[String(id)] = rows;
          else if (!rows) failures += 1;
        });
        schedulesRef.current = next;
        setSchedules(next);
        if (failures > 0) {
          setScheduleError(`${failures} EMI schedule${failures === 1 ? '' : 's'} could not be loaded.`);
        }
      })
      .finally(() => {
        if (cancelled) return;
        scheduleInFlight.current = false;
        setSchedulesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [allRecords, scheduleNonce]);

  // ---- Filters ----------------------------------------------------------
  const now = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    const y = now.getFullYear();
    const m = pad2(now.getMonth() + 1);
    const d = pad2(now.getDate());
    return `${y}-${m}-${d}`;
  }, [now]);

  const vehicleOptions = useMemo(
    () =>
      allRecords.map((row) => ({
        value: row.vehicleId,
        label: row.vehicleNo,
      })),
    [allRecords]
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    Object.values(schedules).forEach((rows) => {
      rows.forEach((row) => {
        const year = Number(row.dueDate.slice(0, 4));
        if (Number.isFinite(year)) years.add(year);
      });
    });
    allRecords.forEach((row) => {
      if (row.emiDate) {
        const year = Number(row.emiDate.slice(0, 4));
        if (Number.isFinite(year)) years.add(year);
      }
    });
    return [...years].sort((a, b) => b - a);
  }, [schedules, allRecords, now]);

  return {
    allRecords,
    schedules,
    vehicleOptions,
    yearOptions,
    todayKey,
    loading,
    schedulesLoading,
    refreshing,
    error,
    scheduleError,
    refresh,
    refreshStatus,
    clearRefreshStatus,
    lastRefreshed,
    payEMI,
    payError,
  };
}

/** Build the full planning view for a given filter. Pure + memoizable. */
export function buildPlanning(
  allRecords: EmiOverview[],
  schedules: Record<string, VehicleEmiInstallment[]>,
  filter: EmiFilterState,
  todayKey: string
): EmiPlanning {
  const { vehicleId, status, year, month } = filter;
  const selectedKey = `${year}-${pad2(month)}`;
  const monthStart = `${year}-${pad2(month)}-01`;

  const rows = allRecords.filter((row) => {
    if (vehicleId !== 'all' && String(row.vehicleId) !== String(vehicleId)) return false;
    if (status !== 'all' && row.status !== status) return false;
    return true;
  });

  const installmentsOf = (row: EmiOverview): VehicleEmiInstallment[] =>
    row.emiRecordId != null ? schedules[String(row.emiRecordId)] ?? [] : [];

  let monthlyCommitment = 0;
  let activeLoans = 0;
  let dueThisMonth = 0;
  let paidThisMonth = 0;
  let overdueAmount = 0;
  let remainingCommitment = 0;

  const pendingRows: EmiOverview[] = [];
  let nextDueDate: string | null = null;
  let nextDueAmount = 0;

  const allUpcoming: UpcomingEmiRow[] = [];
  const overdueItems: { vehicleNo: string; dueDate: string; amount: number }[] = [];
  const dueSoonItems: { vehicleNo: string; dueDate: string; amount: number; days: number }[] = [];

  rows.forEach((row) => {
    const installmentRows = installmentsOf(row);
    const isPendingRow = row.status === 'pending';

    if (isPendingRow) {
      monthlyCommitment += Number(row.monthlyEmi) || 0;
      if (row.emiRecordId != null) activeLoans += 1;
      remainingCommitment += (Number(row.pendingEMIs) || 0) * (Number(row.monthlyEmi) || 0);
      pendingRows.push(row);
    }

    if (installmentRows.length > 0) {
      installmentRows.forEach((inst) => {
        const dueKey = monthKeyOf(inst.dueDate);
        if (dueKey === selectedKey) {
          dueThisMonth += Number(inst.amount) || 0;
          if (inst.status === 'paid') paidThisMonth += Number(inst.amount) || 0;
        }
        if (inst.status === 'pending') {
          const isOverdue = inst.dueDate < todayKey;
          const days = Math.round(
            (new Date(`${inst.dueDate}T00:00:00`).getTime() - new Date(`${todayKey}T00:00:00`).getTime()) / 86400000
          );
          if (isOverdue) {
            overdueAmount += Number(inst.amount) || 0;
            overdueItems.push({ vehicleNo: row.vehicleNo, dueDate: inst.dueDate, amount: Number(inst.amount) || 0 });
          } else {
            allUpcoming.push({
              id: `${row.vehicleId}:${inst.id}:${inst.installmentNo}`,
              vehicleId: row.vehicleId,
              vehicleNo: row.vehicleNo,
              emiRecordId: row.emiRecordId,
              dueDate: inst.dueDate,
              amount: Number(inst.amount) || 0,
              daysRemaining: days,
              status: days <= 7 ? 'due-soon' : 'upcoming',
            });
            if (days <= 7) {
              dueSoonItems.push({ vehicleNo: row.vehicleNo, dueDate: inst.dueDate, amount: Number(inst.amount) || 0, days });
            }
          }
          if (!nextDueDate || inst.dueDate < nextDueDate) {
            nextDueDate = inst.dueDate;
            nextDueAmount = Number(inst.amount) || 0;
          }
        }
      });
    } else if (isPendingRow && row.emiDate) {
      // Fallback: vehicles without a persisted schedule use the overview EMI
      // date (next occurrence) for the selected-month and overdue KPIs.
      const dueKey = monthKeyOf(row.emiDate);
      if (dueKey === selectedKey) dueThisMonth += Number(row.monthlyEmi) || 0;
      if (row.emiDate < todayKey) {
        overdueAmount += Number(row.monthlyEmi) || 0;
        overdueItems.push({ vehicleNo: row.vehicleNo, dueDate: row.emiDate, amount: Number(row.monthlyEmi) || 0 });
      }
      if (!nextDueDate || row.emiDate < nextDueDate) {
        nextDueDate = row.emiDate;
        nextDueAmount = Number(row.monthlyEmi) || 0;
      }
    }
  });

  const pendingThisMonth = Math.max(0, dueThisMonth - paidThisMonth);

  // ---- Trend: 12 months of the selected year ---------------------------
  const trend: EmiTrendPoint[] = MONTH_LABELS.map((label, index) => {
    const key = `${year}-${pad2(index + 1)}`;
    let due = 0;
    let paid = 0;
    let outstanding = 0;
    rows.forEach((row) => {
      const installmentRows = installmentsOf(row);
      installmentRows.forEach((inst) => {
        if (monthKeyOf(inst.dueDate) === key) {
          due += Number(inst.amount) || 0;
          if (inst.status === 'paid') paid += Number(inst.amount) || 0;
        }
        if (inst.status === 'pending' && inst.dueDate >= monthStart) {
          outstanding += Number(inst.amount) || 0;
        }
      });
    });
    return { key, label, due, paid, outstanding };
  });

  // ---- Upcoming (future pending installments, nearest first) ------------
  const upcoming = allUpcoming
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10);

  // ---- Attention --------------------------------------------------------
  const attention: EmiAttentionItem[] = [];
  overdueItems
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4)
    .forEach((item) => {
      attention.push({
        id: `overdue:${item.vehicleNo}:${item.dueDate}`,
        kind: 'overdue',
        tone: 'border-rose-200 bg-rose-50',
        title: `Overdue EMI · ${item.vehicleNo}`,
        detail: `Due ${item.dueDate} — ${Math.round(
          (new Date(`${todayKey}T00:00:00`).getTime() - new Date(`${item.dueDate}T00:00:00`).getTime()) / 86400000
        )} day${(new Date(`${todayKey}T00:00:00`).getTime() - new Date(`${item.dueDate}T00:00:00`).getTime()) / 86400000 === 1 ? '' : 's'} late`,
        value: money(item.amount),
      });
    });
  dueSoonItems
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)
    .forEach((item) => {
      attention.push({
        id: `due-soon:${item.vehicleNo}:${item.dueDate}`,
        kind: 'due-soon',
        tone: 'border-amber-200 bg-amber-50',
        title: `EMI due in ${item.days} day${item.days === 1 ? '' : 's'} · ${item.vehicleNo}`,
        detail: `Due ${item.dueDate}`,
        value: money(item.amount),
      });
    });

  const byOutstanding = [...pendingRows].sort(
    (a, b) =>
      (Number(b.pendingEMIs) || 0) * (Number(b.monthlyEmi) || 0) -
      (Number(a.pendingEMIs) || 0) * (Number(a.monthlyEmi) || 0)
  );
  byOutstanding.slice(0, 2).forEach((row, index) => {
    const value = (Number(row.pendingEMIs) || 0) * (Number(row.monthlyEmi) || 0);
    if (value <= 0) return;
    attention.push({
      id: `highest-outstanding:${row.vehicleId}`,
      kind: 'highest-outstanding',
      tone: 'border-indigo-200 bg-indigo-50',
      title: index === 0 ? 'Highest remaining commitment' : 'Second highest commitment',
      detail: `${row.vehicleNo} · ${row.pendingEMIs} EMIs remaining`,
      value: money(value),
    });
  });

  const byEmi = [...pendingRows].sort(
    (a, b) => (Number(b.monthlyEmi) || 0) - (Number(a.monthlyEmi) || 0)
  );
  byEmi.slice(0, 2).forEach((row, index) => {
    const value = Number(row.monthlyEmi) || 0;
    if (value <= 0) return;
    attention.push({
      id: `highest-emi:${row.vehicleId}`,
      kind: 'highest-emi',
      tone: 'border-slate-200 bg-slate-50',
      title: index === 0 ? 'Highest monthly EMI' : 'Second highest monthly EMI',
      detail: row.vehicleNo,
      value: `${money(value)}/mo`,
    });
  });

  const hasAnyData = rows.length > 0;
  const hasSchedules = rows.some((row) => installmentsOf(row).length > 0 || row.emiRecordId != null);

  return {
    rows,
    hasAnyData,
    hasSchedules,
    monthlyCommitment,
    activeLoans,
    dueThisMonth,
    paidThisMonth,
    pendingThisMonth,
    overdueAmount,
    remainingCommitment,
    nextDueDate,
    nextDueAmount,
    trend,
    upcoming,
    attention,
  };
}