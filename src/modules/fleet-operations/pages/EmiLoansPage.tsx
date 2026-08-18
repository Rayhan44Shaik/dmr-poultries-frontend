import { memo, useMemo, useState } from 'react';
import Select from 'react-select';
import { AlertCircle, CircleDollarSign, Loader2, RefreshCw } from 'lucide-react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useEmiData } from '../hooks/useEmiData';
import type { EmiOverview, EmiOverviewStatus } from '../types';

interface EmiLoansPageProps { embedded?: boolean }

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

const EmiLoansPage = ({ embedded = false }: EmiLoansPageProps) => {
  const { allRecords, vehicles, loading, refreshing, error, refresh, kpis } = useEmiData();

  // Draft filters (edited) vs applied filters (used by the table). The table
  // only changes after Apply; Clear resets both immediately.
  const [draftVehicleId, setDraftVehicleId] = useState<string>('all');
  const [draftStatus, setDraftStatus] = useState<EmiOverviewStatus | 'all'>('all');
  const [appliedVehicleId, setAppliedVehicleId] = useState<string>('all');
  const [appliedStatus, setAppliedStatus] = useState<EmiOverviewStatus | 'all'>('all');

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber })),
    [vehicles]
  );

  const filtered = useMemo(
    () => applyFilters(allRecords, appliedVehicleId, appliedStatus),
    [allRecords, appliedVehicleId, appliedStatus]
  );

  const apply = () => {
    setAppliedVehicleId(draftVehicleId);
    setAppliedStatus(draftStatus);
  };

  const clear = () => {
    setDraftVehicleId('all');
    setDraftStatus('all');
    setAppliedVehicleId('all');
    setAppliedStatus('all');
  };

  const kpiCards = [
    { label: 'Total Vehicles', value: kpis.total, tone: 'text-blue-600' },
    { label: 'EMI Completed', value: kpis.completed, tone: 'text-emerald-600' },
    { label: 'EMI Pending', value: kpis.pending, tone: 'text-amber-600' },
  ];

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 animate-in fade-in duration-300 ${embedded ? '' : 'min-h-screen bg-slate-50 px-4 py-6 md:px-8'}`}>
        {/* KPI section — 3 compact cards, equal width, one row on desktop. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kpiCards.map(({ label, value, tone }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filter section — vertical, compact. */}
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Vehicle</label>
              <Select
                options={vehicleOptions}
                isClearable
                isSearchable
                placeholder="All vehicles"
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
            <div className="flex justify-end gap-3 pt-1">
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

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span>
            <button type="button" onClick={refresh} className="font-bold underline">Retry</button>
          </div>
        )}

        {/* Table section with its own toolbar (Refresh lives here, not in the filters). */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-black uppercase tracking-wider text-slate-500">EMI Table</span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <div className="relative">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-500">
                <Loader2 className="animate-spin text-blue-500" size={20} /> Loading EMI data…
              </div>
            ) : allRecords.length === 0 ? (
              <div className="py-20 text-center">
                <CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} />
                <p className="font-bold text-slate-700">No active vehicles found.</p>
                <p className="mt-1 text-sm text-slate-400">Add active vehicles in Vehicle Master to see EMI status.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} />
                <p className="font-bold text-slate-700">No vehicles match the selected filters.</p>
              </div>
            ) : (
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
                    {filtered.map((record) => (
                      <tr key={record.vehicleId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-sm font-bold text-slate-800">{record.vehicleNo}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{money(record.purchaseAmount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{displayDate(record.purchaseDate)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">{record.totalEMIs}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{record.completedEMIs}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">{record.pendingEMIs}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
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
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);
