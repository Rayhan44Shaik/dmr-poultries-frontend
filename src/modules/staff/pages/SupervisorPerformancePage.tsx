// src/modules/staff/pages/SupervisorPerformancePage.tsx

import { useState, useEffect } from 'react';
import { useSupervisorPerformance } from '../hooks/usePerformanceReports';
import PerformanceFilters from '../components/performance/PerformanceFilters';
import SupervisorPerformanceKPIs from '../components/performance/SupervisorPerformanceKPIs';
import SupervisorTrendChart from '../components/performance/SupervisorTrendChart';
import ShopLeaderboardTable from '../components/performance/ShopLeaderboardTable';
import PerformanceExportButtons from '../components/performance/PerformanceExportButtons';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { exportToPDF, exportToExcel } from '../../../utils/exportUtils';

type SupervisorPerformancePageProps = {
  embedded?: boolean;
};

function SupervisorPerformancePage({ embedded = false }: SupervisorPerformancePageProps) {
  const { showNotification } = useSafeNotification();

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultFromDate = thirtyDaysAgo.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(today);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | null>(null);

  // ✅ Removed unused 'refresh'
  const { performance, loading, error, availableSupervisors, trendData } =
    useSupervisorPerformance(selectedSupervisorId, fromDate, toDate);

  useEffect(() => {
    if (availableSupervisors.length > 0 && selectedSupervisorId === null) {
      setSelectedSupervisorId(availableSupervisors[0].id);
    }
  }, [availableSupervisors, selectedSupervisorId]);

  const handleReset = () => {
    setFromDate(defaultFromDate);
    setToDate(today);
    setSelectedSupervisorId(availableSupervisors.length > 0 ? availableSupervisors[0].id : null);
  };

  const handleExportPDF = () => {
    if (!performance) {
      showNotification('No data to export.', 'error');
      return;
    }
    const supervisor = availableSupervisors.find((d) => d.id === selectedSupervisorId);
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Trips Managed', performance.tripsManaged.toString()],
      ['Farms Visited', performance.farmsVisited.toString()],
      ['Shops Delivered', performance.shopsDelivered.toString()],
      ['Delivery Accuracy', `${performance.deliveryAccuracy}%`],
      ['Mortality Verified', `${performance.mortalityVerified}%`],
      ['Top Shop', performance.leaderboard[0]?.shopName || 'N/A'],
      ['Top Shop Trips', performance.leaderboard[0]?.trips.toString() || 'N/A'],
    ];
    const filename = `Supervisor_Performance_${supervisor?.name || 'Report'}_${new Date().toISOString().split('T')[0]}`;
    exportToPDF('Supervisor Performance Report', headers, rows, filename);
    showNotification('PDF exported successfully!', 'success');
  };

  const handleExportExcel = () => {
    if (!performance) {
      showNotification('No data to export.', 'error');
      return;
    }
    const supervisor = availableSupervisors.find((d) => d.id === selectedSupervisorId);
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Trips Managed', performance.tripsManaged],
      ['Farms Visited', performance.farmsVisited],
      ['Shops Delivered', performance.shopsDelivered],
      ['Delivery Accuracy', `${performance.deliveryAccuracy}%`],
      ['Mortality Verified', `${performance.mortalityVerified}%`],
    ];
    performance.leaderboard.forEach((shop, index) => {
      rows.push([`Top ${index + 1} Shop`, shop.shopName]);
      rows.push([`  - Trips`, shop.trips]);
      rows.push([`  - Birds`, shop.birds]);
      rows.push([`  - Weight (KG)`, shop.weight]);
      rows.push([`  - Mortality %`, shop.mortality]);
    });
    const filename = `Supervisor_Performance_${supervisor?.name || 'Report'}_${new Date().toISOString().split('T')[0]}`;
    exportToExcel('Supervisor Performance Report', headers, rows, filename);
    showNotification('Excel exported successfully!', 'success');
  };

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supervisor Performance Report</h1>
          <p className="text-sm text-slate-500">Track supervisor operational efficiency and team performance</p>
        </div>
        <PerformanceExportButtons
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          disabled={!performance || loading}
        />
      </div>

      <PerformanceFilters
        fromDate={fromDate}
        toDate={toDate}
        selectedId={selectedSupervisorId}
        availableList={availableSupervisors}
        label="Supervisor"
        setFromDate={setFromDate}
        setToDate={setToDate}
        setSelectedId={setSelectedSupervisorId}
        onReset={handleReset}
      />

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && !performance && selectedSupervisorId && (
        <div className="text-center text-slate-500 py-8">
          No performance data available for the selected period.
        </div>
      )}

      {!loading && !error && performance && (
        <>
          <SupervisorPerformanceKPIs data={performance} loading={loading} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SupervisorTrendChart data={trendData} loading={loading} />
            <ShopLeaderboardTable data={performance.leaderboard} loading={loading} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Performance Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Trips Managed:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.tripsManaged}</span>
              </div>
              <div>
                <span className="text-slate-500">Farms Visited:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.farmsVisited}</span>
              </div>
              <div>
                <span className="text-slate-500">Shops Delivered:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.shopsDelivered}</span>
              </div>
              <div>
                <span className="text-slate-500">Delivery Accuracy:</span>
                <span className={`font-semibold ml-2 ${performance.deliveryAccuracy > 95 ? 'text-green-600' : 'text-amber-600'}`}>
                  {performance.deliveryAccuracy}%
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (embedded) return content;
  return content;
}

export default SupervisorPerformancePage;