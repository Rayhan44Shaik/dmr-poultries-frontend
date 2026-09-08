import { memo, useState, useCallback, useMemo } from 'react';
import { addDays, format } from 'date-fns';
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
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from '../../../shared/ui/paginationStyles';

/* ══════════════════════════════════════════════════════════════════════════
 * ⚠️  TEMPORARY PREVIEW SAMPLE DATA — PERMITS & DOCUMENTS PAGE ONLY
 * ──────────────────────────────────────────────────────────────────────────
 * Purpose: review the redesigned table (Chassis No. / Engine No. columns,
 * status pills, global pagination) without waiting for the real ERP permits
 * API. This block is display-only:
 *
 *   • it lives in this page file alone — no backend, hook, service, type,
 *     i18n or shared file was changed for it;
 *   • it never writes anything — Edit/Save still posts the real vehicle id;
 *   • real values always win: a chassis/engine number or expiry date coming
 *     from the API is kept, samples only fill blanks;
 *   • when the API returns no vehicles at all, the synthetic rows below are
 *     used so the page is never empty during the review.
 *
 * 🧹 TO REMOVE: delete this whole block (down to the end marker) and the two
 *    `withPreviewSamples(...)` calls in `displayMatrix` / `sampleRowFill`,
 *    leaving `matrix` and `matrix.length` in their place.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Master switch for the preview samples above. */
const PREVIEW_SAMPLE_ENABLED = true;

/** Expiry date `offsetDays` from today, in the dd/MM/yyyy shape the UI parses. */
const sampleExpiry = (offsetDays: number): string => format(addDays(new Date(), offsetDays), 'dd/MM/yyyy');

/** `null` = leave that document type as "Not added" so every state is visible.
 * Order follows DOCUMENT_TYPE_ORDER: rc, insurance, fitness, permit, puc. */
type SampleVehicle = {
  id: number;
  vehicleNumber: string;
  vehicleType: string;
  status: 'Active' | 'Inactive';
  chassisNumber: string;
  engineNumber: string;
  docOffsets: Array<number | null>;
};

const PREVIEW_SAMPLE_VEHICLES: SampleVehicle[] = [
  { id: 9001, vehicleNumber: 'TS 09 AB 1234', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'MAT7H3K2PLM091234', engineNumber: 'K12DE9087654', docOffsets: [-18, 24, 140, 210, 46] },
  { id: 9002, vehicleNumber: 'TS 09 CD 5678', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'MAT7H3K2PLM056781', engineNumber: 'K12DE9112233', docOffsets: [62, -7, 96, 180, 12] },
  { id: 9003, vehicleNumber: 'TS 09 EF 9012', vehicleType: 'Lorry',  status: 'Active',   chassisNumber: 'MC2TL1K2PLM034567', engineNumber: 'T32B4455667',  docOffsets: [240, 300, 28, null, 205] },
  { id: 9004, vehicleNumber: 'AP 16 TC 4101', vehicleType: 'Lorry',  status: 'Active',   chassisNumber: 'AP16TC4101LMX88',  engineNumber: 'E4101LMX8890',  docOffsets: [-42, -9, 55, 130, null] },
  { id: 9005, vehicleNumber: 'AP 16 TD 4202', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'AP16TD4202LMX99',  engineNumber: 'E4202LMX9901',  docOffsets: [150, 160, 170, 180, 190] },
  { id: 9006, vehicleNumber: 'AP 39 UA 4303', vehicleType: 'Truck',  status: 'Inactive', chassisNumber: 'AP39UA4303LMX11',  engineNumber: 'E4303LMX1122',  docOffsets: [-63, null, 17, 22, -5] },
  { id: 9007, vehicleNumber: 'AP 16 TE 4404', vehicleType: 'Lorry',  status: 'Active',   chassisNumber: 'AP16TE4404LMX22',  engineNumber: 'E4404LMX2233',  docOffsets: [88, 92, 79, 101, 84] },
  { id: 9008, vehicleNumber: 'AP 39 UB 4505', vehicleType: 'Lorry',  status: 'Active',   chassisNumber: 'AP39UB4505LMX33',  engineNumber: 'E4505LMX3344',  docOffsets: [5, 240, 11, 300, 9] },
  { id: 9009, vehicleNumber: 'AP 16 TF 4606', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'AP16TF4606LMX44',  engineNumber: 'E4606LMX4455',  docOffsets: [null, null, 210, 230, null] },
  { id: 9010, vehicleNumber: 'AP 39 UC 4707', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'AP39UC4707LMX55',  engineNumber: 'E4707LMX5566',  docOffsets: [310, 275, 290, 268, 305] },
  { id: 9011, vehicleNumber: 'AP 16 TG 4808', vehicleType: 'Lorry',  status: 'Active',   chassisNumber: 'AP16TG4808LMX66',  engineNumber: 'E4808LMX6677',  docOffsets: [-1, 30, 0, 29, 31] },
  { id: 9012, vehicleNumber: 'AP 39 UD 4909', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'AP39UD4909LMX77',  engineNumber: 'E4909LMX7788',  docOffsets: [44, 120, 66, 145, 15] },
  { id: 9013, vehicleNumber: 'TS 09 GH 3456', vehicleType: 'Truck',  status: 'Active',   chassisNumber: 'MAT7H3K2PLM078901', engineNumber: 'K12DE9334455', docOffsets: [72, 65, 58, 90, 130] },
  { id: 9014, vehicleNumber: 'TS 10 JK 7890', vehicleType: 'Lorry',  status: 'Active',   chassisNumber: 'MC2TL1K2PLM098765', engineNumber: 'T32B4789012',  docOffsets: [-96, 14, 200, -3, 33] },
];

/** One synthetic matrix row built from a sample vehicle. */
const buildSampleRow = (sample: SampleVehicle): PreviewMatrixRow => {
  const docMap: PreviewMatrixRow['docMap'] = {};
  DOCUMENT_TYPE_ORDER.forEach((type, index) => {
    const offset = sample.docOffsets[index];
    if (offset === null || offset === undefined) return;
    docMap[type] = {
      id: `sample-${sample.id}-${type}`,
      vehicleId: String(sample.id),
      type,
      docType: type,
      documentNumber: `${type.slice(0, 3).toUpperCase()}-${sample.id}-${1000 + index * 7}`,
      expiryDate: sampleExpiry(offset),
      status: 'valid',
      // No fake scan: keeps the modal's view/download links honest.
      hasDocument: false,
      fileName: null,
      mimeType: null,
      validFrom: null,
      remarks: null,
    };
  });
  return {
    vehicle: {
      id: sample.id,
      vehicleNo: sample.id,
      vehicleNumber: sample.vehicleNumber,
      vehicleType: sample.vehicleType,
      status: sample.status,
      chassisNumber: sample.chassisNumber,
      engineNumber: sample.engineNumber,
      noOfBoxes: 0,
      birdCapacity: 0,
      capacityKg: 0,
      trackingId: '',
      fastagBank: '',
      insuranceExpiry: '',
      permitExpiry: '',
      fitnessExpiry: '',
      isSample: true,
    },
    docMap,
  };
};

const PREVIEW_SAMPLE_ROWS = PREVIEW_SAMPLE_VEHICLES.map(buildSampleRow);

/** Fill blank chassis / engine / expiry values on real rows; never overwrite. */
const withPreviewSamples = (rows: PreviewMatrixRow[]): PreviewMatrixRow[] => {
  if (!PREVIEW_SAMPLE_ENABLED) return rows;
  if (!rows || rows.length === 0) return PREVIEW_SAMPLE_ROWS;

  return rows.map((row, index) => {
    const sample = PREVIEW_SAMPLE_VEHICLES[index % PREVIEW_SAMPLE_VEHICLES.length];
    const vehicle = row?.vehicle;
    const docMap: PreviewMatrixRow['docMap'] = { ...(row?.docMap ?? {}) };

    DOCUMENT_TYPE_ORDER.forEach((type, typeIndex) => {
      const offset = sample.docOffsets[typeIndex];
      if (offset === null || offset === undefined) return;
      if (docMap[type]?.expiryDate) return; // real data wins
      docMap[type] = {
        ...(docMap[type] ?? {}),
        documentNumber: docMap[type]?.documentNumber || `${type.slice(0, 3).toUpperCase()}-${vehicle?.id ?? index}-${1000 + typeIndex * 7}`,
        expiryDate: sampleExpiry(offset),
        hasDocument: false,
      };
    });

    return {
      ...row,
      vehicle: {
        ...(vehicle ?? {}),
        id: vehicle?.id ?? sample.id,
        vehicleNumber: vehicle?.vehicleNumber ?? sample.vehicleNumber,
        chassisNumber: String(vehicle?.chassisNumber ?? '').trim() || sample.chassisNumber,
        engineNumber: String(vehicle?.engineNumber ?? '').trim() || sample.engineNumber,
      },
      docMap,
    };
  });
};
/** Days from today until an expiry date (same dd/MM/yyyy parsing as the table). */
const daysUntilExpiry = (value: string): number | null => {
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = parts
    ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
};

/** Preview-only tile counts derived from the sample-filled rows, so the summary
 * tiles do not sit at zero while the table below them is full of sample dates.
 * Used ONLY when the API returned no permit rows at all. */
const buildPreviewStatusCounts = (rows: PreviewMatrixRow[]) => {
  const result: Record<string, { expired: number; expiring: number; safe: number }> = {};
  DOCUMENT_TYPE_ORDER.forEach((type) => {
    result[type] = { expired: 0, expiring: 0, safe: 0 };
  });
  rows.forEach((row) => {
    DOCUMENT_TYPE_ORDER.forEach((type) => {
      const expiry = row?.docMap?.[type]?.expiryDate;
      if (!expiry) return;
      const days = daysUntilExpiry(expiry);
      if (days === null) return;
      if (days < 0) result[type].expired += 1;
      else if (days <= 30) result[type].expiring += 1;
      else result[type].safe += 1;
    });
  });
  return result;
};
/* ══════════════ END OF TEMPORARY PREVIEW SAMPLE DATA ══════════════════════ */

/** Structural view of one matrix row. The hook hands back full `Vehicle` /
 * `VehicleDocument` objects; this page only reads the fields below, so the
 * index signatures keep real API rows and preview rows on the same type. */
type PreviewMatrixDoc = {
  expiryDate?: string;
  documentNumber?: string;
  hasDocument?: boolean;
  fileName?: string | null;
  mimeType?: string | null;
  validFrom?: string | null;
  remarks?: string | null;
  [key: string]: unknown;
};

type PreviewMatrixRow = {
  vehicle: {
    id: string | number;
    vehicleNumber: string;
    vehicleType?: string;
    chassisNumber?: string;
    engineNumber?: string;
    status?: string;
    [key: string]: unknown;
  };
  docMap: Record<string, PreviewMatrixDoc | undefined>;
};

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

const getNearestExpiry = (row: any): number => {
  const docMap = row.docMap || {};
  const dates = Object.values(docMap)
    .map((doc: any) => {
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
  const [editData, setEditData] = useState<{ vehicle: any; docMap: any } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  /** Stamped at mount (page load / full page refresh) and again by the refresh
   * and save handlers, so the "Updated …" line is never empty. Lazy initialiser
   * keeps one timestamp per mount instead of a new Date on every render. */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => new Date());
  /** 0 = hidden; any other value is the id of the visible refresh toast. */
  const [refreshToastId, setRefreshToastId] = useState(0);

  // Preview samples are applied at render time only — see the marked block above.
  const displayMatrix = useMemo(() => withPreviewSamples(matrix), [matrix]);

  /** Real tile counts always win; samples only stand in when the API returned
   * nothing at all. Delete with the sample block, leaving `statusCounts`. */
  const tileStatusCounts = useMemo(() => {
    const realTotal = Object.values(statusCounts).reduce(
      (sum, bucket) => sum + bucket.expired + bucket.expiring + bucket.safe,
      0
    );
    return PREVIEW_SAMPLE_ENABLED && realTotal === 0
      ? buildPreviewStatusCounts(displayMatrix)
      : statusCounts;
  }, [statusCounts, displayMatrix]);

  const filteredMatrix = useMemo(() => {
    if (!searchTerm.trim()) return displayMatrix;
    const term = searchTerm.toLowerCase();
    return displayMatrix.filter((row) => {
      const vehicle = row?.vehicle;
      return (
        String(vehicle?.vehicleNumber ?? '').toLowerCase().includes(term) ||
        String(vehicle?.chassisNumber ?? '').toLowerCase().includes(term) ||
        String(vehicle?.engineNumber ?? '').toLowerCase().includes(term)
      );
    });
  }, [displayMatrix, searchTerm]);

  const sortedMatrix = useMemo(() => {
    return [...filteredMatrix].sort((a, b) => getNearestExpiry(a) - getNearestExpiry(b));
  }, [filteredMatrix]);

  const totalRecords = sortedMatrix.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  /** Derived clamp: a narrower search can shrink the list below the stored
   * page, so the rendered page is always valid without an effect. */
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedMatrix = sortedMatrix.slice(startIndex, startIndex + PAGE_SIZE);

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

  const handleEdit = useCallback((vehicle: any, docMap: any) => {
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
      } catch (error: any) {
        showNotification(error?.message || t('fleet.documents.update_failed'), 'error');
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
          statusCounts={tileStatusCounts}
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
                  className="w-full sm:w-72 pl-9 pr-8 py-2 text-sm border border-slate-200/80 rounded-xl bg-slate-50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm text-slate-700 placeholder:text-slate-400"
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
