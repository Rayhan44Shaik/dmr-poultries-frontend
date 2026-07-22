import { memo, useState, useRef, useEffect } from 'react';
import { useMaintenanceData } from '../hooks/useMaintenanceData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import MaintenanceTimeline from '../components/maintenance/MaintenanceTimeline';
import UpcomingServices from '../components/maintenance/UpcomingServices';
import { Wrench, IndianRupee, Milestone, Calendar, AlertCircle, CheckCircle2, ChevronDown, Search } from 'lucide-react';

interface MaintenanceHistoryPageProps {
  embedded?: boolean;
}

const MaintenanceHistoryPage = ({ embedded = false }: MaintenanceHistoryPageProps) => {
  const { 
    vehicles,
    filtered, 
    stats, 
    upcomingServices, 
    selectedVehicle, 
    setSelectedVehicle 
  } = useMaintenanceData();

  // Searchable Dropdown States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const vehicleOptions = [
    { value: 'all', label: 'All Vehicles' },
    ...vehicles.map((v: any) => ({ value: v.id, label: v.vehicleNumber })),
  ];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const overdueCount = upcomingServices.filter(s => s.isDue).length;

  const filteredOptions = vehicleOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSelectedLabel = vehicleOptions.find(opt => opt.value === selectedVehicle)?.label || 'All Vehicles';

  const kpis = [
    { 
      label: 'Total Services', 
      value: stats.total.toLocaleString('en-IN'), 
      icon: <Wrench className="w-5 h-5 stroke-[2]" />, 
      bg: 'bg-blue-50/60', text: 'text-blue-600', border: 'border-blue-100/80'
    },
    { 
      label: 'Total Cost', 
      value: `₹${stats.totalCost.toLocaleString('en-IN')}`, 
      icon: <IndianRupee className="w-5 h-5 stroke-[2]" />, 
      bg: 'bg-emerald-50/60', text: 'text-emerald-600', border: 'border-emerald-100/80'
    },
    { 
      label: 'Total Distance', 
      value: `${stats.totalDistance.toLocaleString('en-IN')} KM`, 
      icon: <Milestone className="w-5 h-5 stroke-[2]" />, 
      bg: 'bg-amber-50/60', text: 'text-amber-600', border: 'border-amber-100/80'
    },
    { 
      label: 'Last Service', 
      value: stats.lastService ? new Date(stats.lastService.date).toLocaleDateString('en-GB') : 'N/A', 
      icon: <Calendar className="w-5 h-5 stroke-[2]" />,
      bg: 'bg-indigo-50/60', text: 'text-indigo-600', border: 'border-indigo-100/80'
    },
  ];

  return (
    <ErrorBoundary>
      {/* Container adapts padding and layout based on whether embedded inside FleetPages layout */}
      <div className={`space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 ${
        embedded ? 'px-0 py-2' : 'px-1 md:px-3 py-6 md:py-8 bg-slate-50 min-h-screen'
      }`}>
        
        {/* Streamlined Toolbar Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
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

          {/* Direct Search Input Component Dropdown Wrapper */}
          <div className="relative sm:mr-8 min-w-[220px]" ref={dropdownRef}>
            <div className="relative flex items-center bg-white rounded-xl border border-slate-200 shadow-sm focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all group hover:bg-slate-50/50">
              <Search size={12} className="text-slate-400 absolute left-3 pointer-events-none" />
              
              <input
                type="text"
                value={isDropdownOpen ? searchTerm : currentSelectedLabel}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  setIsDropdownOpen(true);
                  setSearchTerm(''); // Clears search context to show all options initially on click
                }}
                placeholder="Search vehicle..."
                className="w-full h-9 pl-8 pr-8 bg-transparent text-xs font-bold text-slate-700 focus:outline-none placeholder-slate-400 truncate"
              />
              
              <ChevronDown 
                size={14} 
                className={`text-slate-400 absolute right-3 transition-transform duration-250 pointer-events-none ${isDropdownOpen ? 'rotate-180' : ''}`} 
              />
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-full bg-white border border-slate-200/80 rounded-xl shadow-xl p-1.5 border-t-blue-500 border-t-2 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Bounds container constrained strictly to max 5 item list view height */}
                <div className="max-h-[185px] overflow-y-auto scrollbar-none space-y-0.5">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedVehicle(opt.value);
                          setSearchTerm('');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left h-9 px-2.5 text-xs font-bold rounded-lg transition-colors truncate flex items-center
                          ${selectedVehicle === opt.value 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))
                  ) : (
                    <div className="py-3 px-2 text-center text-[11px] font-bold text-slate-400">
                      No matches found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inline Modernized KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {kpis.map((kpi) => (
            <div 
              key={kpi.label} 
              className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/80 group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest select-none truncate">
                    {kpi.label}
                  </p>
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight transition-colors group-hover:text-slate-950 truncate">
                    {kpi.value}
                  </h3>
                </div>

                <div className={`w-12 h-12 rounded-xl border ${kpi.bg} ${kpi.border} ${kpi.text} flex items-center justify-center shrink-0 shadow-inner transition-transform duration-300 group-hover:scale-105`}>
                  {kpi.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard Panels Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Maintenance Log Timeline</h3>
            </div>
            <div className="p-5 md:p-6">
              <MaintenanceTimeline 
                events={filtered} 
                vehicles={vehicles}
                selectedVehicleId={selectedVehicle}
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