import { memo, useState, useCallback, useMemo } from 'react';
import { uiSearchInputWithClearClass } from '../../../shared/ui/uiTokens';
import { format } from 'date-fns';
import { useI18n } from '../../../i18n';
import { useDocumentsData } from '../hooks/useDocumentsData';
import { DOCUMENT_TYPE_ORDER } from '../utils/constants';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import DocumentSummaryTiles from '../components/documents/DocumentSummaryTiles';
import DocumentMatrix from '../components/documents/DocumentMatrix';
import DocumentEditModal from '../components/documents/DocumentEditModal';
import DocumentRefreshToast from '../components/documents/DocumentRefreshToast';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import {
  RefreshCw,
  Search,
  X,
  FileText,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { PageSizeSelect } from '../../../shared/ui/PageSizeSelect';
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from '../../../shared/ui/paginationStyles';

type MatrixVehicle = {
  id: string | number;
  vehicleNumber: string;
  vehicleType?: string;
  chassisNumber?: string;
  engineNumber?: string;
  status?: string;
};

type MatrixDocument = {
  expiryDate?: string;
  documentNumber?: string;
  validFrom?: string | null;
  remarks?: string | null;
  hasDocument?: boolean;
  fileName?: string | null;
  mimeType?: string | null;
};

type MatrixDocumentMap = Record<string, MatrixDocument | undefined>;

const PAGE_SIZE = 10;

/** Visual-only softening of the hook's expiry status colours. The thresholds
 * and the returned colour *family* are untouched — only the shade is lightened
 * (100 → 50 background, 800 → 600 text, plus a hairline ring) so the date pills
 * read calm instead of bright. Any unmapped value falls through unchanged. */
const SOFTER_STATUS_COLORS: Record<string, string> = {
  'bg-red-100 text-red-800': 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-100',
  'bg-amber-100 text-amber-800': 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100',
  'bg-yellow-100 text-yellow-800': 'bg-yellow-50 text-yellow-600 ring-1 ring-inset ring-yellow-100',
  'bg-green-100 text-green-800': 'bg-green-50 text-green-600 ring-1 ring-inset ring-green-100',
};

const getNearestExpiry = (row: { docMap?: MatrixDocumentMap }): number => {
  const docMap = row.docMap ?? {};
  const dates = Object.values(docMap)
    .map((doc) => {
      if (doc && typeof doc === 'object') {
        return doc.expiryDate;
      }
      return undefined;
    })
    .filter((date): date is string => !!date)
    .map((date) => new Date(date).getTime());
  if (dates.length === 0) return Infinity;
  return Math.min(...dates);
};

interface DocumentsExpiryPageProps {
  embedded?: boolean;
}

const DocumentsExpiryPage = ({ embedded = false }: DocumentsExpiryPageProps) => {
  const { t } = useI18n();
  const {
    totalCounts,
    statusCounts,
    matrix,
    getStatusColor,
    formatExpiryDate,
    refetch,
    updateDocument,
    loading,
    error,
    hasData,
  } = useDocumentsData();
  const { showNotification } = useSafeNotification();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editData, setEditData] = useState<{ vehicle: MatrixVehicle; docMap: MatrixDocumentMap } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchTerm, setSearchTerm] = useState('');
  /** Stamped at mount (page load / full page refresh) and again by the refresh
   * and save handlers, so the "Updated …" line is never empty. Lazy initialiser
   * keeps one timestamp per mount instead of a new Date on every render. */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => new Date());
  /** 0 = hidden; any other value is the id of the visible refresh toast. */
  const [refreshToastId, setRefreshToastId] = useState(0);

  const filteredMatrix = useMemo(() => {
    if (!searchTerm.trim()) return matrix;
    const term = searchTerm.toLowerCase();
    return matrix.filter((row) => {
      const vehicle = row?.vehicle;
      return (
        String(vehicle?.vehicleNumber ?? '').toLowerCase().includes(term) ||
        String(vehicle?.chassisNumber ?? '').toLowerCase().includes(term) ||
        String(vehicle?.engineNumber ?? '').toLowerCase().includes(term)
      );
    });
  }, [matrix, searchTerm]);

  const sortedMatrix = useMemo(() => {
    return [...filteredMatrix].sort((a, b) => getNearestExpiry(a) - getNearestExpiry(b));
  }, [filteredMatrix]);

  const totalRecords = sortedMatrix.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  /** Derived clamp: a narrower search can shrink the list below the stored
   * page, so the rendered page is always valid without an effect. */
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const paginatedMatrix = sortedMatrix.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  /** Stable identity so the toast's 5-second timer is never restarted early. */
  const dismissRefreshToast = useCallback(() => setRefreshToastId(0), []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch?.();
      setLastUpdated(new Date());
      // Top-right toast that closes itself after 5s, instead of the centred
      // app-wide notification popup.
      setRefreshToastId((prev) => prev + 1);
    } catch {
      showNotification(t('fleet.documents.refresh_failed'), 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, showNotification, t]);

  /** Lighten the hook's status colours for display only — see SOFTER_STATUS_COLORS. */
  const softStatusColor = (expiryDate?: string) => {
    const base = getStatusColor(expiryDate);
    return SOFTER_STATUS_COLORS[base] ?? base;
  };

  const handleEdit = useCallback((vehicle: MatrixVehicle, docMap: MatrixDocumentMap) => {
    const normalizedVehicle = {
      ...vehicle,
      id: String(vehicle.id),
    };
    setEditData({ vehicle: normalizedVehicle, docMap });
  }, []);

  const handleCloseEdit = useCallback(() => setEditData(null), []);

  const handleSaveEdit = useCallback(
    async (
      vehicleId: string | number,
      updates: Record<
        string,
        { expiryDate?: string; documentNumber?: string; validFrom?: string; remarks?: string }
      >,
      files?: Record<string, File>,
      removes?: Record<string, boolean>
    ) => {
      try {
        await updateDocument(vehicleId, updates, files, removes);
        setLastUpdated(new Date());
        showNotification(t('fleet.documents.updated_success'), 'success');
        setEditData(null);
      } catch (error: unknown) {
        showNotification(error instanceof Error ? error.message : t('fleet.documents.update_failed'), 'error');
      }
    },
    [updateDocument, showNotification, t]
  );

  const editableDocTypes = DOCUMENT_TYPE_ORDER as unknown as string[];

  const translatedDocLabels = useMemo(
    () => Object.fromEntries(DOCUMENT_TYPE_ORDER.map((type) => [type, t(`fleet.doc_label.${type}`)])),
    [t]
  );

  /** Windowed page numbers with edge ellipsis — same global pagination maths
   * as TripPagination, so every list pages identically. */
  const hasMultiplePages = totalPages > 1;
  const visiblePages = useMemo(() => {
    if (!hasMultiplePages) return [1];
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, safePage - half);
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [safePage, totalPages, hasMultiplePages]);
  const showFirstEllipsis = hasMultiplePages && visiblePages[0] > 1;
  const showLastEllipsis = hasMultiplePages && visiblePages[visiblePages.length - 1] < totalPages;

  const updatedLabel = lastUpdated
    ? t('fleet.emi.updated_at', { time: format(lastUpdated, 'dd MMM yyyy, hh:mm a') })
    : '';

  return (
    <ErrorBoundary>
      <div className={`w-full space-y-5 animate-in fade-in duration-500 ${
        embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50/50 min-h-screen'
      }`}>

        {/* Top-right refresh toast — auto-closes after 5 seconds */}
        <DocumentRefreshToast
          show={refreshToastId > 0}
          eventId={refreshToastId}
          onDismiss={dismissRefreshToast}
        />

        {loading && !hasData && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center text-sm font-semibold text-slate-500 flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" /> {t('fleet.documents.loading')}
          </div>
        )}

        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm text-rose-700 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button onClick={handleRefresh} className="px-4 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-sm">
              {t('common.retry')}
            </button>
          </div>
        )}

        <DocumentSummaryTiles
          counts={totalCounts}
          statusCounts={statusCounts}
          docLabels={translatedDocLabels}
        />

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden">

          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">{t('fleet.documents.vehicle_document_status')}</h3>
                {/* Stamped on page load and again on every refresh / save. */}
                {updatedLabel && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-slate-500 tabular-nums">
                    <Clock size={12} aria-hidden="true" className="text-slate-400" />
                    {updatedLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search Bar */}
              <div className="relative group flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={t('fleet.documents.search_placeholder')}
                  className={`${uiSearchInputWithClearClass} sm:w-72`}
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-[38px] px-3.5 inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 text-slate-600 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? t('fleet.documents.refreshing') : t('common.refresh')}</span>
              </button>
            </div>
          </div>

          {/* Table Area */}
          <div className="w-full overflow-x-auto">
            {paginatedMatrix.length > 0 ? (
              <DocumentMatrix
                matrix={paginatedMatrix}
                docTypes={DOCUMENT_TYPE_ORDER as unknown as string[]}
                docLabels={translatedDocLabels}
                getStatusColor={softStatusColor}
                formatExpiryDate={formatExpiryDate}
                onEdit={handleEdit}
                startSerial={startIndex + 1}
              />
            ) : (
              <div className="py-16 text-center text-slate-400 text-sm font-medium">
                {t('fleet.documents.no_vehicles_match')}
              </div>
            )}
          </div>

          {/* ── Global pagination — same bar as the trip tables ─────────── */}
          {shouldShowPagination(totalRecords) && (
            <div className={paginationBarClass}>
              <div className="mr-auto flex items-center gap-2">
                <PageSizeSelect
                  value={pageSize}
                  onChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
                <span className="text-[13px] font-semibold text-slate-600">Rows Per Page</span>
              </div>
              <button
                type="button"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                className={paginationNavBtnClass}
              >
                {t('common.previous')}
              </button>

              {hasMultiplePages ? (
                <>
                  {showFirstEllipsis && (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePageChange(1)}
                        className={paginationPageBtnClass(safePage === 1)}
                      >
                        1
                      </button>
                      <span className="px-1 text-slate-400">…</span>
                    </>
                  )}

                  {visiblePages.map((page) => (
                    <button
                      type="button"
                      key={page}
                      onClick={() => handlePageChange(page)}
                      aria-current={page === safePage ? 'page' : undefined}
                      className={paginationPageBtnClass(page === safePage)}
                    >
                      {page}
                    </button>
                  ))}

                  {showLastEllipsis && (
                    <>
                      <span className="px-1 text-slate-400">…</span>
                      <button
                        type="button"
                        onClick={() => handlePageChange(totalPages)}
                        className={paginationPageBtnClass(safePage === totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <span className={paginationPageBtnClass(true)}>1</span>
              )}

              <button
                type="button"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages || !hasMultiplePages}
                className={paginationNavBtnClass}
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </div>

        {editData && (
          <DocumentEditModal
            vehicle={editData.vehicle}
            docMap={editData.docMap}
            docTypes={editableDocTypes}
            onClose={handleCloseEdit}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(DocumentsExpiryPage);
