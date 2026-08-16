/*
import { memo } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useFleetData } from '../hooks/useFleetData';
import { useFastagData } from '../hooks/useFastagData';
import ErrorBoundary from '../components/common/ErrorBoundary';
import FastagSummaryTiles from '../components/fastag/FastagSummaryTiles';
import FastagBalanceTable from '../components/fastag/FastagBalanceTable';
import FastagTransactions from '../components/fastag/FastagTransactions';
import { Plus } from 'lucide-react';

const FastagDashboardPage = () => {
  const { vehicles } = useVehicles();
  const { fastags } = useFleetData(); // Remove fastagTransactions - not used
  const { stats, sortedFastags, recentTransactions } = useFastagData();

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">FASTag Dashboard</h1>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Recharge FASTag
          </button>
        </div>

        {// Summary Tiles }
        <FastagSummaryTiles
          totalFastags={stats.totalFastags}
          lowBalanceCount={stats.lowBalanceCount}
          todayToll={stats.todayToll}
          monthToll={stats.monthToll}
          avgDailyToll={stats.avgDailyToll}
        />

        {// Balance & Transactions }
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">FASTag Balance Overview</h3>
            <FastagBalanceTable fastags={sortedFastags} vehicles={vehicles} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Toll Transactions</h3>
            <FastagTransactions
              transactions={recentTransactions}
              fastags={fastags}
              vehicles={vehicles}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FastagDashboardPage);*/

import { memo } from 'react';
import ErrorBoundary from '../components/common/ErrorBoundary';

interface FastagDashboardPageProps {
  embedded?: boolean;
}

const FastagDashboardPage = ({ embedded = false }: FastagDashboardPageProps) => {
  return (
    <ErrorBoundary>
      <div className={`w-full flex items-center justify-center animate-in fade-in duration-500 ${
        embedded ? 'min-h-[60vh]' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'
      }`}>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 border border-blue-100 shadow-sm animate-bounce">
            🚧
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">FASTag Dashboard - Coming Soon</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            This module is currently being enhanced and will be made fully available after the upcoming updates.
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FastagDashboardPage);