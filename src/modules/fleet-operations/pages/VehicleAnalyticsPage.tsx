import { memo } from 'react';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import KpiCard from '../components/common/KpiCard';
import ExpenseBreakdownDonut from '../components/analytics/ExpenseBreakdownDonut';
import TopPerformersTable from '../components/analytics/TopPerformersTable';
import HighestExpenseTable from '../components/analytics/HighestExpenseTable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Fuel, DollarSign, Gauge } from 'lucide-react';

const VehicleAnalyticsPage = () => {
  const {
    stats,
    weeklyData,
    expenseBreakdown,
    topPerformers,
    highestExpense,
    period,
    setPeriod,
  } = useAnalyticsData();

  // Render icons as JSX elements
  const kpis = [
    { label: 'Total Distance (KM)', value: stats.totalDistance, icon: <TrendingUp className="w-5 h-5" />, format: 'number' as const },
    { label: 'Average Mileage (km/l)', value: stats.avgMileage.toFixed(2), icon: <Gauge className="w-5 h-5" /> },
    { label: 'Total Fuel Used (Ltrs)', value: stats.totalFuel, icon: <Fuel className="w-5 h-5" />, format: 'number' as const },
    { label: 'Total Expense', value: stats.totalExpense, icon: <DollarSign className="w-5 h-5" />, format: 'currency' as const },
    { label: 'Cost per KM', value: stats.costPerKM, icon: <DollarSign className="w-5 h-5" />, format: 'currency' as const },
  ];

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Analytics</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="quarter">Last Quarter</option>
          </select>
        </div>

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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Fuel Consumption (Weekly)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="fuel" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Mileage (km/l)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="mileage" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Expense Breakdown</h3>
            <ExpenseBreakdownDonut data={expenseBreakdown} height={180} />
          </div>
        </div>

        {/* Top Performers & Highest Expense */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Performing Vehicles (Mileage)</h3>
            <TopPerformersTable performers={topPerformers} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Highest Expense Vehicles</h3>
            <HighestExpenseTable expenses={highestExpense} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleAnalyticsPage);