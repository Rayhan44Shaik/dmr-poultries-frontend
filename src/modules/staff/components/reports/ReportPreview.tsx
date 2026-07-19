import { memo } from 'react';

interface ReportPreviewProps {
  data: any[];
  loading: boolean;
  error: string | null;
  title: string;
}

function ReportPreview({ data, loading, error, title }: ReportPreviewProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
        Loading report data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No data found for the selected report and date range.
      </div>
    );
  }

  const headers = Object.keys(data[0]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-500">{data.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {h.replace(/([A-Z])/g, ' $1').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.slice(0, 50).map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                {headers.map((h) => (
                  <td key={h} className="px-4 py-2 text-sm text-slate-600">
                    {row[h] !== undefined && row[h] !== null ? String(row[h]) : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 50 && (
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-200">
            Showing first 50 of {data.length} records
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ReportPreview);