import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { CircleAlert, Loader2 } from 'lucide-react';
import type { ReportData, ReportFilters, ReportType } from '../types/reportTypes';
import { getReportData } from '../services/reportService';
import { getQuarterSampleRange } from '../../../sample/quarterSample';
import ReportFiltersComponent from '../components/ReportFilters';
import ReportCard from '../components/ReportCard';
import ShopLedgerPage from './ShopLedgerPage';
import VehicleReportPage from '../vehicle/pages/VehicleReportPage';

// ========== IMPORTS ==========
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';
import { useShops } from '../../masters/shops/hooks/useShops';
import { exportToPDF, exportToExcel } from '../../../utils/exportUtils';

// ========== REPORT CONFIGURATIONS ==========
const REPORT_LABELS: Record<ReportType, string> = {
  weekly: 'Weekly Report',
  vehicle: 'Vehicle Report',
  shopSales: 'Shop Sales Report',
  shopLedger: 'Shop Ledger',
  expenses: 'Expenses Report',
};

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  weekly: 'Complete business summary for the selected week',
  vehicle: 'Detailed report for all vehicles and trips',
  shopSales: 'Sales details for all shops for selected period',
  shopLedger: 'Individual shop ledger with sales & collections',
  expenses: 'All business expenses report for selected period',
};

const REPORT_INCLUDES: Record<ReportType, string[]> = {
  weekly: ['Sales, Collections & Outstanding Summary', 'Trips, Birds, Mortality Summary', 'Expense Summary (Fuel, Maintenance, Fastag, Office)', 'Profit & Loss Summary'],
  vehicle: ['Trip Summary (Vehicle Wise)', 'KM Summary & Distance', 'Fuel Consumption & Expense', 'Maintenance, Fastag, Insurance & Permit', 'Vehicle Availability & Status'],
  shopSales: ['Shop Wise Sales Summary', 'Daily Sales Breakdown', 'Birds, Weight, Boxes, Amount', 'Sales Comparison', 'Top Performing Shops'],
  shopLedger: ['Opening Balance', 'Sales (Debit)', 'Collections (Credit)', 'Running Balance', 'Closing Balance & Outstanding'],
  expenses: ['Fuel Expense', 'Vehicle Maintenance Expense', 'Fastag Expense', 'Office Expense', 'Insurance & Permit Expense', 'Total Expense Summary'],
};

// ========== DEFAULT FILTERS ==========
const getDefaultFilters = (type: ReportType): ReportFilters => {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const common = {
    dateFrom: format(sevenDaysAgo, 'yyyy-MM-dd'),
    dateTo: format(now, 'yyyy-MM-dd'),
    format: 'PDF' as const,
    includeCharts: true,
  };
  switch (type) {
    case 'weekly':
      return { ...common, includeSections: ['Sales Summary', 'Collections Summary', 'Trips, Birds & Mortality'] };
    case 'vehicle':
      return { ...common, vehicle: 'All Vehicles', driver: 'All Drivers', tripStatus: 'All' };
    case 'shopSales':
      return { ...common, shop: 'All Shops', groupBy: 'Shop' };
    case 'shopLedger':
      return { ...common, shop: 'All Shops', groupBy: 'Shop' };
    case 'expenses':
      return { ...common, groupBy: 'Category' };
    default:
      return common;
  }
};

// ========== MAIN COMPONENT ==========
type ReportsDashboardPageProps = { embedded?: boolean };

const ReportsDashboardPage: React.FC<ReportsDashboardPageProps> = React.memo(({ embedded = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Tab resolution: query param first, then the /reports/vehicle path alias.
  const activeTab = useMemo<ReportType>(() => {
    const tab = searchParams.get('tab');
    const validTabs: ReportType[] = ['weekly', 'vehicle', 'shopSales', 'shopLedger', 'expenses'];
    if (tab && validTabs.includes(tab as ReportType)) return tab as ReportType;
    if (location.pathname === '/reports/vehicle' || location.pathname.startsWith('/reports/vehicle/')) {
      return 'vehicle';
    }
    return 'shopLedger';
  }, [searchParams, location.pathname]);

  const { showNotification } = useSafeNotification();

  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const { shops } = useShops();

  const [filters, setFilters] = useState<ReportFilters>(() => getDefaultFilters(activeTab));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // In demo mode, open report filters on the exact quarter advertised by the
  // sample API. Production keeps the normal rolling seven-day default.
  useEffect(() => {
    let cancelled = false;
    getQuarterSampleRange().then((range) => {
      if (!cancelled && range) {
        setFilters((current) => ({ ...current, dateFrom: range.fromDate, dateTo: range.toDate }));
      }
    });
    return () => { cancelled = true; };
  }, [activeTab]);

  // Redirect bare /reports to the default tab. Path aliases such as
  // /reports/vehicle resolve through activeTab and are left untouched.
  useEffect(() => {
    if (!searchParams.get('tab') && location.pathname === '/reports') {
      navigate('/reports?tab=shopLedger', { replace: true });
    }
  }, [location.pathname, location.search, navigate, searchParams]);

  // Legacy deep-link: the Collection Report was replaced by the single
  // Operations → Collection Report implementation. Send old
  // /reports?tab=collection links (bookmarks, /reports/* aliases) there.
  useEffect(() => {
    if (searchParams.get('tab') === 'collection') {
      navigate('/operations?tab=collection-report', { replace: true });
    }
  }, [location.pathname, navigate, searchParams]);

  // Update filters when active tab changes from query params
  useEffect(() => {
    setFilters(getDefaultFilters(activeTab));
  }, [activeTab]);

  const vehicleOptions = useMemo(
    () => [
      { value: 'All Vehicles', label: 'All Vehicles' },
      ...vehicles.map((v) => ({ value: v.vehicleNumber, label: v.vehicleNumber })),
    ],
    [vehicles]
  );

  const driverOptions = useMemo(
    () => [
      { value: 'All Drivers', label: 'All Drivers' },
      ...employees
        .filter((e) => e.department === 'Driver')
        .map((e) => ({ value: e.employeeName, label: e.employeeName })),
    ],
    [employees]
  );

  const shopOptions = useMemo(
    () => [
      { value: 'All Shops', label: 'All Shops' },
      ...shops.map((s) => ({ value: s.shopName, label: s.shopName })),
    ],
    [shops]
  );

  useEffect(() => {
    // Shop Ledger and Vehicle Report own independent live-data pipelines.
    if (activeTab === 'shopLedger' || activeTab === 'vehicle') {
      setReportData(null);
      setReportLoading(false);
      setReportError(null);
      return;
    }
    let cancelled = false;
    setReportLoading(true);
    setReportError(null);
    const queryFilters: ReportFilters = {
      ...getDefaultFilters(activeTab),
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      shop: filters.shop,
    };
    getReportData(activeTab, queryFilters)
      .then((data) => { if (!cancelled) setReportData(data); })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Error loading report:', error);
        setReportData(null);
        setReportError(error instanceof Error ? error.message : 'Unable to load report data.');
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, filters.dateFrom, filters.dateTo, filters.shop]);

  const isDataAvailable = useMemo(() => {
    if (!reportData) return false;
    if (reportData.isEmpty !== undefined) return !reportData.isEmpty;
    if (reportData.details) {
      if (Array.isArray(reportData.details)) return reportData.details.length > 0;
      return Object.keys(reportData.details).length > 0;
    }
    return Object.keys(reportData.summary || {}).length > 0;
  }, [reportData]);

  const handleExport = useCallback(
    (formatType: 'PDF' | 'Excel') => {
      if (!reportData || !isDataAvailable) {
        showNotification('No data to export. Please adjust filters.', 'error');
        return;
      }

      try {
        const headers = ['Metric', 'Value'];
        const rows = Object.entries(reportData.summary).map(([key, value]) => [key, String(value)]);
        const filename = `${activeTab}_${format(new Date(), 'yyyy-MM-dd')}`;
        const title = REPORT_LABELS[activeTab];

        if (formatType === 'PDF') {
          exportToPDF(title, headers, rows, filename);
        } else {
          exportToExcel(title, headers, rows, filename);
        }
        showNotification(`Report downloaded as ${formatType}`, 'success');
      } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to generate report. Please try again.', 'error');
      }
    },
    [reportData, activeTab, isDataAvailable, showNotification]
  );

  const content = (
    <div className="w-full px-4 pb-8 pt-6 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {activeTab === 'shopLedger' ? (
          <ShopLedgerPage embedded={true} />
        ) : activeTab === 'vehicle' ? (
          <VehicleReportPage embedded={true} />
        ) : (
          <>
            <ReportFiltersComponent
              reportType={activeTab}
              filters={filters}
              setFilters={setFilters}
              vehicleOptions={vehicleOptions}
              driverOptions={driverOptions}
              shopOptions={shopOptions}
            />
            {reportError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                <span>Unable to load this report from Operations: {reportError}</span>
              </div>
            )}
            {reportLoading && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10 text-sm font-medium text-slate-500">
                <Loader2 size={17} className="animate-spin" /> Reading live Operations data…
              </div>
            )}
            {!reportLoading && (
              <ReportCard
                title={REPORT_LABELS[activeTab]}
                description={REPORT_DESCRIPTIONS[activeTab]}
                includeList={REPORT_INCLUDES[activeTab]}
                onDownloadPDF={() => handleExport('PDF')}
                onDownloadExcel={() => handleExport('Excel')}
                isDataAvailable={isDataAvailable}
                summary={reportData?.summary}
              />
            )}
          </>
        )}
      </div>
    </div>
  );

  // The legacy collection tab redirects to Operations before anything renders.
  if (searchParams.get('tab') === 'collection') return null;

  if (embedded) return content;
  return <div className="w-full">{content}</div>;
});

export default ReportsDashboardPage;