import { memo } from 'react';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import KpiCard from '../components/common/KpiCard';
import ExpenseBreakdownDonut from '../components/analytics/ExpenseBreakdownDonut';
import TopPerformersTable from '../components/analytics/TopPerformersTable';
import HighestExpenseTable from '../components/analytics/HighestExpenseTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Fuel, DollarSign, Gauge } from 'lucide-react';

interface VehicleAnalyticsPageProps {
  embedded?: boolean;
}

const VehicleAnalyticsPage = ({ embedded = false }: VehicleAnalyticsPageProps) => {
  const {
    stats,
    weeklyData,
    expenseBreakdown,
    topPerformers,
    highestExpense,
    period,
    setPeriod,
  } = useAnalyticsData();

  const kpis = [
    { label: 'Total Distance (KM)', value: stats.totalDistance, icon: <TrendingUp className="w-4 h-4 text-blue-600" />, format: 'number' as const },
    { label: 'Average Mileage (km/l)', value: stats.avgMileage.toFixed(2), icon: <Gauge className="w-4 h-4 text-amber-600" /> },
    { label: 'Total Fuel Used (Ltrs)', value: stats.totalFuel, icon: <Fuel className="w-4 h-4 text-sky-600" />, format: 'number' as const },
    { label: 'Total Expense', value: stats.totalExpense, icon: <DollarSign className="w-4 h-4 text-rose-600" />, format: 'currency' as const },
    { label: 'Cost per KM', value: stats.costPerKM, icon: <DollarSign className="w-4 h-4 text-emerald-600" />, format: 'currency' as const },
  ];

  return (
    <ErrorBoundary>
      {/* Updated outer container without max-w constraints for perfect embedded layout */}
      <div className={`w-full space-y-6 animate-in fade-in duration-500 ${
        embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'
      }`}>
        {/* Period Selector – placed above KPI cards */}
        <div className="flex justify-end items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Report Timeline:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
          >
            <option value="thisMonth">Active Month</option>
            <option value="lastMonth">Previous Cycle</option>
            <option value="quarter">Quarterly Review</option>
          </select>
        </div>

        {/* High Tech Minimal KPI Panel Layout */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleAnalyticsPage);