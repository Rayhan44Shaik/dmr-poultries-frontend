import { memo, useMemo, useState } from 'react';
import Select from 'react-select';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Edit3,
  IndianRupee,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from 'lucide-react';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useEmiData } from '../hooks/useEmiData';
import { handleApiError } from '../../../api/errors';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import type {
  EmiPaymentInput,
  EmiPaymentMode,
  EmiSchedule,
  EmiScheduleInput,
  EmiStatus,
} from '../types';

interface EmiLoansPageProps { embedded?: boolean }

const emptySchedule = (): EmiScheduleInput => ({
  vehicleId: 0,
  loanReference: '',
  financeCompany: '',
  principal: 0,
  interestRate: null,
  emiAmount: 0,
  startDate: '',
  endDate: '',
  totalEmis: 0,
  paidEmis: 0,
  nextEmiDate: '',
  status: 'active',
});

const emptyPayment = (amount = 0): EmiPaymentInput => ({
  paymentDate: new Date().toISOString().slice(0, 10),
  amount,
  paymentMode: 'bank_transfer',
  reference: '',
  remarks: '',
});

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

const statusClass: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const fieldClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const labelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

const EmiLoansPage = ({ embedded = false }: EmiLoansPageProps) => {
  const {
    records, vehicles, loading, saving, error, search, setSearch, vehicleId, setVehicleId,
    status, setStatus, stats, refresh, saveSchedule, recordPayment,
  } = useEmiData();
  const { showNotification } = useSafeNotification();
  const [editing, setEditing] = useState<EmiSchedule | null | 'new'>(null);
  const [scheduleForm, setScheduleForm] = useState<EmiScheduleInput>(emptySchedule);
  const [paying, setPaying] = useState<EmiSchedule | null>(null);
  const [paymentForm, setPaymentForm] = useState<EmiPaymentInput>(emptyPayment());

  const vehicleOptions = useMemo(
    () => vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicleNumber })),
    [vehicles]
  );

  const openNew = () => {
    setScheduleForm(emptySchedule());
    setEditing('new');
  };

  const openEdit = (record: EmiSchedule) => {
    setScheduleForm({
      vehicleId: record.vehicleId,
      loanReference: record.loanReference,
      financeCompany: record.financeCompany,
      principal: record.principal,
      interestRate: record.interestRate,
      emiAmount: record.emiAmount,
      startDate: record.startDate?.slice(0, 10),
      endDate: record.endDate?.slice(0, 10),
      totalEmis: record.totalEmis,
      paidEmis: record.paidEmis,
      nextEmiDate: record.nextEmiDate?.slice(0, 10) || '',
      status: record.status,
    });
    setEditing(record);
  };

  const submitSchedule = async () => {
    if (!scheduleForm.vehicleId || !scheduleForm.loanReference.trim() || !scheduleForm.financeCompany.trim()) {
      showNotification('Vehicle, loan reference and finance company are required.', 'error');
      return;
    }
    if (scheduleForm.principal <= 0 || scheduleForm.emiAmount <= 0 || scheduleForm.totalEmis <= 0) {
      showNotification('Principal, EMI amount and EMI count must be greater than zero.', 'error');
      return;
    }
    if (!scheduleForm.startDate || !scheduleForm.endDate || scheduleForm.endDate < scheduleForm.startDate) {
      showNotification('Enter a valid EMI date range.', 'error');
      return;
    }
    try {
      await saveSchedule(scheduleForm, editing && editing !== 'new' ? editing.id : undefined);
      showNotification(editing === 'new' ? 'EMI schedule created.' : 'EMI schedule updated.', 'success');
      setEditing(null);
    } catch (cause) {
      showNotification(handleApiError(cause), 'error');
    }
  };

  const openPayment = (record: EmiSchedule) => {
    setPaying(record);
    setPaymentForm(emptyPayment(record.emiAmount));
  };

  const submitPayment = async () => {
    if (!paying || !paymentForm.paymentDate || paymentForm.amount <= 0) {
      showNotification('Payment date and a valid amount are required.', 'error');
      return;
    }
    try {
      await recordPayment(paying.id, paymentForm);
      showNotification('EMI payment recorded.', 'success');
      setPaying(null);
    } catch (cause) {
      showNotification(handleApiError(cause), 'error');
    }
  };

  const kpis = [
    { label: 'Monthly EMI', value: money(stats.totalEmi), icon: CreditCard, tone: 'text-blue-600 bg-blue-50' },
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
            <p className="text-sm text-slate-500">API-backed schedules, payment tracking and upcoming obligations.</p>
          </div>
          <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            <Plus size={16} /> Add EMI Schedule
          </button>
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
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loan reference or finance company" className={`${fieldClass} pl-9`} />
          </div>
          <div className="min-w-[220px]">
            <Select options={vehicleOptions} isClearable isSearchable placeholder="All vehicles" value={vehicleOptions.find((option) => String(option.value) === vehicleId) || null} onChange={(option) => setVehicleId(option ? String(option.value) : 'all')} />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as EmiStatus | 'all')} className={`${fieldClass} w-40`}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="closed">Closed</option>
          </select>
          <button onClick={refresh} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>

        {error && <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span><button onClick={refresh} className="font-bold underline">Retry</button></div>}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-500"><Loader2 className="animate-spin text-blue-500" size={20} /> Loading EMI schedules…</div>
          ) : records.length === 0 ? (
            <div className="py-20 text-center"><CircleDollarSign className="mx-auto mb-3 text-slate-300" size={42} /><p className="font-bold text-slate-700">No EMI schedules found</p><p className="mt-1 text-sm text-slate-400">Create a schedule or adjust the current filters.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50"><tr>{['Vehicle','Reference / Finance','Principal','EMI','Paid / Total','Remaining','Next EMI','Status','Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => {
                    const vehicle = vehicles.find((item) => String(item.id) === String(record.vehicleId));
                    return <tr key={record.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">{record.vehicleNumber || vehicle?.vehicleNumber || `Vehicle #${record.vehicleId}`}</td>
                      <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-700">{record.loanReference}</p><p className="text-xs text-slate-400">{record.financeCompany}</p></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{money(record.principal)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-700">{money(record.emiAmount)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{record.paidEmis} / {record.totalEmis}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{record.remainingEmis}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{displayDate(record.nextEmiDate)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusClass[record.status] || statusClass.closed}`}>{record.status}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><button onClick={() => openEdit(record)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600" title="Edit schedule"><Edit3 size={14} /></button><button onClick={() => openPayment(record)} disabled={record.status === 'paid' || record.status === 'closed'} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40"><Banknote size={14} /> Pay</button></div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><div><h3 className="font-bold text-slate-900">{editing === 'new' ? 'New EMI Schedule' : 'Edit EMI Schedule'}</h3><p className="text-xs text-slate-500">All values are sent through the Fleet EMI API.</p></div><button onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                <div><label className={labelClass}>Vehicle *</label><Select options={vehicleOptions} value={vehicleOptions.find((option) => option.value === scheduleForm.vehicleId) || null} onChange={(option) => setScheduleForm((value) => ({ ...value, vehicleId: option?.value || 0 }))} isSearchable placeholder="Select vehicle" /></div>
                <div><label className={labelClass}>Loan / EMI Reference *</label><input className={fieldClass} value={scheduleForm.loanReference} onChange={(e) => setScheduleForm((v) => ({ ...v, loanReference: e.target.value }))} /></div>
                <div><label className={labelClass}>Finance / Bank *</label><input className={fieldClass} value={scheduleForm.financeCompany} onChange={(e) => setScheduleForm((v) => ({ ...v, financeCompany: e.target.value }))} /></div>
                <div><label className={labelClass}>Principal *</label><input type="number" min="0" className={fieldClass} value={scheduleForm.principal || ''} onChange={(e) => setScheduleForm((v) => ({ ...v, principal: Number(e.target.value) }))} /></div>
                <div><label className={labelClass}>EMI Amount *</label><input type="number" min="0" className={fieldClass} value={scheduleForm.emiAmount || ''} onChange={(e) => setScheduleForm((v) => ({ ...v, emiAmount: Number(e.target.value) }))} /></div>
                <div><label className={labelClass}>Interest %</label><input type="number" min="0" step="0.01" className={fieldClass} value={scheduleForm.interestRate ?? ''} onChange={(e) => setScheduleForm((v) => ({ ...v, interestRate: e.target.value === '' ? null : Number(e.target.value) }))} /></div>
                <div><label className={labelClass}>Start Date *</label><input type="date" className={fieldClass} value={scheduleForm.startDate} onChange={(e) => setScheduleForm((v) => ({ ...v, startDate: e.target.value }))} /></div>
                <div><label className={labelClass}>End Date *</label><input type="date" className={fieldClass} value={scheduleForm.endDate} min={scheduleForm.startDate} onChange={(e) => setScheduleForm((v) => ({ ...v, endDate: e.target.value }))} /></div>
                <div><label className={labelClass}>Total EMI Count *</label><input type="number" min="1" className={fieldClass} value={scheduleForm.totalEmis || ''} onChange={(e) => setScheduleForm((v) => ({ ...v, totalEmis: Number(e.target.value) }))} /></div>
                <div><label className={labelClass}>Paid EMI Count</label><input type="number" min="0" max={scheduleForm.totalEmis} className={fieldClass} value={scheduleForm.paidEmis || 0} onChange={(e) => setScheduleForm((v) => ({ ...v, paidEmis: Number(e.target.value) }))} /></div>
                <div><label className={labelClass}>Next EMI Date</label><input type="date" className={fieldClass} value={scheduleForm.nextEmiDate || ''} onChange={(e) => setScheduleForm((v) => ({ ...v, nextEmiDate: e.target.value }))} /></div>
                <div><label className={labelClass}>Status</label><select className={fieldClass} value={scheduleForm.status} onChange={(e) => setScheduleForm((v) => ({ ...v, status: e.target.value as EmiStatus }))}><option value="active">Active</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="closed">Closed</option></select></div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} onClick={submitSchedule} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />} Save Schedule</button></div>
            </div>
          </div>
        )}

        {paying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setPaying(null)}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h3 className="font-bold text-slate-900">Record EMI Payment</h3><p className="text-xs text-slate-500">{paying.loanReference} · {money(paying.emiAmount)}</p></div><button onClick={() => setPaying(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><div className="grid gap-4 p-6 sm:grid-cols-2"><div><label className={labelClass}>Payment Date *</label><input type="date" className={fieldClass} value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((v) => ({ ...v, paymentDate: e.target.value }))} /></div><div><label className={labelClass}>Amount *</label><input type="number" min="0" className={fieldClass} value={paymentForm.amount || ''} onChange={(e) => setPaymentForm((v) => ({ ...v, amount: Number(e.target.value) }))} /></div><div><label className={labelClass}>Payment Mode *</label><select className={fieldClass} value={paymentForm.paymentMode} onChange={(e) => setPaymentForm((v) => ({ ...v, paymentMode: e.target.value as EmiPaymentMode }))}><option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="auto_debit">Auto Debit</option><option value="cash">Cash</option><option value="other">Other</option></select></div><div><label className={labelClass}>Reference</label><input className={fieldClass} value={paymentForm.reference || ''} onChange={(e) => setPaymentForm((v) => ({ ...v, reference: e.target.value }))} /></div><div className="sm:col-span-2"><label className={labelClass}>Remarks</label><textarea rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" value={paymentForm.remarks || ''} onChange={(e) => setPaymentForm((v) => ({ ...v, remarks: e.target.value }))} /></div></div><div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={() => setPaying(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} onClick={submitPayment} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />} Record Payment</button></div></div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(EmiLoansPage);
