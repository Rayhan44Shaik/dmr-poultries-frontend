// src/modules/staff/components/reports/ReportPreview.tsx

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReportPreviewProps {
  data: Record<string, any>[];
  loading: boolean;
  error: string | null;
  title: string;
}

export default function ReportPreview({ data, loading, error, title }: ReportPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.ceil(data.length / pageSize) || 1;
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-6 w-32 bg-slate-200 rounded"></div>
          <p className="text-sm">Loading report data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-rose-200 p-12 text-center text-rose-600 shadow-sm bg-rose-50/50">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
        No records found for the selected criteria.
      </div>
    );
  }

  const headers = Object.keys(data[0] || {});

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
        <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
        <span className="text-xs font-medium px-2.5 py-1 bg-slate-200/60 text-slate-600 rounded-full">
          Total Records: {data.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-100/70">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-16">
                #
              </th>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap"
                >
                  {header.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {paginatedData.map((row, rowIndex) => {
              const globalIndex = (currentPage - 1) * pageSize + rowIndex + 1;
              return (
                <tr key={rowIndex} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-slate-400 whitespace-nowrap">
                    {globalIndex}
                  </td>
                  {headers.map((header, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap"
                    >
                      {row[header] ?? '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Page <span className="text-slate-800 font-semibold">{currentPage}</span> of <span className="text-slate-800 font-semibold">{totalPages}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}