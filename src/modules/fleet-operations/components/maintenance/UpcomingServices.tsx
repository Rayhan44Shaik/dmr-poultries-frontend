import { memo } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

// Define the type inline to match what's returned from the hook
interface UpcomingService {
  vehicle: any;
  lastMaint: any;
  nextKM: number;
  dueKM: number;
  isDue: boolean;
}

interface UpcomingServicesProps {
  services: UpcomingService[];
}

const UpcomingServices = ({ services }: UpcomingServicesProps) => {
  if (!services || services.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
        All vehicles are up to date with maintenance.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {services.map((item) => (
        <div
          key={item.vehicle.id}
          className={`border rounded-lg p-3 ${
            item.isDue ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{item.vehicle.vehicleNumber}</span>
                {item.isDue ? (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    Due Soon
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {item.lastMaint ? (
                  <>
                    Last service: {new Date(item.lastMaint.date).toLocaleDateString()}
                    <span className="mx-2">•</span>
                    {item.dueKM > 0 ? `${item.dueKM} KM remaining` : 'Service overdue'}
                  </>
                ) : (
                  'No maintenance record'
                )}
              </div>
              {item.nextKM > 0 && (
                <div className="mt-1 text-xs text-gray-500">
                  Next service at {item.nextKM} KM
                  {item.vehicle.currentKM && ` • Current: ${item.vehicle.currentKM} KM`}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default memo(UpcomingServices);