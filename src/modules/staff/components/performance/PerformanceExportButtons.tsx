// src/modules/staff/components/performance/PerformanceExportButtons.tsx

import { memo } from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';

interface PerformanceExportButtonsProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
}

function PerformanceExportButtons({
  onExportPDF,
  onExportExcel,
  disabled = false,
}: PerformanceExportButtonsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onExportPDF}
        disabled={disabled}
        className={`px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-medium transition-all flex items-center gap-1.5 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-red-50 hover:shadow-md active:scale-95'
        }`}
      >
        <FileText size={16} /> PDF
      </button>
      <button
        onClick={onExportExcel}
        disabled={disabled}
        className={`px-4 py-2 rounded-lg border border-green-500 text-green-600 text-sm font-medium transition-all flex items-center gap-1.5 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-green-50 hover:shadow-md active:scale-95'
        }`}
      >
        <FileSpreadsheet size={16} /> Excel
      </button>
    </div>
  );
}

export default memo(PerformanceExportButtons);