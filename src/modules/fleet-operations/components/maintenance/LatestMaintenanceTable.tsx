import { memo, useState, useMemo, useRef, useEffect } from 'react';
import { Eye, Edit, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon, Search } from 'lucide-react';
import type { MaintenanceEvent } from '../../types';

interface LatestMaintenanceTableProps {
  records: MaintenanceEvent[];
  vehicles: any[];
  onView: (record: MaintenanceEvent) => void;
  onEdit: (record: MaintenanceEvent) => void;
  onDelete: (record: MaintenanceEvent) => void;
  isEditable: (createdAt?: string) => boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

const LatestMaintenanceTable = ({
  records,
  vehicles,
  onView,
  onEdit,
  onDelete,
  isEditable,
  currentPage,
  onPageChange,
  pageSize = 5,
}: LatestMaintenanceTableProps) => {
  const validRecords = records.filter((r): r is MaintenanceEvent & { id: string } => !!r.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click‑outside handler to deselect row
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return validRecords;
    const term = searchTerm.trim().toLowerCase();
    return validRecords.filter(rec => {
      const vehicle = vehicles.find((v: any) => v.id === rec.vehicleId);
      const vehicleNumber = vehicle?.vehicleNumber || '';
      return vehicleNumber.toLowerCase().includes(term);
    });
  }, [validRecords, searchTerm, vehicles]);

  const totalRecords = filteredRecords.length;
  const startIndex = (currentPage - 1) * pageSize + 1;

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const actualTotalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  if (totalRecords > 0 && currentPage > actualTotalPages) {
    onPageChange(1);
  }

  const handleRowClick = (id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
  };

  const selectedRecord = filteredRecords.find(r => r.id === selectedId) || null;

  return (
    <div ref={containerRef} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header – compact layout */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            Last Maintenance Record
          </h4>
          <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-medium">
            {totalRecords}
          </span>
        </div>

        {/* Compact search – small box beside the title */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedId(null);
              onPageChange(1);
            }}
            placeholder="Search vehicle..."
            className="w-40 pl-7 pr-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={() => selectedRecord && onView(selectedRecord)}
            disabled={!selectedRecord}
            className={`p-1.5 rounded-md transition-colors ${
              selectedRecord
                ? 'text-blue-600 hover:bg-blue-50'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="View selected record"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => selectedRecord && onEdit(selectedRecord)}
            disabled={!selectedRecord || !isEditable(selectedRecord.createdAt)}
            className={`p-1.5 rounded-md transition-colors ${
              selectedRecord && isEditable(selectedRecord.createdAt)
                ? 'text-green-600 hover:bg-green-50'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Edit selected record (within 10 days)"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => selectedRecord && onDelete(selectedRecord)}
            disabled={!selectedRecord || !isEditable(selectedRecord.createdAt)}
            className={`p-1.5 rounded-md transition-colors ${
              selectedRecord && isEditable(selectedRecord.createdAt)
                ? 'text-red-600 hover:bg-red-50'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Delete selected record (within 10 days)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {actualTotalPages > 1 && (
            <span className="text-xs text-slate-500 ml-2">
              Page {currentPage} of {actualTotalPages}
            </span>
          )}
        </div>
      </div>

      {totalRecords === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          {searchTerm ? 'No matching vehicles found.' : 'No maintenance records found.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle No</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Current KM</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Maintenance Type</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Garage</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Mechanic</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Driver</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Next Service KM</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedRecords.map((rec, idx) => {
                  const vehicle = vehicles.find((v: any) => v.id === rec.vehicleId);
                  const isSelected = selectedId === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleRowClick(rec.id)}
                    >
                      <td className="px-3 py-2.5 text-sm text-slate-600">{startIndex + idx}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{vehicle?.vehicleNumber || 'Unknown'}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">{new Date(rec.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{rec.currentKM}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">{rec.maintenanceType}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">{rec.garage || '-'}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">{rec.mechanic || '-'}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">{rec.driverName || '-'}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 text-right">{rec.nextServiceKM || '-'}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-blue-600 text-right">₹{rec.totalCost?.toFixed(2) || '0.00'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {actualTotalPages > 1 && (
            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-sm text-slate-600">
                {currentPage} / {actualTotalPages}
              </span>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === actualTotalPages}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default memo(LatestMaintenanceTable);