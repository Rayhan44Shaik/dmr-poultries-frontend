import { memo, useState } from 'react';
import { useToast } from '../hooks/useToast';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ReportCard from '../components/reports/ReportCard';
import ReportFilters from '../components/reports/ReportFilters';
import { 
  Fuel, Wrench, DollarSign, FileText, FileSpreadsheet, 
  BarChart3, Calendar, Gauge, AlertTriangle, Package, 
  Truck, ClipboardList 
} from 'lucide-react';

const reports = [
  { id: 'fuel', title: 'Fuel Report', description: 'Fuel consumption and cost per vehicle', icon: Fuel },
  { id: 'maintenance', title: 'Maintenance Report', description: 'Service history and costs', icon: Wrench },
  { id: 'toll', title: 'Toll (FASTag) Report', description: 'Toll transactions and expenses', icon: DollarSign },
  { id: 'emi', title: 'EMI Report', description: 'Loan and repayment schedule', icon: FileText },
  { id: 'expense', title: 'Expense Report', description: 'All vehicle costs consolidated', icon: FileSpreadsheet },
  { id: 'mileage', title: 'Mileage Report', description: 'Fuel efficiency analysis', icon: Gauge },
  { id: 'document', title: 'Document Expiry Report', description: 'Compliance status', icon: Calendar },
  { id: 'service', title: 'Service Due Report', description: 'Upcoming maintenance', icon: Wrench },
  { id: 'breakdown', title: 'Breakdown Report', description: 'Vehicle breakdowns and repairs', icon: AlertTriangle },
  { id: 'tyre', title: 'Tyre Report', description: 'Tyre usage and replacement', icon: Package },
  { id: 'utilization', title: 'Vehicle Utilization Report', description: 'Trip and mileage utilization', icon: Truck },
  { id: 'summary', title: 'Fleet Summary Report', description: 'Overall fleet performance', icon: ClipboardList },
];

const VehicleReportsPage = () => {
  const { showToast } = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const handleExport = (reportId: string, format: 'pdf' | 'excel') => {
    showToast(`Exporting ${reportId} as ${format.toUpperCase()}...`, 'info');
    // In real implementation, fetch data for that report and call export utils
  };

  const handleReset = () => {
    setFromDate('');
    setToDate('');
  };

  return (
    <ErrorBoundary>
      {/* 👇 Updated container with reduced horizontal padding and increased top spacing */}
      <div className="px-1 md:px-3 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
        {/* Heading removed */}

        {/* Filters */}
        <ReportFilters
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onReset={handleReset}
        />

        {/* Report Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              id={report.id}
              title={report.title}
              description={report.description}
              icon={report.icon}
              onExport={handleExport}
            />
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(VehicleReportsPage);