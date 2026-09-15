import { useMemo, useRef, useState } from "react";
import {
  Search, X, History, CheckCircle, Clock, AlertCircle, Eye, Pencil,
  Hash, FileText, Calendar, Store, UserCog, IndianRupee, Activity, Settings2,
} from "lucide-react";
import TripPagination from "../../../vehicle-trips/components/TripPagination";
import type { RecentCollection } from "../../types/collection";
import { useI18n } from "../../../../../i18n";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { collectionStatusKey, collectionStatusLabel } from "../../utils/collectionStatusLabel";

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

  /** Dates follow the language; numbers stay in Latin digits so amounts and
    * reference numbers are never ambiguous. Same rule as the Trip view. */
  const localizeDate = (value: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

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

    // Approved tab: one row per shop, showing that shop's MOST RECENT
    // approved collection.
    //
    // Two things matter here and both were previously wrong:
    //
    // 1. "Latest" is resolved against the FULL approved set, never the
    //    search-filtered one. Picking the newest of only the matching rows
    //    would show an older collection number whenever the search happened
    //    to exclude the real latest entry — the row would claim to be the
    //    shop's current state while showing stale figures. The search is
    //    applied afterwards, to decide which shop rows to display.
    //
    // 2. Recency is compared on ONE clock. Mixing approvedDate for one side
    //    and collectionDate for the other compares different quantities, so
    //    the winner depended on which rows happened to carry an approvedDate.
    //    collectionDate is the entry date every row has; the id breaks ties
    //    within a day, giving a total order that cannot flip between renders.
    const allApproved = collections.filter((row) => (row.rawStatus || row.status) === "Approved");

    const isNewer = (candidate: RecentCollection, current: RecentCollection) => {
      const byDate = candidate.collectionDate.localeCompare(current.collectionDate);
      if (byDate !== 0) return byDate > 0;
      return (candidate.numericId ?? 0) > (current.numericId ?? 0);
    };

    const shopMap = new Map<string, RecentCollection>();
    for (const col of allApproved) {
      const existing = shopMap.get(col.shopName);
      if (!existing || isNewer(col, existing)) shopMap.set(col.shopName, col);
    }

    const sort = (rows: RecentCollection[]) =>
      [...rows].sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));

    // Now apply the search to the one-row-per-shop list.
    const matchingShops = new Set(
      filteredBySearch
        .filter((row) => (row.rawStatus || row.status) === "Approved")
        .map((row) => row.shopName),
    );

    const approvedByShop = sort(
      Array.from(shopMap.values()).filter((row) => matchingShops.has(row.shopName)),
    );

    return {
      Pending: sort(pending),
      // EVERY shop that has an approved collection appears, one row each,
      // showing that shop's most recent entry. The row is a doorway: opening
      // it reveals that shop's latest 10 collections. Pagination keeps the
      // full list manageable, so no shop is silently withheld.
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

  /** Any change to the result set returns to page 1, so the view can never be
    * stranded on a page that no longer exists. */
  const updateSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };
  const clearSearch = () => updateSearch("");

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
        </div>
      </div>

      {/* Table — column sizing and type scale match Recent Trip Activity. */}
      <div className="overflow-x-auto">
        {/* Column widths are proportioned to what each column actually holds,
          * measured against the live dataset (longest / average characters):
          *
          *   S.No 3 · Collection No 16 · Date 11 · Shop 33/22 · Collector 14/11
          *   · Amount 11 · Status "Pending" · Actions 4 icons
          *
          * 8/14/10/19/14/10/9/16, summing to exactly 100%. The 1180px floor
          * guarantees every worst case: Actions 16% = 189px against the 178px
          * four 32px buttons plus gaps and padding need, Status 9% = 106px for
          * the short "Pending" badge, Shop 19% = 224px. Below the floor the
          * table scrolls horizontally rather than crushing a column.
          *
          * S.No, Date and their headers are left-aligned like every other text
          * column. They were previously centred, which floated the value away
          * from its own heading and read as uneven gaps either side of
          * Collection No — an alignment problem that no width change fixes. */}
        <table className="min-w-[1180px] w-full table-fixed text-sm text-left border-collapse">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[19%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[16%]" />
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
              <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <FileText size={14} className="shrink-0 text-emerald-500" />
                  {t("table.collection_no")}
                </span>
              </th>
              <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="shrink-0 text-blue-500" />
                  {t("table.date")}
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
                <span className="inline-flex items-center justify-end gap-1.5">
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
                      {localizeDate(col.collectionDate)}
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
                            onClick={() => onViewShop(col.shopName)}
                            aria-label={t("common.view")}
                            className="group h-8 w-8 rounded-xl bg-violet-50 hover:bg-violet-500 text-violet-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                          >
                            <span className={`inline-flex ${uiActionIconMotionClass.view}`}>
                              <Eye size={14} />
                            </span>
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
