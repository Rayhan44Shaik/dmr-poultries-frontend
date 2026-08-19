import { memo, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  RefreshCw,
  Truck,
} from 'lucide-react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import Pagination from '../components/common/Pagination';
import { useEmiData } from '../hooks/useEmiData';
import type { EmiOverview, EmiOverviewStatus } from '../types';

interface EmiLoansPageProps { embedded?: boolean }

const PAGE_SIZE = 10;

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

const statusClass: Record<EmiOverviewStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const fieldClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

/** Deterministic default order: PENDING first, COMPLETED second, A→Z within each group. */
function applyFilters(
  rows: EmiOverview[],
  vehicleId: string,
  status: EmiOverviewStatus | 'all'
): EmiOverview[] {
  const filtered = rows.filter((row) => {
    if (vehicleId !== 'all' && String(row.vehicleId) !== vehicleId) return false;
    if (status !== 'all' && row.status !== status) return false;
    return true;
  });
  const rank: Record<EmiOverviewStatus, number> = { pending: 0, completed: 1 };
  return [...filtered].sort((a, b) => {
    const rankDiff = rank[a.status] - rank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.vehicleNo.localeCompare(b.vehicleNo);
  });
}

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 40,
    borderRadius: 12,
    borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(59,130,246,0.15)' : undefined,
    '&:hover': { borderColor: '#cbd5e1' },
  }),
};

const EmiLoansPage = ({ embedded = false }: EmiLoansPageProps) => {
  const { allRecords, vehicles, loading, refreshing, error, refresh, refreshStatus, clearRefreshStatus, kpis } = useEmiData();

  // Draft filters (edited) vs applied filters (used by the table).
  const [draftVehicleId, setDraftVehicleId] = useState<string>('all');
  const [draftStatus, setDraftStatus] = useState<EmiOverviewStatus | 'all'>('all');
  const [appliedVehicleId, setAppliedVehicleId] = useState<string>('all');
  const [appliedStatus, setAppliedStatus] = useState<EmiOverviewStatus | 'all'>('all');

  const [currentPage, setCurrentPage] = useState(1);

  // Small, non-blocking, auto-dismissing refresh toast (no modal / alert).
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

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber })),
    [vehicles]
  );

  const filtered = useMemo(
    () => applyFilters(allRecords, appliedVehicleId, appliedStatus),
    [allRecords, appliedVehicleId, appliedStatus]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Clamp to the last valid page when data changes (e.g., after refresh).
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const apply = () => {
    setAppliedVehicleId(draftVehicleId);
    setAppliedStatus(draftStatus);
    setCurrentPage(1);
  };

  const clear = () => {
    setDraftVehicleId('all');
    setDraftStatus('all');
    setAppliedVehicleId('all');
    setAppliedStatus('all');
    setCurrentPage(1);
  };

  const kpiCards = [
    { label: 'Total Vehicles', value: kpis.total, icon: Truck, iconBg: 'bg-slate-100', iconText: 'text-slate-600', valueText: 'text-slate-800' },
    { label: 'EMI Completed', value: kpis.completed, icon: CheckCircle2, iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', valueText: 'text-emerald-600' },
    { label: 'EMI Pending', value: kpis.pending, icon: CalendarClock, iconBg: 'bg-amber-100', iconText: 'text-amber-600', valueText: 'text-amber-600' },
  ];

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 animate-in fade-in duration-300 ${embedded ? '' : 'min-h-screen bg-slate-50 px-4 py-6 md:px-8'}`}>
        {/* Toast — non-blocking, top-right, auto-dismiss. */}
        {toast && (
          <div
            className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-lg animate-in slide-in-from-top-4 fade-in duration-200 ${
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

        {/* Top section — filter panel (left) + KPI stack (right). */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Filter panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-500">Filters</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Vehicle</label>
                <Select
                  options={vehicleOptions}
                  isClearable
                  isSearchable
                  placeholder="All vehicles"
                  styles={selectStyles}
                  value={vehicleOptions.find((option) => String(option.value) === draftVehicleId) || null}
                  onChange={(option) => setDraftVehicleId(option ? String(option.value) : 'all')}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value as EmiOverviewStatus | 'all')}
                  className={fieldClass}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* KPI stack — vertical, from the full active dataset (unaffected by filters/pagination). */}
          <div className="flex flex-col gap-3">
            {kpiCards.map(({ label, value, icon: Icon, iconBg, iconText, valueText }) => (
              <div
                key={label}
                className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconText}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className={`text-2xl font-black ${valueText}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span>
            <button type="button" onClick={refresh} className="font-bold underline">Retry</button>
          </div>
        )}

        {/* Full-width table section with its own toolbar + refresh. */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-black uppercase tracking-wider text-slate-500">EMI Overview</span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-500">
              <Loader2 className="animate-spin text-blue-500" size={20} /> Loading EMI data…
            </div>
          ) : allRecords.length === 0 ? (
            <div className="py-20 text-center">
              <CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} />
              <p className="font-bold text-slate-700">No active vehicles</p>
              <p className="mt-1 text-sm text-slate-400">There are currently no active vehicles available for EMI tracking.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} />
              <p className="font-bold text-slate-700">No vehicles match your filters.</p>
              <button
                type="button"
                onClick={clear}
                className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Vehicle No', 'Purchase Amount', 'Purchase Date', 'Total EMI', 'Completed EMI', 'Pending EMI', 'EMI Date', 'Status'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paged.map((record) => (
                      <tr key={record.vehicleId} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{record.vehicleNo}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-700 tabular-nums">{money(record.purchaseAmount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">{displayDate(record.purchaseDate)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700 tabular-nums">{record.totalEMIs}</td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{record.completedEMIs}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700 tabular-nums">{record.pendingEMIs}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
                          {record.status === 'completed' ? <span className="text-slate-400">Completed / —</span> : displayDate(record.emiDate)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass[record.status]}`}>{record.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={PAGE_SIZE}
                totalItems={filtered.length}
              />
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);
