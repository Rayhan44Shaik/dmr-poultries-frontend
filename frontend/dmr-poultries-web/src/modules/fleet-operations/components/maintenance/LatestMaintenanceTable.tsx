import { memo, useState, useMemo, useEffect, useRef } from 'react';
import { Eye, Edit, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon, Search } from 'lucide-react';
import type { MaintenanceEvent } from '../../types';

interface LatestMaintenanceTableProps {
  records: MaintenanceEvent[];
  vehicles: any[];
  viewMode: 'active' | 'deleted';
  onView: (record: MaintenanceEvent) => void;
  onEdit: (record: MaintenanceEvent) => void;
  onDelete: (record: MaintenanceEvent) => void;
  isEditable: (createdAt?: string) => boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onToggleView: (mode: 'active' | 'deleted') => void;
}

const LatestMaintenanceTable = ({
  records,
  vehicles,
  viewMode,
  onView,
  onEdit,
  onDelete,
  isEditable,
  currentPage,
  onPageChange,
  pageSize = 5,
  onToggleView,
}: LatestMaintenanceTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const validRecords = records.filter((r): r is MaintenanceEvent & { id: string } => !!r.id);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return validRecords;
    const term = searchTerm.trim().toLowerCase();
    return validRecords.filter(rec => {
      const vehicle = vehicles.find((v: any) => v.id === rec.vehicleId);
      const vehicleNumber = vehicle?.vehicleNumber || '';
      const billNumber = rec.billNumber || '';
      return vehicleNumber.toLowerCase().includes(term) || billNumber.toLowerCase().includes(term);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        setSelectedId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFirstMaintenanceType = (types: string): string => {
    if (!types) return '-';
    const parts = types.split(',').map(s => s.trim());
    return parts[0] || '-';
  };

  const getAllMaintenanceTypes = (types: string): string => {
    return types || '-';
  };

  return (
    <div ref={tableRef} className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header with toggle buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-bold text-slate-700 tracking-wide">
            {viewMode === 'active' ? 'Unpaid Vehicle Bills' : 'Deleted Records'}
          </h4>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-200 rounded-full">
            {totalRecords}
          </span>
          <div className="flex items-center gap-1 ml-2 border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onToggleView('active')}
              className={`px-3 py-1 text-xs font-semibold transition ${
                viewMode === 'active'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              Unpaid
            </button>
            <button
              onClick={() => onToggleView('deleted')}
              className={`px-3 py-1 text-xs font-semibold transition ${
                viewMode === 'deleted'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              Deleted
            </button>
          </div>
        </div>

        {/* Action buttons & Search */}
        <div className="flex items-center gap-2">
          {selectedRecord && (
            <div className="flex items-center gap-0.5 mr-2">
              <button
                onClick={(e) => { e.stopPropagation(); onView(selectedRecord); }}
                className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition"
                title="View"
              >
                <Eye size={16} />
              </button>
              {viewMode === 'active' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(selectedRecord); }}
                    disabled={!isEditable(selectedRecord.createdAt)}
                    className={`p-1.5 rounded-md transition ${
                      isEditable(selectedRecord.createdAt)
                        ? 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title={isEditable(selectedRecord.createdAt) ? 'Edit' : 'Edit disabled (older than 10 days)'}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(selectedRecord); }}
                    disabled={!isEditable(selectedRecord.createdAt)}
                    className={`p-1.5 rounded-md transition ${
                      isEditable(selectedRecord.createdAt)
                        ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                        : 'text-slate-300 cursor-not-allowed'
                    }`}
                    title={isEditable(selectedRecord.createdAt) ? 'Delete' : 'Delete disabled (older than 10 days)'}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedId(null);
                onPageChange(1);
              }}
              placeholder="Search vehicle or bill..."
              className="w-52 pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {totalRecords === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          {searchTerm ? 'No matching records found.' : (viewMode === 'active' ? 'No unpaid bills.' : 'No deleted records.')}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Bill No.</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Maintenance Details</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Garage</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Mechanic</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Current KM</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Next Service</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Cost</th>
                  {viewMode === 'deleted' && (
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Deleted At</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRecords.map((rec, idx) => {
                  const vehicle = vehicles.find((v: any) => v.id === rec.vehicleId);
                  const isSelected = selectedId === rec.id;
                  const firstType = getFirstMaintenanceType(rec.maintenanceType);
                  const allTypes = getAllMaintenanceTypes(rec.maintenanceType);
                  // in active view all records are unpaid, so always orange
                  const isPaid = rec.paymentStatus === 'paid';

                  return (
                    <tr
                      key={rec.id}
                      className={`group hover:bg-slate-50/60 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleRowClick(rec.id)}
                    >
                      <td className="px-3 py-2.5 text-sm text-slate-500">{startIndex + idx}</td>
                      <td className="px-3 py-2.5 text-sm font-medium">
                        <span className={isPaid ? 'text-green-600' : 'text-orange-500'}>
                          {rec.billNumber || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-800">
                        {vehicle?.vehicleNumber || 'Unknown'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">
                        {new Date(rec.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">
                        <span title={allTypes} className="cursor-help">
                          {firstType}
                          {rec.maintenanceType && rec.maintenanceType.split(',').length > 1 && (
                            <span className="text-xs text-slate-400 ml-1">
                              +{rec.maintenanceType.split(',').length - 1} more
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">
                        {rec.garage || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">
                        {rec.mechanic || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 text-right">
                        {rec.currentKM.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600 text-right">
                        {rec.nextServiceKM?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-bold text-blue-600 text-right">
                        ₹{rec.totalCost?.toFixed(2) || '0.00'}
                      </td>
                      {viewMode === 'deleted' && (
                        <td className="px-3 py-2.5 text-sm text-slate-500">
                          {(rec as any).deletedAt ? new Date((rec as any).deletedAt).toLocaleString() : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {actualTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200/60 bg-slate-50/60">
              <span className="text-xs text-slate-500">
                Showing {startIndex}–{Math.min(startIndex + pageSize - 1, totalRecords)} of {totalRecords}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedId(null); onPageChange(currentPage - 1); }}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>
                <span className="text-sm font-semibold text-slate-700">
                  {currentPage} / {actualTotalPages}
                </span>
                <button
                  onClick={() => { setSelectedId(null); onPageChange(currentPage + 1); }}
                  disabled={currentPage === actualTotalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <span>Next</span>
                  <ChevronRightIcon size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default memo(LatestMaintenanceTable);