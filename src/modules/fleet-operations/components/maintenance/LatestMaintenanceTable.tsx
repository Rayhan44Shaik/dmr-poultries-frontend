import { memo, useState, useMemo, useEffect, useRef } from 'react';
import {
  Eye, Trash2, CheckCircle2,
  Search, Paperclip, Hash, Calendar, Wrench, Store, User, Gauge, Clock, Wallet, History, X, RotateCcw
} from 'lucide-react';
import { useI18n, translateStatus } from '../../../../i18n';
// Recent-Trip-Activity chrome + global pagination standard.
import { Pagination } from '../../../../ui';
import { BrandRefreshButton } from '../../../../ui';
import { uiActionIconMotionClass } from '../../../../shared/ui/uiTokens';
import { shouldShowPagination, PAGINATION_DEFAULT_PAGE_SIZE } from '../../../../shared/ui/paginationStyles';
import { formatTripListDay } from '../../../operations/vehicle-trips/utils/formatTripListDay';
import { usePendingDelete } from '../../../../hooks/usePendingDelete';
import { PendingDeleteNotification } from '../../../../components/common/PendingDeleteNotification';
import type { MaintenanceEvent } from '../../types';

export type ViewMode = 'pending' | 'approved' | 'deleted';

interface LatestMaintenanceTableProps {
  records: MaintenanceEvent[];
  vehicles: any[];
  viewMode: ViewMode;
  onView: (record: MaintenanceEvent) => void;
  onDelete: (record: MaintenanceEvent) => void;
  onApprove: (record: MaintenanceEvent) => void;
  /** Refresh the records from the API — BrandRefreshButton beside the search. */
  onRefresh?: () => void;
  /** True while the API load/refresh is in flight → spinner row, frozen pager. */
  isLoading?: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  onToggleView: (mode: ViewMode) => void;
}

const LatestMaintenanceTable = ({
  records,
  vehicles,
  viewMode,
  onView,
  onDelete,
  onApprove,
  onRefresh,
  isLoading = false,
  currentPage,
  onPageChange,
  pageSize = PAGINATION_DEFAULT_PAGE_SIZE,
  onPageSizeChange,
  onToggleView,
}: LatestMaintenanceTableProps) => {
  const { t, language } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { requestDelete, cancel, isPending, pendingItems } = usePendingDelete<string>(async (id) => {
    const record = records.find((item) => item.id === id);
    if (record) await Promise.resolve(onDelete(record));
  });

  const validRecords = records.filter((r): r is MaintenanceEvent & { id: string } => !!r.id);

  /** Resolve the registered vehicle number from the Vehicle Master first; fall
   * back to the snapshot stored on the record. NEVER show "Unknown" when a
   * valid vehicle exists. */
  const resolveVehicleNumber = (rec: MaintenanceEvent): string => {
    const vehicle = vehicles.find((v: any) => String(v.id) === String(rec.vehicleId));
    if (vehicle?.vehicleNumber) return String(vehicle.vehicleNumber);
    if (rec.vehicleNo) return String(rec.vehicleNo);
    return '—';
  };

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return validRecords;
    return validRecords.filter(rec => {
      const vehicleNumber = resolveVehicleNumber(rec);
      const searchable = [
        rec.billNumber,
        vehicleNumber,
        rec.vehicleNo,
        rec.maintenanceType,
        rec.serviceType,
        rec.garage,
        rec.mechanic,
        rec.driverName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRecords, searchTerm, vehicles]);

  const totalRecords = filteredRecords.length;
  const startIndex = (currentPage - 1) * pageSize + 1;
  void startIndex;

  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const actualTotalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  useEffect(() => {
    if (totalRecords > 0 && currentPage > actualTotalPages) {
      onPageChange(1);
    }
  }, [actualTotalPages, currentPage, onPageChange, totalRecords]);

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

  const getEmptyText = () => {
    if (searchTerm) return t('empty.search_no_results');
    if (viewMode === 'pending') return t('fleet.maintenance_table.no_pending');
    if (viewMode === 'approved') return t('fleet.maintenance_table.no_approved');
    return t('fleet.maintenance_table.no_deleted');
  };

  const isSelectedRecordApproved = selectedRecord?.paymentStatus === 'approved';
  const canApprove = viewMode !== 'deleted' && selectedRecord && !isSelectedRecordApproved;

  return (
    <div ref={tableRef} className="bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-100 overflow-hidden">
      {/* Header — same treatment as Recent Trip Activity (Trip Entry) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {t('fleet.maintenance_table.recent_title')}
            </h3>
          </div>

          {/* Count follows the selected tab (Pending / Approved / Deleted) */}
          <span
            className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums"
          >
            {totalRecords}
          </span>

          {/* Status toggle — labels only, identical to the trip activity toggle */}
          <div className="flex items-center p-0.5 ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 shadow-sm">
            {([
              ['pending', 'Pending', 'bg-orange-50/80 text-orange-500 shadow-sm'],
              ['approved', 'Approved', 'bg-emerald-50/80 text-emerald-500 shadow-sm'],
              ['deleted', 'Deleted', 'bg-rose-50/80 text-rose-500 shadow-sm'],
            ] as const).map(([mode, label, activeClass]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onToggleView(mode)}
                aria-pressed={viewMode === mode}
                className={`inline-flex items-center px-5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === mode
                    ? activeClass
                    : 'bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                {translateStatus(t, label)}
              </button>
            ))}
          </div>
        </div>

        {/* Row actions, search, Reset and Refresh — trip activity arrangement */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {selectedRecord && (
            <div className="flex items-center gap-1 mr-2">
              {/* Icon-only actions — Edit lives INSIDE the View modal, not here */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onView(selectedRecord); }}
                title={t('common.view')}
                aria-label={t('common.view')}
                className="group relative h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-sm bg-blue-50/70 hover:bg-blue-50/80 text-blue-500 border border-blue-200/60 active:scale-95"
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]"><Eye size={14} /></span>
              </button>
              {viewMode !== 'deleted' && (
                <>
                  {/* Delete — available on EVERY record (pending, approved and
                      older ones alike; approval only blocks EDIT). Only an
                      in-flight 10s undo disables it. */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (selectedRecord.id) requestDelete(selectedRecord.id, { label: t('fleet.maintenance_table.deleting', { vehicle: resolveVehicleNumber(selectedRecord) }) }); setSelectedId(null); }}
                    disabled={isPending(selectedRecord.id)}
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    className={`group relative h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                      !isPending(selectedRecord.id)
                        ? 'bg-rose-50/70 hover:bg-rose-50/80 text-rose-500 border border-rose-200/60 active:scale-95'
                        : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                    }`}
                  >
                    <span className={`inline-flex ${!isPending(selectedRecord.id) ? uiActionIconMotionClass.delete : ''}`}><Trash2 size={14} /></span>
                  </button>
                  {canApprove && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onApprove(selectedRecord); setSelectedId(null); }}
                      title={t('common.approve')}
                      aria-label={t('common.approve')}
                      className="group relative h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 active:scale-95"
                    >
                      <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-approve)]"><CheckCircle2 size={14} /></span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedId(null);
                onPageChange(1);
              }}
              placeholder={t('fleet.maintenance_table.search_placeholder')}
              className="w-full sm:w-64 pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedId(null);
                  onPageChange(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-md transition-colors"
                title={t('fleet.maintenance_table.clear_search')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1">
            {/* Reset — clears the search + selection, animated like the trip list reset */}
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedId(null);
                onPageChange(1);
              }}
              className="group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/70 active:scale-95"
              title={t('common.reset')}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={13} /></span>
              <span className="hidden md:inline">{t('common.reset')}</span>
            </button>
            {onRefresh && <BrandRefreshButton onClick={() => onRefresh()} />}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading && totalRecords === 0 ? (
        <div className="py-16 text-center text-sm font-medium text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />
            {t('fleet.maintenance_entry.loading_records')}
          </span>
        </div>
      ) : totalRecords === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          <History size={24} className="mx-auto mb-2 opacity-50" />
          {getEmptyText()}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Hash size={13} className="text-slate-400 shrink-0" />
                      <span>{t('fleet.maintenance_table.mnt_no')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-500 shrink-0" />
                      <span>{t('common.date')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Wrench size={13} className="text-purple-500 shrink-0" />
                      <span>{t('fleet.maintenance_table.maintenance_details')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Store size={13} className="text-amber-500 shrink-0" />
                      <span>{t('operations.maintenance_garage')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-indigo-500 shrink-0" />
                      <span>{t('fleet.maintenance_form.mechanic')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Gauge size={13} className="text-orange-500 shrink-0" />
                      <span>{t('fleet.maintenance_form.current_km')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Clock size={13} className="text-cyan-500 shrink-0" />
                      <span>{t('fleet.maintenance_table.next_service')}</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Wallet size={13} className="text-emerald-600 shrink-0" />
                      <span>{t('fleet.parts.total_cost')}</span>
                    </div>
                  </th>
                  {viewMode === 'deleted' && (
                    <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <History size={13} className="text-rose-500 shrink-0" />
                        <span>{t('fleet.maintenance_table.deleted_at')}</span>
                      </div>
                    </th>
                  )}
                  <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <Paperclip size={13} className="text-slate-500 shrink-0" />
                      <span>{t('fleet.maintenance_table.docs')}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRecords.map((rec) => {
                  const isSelected = selectedId === rec.id;
                  const firstType = getFirstMaintenanceType(rec.maintenanceType);
                  const allTypes = getAllMaintenanceTypes(rec.maintenanceType);
                  const isApproved = rec.paymentStatus === 'approved';
                  const isDeleted = viewMode === 'deleted';
                  const typeCount = rec.maintenanceType
                    ? rec.maintenanceType.split(',').filter(s => s.trim()).length
                    : 0;

                  return (
                    <tr
                      key={rec.id}
                      className={`group hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200'
                          : 'border-l-4 border-l-transparent'
                      }`}
                      onClick={() => handleRowClick(rec.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-start gap-1.5">
                          <div className="w-[13px] shrink-0 mt-0.5" />
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-2 py-0.5 border ${
                              isDeleted
                                ? 'bg-rose-50 text-rose-700 border-rose-100/80'
                                : isApproved
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100/80'
                                  : 'bg-orange-50 text-orange-700 border-orange-100/80'
                            }`}>
                              {rec.billNumber || '-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[13px] shrink-0" />
                          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                            {formatTripListDay((rec as any).date || rec.createdAt, language)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[13px] shrink-0" />
                          <span title={allTypes} className="text-xs text-slate-600 cursor-help">
                            {firstType}
                            {typeCount > 1 && (
                              <span className="text-xs text-slate-400 ml-1">
                                {t('fleet.maintenance_table.more', { count: typeCount - 1 })}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[13px] shrink-0" />
                          <span className="text-xs text-slate-600">{rec.garage || '-'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[13px] shrink-0" />
                          <span className="text-xs text-slate-600">{rec.mechanic || '-'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                        {rec.currentKM.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        {rec.nextServiceKM?.toLocaleString() || '-'}
                      </td>

                      <td className="px-4 py-3 text-right text-xs font-bold text-blue-700 whitespace-nowrap tabular-nums">
                        ₹{rec.totalCost?.toFixed(2) || '0.00'}
                      </td>

                      {isDeleted && (
                        <td className="px-4 py-3 text-left whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-[13px] shrink-0" />
                            <span className="text-xs text-slate-500">
                              {rec.deletedAt ? new Date(rec.deletedAt).toLocaleString() : '-'}
                            </span>
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {Array.isArray(rec.documents) && rec.documents.length > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); onView(rec); }}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm"
                            title={t('fleet.maintenance_table.documents_attached', { count: rec.documents.length })}
                          >
                            <Paperclip size={12} />
                            {rec.documents.length}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Global pagination — identical to the Trip List paginator. */}
          {shouldShowPagination(totalRecords) && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={totalRecords}
              onPageChange={(next) => { setSelectedId(null); onPageChange(next); }}
              onPageSizeChange={onPageSizeChange}
              disabled={isLoading}
            />
          )}
        </>
      )}
      <PendingDeleteNotification items={pendingItems} onCancel={cancel} />
    </div>
  );
};

export default memo(LatestMaintenanceTable);