import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useAccountsData } from '../hooks/useAccountsData';
import { KPICard, LoadingSkeleton, ErrorBoundary } from '../components/common';
import { PendingDonut, RecentExpenses } from '../components/dashboard';
import { formatCurrency } from '../utils/formatters';

const AccountsDashboardPage = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data, loading, error } = useAccountsData(selectedDate);

  const salesTrend = useMemo(() => {
    if (!data || data.yesterdaySales === 0) return 0;
    return ((data.totalSales - data.yesterdaySales) / data.yesterdaySales) * 100;
  }, [data]);

  const collectionsTrend = useMemo(() => {
    if (!data || data.yesterdayCollections === 0) return 0;
    return ((data.totalCollections - data.yesterdayCollections) / data.yesterdayCollections) * 100;
  }, [data]);

  if (error) {
    return <div className="p-6 text-red-600">Error loading dashboard: {error}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Accounts Dashboard</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-3 py-1"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <LoadingSkeleton key={i} count={1} height="h-20" />)
        ) : (
          <>
            <KPICard title="Today's Sales" value={formatCurrency(data?.totalSales || 0)} trend={Math.round(salesTrend)} />
            <KPICard title="Collections" value={formatCurrency(data?.totalCollections || 0)} trend={Math.round(collectionsTrend)} />
            <KPICard title="Cash in Hand" value={formatCurrency(data?.cashInHand || 0)} />
            <KPICard title="Bank Balance" value={formatCurrency(data?.bankBalance || 0)} />
            <KPICard title="Farmer Payables" value={formatCurrency(data?.farmerPayables || 0)} />
            <KPICard title="EMI Due" value={formatCurrency(data?.emiDue || 0)} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorBoundary>
          <PendingDonut title="Pending Farmer Payments" type="farmer" viewAllLink="/accounts/farmer-payments" />
        </ErrorBoundary>
        <ErrorBoundary>
          <PendingDonut title="Pending Shop Collections" type="shop" viewAllLink="/operations/collections/pending" />
        </ErrorBoundary>
      </div>

      {/* Recent Expenses */}
      <div className="mt-6">
        <ErrorBoundary>
          <RecentExpenses />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default AccountsDashboardPage;