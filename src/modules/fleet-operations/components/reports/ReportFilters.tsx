import { memo } from 'react';
import { Calendar } from 'lucide-react';
import { FilterResetButton, countActiveFilters } from '../../../../ui';

interface ReportFiltersProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onReset: () => void;
  onExport?: () => void;
  showExport?: boolean;
}

const ReportFilters = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onReset,
  onExport,
  showExport = false,
}: ReportFiltersProps) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            From Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            To Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-2">
          <FilterResetButton
            count={countActiveFilters(fromDate !== '' || toDate !== '')}
            onClick={onReset}
          />
          {showExport && onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ReportFilters);