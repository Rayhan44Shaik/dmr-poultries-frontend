import { memo } from 'react';
import { Eye, Edit, RefreshCw } from 'lucide-react';

interface DocumentMatrixProps {
  matrix: Array<{
    vehicle: { id: string; vehicleNumber: string };
    docMap: Record<string, any>;
  }>;
  docTypes: string[];
  docLabels: Record<string, string>;
  getStatusColor: (expiryDate?: string) => string;
}

const DocumentMatrix = ({ matrix, docTypes, docLabels, getStatusColor }: DocumentMatrixProps) => {
  if (!matrix || matrix.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No vehicles found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vehicle
            </th>
            {docTypes.map((type) => (
              <th key={type} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {docLabels[type]}
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {matrix.map((row) => (
            <tr key={row.vehicle.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {row.vehicle.vehicleNumber}
              </td>
              {docTypes.map((type) => {
                const doc = row.docMap[type];
                return (
                  <td key={type} className="px-4 py-3">
                    {doc ? (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(doc.expiryDate)}`}>
                        {new Date(doc.expiryDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="View">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-green-600 hover:bg-green-50 rounded" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-1 text-amber-600 hover:bg-amber-50 rounded" title="Renew">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default memo(DocumentMatrix);