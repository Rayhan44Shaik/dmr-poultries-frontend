import { memo, useState } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useMaintenanceData } from '../hooks/useMaintenanceData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import KpiCard from '../components/common/KpiCard';
import MaintenanceTimeline from '../components/maintenance/MaintenanceTimeline';
import UpcomingServices from '../components/maintenance/UpcomingServices';
import { Wrench, DollarSign, MapPin, Calendar } from 'lucide-react';

const MaintenanceHistoryPage = () => {
  const { vehicles } = useVehicles();
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');

  const { filtered, stats, upcomingServices } = useMaintenanceData();

  const vehicleOptions = [
    { value: 'all', label: 'All Vehicles' },
    ...vehicles.map((v: any) => ({ value: v.id, label: v.vehicleNumber })),
  ];

  // Render icons as JSX elements
  const kpis = [
    { label: 'Total Services', value: stats.total, icon: <Wrench className="w-5 h-5" /> },
    { label: 'Total Cost', value: stats.totalCost, icon: <DollarSign className="w-5 h-5" />, format: 'currency' as const },
    { label: 'Total Distance (KM)', value: stats.totalDistance, icon: <MapPin className="w-5 h-5" />, format: 'number' as const },
    { 
      label: 'Last Service', 
      value: stats.lastService ? new Date(stats.lastService.date).toLocaleDateString() : 'N/A', 
      icon: <Calendar className="w-5 h-5" />
    },
  ];

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Maintenance History & Timeline</h1>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {vehicleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => (
            <KpiCard
              key={idx}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              format={kpi.format}
            />
          ))}
        </div>

        {/* Timeline & Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Maintenance Timeline</h3>
            <MaintenanceTimeline events={filtered} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Upcoming Services</h3>
            <UpcomingServices services={upcomingServices} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(MaintenanceHistoryPage);