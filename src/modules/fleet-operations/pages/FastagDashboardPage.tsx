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
import { CreditCard, MessageSquare } from 'lucide-react';

const FastagDashboardPage = () => {
  return (
    <ErrorBoundary>
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="p-4 bg-blue-50 rounded-full mb-6">
          <CreditCard className="w-12 h-12 text-blue-500" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">FASTag Dashboard</h2>
        <p className="text-gray-500 max-w-md">
          We're currently designing this module based on your feedback.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
          <MessageSquare className="w-4 h-4" />
          <span>Coming soon – stay tuned!</span>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(FastagDashboardPage);