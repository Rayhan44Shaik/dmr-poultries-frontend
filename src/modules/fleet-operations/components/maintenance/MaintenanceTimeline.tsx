import { memo } from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, Wrench, Battery, Disc, Settings, Activity } from 'lucide-react';
import type { MaintenanceEvent } from '../../types';

interface MaintenanceTimelineProps {
  events: MaintenanceEvent[];
  vehicles: any[];
  selectedVehicleId?: string | null; // Supports ID string or vehicle registration number text from dropdown
}

const MaintenanceTimeline = ({ events, vehicles, selectedVehicleId }: MaintenanceTimelineProps) => {
  
  // 1. Bulletproof Filtering: Check for exact ID match OR vehicle plate number match
  const filteredEvents = events.filter(event => {
    if (!selectedVehicleId || selectedVehicleId === 'all') return true;
    
    // Find the vehicle corresponding to this event record
    const linkedVehicle = vehicles.find(v => String(v.id) === String(event.vehicleId));
    
    return (
      String(event.vehicleId) === String(selectedVehicleId) || 
      (linkedVehicle && linkedVehicle.vehicleNumber === selectedVehicleId)
    );
  });

  // 2. Icon Classifier for Specific Maintenance Routines
  const getTimelineIcon = (type: string, serviceType: string) => {
    const checkString = `${type} ${serviceType}`.toLowerCase();

    if (checkString.includes('battery')) {
      return <Battery className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (checkString.includes('tyre') || checkString.includes('tire') || checkString.includes('wheel') || checkString.includes('alignment') || checkString.includes('brake')) {
      return <Disc className="w-3.5 h-3.5 text-indigo-500" />;
    }
    if (checkString.includes('breakdown') || checkString.includes('repair')) {
      return <Settings className="w-3.5 h-3.5 text-red-500" />;
    }
    return <Wrench className="w-3.5 h-3.5 text-blue-500" />;
  };

  if (!filteredEvents || filteredEvents.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm flex flex-col items-center justify-center">
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-full mb-3 text-slate-400 shadow-sm">
          <Activity className="w-6 h-6" />
        </div>
        <p className="font-medium text-gray-600">No Records Found</p>
        <p className="text-xs text-gray-400 mt-0.5">No maintenance log matches the selected vehicle view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[420px] overflow-y-auto pl-2 pr-3 scrollbar-thin">
      {filteredEvents
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((event) => {
          const matchedVehicle = vehicles.find(v => String(v.id) === String(event.vehicleId));
          
          return (
            <div key={event.id} className="relative pl-10 border-l border-slate-200 pb-6 last:border-l-0 last:pb-2">
              
              {/* Perfectly Centered Node Circle Container to avoid clipping borders */}
              <div className="absolute -left-3.5 top-1.5 w-7 h-7 bg-white border border-slate-200 rounded-full z-10 flex items-center justify-center shadow-sm hover:scale-105 transition-transform">
                {getTimelineIcon(event.maintenanceType || '', event.serviceType || '')}
              </div>
              
              <div className="bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-xl p-4 transition-all shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm tracking-wide">{event.serviceType}</span>
                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      {event.maintenanceType}
                    </span>
                    {matchedVehicle && (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {matchedVehicle.vehicleNumber}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                    <p className="flex items-center gap-1.5 font-medium text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {format(new Date(event.date), 'dd MMM yyyy')}
                    </p>
                    {event.garage && (
                      <p className="flex items-center gap-1.5 truncate text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">{event.garage} {event.mechanic && `• ${event.mechanic}`}</span>
                      </p>
                    )}
                  </div>

                  <div className="text-[11px] font-semibold text-gray-400 bg-white border border-gray-200/60 rounded px-2 py-0.5 inline-block">
                    Log Profile: {event.currentKM.toLocaleString()} KM 
                    {event.nextServiceKM ? ` • Next Target: ${event.nextServiceKM.toLocaleString()} KM` : ''}
                  </div>
                  
                  {event.remarks && (
                    <div className="text-xs italic text-gray-600 mt-2 bg-white border border-gray-200/70 px-3 py-2 rounded-lg leading-relaxed shadow-inner">
                      "{event.remarks}"
                    </div>
                  )}
                </div>
                
                <div className="sm:text-right shrink-0">
                  <span className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-600 shadow-sm">
                    ₹{event.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default memo(MaintenanceTimeline);