import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FilterX,
  IndianRupee,
  Paperclip,
  Search,
  Truck,
  Wrench,
} from 'lucide-react';
import { DatePicker } from '../../../components/common/DatePicker';
import { apiGet } from '../../../api';
import { useI18n, translateStatus } from '../../../i18n';
import ErrorBoundary from '../components/common/ErrorBoundary';
import MaintenanceTimeline, { type VehicleMeterEvent } from '../components/maintenance/MaintenanceTimeline';
import UpcomingServices from '../components/maintenance/UpcomingServices';
import { useMaintenanceData } from '../hooks/useMaintenanceData';
import { safeDate } from '../utils/maintenanceHelpers';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';

interface MaintenanceHistoryPageProps { embedded?: boolean }
const selectClass = 'h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

const MaintenanceHistoryPage = ({ embedded = false }: MaintenanceHistoryPageProps) => {
  const { t } = useI18n();
  const data = useMaintenanceData('history');
  const { employees } = useEmployees();
  const [meterEvents, setMeterEvents] = useState<VehicleMeterEvent[]>([]);

  // Drivers are pulled from the Employees master, restricted to department === 'Driver'.
  const drivers = useMemo(
    () => employees.filter((e) => String(e.department || '').trim().toLowerCase() === 'driver'),
    [employees]
  );

  // All filter controls are "pending" until the user clicks Search. Nothing is
  // pushed to the hook (and therefore neither table re-queries) until Search is
  // pressed — the tables below only react to the Search action.
  const [pending, setPending] = useState({
    vehicle: 'all',
    driver: 'all',
    maintenanceType: 'all',
    serviceType: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
    search: '',
  });
  const setPendingField = <K extends keyof typeof pending>(key: K, value: typeof pending[K]) =>
    setPending((prev) => ({ ...prev, [key]: value }));

  // Search is the single "apply" trigger: it commits every pending filter value
  // to the data hook at once, so both tables re-run with the new filters.
  const applyFilters = () => {
    data.setSelectedVehicle(pending.vehicle);
    data.setSelectedDriver(pending.driver);
    data.setSelectedMaintenanceType(pending.maintenanceType);
    data.setSelectedServiceType(pending.serviceType);
    data.setSelectedStatus(pending.status);
    data.setFromDate(pending.fromDate);
    data.setToDate(pending.toDate);
    data.setSearchQuery(pending.search.trim());
  };

  // Clear resets every pending filter AND the hook, returning both tables to the
  // full unfiltered view (all approved maintenance + all upcoming services).
  const clearFilters = () => {
    setPending({ vehicle: 'all', driver: 'all', maintenanceType: 'all', serviceType: 'all', status: 'all', fromDate: '', toDate: '', search: '' });
    data.resetFilters();
  };

  // Bottom-right corner toast for the Refresh action. Self-contained, auto-dismiss.
  const [toast, setToast] = useState<{ visible: boolean; message: string; tone: 'success' | 'info' }>({
    visible: false,
    message: '',
    tone: 'success',
  });
  const showCornerToast = useCallback(
    (message: string, tone: 'success' | 'info' = 'success', durationMs = 5000) => {
      setToast({ visible: true, message, tone });
      window.setTimeout(() => {
        setToast((prev) => (prev.message === message ? { ...prev, visible: false } : prev));
      }, durationMs);
    },
    []
  );

  // Trip/Fuel meter events for the timeline. When a single vehicle is selected we
  // hit the per-vehicle endpoint; when "All Vehicles" is selected we fan out to every
  // vehicle's meter-history in parallel and merge, so the timeline shows every
  // vehicle's trips and fuel bills (time-sorted alongside maintenance).
  useEffect(() => {
    let cancelled = false;
    if (!data.selectedVehicle) { setMeterEvents([]); return; }

    if (data.selectedVehicle === 'all') {
      const ids = (data.vehicles || []).map((v: any) => Number(v.id)).filter(Boolean);
      if (ids.length === 0) { setMeterEvents([]); return; }
      Promise.all(
        ids.map((id: number) =>
          apiGet<VehicleMeterEvent[]>(`/fleet/vehicles/${id}/meter-history`)
            .then((res) => res.data || [])
            .catch(() => [])
        )
      )
        .then((lists) => {
          if (cancelled) return;
          const merged = lists.flat().filter((event) => event.sourceType !== 'MAINTENANCE');
          setMeterEvents(merged);
        })
        .catch(() => { if (!cancelled) setMeterEvents([]); });
      return;
    }

    apiGet<VehicleMeterEvent[]>(`/fleet/vehicles/${data.selectedVehicle}/meter-history`)
      .then((response) => { if (!cancelled) setMeterEvents((response.data || []).filter((event) => event.sourceType !== 'MAINTENANCE')); })
      .catch(() => { if (!cancelled) setMeterEvents([]); });
    return () => { cancelled = true; };
  }, [data.selectedVehicle, data.vehicles]);

  // Date-range filter applied to meter events (trip starts/ends and fuel bills)
  // so the timeline honours the From/To dates just like the maintenance list does.
  // Trip rows are kept if their eventDate falls inside the range.
  const filteredMeterEvents = useMemo(() => {
    if (!data.fromDate && !data.toDate) return meterEvents;
    return meterEvents.filter((m) => {
      const d = m.eventDate;
      if (!d) return true;
      if (data.fromDate && d < data.fromDate) return false;
      if (data.toDate && d > data.toDate) return false;
      return true;
    });
  }, [meterEvents, data.fromDate, data.toDate]);

  // Approved Maintenance Timeline:
  //  - By default (no active filter) it shows ALL approved records with full detail.
  //  - Only when a filter is applied does it narrow to the matching subset.
  const allApproved = data.approvedHistory;
  const filteredApproved = useMemo(
    () => data.filtered.filter((record) => record.paymentStatus === 'approved' && !record.deletedAt),
    [data.filtered]
  );
  const timelineSource = data.hasActiveFilters ? filteredApproved : allApproved;
  const sorted = useMemo(
    () => [...timelineSource].sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime()),
    [timelineSource]
  );
  const timelineEvents = sorted;

  // Upcoming Services also honours the active filters (vehicle + date range).
  const visibleUpcoming = useMemo(() => {
    let list = data.upcomingServices;
    if (data.selectedVehicle !== 'all') {
      list = list.filter((item: any) => String(item.vehicle?.id) === String(data.selectedVehicle));
    }
    if (data.fromDate || data.toDate) {
      const from = data.fromDate ? safeDate(data.fromDate).getTime() : -Infinity;
      const to = data.toDate ? safeDate(data.toDate).getTime() : Infinity;
      list = list.filter((item: any) => {
        const d = item.lastMaint?.date ? safeDate(item.lastMaint.date).getTime() : null;
        return d == null || (d >= from && d <= to);
      });
    }
    return list;
  }, [data.upcomingServices, data.selectedVehicle, data.fromDate, data.toDate]);

  const cards = [
    { label: t('fleet.maintenance_history.total_maintenance'), value: data.historyStats.total, icon: Wrench, tone: 'bg-blue-50 text-blue-600' },
    { label: t('fleet.maintenance_history.total_cost'), value: `₹${data.historyStats.totalCost.toLocaleString('en-IN')}`, icon: IndianRupee, tone: 'bg-violet-50 text-violet-600' },
    { label: t('status.approved'), value: data.historyStats.approved, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: t('status.pending'), value: data.historyStats.pending, icon: AlertCircle, tone: 'bg-amber-50 text-amber-600' },
    { label: t('fleet.maintenance_history.vehicles_serviced'), value: data.historyStats.vehiclesServiced, icon: Truck, tone: 'bg-cyan-50 text-cyan-600' },
    { label: t('fleet.maintenance_history.documents'), value: data.historyStats.documents, icon: Paperclip, tone: 'bg-slate-100 text-slate-600' },
  ];

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 ${embedded ? '' : 'min-h-screen bg-slate-50 px-4 py-6 md:px-8'}`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {cards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-lg font-black text-slate-800">{value}</p></div>)}
        </div>

        <div className="relative overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <select value={pending.vehicle} onChange={(e) => setPendingField('vehicle', e.target.value)} className={selectClass}><option value="all">{t('fleet.maintenance_history.all_vehicles')}</option>{data.vehicles.map((vehicle: any) => <option key={vehicle.id} value={String(vehicle.id)}>{vehicle.vehicleNumber}</option>)}</select>
            <select value={pending.driver} onChange={(e) => setPendingField('driver', e.target.value)} className={selectClass}><option value="all">{t('fleet.maintenance_history.all_drivers')}</option>{drivers.map((driver) => <option key={driver.id} value={String(driver.id)}>{driver.employeeName}</option>)}</select>
            <select value={pending.maintenanceType} onChange={(e) => setPendingField('maintenanceType', e.target.value)} className={selectClass}><option value="all">{t('fleet.maintenance_history.all_maintenance_types')}</option>{data.maintenanceTypes.map((type) => <option key={type}>{type}</option>)}</select>
            <select value={pending.serviceType} onChange={(e) => setPendingField('serviceType', e.target.value)} className={selectClass}><option value="all">{t('fleet.maintenance_history.all_service_types')}</option>{data.serviceTypes.map((type) => <option key={type}>{type}</option>)}</select>
            <select value={pending.status} onChange={(e) => setPendingField('status', e.target.value)} className={`${selectClass} min-w-[140px]`}><option value="all">{t('fleet.maintenance_history.all_statuses')}</option><option value="Approved">{translateStatus(t, 'Approved')}</option><option value="Pending">{translateStatus(t, 'Pending')}</option><option value="Deleted">{translateStatus(t, 'Deleted')}</option></select>
            <div className="w-40"><DatePicker value={pending.fromDate} onChange={(v) => setPendingField('fromDate', v)} placeholder={t('reports.date_from')} /></div>
            <div className="w-40"><DatePicker value={pending.toDate} onChange={(v) => setPendingField('toDate', v)} placeholder={t('reports.date_to')} /></div>
            <div className="relative min-w-[220px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={pending.search} onChange={(e) => setPendingField('search', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }} placeholder={t('fleet.maintenance_history.search_placeholder')} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white" /></div>
            <button onClick={applyFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"><Search size={14} /> {t('common.search')}</button>
            <button onClick={clearFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"><FilterX size={14} /> {t('common.clear')}</button>
            <button onClick={() => { data.refresh(); showCornerToast('Trip Data Refreshed.', 'success', 5000); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{t('common.refresh')}</button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><CalendarDays size={12} /> {t('fleet.maintenance_history.filter_hint')}</p>
        </div>

        {(data.historyError || data.error) && <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span className="flex items-center gap-2"><AlertCircle size={17} />{data.historyError || data.error}</span><button onClick={data.refresh} className="font-bold underline">{t('common.retry')}</button></div>}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-800">{t('fleet.maintenance_history.approved_timeline')}</h3></div><div className="p-5"><MaintenanceTimeline events={timelineEvents} meterEvents={filteredMeterEvents} vehicles={data.vehicles} hasActiveFilters={data.hasActiveFilters} onClearFilters={data.resetFilters} /></div></div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="text-sm font-bold text-slate-800">{t('fleet.maintenance_history.upcoming_service')}</h3></div><div className="p-5"><UpcomingServices services={visibleUpcoming} /></div></div>
        </div>
      </div>

      {toast.visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[60] pointer-events-none"
        >
          <div
            className={`pointer-events-auto flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium ${
              toast.tone === 'success'
                ? 'bg-white border-emerald-200 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full ${
                toast.tone === 'success' ? 'bg-emerald-100' : 'bg-slate-100'
              }`}
            >
              <CheckCircle2
                size={14}
                className={toast.tone === 'success' ? 'text-emerald-600' : 'text-slate-500'}
              />
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default memo(MaintenanceHistoryPage);
