import { memo } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface DocumentSummaryTilesProps {
  counts: Record<string, number>;
  docLabels: Record<string, string>;
}

const DocumentSummaryTiles = ({ counts, docLabels }: DocumentSummaryTilesProps) => {
  const totalExpiring = Object.values(counts).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(counts).map(([type, count]) => (
          <div
            key={type}
            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${count > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                {count > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{docLabels[type]}</p>
                <p className={`text-lg font-bold ${count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {count}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {totalExpiring > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {totalExpiring} document{totalExpiring > 1 ? 's' : ''} expiring in the next 30 days
        </div>
      )}
    </div>
  );
};

export default memo(DocumentSummaryTiles);