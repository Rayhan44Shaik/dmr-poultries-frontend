// src/modules/staff/components/reports/ReportBuilder.tsx

import { memo } from 'react';
import { Calendar, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';

interface ReportBuilderProps {
  reportType: string;
  fromDate: string;
  toDate: string;
  format: 'PDF' | 'Excel';
  onFromDateChange: (val: string) => void;
  onToDateChange: (val: string) => void;
  onFormatChange: (val: 'PDF' | 'Excel') => void;
  onGenerate: () => void;
  onReset: () => void;
  isGenerating: boolean;
  hasData: boolean;
}

function ReportBuilder({
  reportType,
  fromDate,
  toDate,
  format,
  onFromDateChange,
  onToDateChange,
  onFormatChange,
  onGenerate,
  onReset,
  isGenerating,
  hasData,
}: ReportBuilderProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-slate-50"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <div className="min-w-[120px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => onFormatChange(e.target.value as 'PDF' | 'Excel')}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
          >
            <option value="PDF">PDF</option>
            <option value="Excel">Excel</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            disabled={isGenerating || !hasData}
            className={`h-10 px-5 rounded-lg text-sm font-medium text-white shadow-sm transition active:scale-95 flex items-center gap-2 ${
              isGenerating || !hasData
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
            {format === 'PDF' ? <FileText size={16} /> : <FileSpreadsheet size={16} />}
          </button>
          <button
            onClick={onReset}
            className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ReportBuilder);