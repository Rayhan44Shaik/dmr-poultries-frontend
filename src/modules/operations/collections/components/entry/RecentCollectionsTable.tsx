import { useMemo, useRef, useState } from "react";
import {
  Search, X, History, CheckCircle, Clock, AlertCircle, Eye, Pencil, RotateCcw,
  Hash, FileText, Calendar, Store, UserCog, IndianRupee, Activity, Settings2,
} from "lucide-react";
import TripPagination from "../../../vehicle-trips/components/TripPagination";
import type { RecentCollection } from "../../types/collection";
import { useI18n } from "../../../../../i18n";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import { formatTripListDay } from "../../../vehicle-trips/utils/formatTripListDay";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { opsSecondaryButtonClass } from "../../../../../shared/ui/operationsStyles";
import { BrandRefreshButton } from "../../../../../ui";
import { collectionStatusKey, collectionStatusLabel } from "../../utils/collectionStatusLabel";
import {
  collectionShopKey,
  compareCollectionRecency,
  latestApprovedPerShop,
} from "./latestApprovedPerShop";

interface Props {
  collections: RecentCollection[];
  /** True while the Recent Collections feed is refreshing. */
  isLoading?: boolean;
  statusFilter: "Pending" | "Approved" | "Deleted";
  onStatusChange: (status: "Pending" | "Approved" | "Deleted") => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (collection: RecentCollection) => void;
  onViewShop: (shopName: string) => void;
  /**
   * Reloads the recent feed from the backend. Lives here, on the results card,
   * beside Reset — the filter bar above stays a pure entry form.
   */
  onRefresh?: () => void | Promise<void>;
  /** Drives the refresh control's dancing-hen busy state. */
  refreshing?: boolean;
  /** Fires whenever the highlighted row changes, so the page can mirror it. */
  onSelectionChange?: (collection: RecentCollection | null) => void;
}

const inr = (n: number) =>
  "₹ " + Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Pending Approval":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Rejected":
    case "Deleted":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function RecentCollectionsTable({
  collections,
  isLoading = false,
  statusFilter,
  onStatusChange,
  onApprove,
  onEdit,
  onViewShop,
  onRefresh,
  refreshing = false,
  onSelectionChange,
}: Props) {
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Shop and collector names are data, not i18n keys, so they are transliterated
    * for Telugu using the same helper the Trip screens use. */
  const localize = (value: string) => localizeTripViewText(value, language);

  /**
   * Search matches the English source AND the Telugu rendering of every field,
   * so a user reading the page in Telugu can still type in English (and vice
   * versa) and find the row. Whitespace is squashed so "SriBalaji" matches
   * "Sri Balaji", mirroring Trip List behaviour.
   */
  const filteredBySearch = useMemo(() => {
    const lower = searchQuery.trim().toLowerCase();
    if (!lower) return collections;
    const squashed = lower.replace(/\s+/g, "");
    return collections.filter((col) => {
      const rawStatus = col.rawStatus || col.status;
      const statusKey = collectionStatusKey(rawStatus);
      const translatedStatus = t(statusKey);
      const candidates = [
        col.collectionNo,
        col.shopName,
        col.collectorName,
        col.collectionDate,
        String(col.amount ?? ""),
        rawStatus,
        translatedStatus === statusKey ? "" : translatedStatus,
        localize(col.shopName),
        localize(col.collectorName),
      ];
      return candidates.some((value) => {
        const text = String(value ?? "").toLowerCase();
        return text.includes(lower) || text.replace(/\s+/g, "").includes(squashed);
      });
    });
  // `localize` is derived from `language`; listing it would re-create the
  // closure every render without changing the result.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, searchQuery, t, language]);

  /** Row buckets per tab — computed once so the toggle can show live counts. */
  const buckets = useMemo(() => {
    const pending = filteredBySearch.filter((col) => col.rawStatus === "Pending Approval");
    const deleted = filteredBySearch.filter((col) => col.rawStatus === "Deleted");

    // Resolve the one-row-per-shop Approved list against the COMPLETE
    // approved set before applying search. This guarantees that searching an
    // older number can reveal its shop, but the row still displays that shop's
    // actual newest approved collection number. Stable shop ids prevent two
    // shops with the same display name from being collapsed together.
    const newestApprovedRows = latestApprovedPerShop(collections);
    const matchingApprovedShopKeys = new Set(
      filteredBySearch
        .filter((row) => (row.rawStatus || row.status) === "Approved")
        .map(collectionShopKey),
    );
    const approvedByShop = newestApprovedRows.filter((row) =>
      matchingApprovedShopKeys.has(collectionShopKey(row)),
    );

    const sort = (rows: RecentCollection[]) =>
      [...rows].sort((a, b) => compareCollectionRecency(b, a));

    return {
      Pending: sort(pending),
      // EVERY shop that has an approved collection appears exactly once and
      // carries that shop's most recent approved collection number. Opening
      // the row loads the same shop's latest 10 records across all statuses.
      Approved: approvedByShop,
      Deleted: sort(deleted),
    };
  }, [collections, filteredBySearch]);

  const displayedData = buckets[statusFilter];

  // Pagination. Reset to page 1 whenever the tab or the search changes, so a
  // filtered-down list can never leave the view stranded on an empty page.
  const totalPages = Math.max(1, Math.ceil(displayedData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedData = displayedData.slice(startIndex, startIndex + pageSize);


  /**
   * Keyboard navigation, matching the Trip List.
   *
   * Rows are a roving tabstop: exactly one row is tabbable at a time, so Tab
   * enters the table once and moves on rather than walking every row. Inside
   * the table, Up/Down move the selection (and follow it across page
   * boundaries), Home/End jump to the ends, and Escape clears. Selecting by
   * any route reports the row upward so the page shows its detail.
   */
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const selectRow = (col: RecentCollection | null) => {
    setSelectedId(col ? col.id : null);
    onSelectionChange?.(col);
  };

  const focusRow = (index: number) => {
    // Defer to after the row has rendered, which matters when the move
    // crossed a page boundary and the row did not exist a tick ago.
    window.requestAnimationFrame(() => rowRefs.current[index]?.focus());
  };

  const moveSelection = (fromIndex: number, delta: number) => {
    const target = fromIndex + delta;

    // Step past the end of this page onto the next/previous one.
    if (target < 0) {
      if (safeCurrentPage > 1) {
        setCurrentPage(safeCurrentPage - 1);
        const lastIndex = pageSize - 1;
        const row = displayedData[(safeCurrentPage - 2) * pageSize + lastIndex];
        if (row) selectRow(row);
        focusRow(lastIndex);
      }
      return;
    }
    if (target >= paginatedData.length) {
      if (safeCurrentPage < totalPages) {
        setCurrentPage(safeCurrentPage + 1);
        const row = displayedData[safeCurrentPage * pageSize];
        if (row) selectRow(row);
        focusRow(0);
      }
      return;
    }

    selectRow(paginatedData[target]);
    focusRow(target);
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, col: RecentCollection) => {
    // Let the action buttons keep their own keyboard behaviour.
    if (event.target !== event.currentTarget) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveSelection(index, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveSelection(index, -1);
        break;
      case "Home":
        event.preventDefault();
        if (paginatedData.length > 0) {
          selectRow(paginatedData[0]);
          focusRow(0);
        }
        break;
      case "End":
        event.preventDefault();
        if (paginatedData.length > 0) {
          const last = paginatedData.length - 1;
          selectRow(paginatedData[last]);
          focusRow(last);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectRow(selectedId === col.id ? null : col);
        break;
      case "Escape":
        event.preventDefault();
        selectRow(null);
        break;
      default:
        break;
    }
  };

  /** The roving tabstop: the selected row, else the first row. */
  const activeRowIndex = Math.max(0, paginatedData.findIndex((row) => row.id === selectedId));

  /** Any search/reset change returns to page 1 and clears the old selection,
    * so an action can never target a row that is no longer visible. */
  const updateSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    selectRow(null);
  };
  const clearSearch = () => updateSearch("");
  const resetTable = () => updateSearch("");

  /** Refresh clears the highlight first: the reloaded feed may not hold the
    * row that was selected a moment ago, and a dangling highlight is worse
    * than none. */
  const refreshTable = () => {
    setCurrentPage(1);
    selectRow(null);
    void onRefresh?.();
  };

  /** Approved actions always select first, then open that exact entry. */
  const viewApprovedCollection = (collection: RecentCollection) => {
    selectRow(collection);
    onViewShop(collection.shopName);
  };

  const getEmptyStateMessage = (): string => {
    switch (statusFilter) {
      case "Pending":
        return t("empty.no_pending");
      case "Approved":
        return t("ops.collection.no_approved");
      case "Deleted":
        return t("ops.collection.no_deleted");
      default:
        return t("empty.no_collections");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden mt-8 transition-all duration-300">
      {/* Header — mirrors Recent Trip Activity: icon + title, selected-tab count
        * beside the name, segmented status toggle, then the search box. */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {t("ops.collection.recent_collections")}
            </h3>
          </div>

          {/* Count follows the selected tab, exactly like Trip List. */}
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums">
            {displayedData.length}
          </span>

          <div className="flex items-center p-0.5 ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 shadow-sm">
            {(["Pending", "Approved", "Deleted"] as const).map((tab) => {
              const isActive = statusFilter === tab;
              // Colours match the meaning of each tab and the row/badge tints.
              const activeClass =
                tab === "Approved"
                  ? "bg-emerald-50/80 text-emerald-500 shadow-sm"
                  : tab === "Pending"
                  ? "bg-orange-50/80 text-orange-500 shadow-sm"
                  : "bg-rose-50/80 text-rose-500 shadow-sm";
              // Tab and row badge share one label source, so they always agree.
              const key = `status.${tab.toLowerCase()}`;
              const label = t(key) === key ? tab : t(key);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    selectRow(null);
                    onStatusChange(tab);
                    setCurrentPage(1);
                  }}
                  aria-pressed={isActive}
                  className={`inline-flex items-center px-5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    isActive ? activeClass : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder={t("ops.collection.search_collections_placeholder")}
              className="w-full sm:w-64 pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={t("common.clear")}
                className="group absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} className={uiActionIconMotionClass.close} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={resetTable}
            className={`group relative ${opsSecondaryButtonClass}`}
            aria-label={t("common.reset")}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.reset}`}>
              <RotateCcw size={14} />
            </span>
            {t("common.reset")}
          </button>

          {onRefresh && (
            <BrandRefreshButton
              onClick={refreshTable}
              loading={refreshing || isLoading}
              ariaLabel={t("common.refresh")}
            >
              {t("common.refresh")}
            </BrandRefreshButton>
          )}
        </div>
      </div>

      {/* Data-first order shared with View Collection: S.No, Collection No,
        * then Day. Remaining widths follow the content they carry so labels
        * and values stay evenly separated without wasting table space. */}
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full table-fixed text-sm text-left border-collapse">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
            <tr>
              {/* Each column is tagged with the same icon vocabulary Shop Sales
                * uses, so a column means the same thing across the product. */}
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <Hash size={14} className="shrink-0 text-slate-400" />
                  {t("table.s_no")}
                </span>
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={14} className="shrink-0 text-emerald-500" />
                  {t("table.collection_no")}
                </span>
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="shrink-0 text-blue-500" />
                  {t("common.day")}
                </span>
              </th>
              <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <Store size={14} className="shrink-0 text-amber-500" />
                  {t("table.shop")}
                </span>
              </th>
              <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <UserCog size={14} className="shrink-0 text-violet-500" />
                  {t("table.collector")}
                </span>
              </th>
              <th className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex w-full items-center justify-end gap-1.5">
                  <IndianRupee size={14} className="shrink-0 text-emerald-600" />
                  {t("table.amount")}
                </span>
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Activity size={14} className="shrink-0 text-orange-500" />
                  {t("table.status")}
                </span>
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Settings2 size={14} className="shrink-0 text-slate-400" />
                  {t("table.actions")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-sm font-medium text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                      aria-hidden="true"
                    />
                    {t("ops.collection.loading_recent")}
                  </span>
                </td>
              </tr>
            ) : displayedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <History size={24} className="mx-auto mb-2" />
                  {getEmptyStateMessage()}
                </td>
              </tr>
            ) : (
              paginatedData.map((col, index) => {
                const rawStatus = col.rawStatus || col.status;
                const isSelected = selectedId === col.id;
                const isPending = rawStatus === "Pending Approval";
                const isDeleted = rawStatus === "Deleted";
                const statusLabel = collectionStatusLabel(rawStatus, t);
                const statusIcon = isDeleted ? (
                  <AlertCircle size={12} />
                ) : isPending ? (
                  <Clock size={12} />
                ) : (
                  <CheckCircle size={12} />
                );

                return (
                  <tr
                    key={`${col.id}-${index}`}
                    ref={(node) => {
                      // Clearing on unmount keeps the arrow keys from ever
                      // focusing a detached row after the page shrinks.
                      rowRefs.current[index] = node;
                      return () => {
                        rowRefs.current[index] = null;
                      };
                    }}
                    tabIndex={index === activeRowIndex ? 0 : -1}
                    onClick={() => selectRow(isSelected ? null : col)}
                    onKeyDown={(event) => handleRowKeyDown(event, index, col)}
                    aria-selected={isSelected}
                    className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                      isSelected
                        ? "bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tabular-nums">
                      {startIndex + index + 1}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800 truncate">
                      {col.collectionNo}
                    </td>
                    <td className="px-4 py-3 text-left text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">
                      {formatTripListDay(col.collectionDate, language)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 truncate">{localize(col.shopName)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 truncate">{localize(col.collectorName)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">
                      {inr(col.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm border ${getStatusBadgeClass(rawStatus)}`}
                      >
                        {statusIcon}
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {/* Icon buttons matching the Trip List action vocabulary.
                        * No title attributes — the page is tooltip-free, so each
                        * control carries an aria-label for assistive tech only. */}
                      <div className="flex items-center justify-center gap-1.5">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => onApprove(col.id)}
                              aria-label={t("common.approve")}
                              className="group h-8 w-8 rounded-xl bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                            >
                              <span className={`inline-flex ${uiActionIconMotionClass.approve}`}>
                                <CheckCircle size={14} />
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onEdit(col)}
                              aria-label={t("common.edit")}
                              className="group h-8 w-8 rounded-xl bg-blue-50 hover:bg-blue-500 text-blue-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                            >
                              <span className={`inline-flex ${uiActionIconMotionClass.edit}`}>
                                <Pencil size={14} />
                              </span>
                            </button>
                          </>
                        )}

                        {/* View is an approved-only affordance. A pending row
                          * has nothing settled to inspect yet — approve or edit
                          * it first. */}
                        {!isDeleted && !isPending && (
                          <button
                            type="button"
                            onClick={() => viewApprovedCollection(col)}
                            aria-label={`${t("common.view")} ${col.collectionNo}`}
                            className="group inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-violet-50 px-3 text-xs font-bold text-violet-600 shadow-sm transition-all hover:bg-violet-500 hover:text-white active:scale-95"
                          >
                            <span className={`inline-flex ${uiActionIconMotionClass.view}`}>
                              <Eye size={14} />
                            </span>
                            {t("common.view")}
                          </button>
                        )}

                        {/* Deleted rows have no actions left to offer. */}
                        {isDeleted && (
                          <span className="text-xs font-medium text-slate-400">{t("status.deleted")}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Same pagination control as the Trip List, built on the shared
        * paginationStyles tokens, so page size and navigation behave
        * identically across Operations. */}
      {displayedData.length > 0 && (
        <TripPagination
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={displayedData.length}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
