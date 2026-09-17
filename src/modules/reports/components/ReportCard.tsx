import React from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  includeList: string[];
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  isDataAvailable: boolean;
  summary?: Record<string, unknown>;
}

const ReportCard: React.FC<Props> = React.memo(({
  title,
  description,
  includeList,
  onDownloadPDF,
  onDownloadExcel,
  isDataAvailable,
  summary,
}) => {
  const formatMetric = (label: string, value: unknown): string => {
    if (typeof value !== 'number') return String(value ?? '—');
    const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
    return /(sales|collection|outstanding|expense|result|profit|amount|cost)/i.test(label)
      ? `₹${formatted}`
      : formatted;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{description}</p>

      {summary && Object.keys(summary).length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(summary).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500" title={label}>
                {label}
              </p>
              <p className="mt-1 truncate text-base font-bold text-slate-900" title={formatMetric(label, value)}>
                {formatMetric(label, value)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Includes:</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {includeList.map((item, idx) => (
            <li key={idx} className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={onDownloadPDF}
          disabled={!isDataAvailable}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            isDataAvailable
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <FileText size={16} /> Download PDF
        </button>
        <button
          onClick={onDownloadExcel}
          disabled={!isDataAvailable}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            isDataAvailable
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <FileSpreadsheet size={16} /> Download Excel
        </button>
      </div>
    </div>
  );
});

export default ReportCard;