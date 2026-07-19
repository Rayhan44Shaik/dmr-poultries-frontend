// src/modules/staff/pages/DriverPerformancePage.tsx

import { useState, useEffect } from 'react';
import { useDriverPerformance } from '../hooks/usePerformanceReports';
import PerformanceFilters from '../components/performance/PerformanceFilters';
import DriverPerformanceKPIs from '../components/performance/DriverPerformanceKPIs';
import DriverTrendChart from '../components/performance/DriverTrendChart';
import DutyTypeDonutChart from '../components/performance/DutyTypeDonutChart';
import PerformanceExportButtons from '../components/performance/PerformanceExportButtons';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { exportToPDF, exportToExcel } from '../../../utils/exportUtils';

type DriverPerformancePageProps = {
  embedded?: boolean;
};

function DriverPerformancePage({ embedded = false }: DriverPerformancePageProps) {
  const { showNotification } = useSafeNotification();

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultFromDate = thirtyDaysAgo.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(today);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

  // ✅ Removed unused 'refresh'
  const { performance, loading, error, availableDrivers, trendData } =
    useDriverPerformance(selectedDriverId, fromDate, toDate);

  useEffect(() => {
    if (availableDrivers.length > 0 && selectedDriverId === null) {
      setSelectedDriverId(availableDrivers[0].id);
    }
  }, [availableDrivers, selectedDriverId]);

  const handleReset = () => {
    setFromDate(defaultFromDate);
    setToDate(today);
    setSelectedDriverId(availableDrivers.length > 0 ? availableDrivers[0].id : null);
  };

  const handleExportPDF = () => {
    if (!performance) {
      showNotification('No data to export.', 'error');
      return;
    }
    const driver = availableDrivers.find((d) => d.id === selectedDriverId);
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Trips', performance.totalTrips.toString()],
      ['Delivery Days', performance.deliveryDays.toString()],
      ['Repair Days', performance.repairDays.toString()],
      ['Total Distance (KM)', performance.totalDistance.toLocaleString()],
      ['Total Birds', performance.totalBirds.toLocaleString()],
      ['Total Weight (KG)', performance.totalWeight.toLocaleString()],
      ['Mortality Rate', `${performance.mortalityRate}%`],
      ['Fuel Used (LTR)', performance.fuelUsed.toLocaleString()],
      ['Avg Weight/Trip (KG)', performance.avgWeightPerTrip.toLocaleString()],
    ];
    const filename = `Driver_Performance_${driver?.name || 'Report'}_${new Date().toISOString().split('T')[0]}`;
    exportToPDF('Driver Performance Report', headers, rows, filename);
    showNotification('PDF exported successfully!', 'success');
  };

  const handleExportExcel = () => {
    if (!performance) {
      showNotification('No data to export.', 'error');
      return;
    }
    const driver = availableDrivers.find((d) => d.id === selectedDriverId);
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Trips', performance.totalTrips],
      ['Delivery Days', performance.deliveryDays],
      ['Repair Days', performance.repairDays],
      ['Total Distance (KM)', performance.totalDistance],
      ['Total Birds', performance.totalBirds],
      ['Total Weight (KG)', performance.totalWeight],
      ['Mortality Rate', `${performance.mortalityRate}%`],
      ['Fuel Used (LTR)', performance.fuelUsed],
      ['Avg Weight/Trip (KG)', performance.avgWeightPerTrip],
    ];
    const filename = `Driver_Performance_${driver?.name || 'Report'}_${new Date().toISOString().split('T')[0]}`;
    exportToExcel('Driver Performance Report', headers, rows, filename);
    showNotification('Excel exported successfully!', 'success');
  };

  const dutyData = performance
    ? [
        {
          name: 'Delivery',
          value: Math.round((performance.deliveryDays / (performance.deliveryDays + performance.repairDays || 1)) * 100),
          color: '#8B5CF6',
        },
        {
          name: 'Repair',
          value: Math.round((performance.repairDays / (performance.deliveryDays + performance.repairDays || 1)) * 100),
          color: '#60A5FA',
        },
        {
          name: 'Rest',
          value: Math.round(
            ((performance.totalTrips * 0.2) / (performance.totalTrips * 0.2 + performance.totalTrips || 1)) * 100
          ),
          color: '#FCD34D',
        },
        {
          name: 'Office',
          value: Math.round(
            ((performance.totalTrips * 0.1) / (performance.totalTrips * 0.2 + performance.totalTrips || 1)) * 100
          ),
          color: '#34D399',
        },
      ]
    : [];

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Driver Performance Report</h1>
          <p className="text-sm text-slate-500">Track driver logistics efficiency and performance metrics</p>
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
        selectedId={selectedDriverId}
        availableList={availableDrivers}
        label="Driver"
        setFromDate={setFromDate}
        setToDate={setToDate}
        setSelectedId={setSelectedDriverId}
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

      {!loading && !error && !performance && selectedDriverId && (
        <div className="text-center text-slate-500 py-8">
          No performance data available for the selected period.
        </div>
      )}

      {!loading && !error && performance && (
        <>
          <DriverPerformanceKPIs data={performance} loading={loading} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DriverTrendChart data={trendData} loading={loading} />
            <DutyTypeDonutChart data={dutyData} loading={loading} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Performance Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Total Trips:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.totalTrips}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Distance:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.totalDistance.toLocaleString()} KM</span>
              </div>
              <div>
                <span className="text-slate-500">Total Birds:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.totalBirds.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500">Total Weight:</span>
                <span className="font-semibold text-slate-800 ml-2">{performance.totalWeight.toLocaleString()} KG</span>
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

export default DriverPerformancePage;