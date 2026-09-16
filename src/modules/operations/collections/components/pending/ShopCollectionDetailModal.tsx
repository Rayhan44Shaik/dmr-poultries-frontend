// src/modules/operations/collections/components/pending/ShopCollectionDetailModal.tsx
//
// The shop view for Pending Collections.
//
// Same shell, animation and size as the Trip List view: AppShellModal — the
// global view panel (fade-in overlay, scale-in panel, 96rem cap, 100vh-minus-
// header height) — so a shop opens exactly like a trip does, and the same
// scoped language switch (`ViewLanguageToggle`) flips THIS popup to Telugu
// without touching the page behind it.
//
// It reads the shop's WHOLE collection history (not the latest ten) through the
// dedicated recent endpoint, searches it, and pages it with the global
// Pagination, so every record the backend returns is reachable from here.
//
// Deleting: one row, one click, the shared 10-second countdown pop — the exact
// delete flow the Recent Collections table uses — and only while the entry is
// inside its delete window (aged rows render the same disabled state the
// Collection Entry view shows, with the days remaining in the hint). The
// service republishes the shop balance, so the Shops master is correct
// immediately and the row shows up under Recent Collections → Deleted.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X, Eye, IndianRupee, Calendar, User, CreditCard, Hash, FileText, Trash2, Loader2,
  Search, Wallet, Clock, Activity, Settings2,
} from "lucide-react";
import type { Collection, CollectionApiEntry } from "../../types/collection";
import type { Shop } from "../../../../masters/shops/types/shop";
import { collectionService } from "../../services/collectionService";
import { useSafeNotification } from "../../../../../hooks/useSafeNotification";
import { usePendingDelete } from "../../../../../hooks/usePendingDelete";
import { getDeleteWindowForStatus } from "../../utils/collectionDeleteWindow";
import { PendingDeleteNotification } from "../../../../../components/common/PendingDeleteNotification";
import { shouldShowPagination } from "../../../../../shared/ui/paginationStyles";
import { KpiCardGrid, Pagination, type KpiCardItem } from "../../../../../ui";
import AppShellModal from "../../../../../ui/AppShellModal";
import { ViewLanguageToggle } from "../../../../../ui/ViewLanguageToggle";
import { ActionTooltip } from "../../../../../ui/ActionTooltip";
import { ScopedI18nProvider, useI18n } from "../../../../../i18n";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import { collectionStatusKey, collectionStatusLabel } from "../../utils/collectionStatusLabel";

/** Every record for one shop in a single read; the pager handles the rest. */
const SHOP_HISTORY_LIMIT = 500;
const DEFAULT_PAGE_SIZE = 10;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr || dateStr === "-") return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function statusBadgeClass(status: string): string {
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

interface ShopCollectionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  allCollections: Collection[];
  shops: Shop[];
  onRefresh: () => void;
}

/**
 * One table for every collection of the shop — eight equally spaced columns,
 * the same field order the operator reads in the Recent Collections table:
 * S.No · Collection No · Collection Date · Amount · Mode · Collected By ·
 * Status · Actions.
 */
const TABLE_COLUMNS = [
  { key: "sno", className: "w-[12.5%]" },
  { key: "no", className: "w-[12.5%]" },
  { key: "date", className: "w-[12.5%]" },
  { key: "amount", className: "w-[12.5%]" },
  { key: "mode", className: "w-[12.5%]" },
  { key: "collector", className: "w-[12.5%]" },
  { key: "status", className: "w-[12.5%]" },
  { key: "actions", className: "w-[12.5%]" },
] as const;

function ShopCollectionDetailView({
  isOpen,
  onClose,
  shopName,
  allCollections,
  shops,
  onRefresh,
}: ShopCollectionDetailModalProps) {
  const { t, language, toggleLanguage } = useI18n();
  const { showNotification } = useSafeNotification();
  // Names are transliterated for display only; stored values drive every lookup.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);

  const shopCollections = useMemo(
    () =>
      allCollections
        .filter((c) => c.shopName === shopName)
        .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate)),
    [allCollections, shopName],
  );

  const [recentList, setRecentList] = useState<CollectionApiEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Find shop info for owner/mobile
  const shopInfo = shops.find((s) => s.shopName === shopName);

  useEffect(() => {
    let cancelled = false;
    const shopId = collectionService.getShopIdForName(shopName);
    if (!isOpen || !shopId) {
      if (!isOpen) setRecentList([]);
      return;
    }
    setRecentLoading(true);
    collectionService
      .fetchRecentCollectionsForShop(shopId, SHOP_HISTORY_LIMIT)
      .then((rows) => {
        if (!cancelled) setRecentList(rows);
      })
      .catch(() => {
        if (!cancelled) setRecentList([]);
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, shopName, refreshToken]);

  // Every open starts on page 1, with a clean search box.
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setSearch("");
    } else {
      setPage(1);
    }
  }, [isOpen, shopName]);

  /* -------------------------------------------------------------------- *
   * Delete — the Recent Collections flow, exactly.
   *
   * One click asks for the delete; the shared 10-second pop counts down and
   * only its completion calls the service. Rows outside their window are
   * disabled up front (see `deleteHintFor` below) so the pop is never the
   * first time the operator hears about the rule.
   * ------------------------------------------------------------------ */
  const performDelete = useCallback(
    async (id: string) => {
      const result = await collectionService.deletePendingCollection(String(id));
      if (result.success) {
        showNotification(t("ops.collection.deleted_success"), "success");
        // Row leaves this table immediately, and the page (Recent Collections)
        // reloads behind it. The service has already republished the shop
        // balance, so the Shops master shows the corrected figure at once.
        setRefreshToken((token) => token + 1);
        await onRefresh();
      } else {
        showNotification(result.message ?? t("ops.collection.delete_failed"), "error");
      }
    },
    [onRefresh, showNotification, t],
  );

  const pendingDelete = usePendingDelete<string>(performDelete);

  /** The 10-day rule, said in words, for one row. */
  const deleteHintFor = useCallback(
    (collection: CollectionApiEntry) => {
      const window = getDeleteWindowForStatus(collection.collectionDate, collection.status);
      const isPendingEntry = String(collection.status ?? "").toLowerCase().startsWith("pending");
      if (!window.canDelete) {
        return isPendingEntry
          ? t("ops.collection.delete_today_only")
          : t("ops.collection.delete_window_closed");
      }
      if (isPendingEntry) return t("ops.collection.delete_window_today");
      if (window.daysRemaining === 0) return t("ops.collection.delete_window_last_day");
      return t("ops.collection.delete_window_open", { days: window.daysRemaining });
    },
    [t],
  );

  if (!isOpen) return null;

  const totalCollections = shopCollections.reduce((sum, c) => sum + c.amount, 0);
  const currentOutstanding = collectionService.getShopBalance(shopName);
  const lastCollectionDate = shopCollections.length > 0 ? shopCollections[0].collectionDate : null;

  const searchTerm = search.trim().toLowerCase();
  const filteredRecent = searchTerm
    ? recentList.filter((col) =>
        [
          col.collectionNo,
          col.collectionDate,
          col.collector,
          col.paymentMode,
          col.status,
          String(col.amount ?? ""),
        ].some((value) => String(value ?? "").toLowerCase().includes(searchTerm)),
      )
    : recentList;

  const startIndex = (page - 1) * pageSize;
  const pageRows = filteredRecent.slice(startIndex, startIndex + pageSize);
  const busy = recentLoading || pendingDelete.pendingItems.length > 0;

  const inr = (value: number) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const outstanding = inr(currentOutstanding);
  const collectionsValue = inr(totalCollections);

  const kpiItems: KpiCardItem[] = [
    {
      id: "outstanding",
      label: t("ops.collection.current_outstanding"),
      value: <span className="tabular-nums">{outstanding}</span>,
      tooltip: `${t("ops.collection.current_outstanding")}: ${outstanding}`,
      Icon: IndianRupee,
      tone: "rose",
    },
    {
      id: "collections",
      label: t("ops.collection.total_collections"),
      value: <span className="tabular-nums">{collectionsValue}</span>,
      tooltip: `${t("ops.collection.total_collections")}: ${collectionsValue}`,
      Icon: Wallet,
      tone: "emerald",
    },
    {
      id: "last",
      label: t("ops.collection.last_collection"),
      value: <span className="text-xl">{formatDate(lastCollectionDate)}</span>,
      tooltip: `${t("ops.collection.last_collection")}: ${formatDate(lastCollectionDate)}`,
      Icon: Calendar,
      tone: "blue",
    },
  ];

  return (
    <AppShellModal open={isOpen} onClose={onClose} ariaLabelledBy="shop-collection-view-title">
      {/* Header — the Trip List view header shape, in this page's tone. */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-orange-50/40 px-6 py-4 flex-shrink-0 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 border border-orange-100 text-orange-500 shadow-inner shrink-0">
            <Eye size={18} />
          </div>
          <div>
            <h3 id="shop-collection-view-title" className="text-base font-bold text-slate-800 tracking-tight">
              {t("ops.collection.shop_collection_details")}
            </h3>
            <p className="text-sm font-medium text-slate-600 mt-0.5">{shown(shopName)}</p>
            {shopInfo && (
              <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  <span>{t("ops.collection.owner_label")}: <span className="font-medium text-slate-800">{shown(shopInfo.ownerName) || "—"}</span></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400" />
                  <span>{t("ops.collection.mobile_label")}: <span className="font-medium tabular-nums text-slate-800">{shopInfo.phoneNumber || "—"}</span></span>
                </span>
              </div>
            )}
            {/* The delete rule, stated plainly: the same 10-day window the
              * Collection Entry view enforces, so the enabled/disabled trash
              * below is never a surprise. */}
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              <Clock size={12} className="text-orange-500" />
              {t("ops.collection.delete_window_rule")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
          <ViewLanguageToggle
            language={language}
            onToggle={toggleLanguage}
            tone="emerald"
            labelMode="target"
            ariaLabel={t("ops.trip.popup_language_toggle")}
            tooltip={<ActionTooltip label={t("ops.trip.popup_language_tooltip")} side="bottom" />}
          />
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
            aria-label={t("common.close")}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
              <X size={16} />
            </span>
          </button>
        </div>
      </div>

      {/* Body — the panel scrolls, the header and footer stay put. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {/* Shop summary — the shared KPI surface, tone for tone with the
          * Trip List strip and the Pending Collections page above it. */}
        <KpiCardGrid
          items={kpiItems}
          gridClassName="lg:grid-cols-3"
          ariaLabel={t("ops.collection.shop_collection_details")}
        />

        {/* All Collections — every transaction this shop ever made. */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <h4 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-800">
              {/* The colour logo badge — same size and shape as the Rate Entry
                * table's header mark, so the two tables open identically. */}
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner">
                <Wallet className="h-5 w-5" />
              </span>
              {t("ops.collection.all_transactions")}
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 sm:inline">
                {filteredRecent.length} {filteredRecent.length === 1 ? t("common.entry") : t("common.entries")}
              </span>
            </h4>
            <div className="flex items-center gap-2">
              {recentLoading && recentList.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" />
                  {t("common.loading")}
                </span>
              )}
              {/* Search this shop's records, so one entry is always findable. */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t("ops.collection.search_collections_placeholder")}
                  className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 sm:w-64"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label={t("common.clear")}
                    className="group absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} className={uiActionIconMotionClass.close} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {recentLoading && recentList.length === 0 ? (
            <div className="py-16 text-center text-sm font-medium text-slate-400">
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-orange-500" aria-hidden="true" />
                {t("ops.collection.loading_view_records")}
              </span>
            </div>
          ) : recentList.length === 0 ? (
            <div className="p-8 text-center text-slate-500">{t("ops.collection.no_collections_for_shop")}</div>
          ) : filteredRecent.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{t("empty.search_no_results")}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] w-full table-fixed divide-y divide-slate-100">
                  <colgroup>
                    {TABLE_COLUMNS.map((column) => (
                      <col key={column.key} className={column.className} />
                    ))}
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-slate-50/75">
                    <tr>
                      <th className="px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Hash size={14} className="shrink-0 text-slate-400" />
                          {t("table.s_no")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText size={14} className="shrink-0 text-emerald-500" />
                          {t("ops.collection.collection_id")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={14} className="shrink-0 text-blue-500" />
                          {t("ops.collection.collection_date")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex w-full items-center justify-end gap-1.5">
                          <IndianRupee size={14} className="shrink-0 text-emerald-600" />
                          {t("table.amount")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CreditCard size={14} className="shrink-0 text-sky-500" />
                          {t("operations.payment_mode")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <User size={14} className="shrink-0 text-violet-500" />
                          {t("ops.collection.collected_by")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Activity size={14} className="shrink-0 text-orange-500" />
                          {t("table.status")}
                        </span>
                      </th>
                      <th className="px-3.5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                          <Settings2 size={14} className="shrink-0 text-slate-400" />
                          {t("table.actions")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pageRows.map((col, index) => {
                      const statusKey = collectionStatusKey(col.status);
                      const translatedStatus = t(statusKey);
                      const statusLabel = translatedStatus === statusKey
                        ? collectionStatusLabel(col.status, t)
                        : translatedStatus;
                      const deleteWindow = getDeleteWindowForStatus(col.collectionDate, col.status);
                      const canDelete = Boolean(col.canDelete) && deleteWindow.canDelete && !col.deleted;
                      const deleteHint = deleteHintFor(col);
                      const isCommitting = pendingDelete.isCommitting(String(col.id));
                      const isCounting = pendingDelete.isPending(String(col.id));
                      return (
                        <tr
                          key={col.id}
                          className={`transition-colors ${
                            isCounting || isCommitting ? "bg-rose-50/40" : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="px-3.5 py-3 text-xs font-semibold tabular-nums text-slate-500">
                            {startIndex + index + 1}
                          </td>
                          <td className="px-3.5 py-3 text-xs font-medium tabular-nums text-slate-700">
                            <span className="block truncate" title={col.collectionNo || "-"}>
                              {col.collectionNo || "-"}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {formatDate(col.collectionDate)}
                          </td>
                          <td className="px-3.5 py-3 text-right text-sm font-bold tabular-nums text-slate-900 whitespace-nowrap">
                            {formatCurrency(Number(col.amount) || 0)}
                          </td>
                          <td className="px-3.5 py-3 text-xs text-slate-600">
                            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                              {localizeTripViewText(col.paymentMode || "Cash", language)}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-xs font-medium text-slate-600">
                            <span className="block truncate" title={col.collector || "-"}>
                              {localizeTripViewText(col.collector || "-", language)}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-xs">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(col.status)}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            {col.deleted ? (
                              // A deleted record keeps its permanent number and
                              // status, and offers nothing left to act on.
                              <span className="text-xs font-semibold text-slate-300">—</span>
                            ) : (
                            <span className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                pendingDelete.requestDelete(String(col.id), {
                                  label: `${t("ops.collection.delete_collection")} · ${
                                    col.collectionNo || formatCurrency(Number(col.amount) || 0)
                                  }`,
                                })
                              }
                              disabled={!canDelete || isCounting || isCommitting}
                              title={deleteHint}
                              aria-label={`${t("ops.collection.delete_collection")} — ${deleteHint}`}
                              className="group inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 shadow-sm transition-all hover:bg-rose-500 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none disabled:hover:bg-slate-50 disabled:hover:text-slate-300"
                            >
                              {isCommitting ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} className={uiActionIconMotionClass.delete} />
                              )}
                            </button>
                            {/* Days left in the window, visible without a
                              * hover — the same figure the hint carries. */}
                            {canDelete && deleteWindow.daysRemaining > 0 && (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                                {t("ops.collection.delete_days_chip", { days: deleteWindow.daysRemaining })}
                              </span>
                            )}
                            </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {shouldShowPagination(filteredRecent.length) && (
                <div className="border-t border-slate-200">
                  <Pagination
                    compact
                    page={page}
                    pageSize={pageSize}
                    totalItems={filteredRecent.length}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                    disabled={busy}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer — Close only, in the Trip List view's button. */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-5 md:px-8 rounded-b-2xl flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95"
          aria-label={t("common.close")}
        >
          <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
            <X size={15} />
          </span>
          {t("common.close")}
        </button>
      </div>

      {/* The delayed-delete pop: 10 seconds to change your mind. */}
      <PendingDeleteNotification
        items={pendingDelete.pendingItems}
        onCancel={(id) => pendingDelete.cancel(id)}
      />
    </AppShellModal>
  );
}

/**
 * The popup owns its language: the toggle inside it flips THIS view only,
 * exactly like the Trip List view's scoped provider.
 */
export function ShopCollectionDetailModal(props: ShopCollectionDetailModalProps) {
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <ShopCollectionDetailView {...props} />
    </ScopedI18nProvider>
  );
}

export default ShopCollectionDetailModal;
