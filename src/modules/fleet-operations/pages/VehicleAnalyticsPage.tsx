import { memo } from 'react';
import Select from 'react-select';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import KpiCard from '../components/common/KpiCard';
import ExpenseBreakdownDonut from '../components/analytics/ExpenseBreakdownDonut';
import TopPerformersTable from '../components/analytics/TopPerformersTable';
import HighestExpenseTable from '../components/analytics/HighestExpenseTable';
import { DatePicker } from '../../../components/common/DatePicker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Fuel, DollarSign, Gauge, RotateCcw, Loader2, CalendarDays, Truck, Wrench, CreditCard, AlertCircle } from 'lucide-react';
import type { Vehicle } from '../../masters/vehicles/types/vehicle';

interface VehicleAnalyticsPageProps {
  embedded?: boolean;
}

const containsFilter = (option: any, inputValue: string) => {
  if (!inputValue) return true;
  return option.label.toLowerCase().includes(inputValue.toLowerCase());
};

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
    minHeight: '38px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: '#ffffff',
    '&:hover': { borderColor: '#cbd5e1' },
  }),
  option: (base: any, { isFocused, isSelected }: any) => ({
    ...base,
    backgroundColor: isSelected ? '#2563eb' : isFocused ? '#f8fafc' : 'transparent',
    color: isSelected ? '#ffffff' : '#334155',
    fontSize: '12px',
    fontWeight: isSelected ? 600 : 500,
    padding: '7px 12px',
    cursor: 'pointer',
  }),
  menu: (base: any) => ({
    ...base,
    borderRadius: '0.75rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    zIndex: 50,
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 9999,
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: any) => ({
    ...base,
    color: '#94a3b8',
    '&:hover': { color: '#64748b' },
  }),
  clearIndicator: (base: any) => ({
    ...base,
    color: '#94a3b8',
    '&:hover': { color: '#ef4444' },
  }),
};

const VehicleAnalyticsPage = ({ embedded = false }: VehicleAnalyticsPageProps) => {
  const {
    stats,
    weeklyData,
    expenseBreakdown,
    topPerformers,
    highestExpense,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    selectedVehicleId,
    setSelectedVehicleId,
    vehicles,
    clearFilters,
    loading,
    error,
  } = useAnalyticsData();

  const vehicleOptions = (vehicles || []).map((v: Vehicle) => ({
    value: v.id,
    label: v.vehicleNumber || String(v.vehicleNo),
  }));

  const kpis = [
    { label: 'Total Trips', value: stats.totalTrips, icon: <Truck className="w-4 h-4 text-indigo-600" />, format: 'number' as const },
    { label: 'Total Distance (KM)', value: stats.totalDistance, icon: <TrendingUp className="w-4 h-4 text-blue-600" />, format: 'number' as const },
    { label: 'Average Mileage', value: stats.avgMileage.toFixed(2), icon: <Gauge className="w-4 h-4 text-amber-600" /> },
    { label: 'Fuel Cost', value: stats.fuelCost, icon: <Fuel className="w-4 h-4 text-sky-600" />, format: 'currency' as const },
    { label: 'Maintenance Cost', value: stats.maintenanceCost, icon: <Wrench className="w-4 h-4 text-violet-600" />, format: 'currency' as const },
    { label: 'EMI Due', value: stats.emiCost, icon: <CreditCard className="w-4 h-4 text-emerald-600" />, format: 'currency' as const },
    { label: 'Total Expense', value: stats.totalExpense, icon: <DollarSign className="w-4 h-4 text-rose-600" />, format: 'currency' as const },
  ];

  return (
    <ErrorBoundary>
      {/* Updated outer container without max-w constraints for perfect embedded layout */}
      <div className={`w-full space-y-6 animate-in fade-in duration-500 ${
        embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'
      }`}>
        {/* Shared Filter Bar – date range + vehicle. Single source of truth
            for the entire Analytics page. */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <CalendarDays size={13} className="text-blue-500 flex-shrink-0" />
                Report Range
              </span>
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <DatePicker
                    value={fromDate}
                    onChange={setFromDate}
                    placeholder="From date"
                    disabled={loading}
                    className="text-xs"
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">→</span>
                <div className="w-44">
                  <DatePicker
                    value={toDate}
                    onChange={setToDate}
                    placeholder="To date"
                    disabled={loading}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Truck size={13} className="text-indigo-500 flex-shrink-0" />
                Vehicle
              </span>
              <div className="w-56">
                <Select
                  options={vehicleOptions}
                  value={vehicleOptions.find((o) => o.value === selectedVehicleId) ?? null}
                  onChange={(selected) => setSelectedVehicleId(selected ? selected.value : null)}
                  isSearchable
                  isClearable
                  filterOption={containsFilter}
                  placeholder="All Vehicles"
                  isDisabled={loading}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RotateCcw size={13} className="text-slate-400" />
            Clear
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertCircle size={17} /> {error}
          </div>
        )}

        {loading ? (
          <div className="w-full flex items-center justify-center py-24">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              Computing fleet analytics…
            </div>
          </div>
        ) : (
          <>
            {/* High Tech Minimal KPI Panel Layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
              {kpis.map((kpi, idx) => (
                <KpiCard
                  key={idx}
                  label={kpi.label}
                  value={kpi.value}
                  icon={
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200/40">
                      {kpi.icon}
                    </div>
                  }
                  format={kpi.format}
                  className="!border-slate-200/60 !shadow-sm hover:!border-blue-500/40 transition-all duration-300"
                />
              ))}
            </div>

            {/* Main Operational Chart Analytics Console */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Fuel Area Card */}
              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Fuel Matrix</h3>
                  <p className="text-sm font-bold text-slate-800 mt-0.5 mb-4">Weekly Liters Consumption</p>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="fuel" fill="url(#fuelGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Efficiency Metric Area Card */}
              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Performance Index</h3>
                  <p className="text-sm font-bold text-slate-800 mt-0.5 mb-4">Weekly Mean Mileage Profile</p>
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mileageGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0.3}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="mileage" fill="url(#mileageGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Donut Layout Card */}
              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Resource Split</h3>
                  <p className="text-sm font-bold text-slate-800 mt-0.5 mb-2">Cost Center Allocations</p>
                </div>
                <ExpenseBreakdownDonut data={expenseBreakdown} height={170} />
              </div>
            </div>

            {/* Fleet Tables Data Block Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800">Top Performing Fleet Nodes</h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Assets ordered by clean efficiency scaling profiles</p>
                </div>
                <TopPerformersTable performers={topPerformers} />
              </div>

              <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800">High Deficit Operational Accounts</h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">Asset metrics sorted by absolute combined run-costs</p>
                </div>
                <HighestExpenseTable expenses={highestExpense} />
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleAnalyticsPage);