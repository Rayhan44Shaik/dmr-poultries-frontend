import { memo, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { Wrench, Battery, Disc, Settings, Droplets, Wind, CircleDot, Gauge, Target, Activity, Hash, Paperclip, Calendar, FilterX, Route, Fuel, Truck } from 'lucide-react';
import type { MaintenanceEvent } from '../../types';
import type { Vehicle } from '../../../masters/vehicles/types/vehicle';
import { formatVehicleNumber } from '../../../../utils/format';
import { safeDate } from '../../utils/maintenanceHelpers';
import ViewModal from './ViewModal';

/** One row from GET /fleet/vehicles/:vehicleId/meter-history (backend/src/utils/vehicleMeterLedger.ts) — the
 * same universal ledger used for write-time validation, reused here read-only for the timeline. */
export interface VehicleMeterEvent {
  vehicleId: number;
  sourceType: 'TRIP_START' | 'TRIP_END' | 'FUEL' | 'MAINTENANCE';
  recordId: string;
  ref: string;
  tripId?: string;
  meter: number;
  eventDate: string;
  eventInstant: string;
  diffFromPrevious: number | null;
  /** Present for trip-bound rows; only Approved/Completed trips belong in this feed. */
  tripStatus?: string;
}

interface MaintenanceTimelineProps {
  events: MaintenanceEvent[];
  /** Trip/Fuel meter events for the currently-selected vehicle, merged in
   * alongside the maintenance cards below — MAINTENANCE-sourced rows are
   * expected to already be excluded (they're covered by `events` above). */
  meterEvents?: VehicleMeterEvent[];
  vehicles: Vehicle[];
  /** Full approved history; the selected-record view uses this for its
   * same-vehicle detail list without bringing back a maintenance table. */
  vehicleHistory?: MaintenanceEvent[];
  hasActiveFilters?: boolean;
  /** Ascending/descending calendar order from the history filter bar. */
  sortDirection?: 'asc' | 'desc';
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

/** One simple, calm tone for every approved-maintenance node — the glyph
 * still tells the service kind apart, but the feed no longer rains colour. */
const SIMPLE_NODE_CLASSES =
  'border-emerald-200 bg-emerald-50 text-emerald-600';

const getTimelineNode = (event: MaintenanceEvent): TimelineNode => {
  const check = `${event.serviceType || ''} ${event.maintenanceType || ''}`.toLowerCase();

  if (check.includes('battery')) {
    return { icon: <Battery className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  if (check.includes('tyre') || check.includes('tire') || check.includes('wheel') || check.includes('alignment') || check.includes('balancing')) {
    return { icon: <Disc className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  if (check.includes('brake')) {
    return { icon: <CircleDot className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  if (check.includes('coolant')) {
    return { icon: <Droplets className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  if (check.includes('filter')) {
    return { icon: <Wind className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  if (check.includes('clutch')) {
    return { icon: <Settings className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  if (check.includes('breakdown') || check.includes('repair')) {
    return { icon: <Wrench className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
  }
  return { icon: <Wrench className="w-3.5 h-3.5" />, classes: SIMPLE_NODE_CLASSES };
};

type TimelineRow =
  | { kind: 'maintenance'; time: number; data: MaintenanceEvent }
  | { kind: 'trip'; time: number; data: TripGroup }
  | { kind: 'meter'; time: number; data: VehicleMeterEvent };

interface TripGroup {
  id: string;
  ref: string;
  vehicleId: number;
  startEvent?: VehicleMeterEvent;
  endEvent?: VehicleMeterEvent;
  fuels: VehicleMeterEvent[];
}

/** A single consistent visual treatment for every registration in the feed. */
const VehicleRegistration = ({ value }: { value?: string | number }) => {
  const rawValue = value == null ? '' : String(value);
  const registration = formatVehicleNumber(rawValue);
  if (!rawValue || registration === '—') return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-bold tracking-wide text-slate-600">
      <Truck className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
      {registration}
    </span>
  );
};

/** Animated placeholder rows shown while the approved timeline loads — the
 * same silhouette as a live row (node on the connector + card), so the page
 * fills in place exactly like the Trip List / Order Assignment loaders. */
export const MaintenanceTimelineSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div role="status" aria-busy="true" className="relative pl-2 pr-3">
    <div className="absolute left-5 top-2 bottom-2 w-px bg-slate-200" aria-hidden="true" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={`relative pl-14 animate-pulse ${i === rows - 1 ? 'pb-1' : 'pb-6'}`}>
        <div className="absolute left-5 -translate-x-1/2 top-1 z-10 h-8 w-8 rounded-full border border-slate-200 bg-slate-100" />
        <div className="rounded-xl border border-slate-200/70 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="h-4 w-44 rounded bg-slate-100" />
            <div className="h-7 w-20 rounded-lg bg-slate-100" />
          </div>
          <div className="mt-3 h-6 w-28 rounded-lg bg-slate-100" />
          <div className="mt-2.5 h-4 w-64 max-w-full rounded bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);

const MaintenanceTimeline = ({ events, meterEvents = [], vehicles, vehicleHistory = [], hasActiveFilters = false, sortDirection = 'desc', onClearFilters }: MaintenanceTimelineProps) => {
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceEvent | null>(null);

// Sort by the actual maintenance date, newest first (never by the MNT number).
  const timelineEvents = useMemo(() => {
    return (events || [])
      .filter((event) => event.paymentStatus === 'approved')
      .slice()
      .sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [events]);

  // Consolidate Trip Start + Trip End (same trip record) and every trip-linked
  // Fuel bill into ONE card. Standalone fuels remain separate rows. Mileage
  // shown is the distance covered (end − start) in KM — fuel litres are not
  // exposed by the read-only meter view, so km/litre is N/A here.
  const { tripRows, orphanFuelRows } = useMemo(() => {
    const starts = new Map<string, VehicleMeterEvent>();
    const ends = new Map<string, VehicleMeterEvent>();
    const fuels: VehicleMeterEvent[] = [];
    const visibleTripStatus = (status?: string) => {
      const normalized = String(status || '').trim().toLowerCase();
      return normalized === 'approved' || normalized === 'completed';
    };
    (meterEvents || [])
      .filter((m) => {
        if (m.sourceType === 'MAINTENANCE') return false;
        if (m.sourceType === 'TRIP_START' || m.sourceType === 'TRIP_END') {
          return visibleTripStatus(m.tripStatus);
        }
        // Standalone fuel bills are valid history events. Trip fuel rows carry
        // tripStatus from the backend and must belong to an approved/completed trip.
        return m.sourceType !== 'FUEL' || m.tripStatus == null || visibleTripStatus(m.tripStatus);
      })
      .forEach((m) => {
        const tripKey = `${m.vehicleId}:${m.recordId}`;
        if (m.sourceType === 'TRIP_START') starts.set(tripKey, m);
        else if (m.sourceType === 'TRIP_END') ends.set(tripKey, m);
        else if (m.sourceType === 'FUEL') fuels.push(m);
      });

    const refs = new Set<string>([...starts.keys(), ...ends.keys()]);
    const consumed = new Set<string>();
    const tripGroups: TripGroup[] = [];

    refs.forEach((id) => {
      const s = starts.get(id);
      const e = ends.get(id);
      const startT = s ? safeDate(s.eventInstant || s.eventDate).getTime() : -Infinity;
      const endT = e ? safeDate(e.eventInstant || e.eventDate).getTime() : Infinity;
      const tripRecordId = s?.recordId || e?.recordId;
      const tripFuels = fuels.filter((f) => {
        // The backend supplies tripId for trip fuel. This exact relationship is
        // authoritative and prevents one trip's fuel from leaking into another.
        if (f.tripId && f.tripId === tripRecordId) {
          consumed.add(f.recordId);
          return true;
        }
        // Keep compatibility with older API responses, but only use the time
        // window for rows that are explicitly trip-linked (tripId absent there).
        if (f.tripId || !tripRecordId) return false;
        const t = safeDate(f.eventInstant || f.eventDate).getTime();
        const inside = t >= startT && t <= endT;
        if (inside) consumed.add(f.recordId);
        return inside;
      });
      tripGroups.push({ id, ref: (s || e)!.ref, vehicleId: (s || e)!.vehicleId, startEvent: s, endEvent: e, fuels: tripFuels });
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
    return [...maintRows, ...tripRowItems, ...orphanRows].sort((a, b) =>
      sortDirection === 'asc' ? a.time - b.time : b.time - a.time
    );
  }, [timelineEvents, tripRows, orphanFuelRows, sortDirection]);

  const handleRecordSelect = (event: MaintenanceEvent) => {
    setSelectedRecord(event);
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
            const tripVehicleNo = tripVehicle?.vehicleNumber || tripVehicle?.vehicleNo || '';
            const tripDate = trip.startEvent?.eventDate || trip.endEvent?.eventDate || '';
            return (
              <div
                key={`trip-${trip.id}`}
                className={`relative pl-14 animate-fade-in-up ${isLast ? 'pb-1' : 'pb-6'}`}
                style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
              >
                <div className="absolute left-5 -translate-x-1/2 top-1 z-10 w-8 h-8 rounded-full border flex items-center justify-center shadow-sm border-slate-200 bg-slate-50 text-slate-500">
                  <Route className="w-3.5 h-3.5" />
                </div>
                <div className="bg-gradient-to-br from-white via-white to-slate-50/70 hover:from-emerald-50/20 hover:to-white border border-slate-200/70 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm tracking-wide">Trip</h4>
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {trip.ref}
                      </span>
                      <VehicleRegistration value={tripVehicleNo} />
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        {String(trip.startEvent?.tripStatus || trip.endEvent?.tripStatus || 'Completed')}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700 shadow-sm">
                        {distance != null ? `${distance.toLocaleString('en-IN')} KM` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      <Calendar className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                      {tripDate ? format(safeDate(tripDate), 'dd MMM yyyy') : '—'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1 font-semibold text-gray-600">
                      <Gauge className="w-3.5 h-3.5 text-gray-400" />
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
                  {trip.fuels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                      {trip.fuels.map((fuel) => (
                        <span key={fuel.recordId} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
                          <Fuel className="h-3 w-3 text-slate-400" />
                          {fuel.ref || 'Fuel'} · {fuel.meter.toLocaleString('en-IN')} KM
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (row.kind === 'meter') {
            const m = row.data;
            const isFuel = m.sourceType === 'FUEL';
            const icon = isFuel ? <Fuel className="w-3.5 h-3.5" /> : <Route className="w-3.5 h-3.5" />;
            const classes = 'border-slate-200 bg-slate-50 text-slate-500';
            const meterVehicle = vehicles.find((v) => String(v.id) === String(m.vehicleId));
            const meterVehicleNo = meterVehicle?.vehicleNumber || meterVehicle?.vehicleNo || '';
            return (
                <div
                  key={`meter-${m.sourceType}-${m.recordId}`}
                  className={`relative pl-14 animate-fade-in-up ${isLast ? 'pb-1' : 'pb-6'}`}
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
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
                      <VehicleRegistration value={meterVehicleNo} />
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                        {m.meter.toLocaleString('en-IN')} KM
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      <Calendar className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                      {format(safeDate(m.eventDate), 'dd MMM yyyy')}
                    </span>
                    {m.diffFromPrevious != null && (
                      <span className={`text-[11px] font-semibold ${m.diffFromPrevious < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
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
          const vehicleNo = matchedVehicle?.vehicleNumber || matchedVehicle?.vehicleNo || event.vehicleNo || '';
          const node = getTimelineNode(event);
          const title = String(event.serviceType || '').trim() || String(event.maintenanceType || '').trim() || 'Maintenance';
          const typeBadge = String(event.maintenanceType || '').trim();
          const showTypeBadge = typeBadge && typeBadge.toLowerCase() !== title.toLowerCase();
          const docCount = Array.isArray(event.documents) ? event.documents.length : 0;

          return (
            <div
              key={event.id}
              className={`relative pl-14 animate-fade-in-up ${isLast ? 'pb-1' : 'pb-6'}`}
              style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
            >
              {/* Timeline node centred exactly on the connector line */}
              <div className={`absolute left-5 -translate-x-1/2 top-1 z-10 w-8 h-8 rounded-full border flex items-center justify-center shadow-sm ${node.classes}`}>
                {node.icon}
              </div>

              {/* Maintenance card */}
              <article
                role="button"
                tabIndex={0}
                onClick={() => handleRecordSelect(event)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                    keyboardEvent.preventDefault();
                    handleRecordSelect(event);
                  }
                }}
                aria-label={`View approved maintenance ${event.billNumber || event.maintenanceType}`}
                className="group cursor-pointer rounded-xl border border-slate-200/70 bg-white p-4 text-left shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
              >
                {/* Top row: title, badges, documents, amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm tracking-wide">{title}</h4>

                      {showTypeBadge && (
                        <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                          {typeBadge}
                        </span>
                      )}

                      <VehicleRegistration value={vehicleNo} />

                      {event.billNumber && (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700"
                          title="Open approved maintenance details"
                        >
                          <Hash className="w-3 h-3" />
                          {event.billNumber}
                        </span>
                      )}

                      {docCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600"
                          title={`${docCount} document${docCount > 1 ? 's' : ''} attached`}
                        >
                          <Paperclip className="w-3 h-3" />
                          {docCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-700 shadow-sm">
                      ₹{event.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Second row: actual maintenance date */}
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    <Calendar className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                    {format(safeDate(event.date), 'dd MMM yyyy')}
                  </span>
                </div>

                {/* Third row: operational information */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                  {/* Log Profile reads as one neat, compact chip. */}
                  {/* Log Profile and Next Target share one matched tone. */}
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <Gauge className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                    <span>Log Profile</span>
                    <strong className="tabular-nums text-emerald-800">
                      {event.currentKM.toLocaleString('en-IN')} KM
                    </strong>
                  </span>
                  {event.nextServiceKM > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Target className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                      Next Target:{' '}
                      <strong className="tabular-nums text-emerald-800">
                        {event.nextServiceKM.toLocaleString('en-IN')} KM
                      </strong>
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
              </article>
            </div>
          );
        })}
      </div>
      {mergedTimeline.length > visibleTimeline.length && (
        <p className="px-5 pt-3 text-center text-[11px] font-semibold text-slate-400">
          Showing {visibleTimeline.length} of {mergedTimeline.length} events. Narrow the date or vehicle filter to see more.
        </p>
      )}

      {selectedRecord ? (
        <ViewModal
          record={selectedRecord}
          vehicles={vehicles}
          vehicleHistory={vehicleHistory}
          onClose={() => setSelectedRecord(null)}
        />
      ) : null}
    </>
  );
};

export default memo(MaintenanceTimeline);
