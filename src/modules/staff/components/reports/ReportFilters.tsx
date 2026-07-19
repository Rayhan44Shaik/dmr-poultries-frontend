import { memo, useState, useRef, useEffect } from 'react';
import { Calendar, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { DateRangePicker } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

interface ReportFiltersProps {
  fromDate: string;
  toDate: string;
  reportType: string;
  onDateChange: (from: string, to: string) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onRefresh: () => void;
  disabled?: boolean;
}

function ReportFilters({
  fromDate,
  toDate,
  reportType,
  onDateChange,
  onExportPDF,
  onExportExcel,
  onRefresh,
  disabled = false,
}: ReportFiltersProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [range, setRange] = useState({
    startDate: new Date(fromDate),
    endDate: new Date(toDate),
    key: 'selection',
  });

  useEffect(() => {
    setRange({
      startDate: new Date(fromDate),
      endDate: new Date(toDate),
      key: 'selection',
    });
  }, [fromDate, toDate]);

  const handleSelect = (ranges: any) => {
    const { startDate, endDate } = ranges.selection;
    setRange(ranges.selection);
    onDateChange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    setShowPicker(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 transition bg-white"
          >
            <Calendar size={16} className="text-slate-400" />
            <span>{formatDate(fromDate)} – {formatDate(toDate)}</span>
          </button>
          {showPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200">
              <DateRangePicker
                ranges={[range]}
                onChange={handleSelect}
                moveRangeOnFirstSelection={false}
                months={1}
                direction="horizontal"
                rangeColors={['#3B82F6']}
                staticRanges={[]}
                inputRanges={[]}
              />
            </div>
          )}
        </div>

        <span className="text-sm text-slate-500">
          Report: <span className="font-medium text-slate-700 capitalize">{reportType.replace('-', ' ')}</span>
        </span>

        <div className="flex-1" />

        <button
          onClick={onRefresh}
          disabled={disabled}
          className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw size={16} /> Refresh
        </button>
        <button
          onClick={onExportPDF}
          disabled={disabled}
          className="h-10 px-3 rounded-lg border border-red-500 text-red-600 text-sm font-medium hover:bg-red-50 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <FileText size={16} /> PDF
        </button>
        <button
          onClick={onExportExcel}
          disabled={disabled}
          className="h-10 px-3 rounded-lg border border-green-500 text-green-600 text-sm font-medium hover:bg-green-50 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <FileSpreadsheet size={16} /> Excel
        </button>
      </div>
    </div>
  );
}

export default memo(ReportFilters);