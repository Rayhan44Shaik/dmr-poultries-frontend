import { memo, useState, useCallback, useMemo } from "react";
import {
  opsFilterCardClass,
  opsFilterLabelClass,
  opsInputClass,
} from "../../../shared/ui/operationsStyles";
import {
  BrandRefreshButton,
  FilterResetButton,
  Pagination,
  countActiveFilters,
} from "../../../ui";
import MasterDropdown from "../../masters/components/MasterDropdown";
import { format } from "date-fns";
import { useI18n } from "../../../i18n";
import { useDocumentsData } from "../hooks/useDocumentsData";
import { DOCUMENT_TYPE_ORDER } from "../utils/constants";
import ErrorBoundary from "../../../components/common/ErrorBoundary";
import DocumentSummaryTiles from "../components/documents/DocumentSummaryTiles";
import DocumentMatrix from "../components/documents/DocumentMatrix";
import DocumentEditModal from "../components/documents/DocumentEditModal";
import DocumentRefreshToast from "../components/documents/DocumentRefreshToast";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import {
  Search,
  FileText,
  AlertCircle,
  Clock,
  Files,
  ToggleLeft,
  ArrowUpDown,
} from "lucide-react";
import { shouldShowPagination } from "../../../shared/ui/paginationStyles";
import { parse, differenceInDays } from "date-fns";

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
  "bg-red-100 text-red-800":
    "bg-red-50 text-red-600 ring-1 ring-inset ring-red-100",
  "bg-amber-100 text-amber-800":
    "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100",
  "bg-yellow-100 text-yellow-800":
    "bg-yellow-50 text-yellow-600 ring-1 ring-inset ring-yellow-100",
  "bg-green-100 text-green-800":
    "bg-green-50 text-green-600 ring-1 ring-inset ring-green-100",
};

type DocFilter = "all" | "rc" | "insurance" | "fitness" | "permit" | "puc";
type StatusFilter = "" | "expired" | "expiring" | "valid" | "missing";
type SortKey = "expiry" | "vehicle" | "status";

/** Mirrors the hook's dd/MM/yyyy storage format; null when absent/invalid. */
const parseExpiry = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const d = parse(dateStr, "dd/MM/yyyy", new Date());
  return isNaN(d.getTime()) ? null : d;
};

/** Same thresholds as the hook's tile counts: <0 expired, ≤30 expiring. */
const expiryState = (dateStr: string | undefined, now: Date): StatusFilter => {
  const d = parseExpiry(dateStr);
  if (!d) return "missing";
  const days = differenceInDays(d, now);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
};

const STATUS_RANK: Record<StatusFilter, number> = {
  expired: 0,
  expiring: 1,
  missing: 2,
  valid: 3,
  "": 4,
};

const getNearestExpiry = (row: { docMap?: MatrixDocumentMap }): number => {
  const docMap = row.docMap ?? {};
  const dates = Object.values(docMap)
    .map((doc) => {
      if (doc && typeof doc === "object") {
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

const DocumentsExpiryPage = ({
  embedded = false,
}: DocumentsExpiryPageProps) => {
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
  const [editData, setEditData] = useState<{
    vehicle: MatrixVehicle;
    docMap: MatrixDocumentMap;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchTerm, setSearchTerm] = useState("");
  const [docFilter, setDocFilter] = useState<DocFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const now = useMemo(() => new Date(), []);
  /** Stamped at mount (page load / full page refresh) and again by the refresh
   * and save handlers, so the "Updated …" line is never empty. Lazy initialiser
   * keeps one timestamp per mount instead of a new Date on every render. */
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => new Date());
  /** 0 = hidden; any other value is the id of the visible refresh toast. */
  const [refreshToastId, setRefreshToastId] = useState(0);

  const filteredMatrix = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const types =
      docFilter === "all"
        ? (DOCUMENT_TYPE_ORDER as unknown as string[])
        : [docFilter];
    return matrix.filter((row) => {
      const vehicle = row?.vehicle;
      if (
        term &&
        !(
          String(vehicle?.vehicleNumber ?? "")
            .toLowerCase()
            .includes(term) ||
          String(vehicle?.chassisNumber ?? "")
            .toLowerCase()
            .includes(term) ||
          String(vehicle?.engineNumber ?? "")
            .toLowerCase()
            .includes(term)
        )
      ) {
        return false;
      }
      if (!statusFilter) return true;
      const docMap = (row?.docMap ?? {}) as MatrixDocumentMap;
      // A vehicle matches when ANY of the selected document types is in that state.
      return types.some(
        (type) => expiryState(docMap[type]?.expiryDate, now) === statusFilter,
      );
    });
  }, [matrix, searchTerm, docFilter, statusFilter, now]);

  const sortedMatrix = useMemo(() => {
    const rows = [...filteredMatrix];
    const nearest = (row: { docMap?: MatrixDocumentMap }) => {
      if (docFilter === "all") return getNearestExpiry(row);
      const d = parseExpiry(row.docMap?.[docFilter]?.expiryDate);
      return d ? d.getTime() : Infinity;
    };
    const worstState = (row: { docMap?: MatrixDocumentMap }) => {
      const docMap = row.docMap ?? {};
      const types =
        docFilter === "all"
          ? (DOCUMENT_TYPE_ORDER as unknown as string[])
          : [docFilter];
      return Math.min(
        ...types.map(
          (type) => STATUS_RANK[expiryState(docMap[type]?.expiryDate, now)],
        ),
      );
    };
    if (sortKey === "vehicle") {
      rows.sort((a, b) =>
        String(a.vehicle?.vehicleNumber ?? "").localeCompare(
          String(b.vehicle?.vehicleNumber ?? ""),
        ),
      );
    } else if (sortKey === "status") {
      rows.sort(
        (a, b) => worstState(a) - worstState(b) || nearest(a) - nearest(b),
      );
    } else {
      rows.sort((a, b) => nearest(a) - nearest(b));
    }
    return rows;
  }, [filteredMatrix, sortKey, docFilter, now]);

  const totalRecords = sortedMatrix.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  /** Derived clamp: a narrower search can shrink the list below the stored
   * page, so the rendered page is always valid without an effect. */
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const paginatedMatrix = sortedMatrix.slice(startIndex, startIndex + pageSize);

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
      showNotification(t("fleet.documents.refresh_failed"), "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, showNotification, t]);

  /** Lighten the hook's status colours for display only — see SOFTER_STATUS_COLORS. */
  const softStatusColor = (expiryDate?: string) => {
    const base = getStatusColor(expiryDate);
    return SOFTER_STATUS_COLORS[base] ?? base;
  };

  const handleEdit = useCallback(
    (vehicle: MatrixVehicle, docMap: MatrixDocumentMap) => {
      const normalizedVehicle = {
        ...vehicle,
        id: String(vehicle.id),
      };
      setEditData({ vehicle: normalizedVehicle, docMap });
    },
    [],
  );

  const handleCloseEdit = useCallback(() => setEditData(null), []);

  const handleSaveEdit = useCallback(
    async (
      vehicleId: string | number,
      updates: Record<
        string,
        {
          expiryDate?: string;
          documentNumber?: string;
          validFrom?: string;
          remarks?: string;
        }
      >,
      files?: Record<string, File>,
      removes?: Record<string, boolean>,
    ) => {
      try {
        await updateDocument(vehicleId, updates, files, removes);
        setLastUpdated(new Date());
        showNotification(t("fleet.documents.updated_success"), "success");
        setEditData(null);
      } catch (error: unknown) {
        showNotification(
          error instanceof Error
            ? error.message
            : t("fleet.documents.update_failed"),
          "error",
        );
      }
    },
    [updateDocument, showNotification, t],
  );

  const editableDocTypes = DOCUMENT_TYPE_ORDER as unknown as string[];

  const translatedDocLabels = useMemo(
    () =>
      Object.fromEntries(
        DOCUMENT_TYPE_ORDER.map((type) => [type, t(`fleet.doc_label.${type}`)]),
      ),
    [t],
  );

  const activeFilterCount = countActiveFilters(
    searchTerm.trim() !== "",
    docFilter !== "all",
    statusFilter !== "",
    sortKey !== "expiry",
  );
  const handleResetFilters = () => {
    setSearchTerm("");
    setDocFilter("all");
    setStatusFilter("");
    setSortKey("expiry");
    setCurrentPage(1);
  };
  const isBusy = loading || isRefreshing;
  const searchId = "permits-search";

  const updatedLabel = lastUpdated
    ? t("fleet.emi.updated_at", {
        time: format(lastUpdated, "dd MMM yyyy, hh:mm a"),
      })
    : "";

  return (
    <ErrorBoundary>
      <div
        className={`w-full space-y-4 ${
          embedded
            ? ""
            : "px-4 md:px-8 py-6 md:py-8 bg-slate-50/50 min-h-screen"
        }`}
      >
        {/* Top-right refresh toast — auto-closes after 5 seconds */}
        <DocumentRefreshToast
          show={refreshToastId > 0}
          eventId={refreshToastId}
          onDismiss={dismissRefreshToast}
        />

        {!loading && error && (
          <div
            className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-sm text-rose-700 flex items-center justify-between gap-3 shadow-sm"
            role="alert"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-100 transition-colors shadow-sm"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        <DocumentSummaryTiles
          counts={totalCounts}
          statusCounts={statusCounts}
          docLabels={translatedDocLabels}
          loading={loading && !hasData}
        />

        {/* ── Filter card — Trip List anatomy: glyph labels on row 1, actions
            right-aligned on row 2. Never unmounts while the table loads. ── */}
        <section
          className={`${opsFilterCardClass} motion-safe:animate-[var(--animate-fade-in-up)]`}
          aria-label={t("fleet.documents.vehicle_document_status")}
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={searchId} className={opsFilterLabelClass}>
                <Search size={17} className="text-slate-400 flex-shrink-0" />
                <span>{t("common.search")}</span>
              </label>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id={searchId}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={t("fleet.documents.search_placeholder")}
                  className={`${opsInputClass} pl-10`}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label className={opsFilterLabelClass}>
                <Files size={17} className="text-indigo-500 flex-shrink-0" />
                <span>{t("fleet.documents.filter.document")}</span>
              </label>
              <MasterDropdown
                label={t("fleet.documents.filter.document")}
                hideLabel
                value={docFilter}
                options={[
                  {
                    value: "all",
                    label: t("fleet.documents.filter.all_documents"),
                  },
                  ...DOCUMENT_TYPE_ORDER.map((type) => ({
                    value: type,
                    label: translatedDocLabels[type],
                  })),
                ]}
                onChange={(v) => {
                  setDocFilter(v as DocFilter);
                  setCurrentPage(1);
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className={opsFilterLabelClass}>
                <ToggleLeft
                  size={17}
                  className="text-amber-500 flex-shrink-0"
                />
                <span>{t("common.status")}</span>
              </label>
              <MasterDropdown
                label={t("common.status")}
                hideLabel
                value={statusFilter}
                options={[
                  { value: "", label: t("common.all_statuses") },
                  {
                    value: "expired",
                    label: t("fleet.doc_matrix.status_expired"),
                  },
                  {
                    value: "expiring",
                    label: t("fleet.doc_matrix.status_expiring"),
                  },
                  {
                    value: "valid",
                    label: t("fleet.doc_matrix.status_active"),
                  },
                  {
                    value: "missing",
                    label: t("fleet.doc_matrix.status_not_added"),
                  },
                ]}
                onChange={(v) => {
                  setStatusFilter(v as StatusFilter);
                  setCurrentPage(1);
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className={opsFilterLabelClass}>
                <ArrowUpDown
                  size={17}
                  className="text-violet-500 flex-shrink-0"
                />
                <span>{t("common.sort_by")}</span>
              </label>
              <MasterDropdown
                label={t("common.sort_by")}
                hideLabel
                value={sortKey}
                options={[
                  {
                    value: "expiry",
                    label: t("fleet.documents.sort.nearest_expiry"),
                  },
                  { value: "vehicle", label: t("common.vehicle") },
                  { value: "status", label: t("common.status") },
                ]}
                onChange={(v) => {
                  setSortKey(v as SortKey);
                  setCurrentPage(1);
                }}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {updatedLabel ? (
              <p className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 tabular-nums">
                <Clock
                  size={12}
                  aria-hidden="true"
                  className="text-slate-400"
                />
                {updatedLabel}
              </p>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <FilterResetButton
                count={activeFilterCount}
                onClick={handleResetFilters}
                disabled={isBusy}
              />
              <BrandRefreshButton
                onClick={handleRefresh}
                loading={isRefreshing}
                disabled={isBusy}
              />
            </div>
          </div>
        </section>

        {/* ── Table card — Trip List header: glyph tile + title + count ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
          <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight truncate">
                {t("fleet.documents.vehicle_document_status")}
              </h3>
            </div>
            <span
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-600"
              aria-live="polite"
            >
              {totalRecords.toLocaleString("en-IN")}
            </span>
          </div>

          <DocumentMatrix
            matrix={paginatedMatrix}
            docTypes={DOCUMENT_TYPE_ORDER as unknown as string[]}
            docLabels={translatedDocLabels}
            getStatusColor={softStatusColor}
            formatExpiryDate={formatExpiryDate}
            onEdit={handleEdit}
            startSerial={startIndex + 1}
            loading={isBusy}
            emptyMessage={t("fleet.documents.no_vehicles_match")}
          />

          {shouldShowPagination(totalRecords) && (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={totalRecords}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              disabled={isBusy}
            />
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
