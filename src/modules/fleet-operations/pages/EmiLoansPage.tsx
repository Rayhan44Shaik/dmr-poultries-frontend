import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import KpiCard from '../components/common/KpiCard';
import Pagination from '../components/common/Pagination';
import SearchInput from '../components/common/SearchInput';
import { useEmiData } from '../hooks/useEmiData';
import type { EmiOverview, EmiOverviewStatus } from '../types';

interface EmiLoansPageProps {
  embedded?: boolean;
}

const PAGE_SIZE = 10;

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const displayDate = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fieldClass =
  'h-9 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const controlClass =
  'flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50';

type SortKey =
  | 'vehicleNo'
  | 'financeCompany'
  | 'purchaseAmount'
  | 'monthlyEmi'
  | 'emiDate'
  | 'completedEMIs'
  | 'pendingEMIs'
  | 'outstanding'
  | 'status';

type SortDir = 'asc' | 'desc';

const SORT_GETTER: Record<SortKey, (row: EmiOverview, todayKey: string) => number | string> = {
  vehicleNo: (row) => row.vehicleNo,
  financeCompany: (row) => row.financeCompany || '',
  purchaseAmount: (row) => row.purchaseAmount,
  monthlyEmi: (row) => row.monthlyEmi,
  emiDate: (row) => row.emiDate || (row.status === 'completed' ? '9999-12-31' : ''),
  completedEMIs: (row) => row.completedEMIs,
  pendingEMIs: (row) => row.pendingEMIs,
  outstanding: (row) => (row.pendingEMIs || 0) * (row.monthlyEmi || 0),
  status: (row, todayKey) =>
    row.status === 'pending' && row.emiDate && row.emiDate < todayKey
      ? '0-overdue'
      : row.status === 'pending'
        ? '1-pending'
        : '2-completed',
};

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'vehicleNo', label: 'Vehicle No', align: 'left' },
  { key: 'financeCompany', label: 'Loan Provider', align: 'left' },
  { key: 'purchaseAmount', label: 'Loan Amount', align: 'right' },
  { key: 'monthlyEmi', label: 'EMI', align: 'right' },
  { key: 'emiDate', label: 'Due Date', align: 'left' },
  { key: 'completedEMIs', label: 'Paid', align: 'right' },
  { key: 'pendingEMIs', label: 'Remaining', align: 'right' },
  { key: 'outstanding', label: 'Outstanding', align: 'right' },
  { key: 'status', label: 'Status', align: 'left' },
];

const StatusBadge = ({ row, todayKey }: { row: EmiOverview; todayKey: string }) => {
  if (row.status === 'pending' && row.emiDate && row.emiDate < todayKey) {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
        Overdue
      </span>
    );
  }
  if (row.status === 'pending') {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        Pending
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
      Completed
    </span>
  );
};

const EmiLoansPage = ({ embedded = false }: EmiLoansPageProps) => {
  const {
    allRecords,
    todayKey,
    loading,
    refreshing,
    error,
    refresh,
    refreshStatus,
    clearRefreshStatus,
    lastRefreshed,
  } = useEmiData();

  // ---- Filters (applied instantly over the loaded overview — no re-fetch) --
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmiOverviewStatus | 'all'>('all');

  const reset = () => {
    setSearch('');
    setStatus('all');
  };

  const hasActiveFilters = search.trim() !== '' || status !== 'all';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRecords.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (term) {
        const haystack = `${row.vehicleNo} ${row.financeCompany || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [allRecords, search, status]);

  // ---- KPIs (overview arithmetic; overdue uses the next-EMI date) ---------
  const kpis = useMemo(() => {
    let activeLoans = 0;
    let monthlyCommitment = 0;
    let overdue = 0;
    filtered.forEach((row) => {
      if (row.status !== 'pending') return;
      if (row.emiRecordId != null) activeLoans += 1;
      monthlyCommitment += Number(row.monthlyEmi) || 0;
      if (row.emiDate && row.emiDate < todayKey) {
        overdue += Number(row.monthlyEmi) || 0;
      }
    });
    return { activeLoans, monthlyCommitment, overdue };
  }, [filtered, todayKey]);

  // ---- Read-only table (sort + paginate over the same filtered set) -------
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const getter = SORT_GETTER[sortKey];
    const factor = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getter(a, todayKey);
      const bv = getter(b, todayKey);
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * factor;
      }
      return ((Number(av) || 0) - (Number(bv) || 0)) * factor;
    });
  }, [filtered, sortKey, sortDir, todayKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage]
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'vehicleNo' || key === 'status' || key === 'financeCompany' ? 'asc' : 'desc');
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // ---- Toast for refresh outcome ----------------------------------------
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (refreshStatus === 'success') {
      setToast({ type: 'success', message: 'EMI data refreshed' });
      clearRefreshStatus();
    } else if (refreshStatus === 'error') {
      setToast({ type: 'error', message: 'Unable to refresh EMI data. Please try again.' });
      clearRefreshStatus();
    }
  }, [refreshStatus, clearRefreshStatus]);

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 ${embedded ? '' : 'px-4 py-6 md:px-8 md:py-8'}`}>
        {toast && (
          <div
            className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              FLEET EMI MANAGEMENT
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Vehicle finance, repayment schedule and outstanding obligations
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            {refreshing && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> Updating…
              </span>
            )}
            {lastRefreshed && (
              <span className="hidden sm:inline">
                Last updated {new Date(lastRefreshed).toLocaleTimeString('en-IN')}
              </span>
            )}
            <button type="button" onClick={refresh} disabled={loading || refreshing} className={controlClass}>
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-emerald-600' : 'text-slate-400'} />
              Refresh
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          <div className="w-full min-w-[220px] sm:max-w-xs">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search vehicle no, provider…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EmiOverviewStatus | 'all')}
              className={fieldClass}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {hasActiveFilters && (
            <div className="ml-auto flex items-center gap-2 pb-0.5">
              <button type="button" onClick={reset} className={controlClass}>
                <RotateCcw size={13} className="text-slate-400" /> Clear filters
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>
            <button type="button" onClick={refresh} className="font-bold underline">Retry</button>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Active Loans"
            value={loading ? '—' : kpis.activeLoans}
            format="number"
            icon={<Landmark size={18} />}
          />
          <KpiCard
            label="Monthly Commitment"
            value={loading ? '—' : money(kpis.monthlyCommitment)}
            format="currency"
            icon={<Wallet size={18} />}
          />
          <KpiCard
            label="Overdue"
            value={loading ? '—' : money(kpis.overdue)}
            format="currency"
            icon={<Clock size={18} />}
          />
        </div>

        {/* Vehicle EMI table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">EMI Overview</h3>
          <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">
            Per-vehicle loan position and payment status
          </p>

          {loading ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : allRecords.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} />
              <p className="font-bold text-slate-700">No active vehicles</p>
              <p className="mt-1 text-sm text-slate-400">
                There are currently no active vehicles available for EMI tracking.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} />
              <p className="font-bold text-slate-700">No vehicles match the selected filters.</p>
              <button
                type="button"
                onClick={reset}
                className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {COLUMNS.map((column) => (
                        <th
                          key={column.key}
                          className={`px-3 py-2.5 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(column.key)}
                            className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                              sortKey === column.key ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {column.label}
                            {sortKey === column.key && (
                              <span className="text-emerald-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paged.map((record) => (
                      <tr key={record.vehicleId} className="transition-colors hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-900">
                          {record.vehicleNo}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">
                          {record.financeCompany || '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">
                          {money(record.purchaseAmount)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-700">
                          {record.monthlyEmi > 0 ? money(record.monthlyEmi) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">
                          {record.status === 'completed' ? (
                            <span className="text-slate-400">Completed / —</span>
                          ) : (
                            displayDate(record.emiDate)
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">
                          {record.completedEMIs}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-700">
                          {record.pendingEMIs}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-800">
                          {money((record.pendingEMIs || 0) * (record.monthlyEmi || 0))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <StatusBadge row={record} todayKey={todayKey} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  itemsPerPage={PAGE_SIZE}
                  totalItems={sorted.length}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);