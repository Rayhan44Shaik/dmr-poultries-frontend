import { memo } from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, DollarSign } from 'lucide-react';
import type { MaintenanceEvent } from '../../types';

interface MaintenanceTimelineProps {
  events: MaintenanceEvent[];
}

const MaintenanceTimeline = ({ events }: MaintenanceTimelineProps) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No maintenance records found.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
      {events
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((event) => (
          <div key={event.id} className="relative pl-8 border-l-2 border-blue-300 pb-6 last:border-l-0">
            <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
            
            <div className="flex flex-wrap justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{event.serviceType}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {event.maintenanceType}
                  </span>
                </div>
                
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(event.date), 'dd MMM yyyy')}
                  </p>
                  {event.garage && (
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      {event.garage} {event.mechanic && `• ${event.mechanic}`}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    KM {event.currentKM} • Next service at {event.nextServiceKM} KM
                  </p>
                </div>
                
                {event.remarks && (
                  <p className="text-sm italic text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                    "{event.remarks}"
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="font-bold text-blue-600 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {event.totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};

export default memo(MaintenanceTimeline);