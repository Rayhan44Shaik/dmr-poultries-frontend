import { memo, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from 'lucide-react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useEmiData } from '../hooks/useEmiData';
import { handleApiError, isCanceledError } from '../../../api/errors';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import type { EmiOverview, EmiOverviewStatus, VehicleEmiInstallment } from '../types';

interface EmiLoansPageProps { embedded?: boolean }

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

const statusClass: Record<EmiOverviewStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const fieldClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

const EmiLoansPage = ({ embedded = false }: EmiLoansPageProps) => {
  const {
    records, vehicles, loading, refreshing, saving, error, search, setSearch, vehicleId, setVehicleId,
    status, setStatus, stats, refresh, recordPayment, loadSchedule,
  } = useEmiData();
  const { showNotification } = useSafeNotification();
  const [paying, setPaying] = useState<EmiOverview | null>(null);
  const [schedule, setSchedule] = useState<VehicleEmiInstallment[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<EmiOverview | null>(null);
  const [scheduleRetry, setScheduleRetry] = useState(0);

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber })),
    [vehicles]
  );

  useEffect(() => {
    if (!scheduleFor || scheduleFor.emiRecordId == null) {
      return;
    }
    const controller = new AbortController();
    const emiId = scheduleFor.emiRecordId;
    setScheduleLoading(true);
    setScheduleError(null);
    void loadSchedule(emiId, controller.signal)
      .then((rows) => {
        setSchedule(rows);
      })
      .catch((cause) => {
        if (isCanceledError(cause)) return;
        setSchedule([]);
        setScheduleError(handleApiError(cause));
      })
      .finally(() => setScheduleLoading(false));
    return () => controller.abort();
  }, [loadSchedule, scheduleFor?.emiRecordId, scheduleRetry]);

  const submitPayment = async () => {
    if (!paying || paying.emiRecordId == null || saving) return;
    try {
      const saved = await recordPayment(paying.emiRecordId, { paidEMIs: paying.completedEMIs });
      if (!saved) return;
      showNotification('EMI installment marked as paid.', 'success');
      setPaying(null);
      if (scheduleFor?.emiRecordId === paying.emiRecordId) setScheduleRetry((n) => n + 1);
    } catch (cause) {
      showNotification(handleApiError(cause), 'error');
    }
  };

  const kpis = [
    { label: 'Monthly EMI', value: money(stats.monthly), icon: CreditCard, tone: 'text-blue-600 bg-blue-50' },
    { label: 'Paid Value', value: money(stats.paid), icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Pending Loans', value: stats.pending, icon: WalletCards, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Upcoming (30d)', value: stats.upcoming, icon: CalendarClock, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Overdue', value: stats.overdue, icon: AlertCircle, tone: 'text-rose-600 bg-rose-50' },
    { label: 'Remaining', value: money(stats.remaining), icon: IndianRupee, tone: 'text-slate-700 bg-slate-100' },
  ];

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 animate-in fade-in duration-300 ${embedded ? '' : 'min-h-screen bg-slate-50 px-4 py-6 md:px-8'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Vehicle EMI Management</h2>
            <p className="text-sm text-slate-500">EMI status for active vehicles, derived from Vehicle Master and payment history.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {kpis.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-1 truncate text-lg font-black text-slate-800" title={String(value)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle number or finance company" className={`${fieldClass} pl-9`} />
          </div>
          <div className="min-w-[220px]">
            <Select options={vehicleOptions} isClearable isSearchable placeholder="All vehicles" value={vehicleOptions.find((option) => String(option.value) === vehicleId) || null} onChange={(option) => setVehicleId(option ? String(option.value) : 'all')} />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as EmiOverviewStatus | 'all')} className={`${fieldClass} w-40`}>
            <option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option>
          </select>
          <button type="button" onClick={refresh} disabled={loading || refreshing} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading || refreshing ? 'animate-spin' : ''} /> Refresh</button>
        </div>

        {error && <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><button type="button" onClick={refresh} className="font-bold underline">Retry</button></div>}

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {refreshing && !loading && (
            <div className="pointer-events-none absolute inset-0 z-10 bg-white/40">
              <div className="sticky top-3 mx-auto flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Updating…
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-500"><Loader2 className="animate-spin text-blue-500" size={20} /> Loading EMI schedules…</div>
          ) : records.length === 0 ? (
            <div className="py-20 text-center"><CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} /><p className="font-bold text-slate-700">No EMI data found</p><p className="mt-1 text-sm text-slate-400">No active vehicles match the current filters.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50"><tr>{['Vehicle No','Purchase Amount','Purchase Date','Total EMI','Completed EMI','Pending EMI','EMI Date','Status','Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
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
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass[record.status]}`}>{record.status}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2">
                        {record.emiRecordId != null && (
                          <button type="button" onClick={() => setScheduleFor(record)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Schedule</button>
                        )}
                        {record.emiRecordId != null && record.pendingEMIs > 0 && (
                          <button type="button" onClick={() => setPaying(record)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Banknote size={14} /> Pay</button>
                        )}
                        {record.emiRecordId == null && <span className="text-xs text-slate-300">No schedule</span>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {paying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setPaying(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="font-bold text-slate-900">Pay next EMI installment</h3>
                  <p className="text-xs text-slate-500">{paying.vehicleNo} · {paying.financeCompany || 'No finance company'} · {money(paying.monthlyEmi)}</p>
                </div>
                <button type="button" onClick={() => setPaying(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="space-y-2 p-6 text-sm text-slate-600">
                <p>This marks the next pending installment as paid on the server. Paid count, next due date and status are recalculated by the backend.</p>
                <p>Completed: <span className="font-semibold text-slate-800">{paying.completedEMIs}</span> · Pending: <span className="font-semibold text-slate-800">{paying.pendingEMIs}</span> · Next due: <span className="font-semibold text-slate-800">{displayDate(paying.emiDate)}</span></p>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button type="button" onClick={() => setPaying(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
                <button type="button" disabled={saving} onClick={submitPayment} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />} Confirm payment</button>
              </div>
            </div>
          </div>
        )}

        {scheduleFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setScheduleFor(null)}>
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="font-bold text-slate-900">EMI schedule</h3>
                  <p className="text-xs text-slate-500">{scheduleFor.vehicleNo} · {scheduleFor.financeCompany || 'No finance company'}</p>
                </div>
                <button type="button" onClick={() => { setScheduleFor(null); setSchedule([]); setScheduleError(null); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-4">
                {scheduleError && (
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <span>{scheduleError}</span>
                    <button type="button" className="font-bold underline" onClick={() => setScheduleRetry((n) => n + 1)}>Retry</button>
                  </div>
                )}
                {scheduleLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500"><Loader2 className="animate-spin text-blue-500" size={20} /> Loading schedule…</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        {['#', 'Due date', 'Amount', 'Status', 'Paid date'].map((heading) => (
                          <th key={heading} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 text-sm text-slate-700">{row.installmentNo}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{displayDate(row.dueDate)}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-slate-800">{money(row.amount)}</td>
                          <td className="px-3 py-2 text-sm capitalize text-slate-600">{row.status}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{row.paidAt ? displayDate(row.paidAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);
