import { memo, useCallback, useMemo } from 'react';
import Select from 'react-select';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ExpenseBreakdownDonut from '../components/analytics/ExpenseBreakdownDonut';
import VehiclePerformanceChart from '../components/analytics/VehiclePerformanceChart';
import WeeklyTrendChart from '../components/analytics/WeeklyTrendChart';
import VehiclePerformanceTable from '../components/analytics/VehiclePerformanceTable';
import AttentionSection from '../components/analytics/AttentionSection';
import { DatePicker } from '../../../components/common/DatePicker';
import {
  Activity,
  AlertCircle,
  Banknote,
  CalendarDays,
  CreditCard,
  Fuel,
  Gauge,
  IndianRupee,
  Loader2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Truck,
  Wrench,
} from 'lucide-react';

interface VehicleAnalyticsPageProps {
  embedded?: boolean;
}

const containsFilter = (option: { label: string }, inputValue: string) => {
  if (!inputValue) return true;
  return option.label.toLowerCase().includes(inputValue.toLowerCase());
};

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#10b981' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(16, 185, 129, 0.12)' : 'none',
    minHeight: '36px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: '#ffffff',
    '&:hover': { borderColor: '#cbd5e1' },
  }),
  option: (base: Record<string, unknown>, { isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) => ({
    ...base,
    backgroundColor: isSelected ? '#10b981' : isFocused ? '#f0fdf4' : 'transparent',
    color: isSelected ? '#ffffff' : '#334155',
    fontSize: '12px',
    fontWeight: isSelected ? 600 : 500,
    padding: '6px 12px',
    cursor: 'pointer',
  }),
  menu: (base: Record<string, unknown>) => ({
    ...base,
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    zIndex: 50,
  }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: Record<string, unknown>) => ({ ...base, color: '#94a3b8' }),
  clearIndicator: (base: Record<string, unknown>) => ({ ...base, color: '#94a3b8' }),
};

interface KpiDef {
  label: string;
  value: string;
  icon: typeof Truck;
  tone: string;
  sub?: string;
}

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const number = (value: number) => value.toLocaleString('en-IN');

const SkeletonKpis = () => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    {Array.from({ length: 10 }).map((_, index) => (
      <div
        key={index}
        className="animate-pulse rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="h-7 w-7 rounded-lg bg-slate-100" />
        <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
        <div className="mt-2 h-5 w-1/2 rounded bg-slate-100" />
      </div>
    ))}
  </div>
);

const SkeletonCharts = () => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div className="h-4 w-40 rounded bg-slate-100" />
      <div className="mt-4 h-64 rounded-xl bg-slate-50" />
    </div>
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="mt-4 h-64 rounded-xl bg-slate-50" />
    </div>
  </div>
);

const VehicleAnalyticsPage = ({ embedded = false }: VehicleAnalyticsPageProps) => {
  const {
    stats,
    weeklyData,
    expenseBreakdown,
    vehicleStats,
    vehicleStatusById,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    selectedVehicleId,
    setSelectedVehicleId,
    vehicleOptions,
    vehiclesLoading,
    clearFilters,
    loading,
    refreshing,
    error,
    refresh,
    lastRefreshed,
  } = useAnalyticsData();

  const selectedOption = useMemo(
    () => vehicleOptions.find((option) => option.value === selectedVehicleId) ?? null,
    [vehicleOptions, selectedVehicleId]
  );

  const showSkeleton = loading && !lastRefreshed;

  const utilization = useMemo(() => {
    const total = vehicleStats.length;
    if (total === 0) return 0;
    const active = vehicleStats.filter((row) => row.trips > 0 || row.distance > 0).length;
    return Math.round((active / total) * 100);
  }, [vehicleStats]);

  const kpis = useMemo<KpiDef[]>(() => {
    const costPerKm = stats.costPerKm > 0 ? `₹${stats.costPerKm.toFixed(2)}` : '—';
    return [
      { label: 'Total Trips', value: number(stats.totalTrips), icon: Truck, tone: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
      { label: 'Total Distance', value: `${number(stats.totalDistance)} km`, icon: TrendingUp, tone: 'bg-blue-50 text-blue-600 border-blue-100' },
      { label: 'Fuel Used', value: `${number(stats.totalFuelLitres)} L`, icon: Fuel, tone: 'bg-amber-50 text-amber-600 border-amber-100' },
      { label: 'Avg Mileage', value: stats.averageMileage > 0 ? `${stats.averageMileage.toFixed(2)} km/l` : '—', icon: Gauge, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      { label: 'Vehicle Utilization', value: `${utilization}%`, icon: Activity, tone: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
      { label: 'Fuel Cost', value: money(stats.fuelCost), icon: Banknote, tone: 'bg-sky-50 text-sky-600 border-sky-100' },
      { label: 'Maintenance Cost', value: money(stats.maintenanceCost), icon: Wrench, tone: 'bg-violet-50 text-violet-600 border-violet-100' },
      { label: 'EMI Due', value: money(stats.emiDue), icon: CreditCard, tone: 'bg-teal-50 text-teal-600 border-teal-100' },
      { label: 'Total Fleet Cost', value: money(stats.totalExpense), icon: IndianRupee, tone: 'bg-rose-50 text-rose-600 border-rose-100' },
      { label: 'Cost / KM', value: costPerKm, icon: Activity, tone: 'bg-slate-100 text-slate-600 border-slate-200' },
    ];
  }, [stats, utilization]);

  const hasAnyData = stats.totalTrips > 0 || stats.totalDistance > 0 || stats.totalExpense > 0;

  const controlClass =
    'flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50';

  const onReset = useCallback(() => clearFilters(), [clearFilters]);

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 ${embedded ? '' : 'px-4 py-6 md:px-8 md:py-8'}`}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              FLEET ANALYTICS
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Vehicle performance, utilization, cost and operational insights
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            {refreshing && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> Updating…
              </span>
            )}
            {lastRefreshed && (
              <span className="hidden sm:inline">
                Last updated {new Date(lastRefreshed).toLocaleTimeString('en-IN')}
              </span>
            )}
            <button type="button" onClick={refresh} disabled={loading || refreshing} className={controlClass}>
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-emerald-600' : 'text-slate-400'} />
              Refresh
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <CalendarDays size={11} className="text-emerald-600" /> Date Range
            </span>
            <div className="flex items-center gap-2">
              <div className="w-40">
                <DatePicker value={fromDate} onChange={setFromDate} placeholder="From date" className="[&_input]:!h-9 [&_input]:!text-xs" />
              </div>
              <span className="text-xs font-bold text-slate-300">→</span>
              <div className="w-40">
                <DatePicker value={toDate} onChange={setToDate} placeholder="To date" className="[&_input]:!h-9 [&_input]:!text-xs" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Truck size={11} className="text-emerald-600" /> Vehicle
            </span>
            <div className="w-52">
              <Select
                options={vehicleOptions}
                value={selectedOption}
                onChange={(selected) => setSelectedVehicleId(selected ? selected.value : null)}
                isSearchable
                isClearable
                filterOption={containsFilter}
                placeholder={vehiclesLoading ? 'Loading vehicles…' : 'All vehicles'}
                isDisabled={vehiclesLoading}
                styles={selectStyles}
                menuPortalTarget={document.body}
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 pb-0.5">
            <button type="button" onClick={onReset} className={controlClass}>
              <RotateCcw size={13} className="text-slate-400" /> Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </span>
            <button type="button" onClick={refresh} className="font-bold underline">
              Retry
            </button>
          </div>
        )}

        {!hasAnyData && !loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
            No analytics data available for the selected filters.
          </div>
        )}

        {showSkeleton ? (
          <div className="space-y-4">
            <SkeletonKpis />
            <SkeletonCharts />
          </div>
        ) : (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs transition-shadow hover:shadow-sm"
                >
                  <div className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-lg border ${kpi.tone}`}>
                    <kpi.icon size={14} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {kpi.label}
                  </p>
                  <p className="mt-0.5 truncate text-lg font-black tabular-nums text-slate-900">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Performance + Cost */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Vehicle Performance
                </h3>
                <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">
                  Fleet ranking by selected metric
                </p>
                <VehiclePerformanceChart stats={vehicleStats} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Cost Analysis
                </h3>
                <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">
                  Expense breakdown by category
                </p>
                <ExpenseBreakdownDonut data={expenseBreakdown} height={300} />
              </div>
            </div>

            {/* Trend + Attention */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Operational Trend
                </h3>
                <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">
                  Weekly distance and fuel consumption
                </p>
                <WeeklyTrendChart data={weeklyData} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Attention Required
                </h3>
                <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">
                  Decision support for the period
                </p>
                <AttentionSection stats={vehicleStats} />
              </div>
            </div>

            {/* Vehicle performance table */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Vehicle Performance
              </h3>
              <p className="mb-3 mt-0.5 text-sm font-bold text-slate-800">
                Per-vehicle trips, distance, fuel, cost and efficiency
              </p>
              <VehiclePerformanceTable stats={vehicleStats} statusById={vehicleStatusById} />
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleAnalyticsPage);