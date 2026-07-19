import { useCallback } from 'react';
import { useStaffReports } from '../hooks/useStaffReports';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { exportToPDF, exportToExcel } from '../../../utils/exportUtils';
import ReportTiles from '../components/reports/ReportTiles';
import ReportFilters from '../components/reports/ReportFilters';
import ReportPreview from '../components/reports/ReportPreview';

type StaffReportsPageProps = { embedded?: boolean };

function StaffReportsPage({ embedded = false }: StaffReportsPageProps) {
  const { showNotification } = useSafeNotification();
  const {
    filters,
    data,
    loading,
    error,
    updateFilters,
    refresh,
    getReportTitle,
  } = useStaffReports();

  const handleExportPDF = useCallback(() => {
    if (data.length === 0) {
      showNotification('No data to export.', 'error');
      return;
    }
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => String(row[h] ?? '-')));
    const title = getReportTitle(filters.reportType);
    const filename = `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    exportToPDF(title, headers, rows, filename);
    showNotification('PDF exported successfully!', 'success');
  }, [data, filters.reportType, getReportTitle, showNotification]);

  const handleExportExcel = useCallback(() => {
    if (data.length === 0) {
      showNotification('No data to export.', 'error');
      return;
    }
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h] ?? '-'));
    const title = getReportTitle(filters.reportType);
    const filename = `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    exportToExcel(title, headers, rows, filename);
    showNotification('Excel exported successfully!', 'success');
  }, [data, filters.reportType, getReportTitle, showNotification]);

  const handleDateChange = useCallback((from: string, to: string) => {
    updateFilters({ fromDate: from, toDate: to });
  }, [updateFilters]);

  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Staff Reports</h1>
        <p className="text-sm text-slate-500">Generate and export reports for all staff modules</p>
      </div>

      <ReportTiles
        reportType={filters.reportType}
        onSelect={(type) => updateFilters({ reportType: type as any })}
      />

      <ReportFilters
        fromDate={filters.fromDate}
        toDate={filters.toDate}
        reportType={filters.reportType}
        onDateChange={handleDateChange}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onRefresh={refresh}
        disabled={loading}
      />

      <ReportPreview
        data={data}
        loading={loading}
        error={error}
        title={getReportTitle(filters.reportType)}
      />
    </div>
  );

  if (embedded) return content;
  return content;
}

export default StaffReportsPage;