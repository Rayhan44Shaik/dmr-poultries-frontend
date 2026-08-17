import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { useMaintenanceData } from '../hooks/useMaintenanceData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import MaintenanceTimeline, { type VehicleMeterEvent } from '../components/maintenance/MaintenanceTimeline';
import UpcomingServices from '../components/maintenance/UpcomingServices';
import { AlertCircle, CheckCircle2, ChevronDown, Search, X, FilterX } from 'lucide-react';
import { safeDate } from '../utils/maintenanceHelpers';
import { apiGet } from '../../../api';

interface MaintenanceHistoryPageProps {
  embedded?: boolean;
}

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  allLabel: string;
  value: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
  searchable?: boolean;
}

const FilterDropdown = ({ allLabel, value, options, onSelect, searchable = false }: FilterDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allOptions: FilterOption[] = useMemo(
    () => [{ value: 'all', label: allLabel }, ...options],
    [allLabel, options]
  );

  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allOptions;
    return allOptions.filter((o) => o.label.toLowerCase().includes(needle));
  }, [allOptions, query]);

  const currentLabel = allOptions.find((o) => o.value === value)?.label || allLabel;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="inline-flex items-center justify-between gap-2 h-9 px-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 min-w-[170px] max-w-[230px]"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-1.5 min-w-full w-max max-w-[260px] bg-white border border-slate-200/80 rounded-xl shadow-xl p-1.5 border-t-blue-500 border-t-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {searchable && (
            <div className="relative mb-1">
              <Search size={12} className="text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${allLabel.toLowerCase()}...`}
                className="w-full h-8 pl-7 pr-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 placeholder-slate-400"
              />
            </div>
          )}
          <div className="max-h-[220px] overflow-y-auto scrollbar-thin space-y-0.5">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className={`w-full text-left h-9 px-2.5 text-xs font-bold rounded-lg transition-colors truncate flex items-center
                    ${value === opt.value
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <div className="py-3 px-2 text-center text-[11px] font-bold text-slate-400">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MaintenanceHistoryPage = ({ embedded = false }: MaintenanceHistoryPageProps) => {
  const {
    vehicles,
    filtered,
    upcomingServices,
    selectedVehicle,
    setSelectedVehicle,
    selectedMaintenanceType,
    setSelectedMaintenanceType,
    searchQuery,
    setSearchQuery,
    hasActiveFilters,
    resetFilters,
    approvedHistory,
    maintenanceTypes,
  } = useMaintenanceData();

  const overdueCount = upcomingServices.filter((s) => s.isDue).length;

  // Canonical vehicle options from the Vehicle Master (numbers only, no ids).
  const vehicleOptions = useMemo<FilterOption[]>(
    () =>
      vehicles
        .map((v: any) => ({ value: String(v.id), label: String(v.vehicleNumber || '') }))
        .filter((o: FilterOption) => o.label),
    [vehicles]
  );

  const maintenanceTypeOptions = useMemo<FilterOption[]>(
    () => maintenanceTypes.map((type) => ({ value: type, label: type })),
    [maintenanceTypes]
  );

  // Approved maintenance log, newest first (by actual maintenance date).
  const timelineEvents = useMemo(() => {
    return filtered
      .filter((e: any) => e.paymentStatus === 'approved')
      .slice()
      .sort((a: any, b: any) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [filtered]);

  // Trip/Fuel meter events supplement the maintenance-only timeline above.
  // Only fetched when the user has narrowed to a single vehicle — the
  // backend endpoint is per-vehicle (backend/src/routes/fleet.ts
  // GET /fleet/vehicles/:vehicleId/meter-history, backed by the same
  // universal vehicle_meter_events view used for write-time validation).
  const [meterEvents, setMeterEvents] = useState<VehicleMeterEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!selectedVehicle || selectedVehicle === 'all') {
      setMeterEvents([]);
      return;
    }
    apiGet<VehicleMeterEvent[]>(`/fleet/vehicles/${selectedVehicle}/meter-history`)
      .then((res) => {
        if (!cancelled) {
          setMeterEvents((res.data ?? []).filter((e) => e.sourceType !== 'MAINTENANCE'));
        }
      })
      .catch(() => {
        if (!cancelled) setMeterEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVehicle]);

  const allApprovedCount = approvedHistory.length;
  const visibleCount = timelineEvents.length;

  // Small contextual count shown beside the timeline heading.
  const resultText = useMemo(
    () => `Showing ${visibleCount} of ${allApprovedCount} records`,
    [visibleCount, allApprovedCount]
  );

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-4 animate-in fade-in duration-500 ${
        embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'
      }`}>

        {/* Streamlined Toolbar Row */}
        <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-2">
            {overdueCount > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{overdueCount} {overdueCount === 1 ? 'Vehicle requires' : 'Vehicles require'} attention</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All vehicle schedules are clear</span>
              </div>
            )}
          </div>
        </div>

        {/* Maintenance History Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterDropdown
              allLabel="All Maintenance Details"
              value={selectedMaintenanceType}
              options={maintenanceTypeOptions}
              onSelect={setSelectedMaintenanceType}
            />

            <FilterDropdown
              allLabel="All Vehicles"
              value={selectedVehicle}
              options={vehicleOptions}
              onSelect={setSelectedVehicle}
              searchable
            />

            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={13} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search maintenance..."
                className="w-full h-9 pl-8 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 placeholder-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/70 transition-colors"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
              >
                <FilterX size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Panels Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <h3 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Maintenance Log Timeline</h3>
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{resultText}</span>
            </div>
            <div className="p-5 md:p-6">
              <MaintenanceTimeline
                events={timelineEvents}
                meterEvents={meterEvents}
                vehicles={vehicles}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={resetFilters}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Upcoming Action Schedules</h3>
            </div>
            <div className="p-5 md:p-6">
              <UpcomingServices services={upcomingServices} />
            </div>
          </div>
        </div>

      </div>
    </ErrorBoundary>
  );
};

export default memo(MaintenanceHistoryPage);
