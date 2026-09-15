import { useMemo, useState } from "react";
import { Search, X, History, CheckCircle, Clock, AlertCircle, Eye, Pencil, Trash2 } from "lucide-react";
import type { RecentCollection } from "../../types/collection";
import { useI18n } from "../../../../../i18n";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";

interface Props {
  collections: RecentCollection[];
  statusFilter: "Pending" | "Approved" | "Deleted";
  pendingApprovalCount: number;
  onStatusChange: (status: "Pending" | "Approved" | "Deleted") => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (collection: RecentCollection) => void;
  onDelete: (id: string) => void;
  onViewShop: (shopName: string) => void;
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

function getRowStyle(rawStatus: string): string {
  switch (rawStatus) {
    case "Pending Approval":
      return "bg-orange-50/40";
    case "Approved":
      return "bg-emerald-50/40";
    case "Deleted":
      return "bg-rose-50/40 opacity-60";
    default:
      return "";
  }
}

export default function RecentCollectionsTable({
  collections,
  statusFilter,
  pendingApprovalCount,
  onStatusChange,
  onApprove,
  onEdit,
  onDelete,
  onViewShop,
}: Props) {
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

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
      const statusKey = "status." + String(rawStatus).toLowerCase().replace(/\s+/g, "_");
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

    // Approved tab shows only the latest approved collection per shop.
    const shopMap = new Map<string, RecentCollection>();
    for (const col of filteredBySearch.filter((row) => row.rawStatus === "Approved")) {
      const existing = shopMap.get(col.shopName);
      if (!existing) {
        shopMap.set(col.shopName, col);
        continue;
      }
      const existingDate = existing.approvedDate || existing.collectionDate;
      const currentDate = col.approvedDate || col.collectionDate;
      if (currentDate > existingDate) shopMap.set(col.shopName, col);
      else if (currentDate === existingDate && (col.numericId ?? 0) > (existing.numericId ?? 0)) {
        shopMap.set(col.shopName, col);
      }
    }

    const sort = (rows: RecentCollection[]) =>
      [...rows].sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));

    return {
      Pending: sort(pending),
      Approved: sort(Array.from(shopMap.values())),
      Deleted: sort(deleted),
    };
  }, [filteredBySearch]);

  const displayedData = buckets[statusFilter];

  const clearSearch = () => setSearchQuery("");

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
              const key = `status.${tab.toLowerCase()}`;
              const label = t(key) === key ? tab : t(key);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onStatusChange(tab)}
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

          {pendingApprovalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700">
              <Clock size={11} />
              {t("common.pending")}: <span className="tabular-nums">{pendingApprovalCount}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("table.s_no")}</th>
              <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("table.collection_no")}</th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("table.date")}</th>
              <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("table.shop")}</th>
              <th className="px-4 py-3 text-sm font-bold uppercase tracking-wider">{t("table.collector")}</th>
              <th className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wider">{t("table.amount")}</th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("table.status")}</th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wider">{t("table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <History size={24} className="mx-auto mb-2" />
                  {getEmptyStateMessage()}
                </td>
              </tr>
            ) : (
              displayedData.map((col, index) => {
                const rawStatus = col.rawStatus || col.status;
                const isPending = rawStatus === "Pending Approval";
                const isDeleted = rawStatus === "Deleted";
                const statusKey = "status." + String(rawStatus).toLowerCase().replace(/\s+/g, "_");
                const statusLabel = t(statusKey) === statusKey ? rawStatus : t(statusKey);
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
                    className={`transition-colors hover:bg-slate-50/80 ${getRowStyle(rawStatus)}`}
                  >
                    <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500 tabular-nums">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {col.collectionNo}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">
                      {col.collectionDate}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{localize(col.shopName)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{localize(col.collectorName)}</td>
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
                    <td className="px-4 py-3 text-center">
                      {/* Icon buttons matching the Trip List action vocabulary.
                        * No title attributes — the page is tooltip-free, so each
                        * control carries an aria-label for assistive tech only. */}
                      <div className="flex items-center justify-center gap-1.5">
                        {isPending ? (
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
                            <button
                              type="button"
                              onClick={() => onDelete(col.id)}
                              aria-label={t("common.delete")}
                              className="group h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                            >
                              <span className={`inline-flex ${uiActionIconMotionClass.delete}`}>
                                <Trash2 size={14} />
                              </span>
                            </button>
                          </>
                        ) : isDeleted ? (
                          <span className="text-xs font-medium text-slate-400">{t("status.deleted")}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onViewShop(col.shopName)}
                            aria-label={t("common.view")}
                            className="group h-8 w-8 rounded-xl bg-violet-50 hover:bg-violet-500 text-violet-600 hover:text-white flex items-center justify-center mx-auto transition-all shadow-sm active:scale-95"
                          >
                            <span className={`inline-flex ${uiActionIconMotionClass.view}`}>
                              <Eye size={14} />
                            </span>
                          </button>
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
    </div>
  );
}
