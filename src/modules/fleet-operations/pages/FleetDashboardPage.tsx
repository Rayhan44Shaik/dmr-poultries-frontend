import { memo, Suspense } from 'react';
import { useFleetDashboardData } from '../hooks/useFleetDashboardData';
import KpiCard from '../components/common/KpiCard';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ErrorBoundary from '../components/common/ErrorBoundary';
import AlertStrip from '../components/common/AlertStrip';
import MonthlyFuelTrend from '../components/dashboard/MonthlyFuelTrend';
import VehicleStatusDonut from '../components/dashboard/VehicleStatusDonut';
import TopMaintenanceBar from '../components/dashboard/TopMaintenanceBar';
import DailyStatTiles from '../components/dashboard/DailyStatTiles';
import { Truck, Activity, Wrench, Fuel, MapPin } from 'lucide-react';

const FleetDashboardPage = () => {
  const data = useFleetDashboardData();

  // Render icons as JSX elements instead of passing components directly
  const kpis = [
    { label: 'Total Vehicles', value: data.totalVehicles, icon: <Truck className="w-5 h-5" /> },
    { label: 'Active Vehicles', value: data.activeVehicles, icon: <Activity className="w-5 h-5" /> },
    { label: 'Under Maintenance', value: data.underMaintenance, icon: <Wrench className="w-5 h-5" /> },
    { label: 'Fuel Cost (This Month)', value: data.fuelCostThisMonth, icon: <Fuel className="w-5 h-5" />, format: 'currency' as const },
    { label: 'Total KM (This Month)', value: data.totalKMThisMonth, icon: <MapPin className="w-5 h-5" />, format: 'number' as const },
  ];

  const alerts = [
    { label: 'Service Due', count: data.serviceDue, color: 'bg-amber-100 text-amber-800' },
    { label: 'Insurance Expiring', count: data.insuranceExpiring, color: 'bg-red-100 text-red-800' },
    { label: 'Fitness Expiring', count: data.fitnessExpiring, color: 'bg-red-100 text-red-800' },
    { label: 'Permit Expiring', count: data.permitExpiring, color: 'bg-red-100 text-red-800' },
    { label: 'FASTag Low Balance', count: data.fastagLowBalance, color: 'bg-amber-100 text-amber-800' },
  ];

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        <Suspense fallback={<LoadingSkeleton count={5} />}>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

          {/* Alert Strip */}
          <AlertStrip alerts={alerts} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MonthlyFuelTrend data={data.monthlyFuelTrend} />
            <VehicleStatusDonut data={data.vehicleStatusDonut} />
            <TopMaintenanceBar data={data.topMaintenanceCost} />
          </div>

          {/* Daily Stat Tiles */}
          <DailyStatTiles
            kmToday={data.kmToday}
            fuelToday={data.fuelToday}
            tollToday={data.tollToday}
            documentsExpiring={data.documentsExpiring}
            avgFuelEfficiency={data.avgFuelEfficiency}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FleetDashboardPage);