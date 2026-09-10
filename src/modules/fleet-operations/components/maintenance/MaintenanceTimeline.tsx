import { memo, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { Wrench, Battery, Disc, Settings, Droplets, Wind, CircleDot, Milestone, Activity, Hash, Paperclip, Calendar, FilterX, Route, Fuel } from 'lucide-react';
import type { MaintenanceEvent } from '../../types';
import { safeDate } from '../../utils/maintenanceHelpers';
import BillDetailsModal from './BillDetailsModal';

/** One row from GET /fleet/vehicles/:vehicleId/meter-history (backend/src/utils/vehicleMeterLedger.ts) — the
 * same universal ledger used for write-time validation, reused here read-only for the timeline. */
export interface VehicleMeterEvent {
  vehicleId: number;
  sourceType: 'TRIP_START' | 'TRIP_END' | 'FUEL' | 'MAINTENANCE';
  recordId: string;
  ref: string;
  meter: number;
  eventDate: string;
  eventInstant: string;
  diffFromPrevious: number | null;
}

interface MaintenanceTimelineProps {
  events: MaintenanceEvent[];
  /** Trip/Fuel meter events for the currently-selected vehicle, merged in
   * alongside the maintenance cards below — MAINTENANCE-sourced rows are
   * expected to already be excluded (they're covered by `events` above). */
  meterEvents?: VehicleMeterEvent[];
  vehicles: any[];
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

const METER_SOURCE_LABEL: Record<VehicleMeterEvent['sourceType'], string> = {
  TRIP_START: 'Trip Start',
  TRIP_END: 'Trip End',
  FUEL: 'Fuel Bill',
  MAINTENANCE: 'Maintenance',
};

interface TimelineNode {
  icon: ReactNode;
  classes: string;
}

const getTimelineNode = (event: MaintenanceEvent): TimelineNode => {
  const check = `${event.serviceType || ''} ${event.maintenanceType || ''}`.toLowerCase();

  if (check.includes('battery')) {
    return { icon: <Battery className="w-3.5 h-3.5" />, classes: 'border-amber-200 bg-amber-50 text-amber-600' };
  }
  if (check.includes('tyre') || check.includes('tire') || check.includes('wheel') || check.includes('alignment') || check.includes('balancing')) {
    return { icon: <Disc className="w-3.5 h-3.5" />, classes: 'border-indigo-200 bg-indigo-50 text-indigo-600' };
  }
  if (check.includes('brake')) {
    return { icon: <CircleDot className="w-3.5 h-3.5" />, classes: 'border-red-200 bg-red-50 text-red-600' };
  }
  if (check.includes('coolant')) {
    return { icon: <Droplets className="w-3.5 h-3.5" />, classes: 'border-cyan-200 bg-cyan-50 text-cyan-600' };
  }
  if (check.includes('filter')) {
    return { icon: <Wind className="w-3.5 h-3.5" />, classes: 'border-teal-200 bg-teal-50 text-teal-600' };
  }
  if (check.includes('clutch')) {
    return { icon: <Settings className="w-3.5 h-3.5" />, classes: 'border-violet-200 bg-violet-50 text-violet-600' };
  }
  if (check.includes('breakdown') || check.includes('repair')) {
    return { icon: <Wrench className="w-3.5 h-3.5" />, classes: 'border-red-200 bg-red-50 text-red-600' };
  }
  return { icon: <Wrench className="w-3.5 h-3.5" />, classes: 'border-blue-200 bg-blue-50 text-blue-600' };
};

type TimelineRow =
  | { kind: 'maintenance'; time: number; data: MaintenanceEvent }
  | { kind: 'trip'; time: number; data: TripGroup }
  | { kind: 'meter'; time: number; data: VehicleMeterEvent };

interface TripGroup {
  ref: string;
  vehicleId: number;
  startEvent?: VehicleMeterEvent;
  endEvent?: VehicleMeterEvent;
  fuels: VehicleMeterEvent[];
}

const MaintenanceTimeline = ({ events, meterEvents = [], vehicles, hasActiveFilters = false, onClearFilters }: MaintenanceTimelineProps) => {
  const [selectedBill, setSelectedBill] = useState<MaintenanceEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

// Sort by the actual maintenance date, newest first (never by the MNT number).
  const timelineEvents = useMemo(() => {
    return (events || [])
      .filter((event) => event.paymentStatus === 'approved')
      .slice()
      .sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [events]);

  // Consolidate Trip Start + Trip End (same `ref`/trip_no) into ONE card, and
  // attribute each Fuel bill to the trip whose time window contains it. Fuels
  // that fall outside any trip window remain as standalone rows so no data is
  // lost. Mileage shown is the distance covered (end − start) in KM — fuel
  // litres are not exposed by the read-only meter view, so km/litre is N/A here.
  const { tripRows, orphanFuelRows } = useMemo(() => {
    const starts = new Map<string, VehicleMeterEvent>();
    const ends = new Map<string, VehicleMeterEvent>();
    const fuels: VehicleMeterEvent[] = [];
    (meterEvents || [])
      .filter((m) => m.sourceType !== 'MAINTENANCE')
      .forEach((m) => {
        if (m.sourceType === 'TRIP_START') starts.set(m.ref, m);
        else if (m.sourceType === 'TRIP_END') ends.set(m.ref, m);
        else if (m.sourceType === 'FUEL') fuels.push(m);
      });

    const refs = new Set<string>([...starts.keys(), ...ends.keys()]);
    const consumed = new Set<string>();
    const tripGroups: TripGroup[] = [];

    refs.forEach((ref) => {
      const s = starts.get(ref);
      const e = ends.get(ref);
      const startT = s ? safeDate(s.eventInstant || s.eventDate).getTime() : -Infinity;
      const endT = e ? safeDate(e.eventInstant || e.eventDate).getTime() : Infinity;
      const tripFuels = fuels.filter((f) => {
        const t = safeDate(f.eventInstant || f.eventDate).getTime();
        const inside = t >= startT && t <= endT;
        if (inside) consumed.add(f.recordId);
        return inside;
      });
      tripGroups.push({ ref, vehicleId: (s || e)!.vehicleId, startEvent: s, endEvent: e, fuels: tripFuels });
    });

    const orphanFuels = fuels.filter((f) => !consumed.has(f.recordId));
    return { tripRows: tripGroups, orphanFuelRows: orphanFuels };
  }, [meterEvents]);

  // Merge approved maintenance, consolidated trips, and orphan fuel rows into one
  // chronological feed (newest first).
  const mergedTimeline = useMemo<TimelineRow[]>(() => {
    const maintRows: TimelineRow[] = timelineEvents.map((data) => ({
      kind: 'maintenance',
      time: safeDate(data.date).getTime(),
      data,
    }));
    const tripRowItems: TimelineRow[] = tripRows.map((group) => ({
      kind: 'trip',
      time: safeDate((group.startEvent || group.endEvent)!.eventInstant || (group.startEvent || group.endEvent)!.eventDate).getTime(),
      data: group,
    }));
    const orphanRows: TimelineRow[] = orphanFuelRows.map((data) => ({
      kind: 'meter',
      time: safeDate(data.eventDate).getTime(),
      data,
    }));
    return [...maintRows, ...tripRowItems, ...orphanRows].sort((a, b) => b.time - a.time);
  }, [timelineEvents, tripRows, orphanFuelRows]);

  const handleBillClick = (event: MaintenanceEvent) => {
    setSelectedBill(event);
    setIsModalOpen(true);
  };

  if (!mergedTimeline || mergedTimeline.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="text-center py-12 text-gray-400 text-sm flex flex-col items-center justify-center">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-full mb-3 text-slate-400 shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <p className="font-bold text-gray-700 text-base">No maintenance records found</p>
          <p className="text-xs text-gray-400 mt-1">
            Try changing the maintenance type, vehicle, or search criteria.
          </p>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-colors"
            >
              <FilterX size={14} />
              Clear Filters
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="text-center py-10 text-gray-400 text-sm flex flex-col items-center justify-center">
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-full mb-3 text-slate-400 shadow-sm">
          <Activity className="w-6 h-6" />
        </div>
        <p className="font-medium text-gray-600">No Approved Maintenance History</p>
        <p className="text-xs text-gray-400 mt-0.5">No maintenance records have been approved yet.</p>
      </div>
    );
  }

  const visibleTimeline = mergedTimeline.slice(0, 80);

  return (
    <>
      <div className="relative max-h-[520px] overflow-y-auto pl-2 pr-3 scrollbar-thin">
        {/* Continuous vertical connector running through the centre of every node */}
        <div className="absolute left-5 top-2 bottom-2 w-px bg-slate-200" aria-hidden="true" />

        {visibleTimeline.map((row, index) => {
          const isLast = index === visibleTimeline.length - 1;

          if (row.kind === 'trip') {
            const trip = row.data;
            const startMeter = trip.startEvent?.meter ?? null;
            const endMeter = trip.endEvent?.meter ?? null;
            const distance = startMeter != null && endMeter != null ? Math.max(0, endMeter - startMeter) : null;
            const tripVehicle = vehicles.find((v) => String(v.id) === String(trip.vehicleId));
            const tripVehicleNo = tripVehicle?.vehicleNumber || '';
            const tripDate = trip.startEvent?.eventDate || trip.endEvent?.eventDate || '';
            return (
              <div key={`trip-${trip.ref}`} className={`relative pl-14 ${isLast ? 'pb-1' : 'pb-6'}`}>
                <div className={`absolute left-5 -translate-x-1/2 top-1 z-10 w-8 h-8 rounded-full border flex items-center justify-center shadow-sm border-sky-200 bg-sky-50 text-sky-600`}>
                  <Route className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white hover:bg-slate-50/50 border border-slate-200/70 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm tracking-wide">Trip</h4>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {trip.ref}
                      </span>
                      {tripVehicleNo && (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {tripVehicleNo}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                        {distance != null ? `${distance.toLocaleString('en-IN')} KM` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {tripDate ? format(safeDate(tripDate), 'dd MMM yyyy') : '—'}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-gray-600">
                      <Milestone className="w-3.5 h-3.5 text-gray-400" />
                      Start → End:{' '}
                      <span className="font-bold text-gray-700">
                        {startMeter != null ? startMeter.toLocaleString('en-IN') : '—'} →{' '}
                        {endMeter != null ? endMeter.toLocaleString('en-IN') : '—'} KM
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-gray-600">
                      <Fuel className="w-3.5 h-3.5 text-gray-400" />
                      Fuels: <span className="font-bold text-gray-700">{trip.fuels.length}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          if (row.kind === 'meter') {
            const m = row.data;
            const isFuel = m.sourceType === 'FUEL';
            const icon = isFuel ? <Fuel className="w-3.5 h-3.5" /> : <Route className="w-3.5 h-3.5" />;
            const classes = isFuel
              ? 'border-orange-200 bg-orange-50 text-orange-600'
              : 'border-sky-200 bg-sky-50 text-sky-600';
            const meterVehicle = vehicles.find((v) => String(v.id) === String(m.vehicleId));
            const meterVehicleNo = meterVehicle?.vehicleNumber || '';
            return (
              <div key={`meter-${m.sourceType}-${m.recordId}`} className={`relative pl-14 ${isLast ? 'pb-1' : 'pb-6'}`}>
                <div className={`absolute left-5 -translate-x-1/2 top-1 z-10 w-8 h-8 rounded-full border flex items-center justify-center shadow-sm ${classes}`}>
                  {icon}
                </div>
                <div className="bg-white hover:bg-slate-50/50 border border-slate-200/70 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm tracking-wide">{METER_SOURCE_LABEL[m.sourceType]}</h4>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {m.ref}
                      </span>
                      {meterVehicleNo && (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {meterVehicleNo}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                        {m.meter.toLocaleString('en-IN')} KM
                      </span>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {format(safeDate(m.eventDate), 'dd MMM yyyy')}
                    {m.diffFromPrevious != null && (
                      <span className={`ml-2 text-[11px] font-semibold ${m.diffFromPrevious < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {m.diffFromPrevious >= 0 ? '+' : ''}
                        {m.diffFromPrevious.toLocaleString('en-IN')} KM
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          const event = row.data;
          const matchedVehicle = vehicles.find(v => String(v.id) === String(event.vehicleId));
          const vehicleNo = matchedVehicle?.vehicleNumber || event.vehicleNo || '';
          const node = getTimelineNode(event);
          const title = String(event.serviceType || '').trim() || String(event.maintenanceType || '').trim() || 'Maintenance';
          const typeBadge = String(event.maintenanceType || '').trim();
          const showTypeBadge = typeBadge && typeBadge.toLowerCase() !== title.toLowerCase();
          const docCount = Array.isArray(event.documents) ? event.documents.length : 0;

          return (
            <div key={event.id} className={`relative pl-14 ${isLast ? 'pb-1' : 'pb-6'}`}>
              {/* Timeline node centred exactly on the connector line */}
              <div className={`absolute left-5 -translate-x-1/2 top-1 z-10 w-8 h-8 rounded-full border flex items-center justify-center shadow-sm ${node.classes}`}>
                {node.icon}
              </div>

              {/* Maintenance card */}
              <div className="bg-white hover:bg-slate-50/50 border border-slate-200/70 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
                {/* Top row: title, badges, documents, amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm tracking-wide">{title}</h4>

                      {showTypeBadge && (
                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                          {typeBadge}
                        </span>
                      )}

                      {vehicleNo && (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {vehicleNo}
                        </span>
                      )}

                      {event.billNumber && (
                        <button
                          onClick={() => handleBillClick(event)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded hover:bg-green-100 hover:border-green-300 transition-colors cursor-pointer"
                          title="Click to view bill details"
                        >
                          <Hash className="w-3 h-3" />
                          {event.billNumber}
                        </button>
                      )}

                      {docCount > 0 && (
                        <button
                          onClick={() => handleBillClick(event)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors cursor-pointer"
                          title={`${docCount} document${docCount > 1 ? 's' : ''} attached`}
                        >
                          <Paperclip className="w-3 h-3" />
                          {docCount}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-600 shadow-sm">
                      ₹{event.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Second row: actual maintenance date */}
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {format(safeDate(event.date), 'dd MMM yyyy')}
                </div>

                {/* Third row: operational information */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-gray-600">
                    <Milestone className="w-3.5 h-3.5 text-gray-400" />
                    Log Profile: {event.currentKM.toLocaleString('en-IN')} KM
                  </span>
                  {event.nextServiceKM > 0 && (
                    <span className="font-medium text-gray-500">
                      Next Target: {event.nextServiceKM.toLocaleString('en-IN')} KM
                    </span>
                  )}
                  {event.garage && (
                    <span className="truncate max-w-[180px]">
                      Garage: <span className="font-semibold text-gray-600">{event.garage}</span>
                    </span>
                  )}
                  {event.mechanic && (
                    <span>
                      Mechanic: <span className="font-semibold text-gray-600">{event.mechanic}</span>
                    </span>
                  )}
                  {event.driverName && (
                    <span>
                      Driver: <span className="font-semibold text-gray-600">{event.driverName}</span>
                    </span>
                  )}
                </div>

                {event.remarks && (
                  <div className="text-xs italic text-gray-600 mt-2 bg-slate-50 border border-slate-200/70 px-3 py-2 rounded-lg leading-relaxed">
                    &quot;{event.remarks}&quot;
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {mergedTimeline.length > visibleTimeline.length && (
        <p className="px-5 pt-3 text-center text-[11px] font-semibold text-slate-400">
          Showing latest {visibleTimeline.length} of {mergedTimeline.length} events. Narrow the date or vehicle filter to see more.
        </p>
      )}

      {/* Bill Details Modal */}
      <BillDetailsModal
        isOpen={isModalOpen}
        bill={selectedBill}
        vehicles={vehicles}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBill(null);
        }}
      />
    </>
  );
};

export default memo(MaintenanceTimeline);
