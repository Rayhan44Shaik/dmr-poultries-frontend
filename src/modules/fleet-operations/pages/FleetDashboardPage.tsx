/** DEFERRED / FUTURE WORK — not part of current Fleet Operations production scope. */
import { memo, useMemo, Suspense } from 'react';
import { useI18n } from '../../../i18n';
import { useFleetDashboardData } from '../hooks/useFleetDashboardData';
import KpiCard from '../components/common/KpiCard';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ErrorBoundary from '../components/common/ErrorBoundary';
import AlertStrip from '../components/common/AlertStrip';
import MonthlyFuelTrend from '../components/dashboard/MonthlyFuelTrend';
import VehicleStatusDonut from '../components/dashboard/VehicleStatusDonut';
import TopMaintenanceBar from '../components/dashboard/TopMaintenanceBar';
import DailyStatTiles from '../components/dashboard/DailyStatTiles';
import FleetOverview from '../components/fleet/FleetOverview';
import { Truck, Activity, Fuel, MapPin } from 'lucide-react';

interface FleetDashboardPageProps {
  embedded?: boolean;
}

const FleetDashboardPage = ({ embedded = false }: FleetDashboardPageProps) => {
  const { t } = useI18n();
  const data = useFleetDashboardData();

  // Memoize KPI config array to prevent re-instantiating JSX on every render
  const kpis = useMemo(
    () => [
      {
        label: t('fleet.dashboard.total_vehicles'),
        value: data?.totalVehicles ?? 0,
        icon: <Truck className="w-5 h-5" />,
      },
      {
        label: t('fleet.dashboard.active_vehicles'),
        value: data?.activeVehicles ?? 0,
        icon: <Activity className="w-5 h-5" />,
      },
      {
        label: t('fleet.dashboard.fuel_cost_month'),
        value: data?.fuelCostThisMonth ?? 0,
        icon: <Fuel className="w-5 h-5" />,
        format: 'currency' as const,
      },
      {
        label: t('fleet.dashboard.total_km_month'),
        value: data?.totalKMThisMonth ?? 0,
        icon: <MapPin className="w-5 h-5" />,
        format: 'number' as const,
      },
    ],
    [data, t]
  );

  // Memoize alerts array
  const alerts = useMemo(
    () => [
      { label: t('fleet.dashboard.service_due'), count: data?.serviceDue ?? 0, color: 'bg-amber-100 text-amber-800' },
      { label: t('fleet.dashboard.insurance_expiring'), count: data?.insuranceExpiring ?? 0, color: 'bg-red-100 text-red-800' },
      { label: t('fleet.dashboard.fitness_expiring'), count: data?.fitnessExpiring ?? 0, color: 'bg-red-100 text-red-800' },
      { label: t('fleet.dashboard.permit_expiring'), count: data?.permitExpiring ?? 0, color: 'bg-red-100 text-red-800' },
      { label: t('fleet.dashboard.fastag_low_balance'), count: data?.fastagLowBalance ?? 0, color: 'bg-amber-100 text-amber-800' },
    ],
    [data, t]
  );

  return (
    <ErrorBoundary>
      <div className={embedded ? 'space-y-6' : 'p-4 md:p-6 space-y-6'}>
        <Suspense fallback={<LoadingSkeleton count={5} />}>
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

          {/* Alert Strip */}
          <AlertStrip alerts={alerts} />

          {/* Fleet Overview — live per-vehicle status cards */}
          <FleetOverview
            vehicles={data?.fleetVehicles ?? []}
            counts={data?.fleetCounts ?? { "On Trip": 0, Available: 0, Inactive: 0 }}
            loading={data?.fleetLoading ?? true}
            error={data?.fleetError ?? null}
            onRetry={() => {
              void data?.fleetReload().catch(() => {
                /* error already captured in state */
              });
            }}
          />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <MonthlyFuelTrend data={data?.monthlyFuelTrend} />
            <VehicleStatusDonut data={data?.vehicleStatusDonut} />
            <TopMaintenanceBar data={data?.topMaintenanceCost} />
          </div>

          {/* Daily Stat Tiles */}
          <DailyStatTiles
            kmToday={data?.kmToday ?? 0}
            fuelToday={data?.fuelToday ?? 0}
            tollToday={data?.tollToday ?? 0}
            documentsExpiring={data?.documentsExpiring ?? 0}
            avgFuelEfficiency={data?.avgFuelEfficiency ?? 0}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FleetDashboardPage);