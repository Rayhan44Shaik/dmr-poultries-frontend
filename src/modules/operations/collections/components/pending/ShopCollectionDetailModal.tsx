// src/modules/operations/collections/components/pending/ShopCollectionDetailModal.tsx
//
// The shop view for Pending Collections.
//
// Same shell, animation and size as the Trip List view: AppShellModal — the
// global view panel (fade-in overlay, scale-in panel, 96rem cap, 100vh-minus-
// header height) — so a shop opens exactly like a trip does.
//
// It reads the shop's WHOLE collection history (not the latest ten) through the
// dedicated recent endpoint, and pages it with the global Pagination, so every
// record the backend returns is reachable from here.

import { useEffect, useState } from "react";
import {
  X, Eye, IndianRupee, Calendar, User, CreditCard, Hash, FileText, Trash2, Loader2,
  RotateCcw, Save,
} from "lucide-react";
import type { Collection, CollectionApiEntry } from "../../types/collection";
import type { Shop } from "../../../../masters/shops/types/shop";
import { collectionService } from "../../services/collectionService";
import { useSafeNotification } from "../../../../../hooks/useSafeNotification";
import { opsSecondaryButtonClass, opsPrimaryButtonClass } from "../../../../../shared/ui/operationsStyles";
import { shouldShowPagination } from "../../../../../shared/ui/paginationStyles";
import { Pagination } from "../../../../../ui";
import AppShellModal from "../../../../../ui/AppShellModal";
import { useI18n } from "../../../../../i18n";
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

export function ShopCollectionDetailModal({
  isOpen,
  onClose,
  shopName,
  allCollections,
  shops,
  onRefresh,
}: ShopCollectionDetailModalProps) {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  // Names are transliterated for display only; stored values drive every lookup.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);

  const shopCollections = allCollections
    .filter((c) => c.shopName === shopName)
    .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));

  const [recentList, setRecentList] = useState<CollectionApiEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
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
  }, [isOpen, shopName]);

  // Every open starts on page 1 with no staged deletes.
  useEffect(() => {
    if (isOpen) {
      setPage(1);
    } else {
      setDeletingIds(new Set());
      setDeleting(new Set());
      setPage(1);
    }
  }, [isOpen, shopName]);

  const handleStageDelete = (collection: CollectionApiEntry) => {
    if (!collection.canDelete) {
      showNotification(t("ops.collection.cannot_delete_window"), "error");
      return;
    }
    setDeletingIds((prev) => {
      const next = new Set(prev);
      if (next.has(collection.id)) {
        next.delete(collection.id);
      } else {
        next.add(collection.id);
      }
      return next;
    });
  };

  const handleSaveAndClose = async () => {
    if (deletingIds.size === 0) {
      onClose();
      return;
    }

    setDeleting(new Set(deletingIds));
    let hasError = false;

    for (const id of deletingIds) {
      try {
        const result = await collectionService.deletePendingCollection(String(id));
        if (!result.success) {
          showNotification(result.message ?? t("ops.collection.failed_delete_collection", { id }), "error");
          hasError = true;
        }
      } catch {
        showNotification(t("ops.collection.failed_delete_collection", { id }), "error");
        hasError = true;
      }
    }

    if (!hasError && deletingIds.size > 0) {
      showNotification(t("ops.collection.deleted_count_success", { count: deletingIds.size }), "success");
      await onRefresh();
    }

    setDeletingIds(new Set());
    setDeleting(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const totalCollections = shopCollections.reduce((sum, c) => sum + c.amount, 0);
  const currentOutstanding = collectionService.getShopBalance(shopName);
  const lastCollectionDate = shopCollections.length > 0 ? shopCollections[0].collectionDate : null;

  const startIndex = (page - 1) * pageSize;
  const pageRows = recentList.slice(startIndex, startIndex + pageSize);
  const busy = recentLoading || deleting.size > 0;

  return (
    <AppShellModal open={isOpen} onClose={onClose} ariaLabelledBy="shop-collection-view-title">
      {/* Header — the trips view header shape, in this page's tone. */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 bg-gradient-to-r from-orange-50/60 via-white to-orange-50/40 flex-shrink-0">
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
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 shrink-0"
          aria-label={t("common.close")}
          disabled={deleting.size > 0}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body — the panel scrolls, the header and footer stay put. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {/* Shop Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-red-600 mb-1">
              <IndianRupee size={14} />
              {t("ops.collection.current_outstanding")}
            </div>
            <div className="text-lg font-bold text-red-700">{formatCurrency(currentOutstanding)}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-green-600 mb-1">
              <CreditCard size={14} />
              {t("ops.collection.total_collections")}
            </div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totalCollections)}</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-600 mb-1">
              <Calendar size={14} />
              {t("ops.collection.last_collection")}
            </div>
            <div className="text-lg font-bold text-blue-700">{formatDate(lastCollectionDate)}</div>
          </div>
        </div>

        {/* All collection transactions for this shop */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText size={14} className="text-slate-500" />
              {t("ops.collection.all_transactions")}
            </h4>
            <span className="text-xs text-slate-500">
              {recentList.length} {recentList.length === 1 ? t("common.entry") : t("common.entries")}
            </span>
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
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{t("ops.collection.collection_id")}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{t("table.date")}</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">{t("table.amount")}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{t("table.mode")}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{t("table.status")}</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">{t("table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pageRows.map((col) => {
                      const isStaged = deletingIds.has(col.id);
                      const isDeleting = deleting.has(col.id);
                      const statusKey = collectionStatusKey(col.status);
                      const translatedStatus = t(statusKey);
                      const statusLabel = translatedStatus === statusKey
                        ? collectionStatusLabel(col.status, t)
                        : translatedStatus;
                      const canStage = col.canDelete && col.status === "Approved" && !col.deleted;
                      return (
                        <tr
                          key={col.id}
                          className={`${isStaged ? "bg-red-50/50 line-through text-slate-400" : "hover:bg-slate-50/50"} transition-colors`}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">{col.collectionNo || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(col.collectionDate)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{formatCurrency(Number(col.amount) || 0)}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                              {col.paymentMode || "Cash"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(col.status)}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isStaged ? (
                              <button
                                onClick={() => handleStageDelete(col)}
                                disabled={isDeleting}
                                title={t("ops.collection.undo_delete")}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-green-600 hover:bg-green-50 transition disabled:opacity-50"
                              >
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStageDelete(col)}
                                disabled={isDeleting || !canStage}
                                title={!canStage ? t("ops.collection.cannot_delete_7day") : t("ops.collection.stage_delete")}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isDeleting ? (
                                  <Loader2 size={16} className="animate-spin text-slate-400" />
                                ) : (
                                  <Trash2 size={16} className="text-red-500" />
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {shouldShowPagination(recentList.length) && (
                <div className="border-t border-slate-200">
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    totalItems={recentList.length}
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

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 bg-slate-50/50 flex-shrink-0">
        <button
          onClick={onClose}
          disabled={deleting.size > 0}
          className={opsSecondaryButtonClass}
        >
          <X size={16} className="mr-1" />
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSaveAndClose}
          disabled={deleting.size > 0}
          className={`${opsPrimaryButtonClass} ${deletingIds.size > 0 ? "" : "opacity-60 cursor-not-allowed"}`}
        >
          {deleting.size > 0 ? (
            <>
              <Loader2 size={16} className="animate-spin mr-1" />
              {t("common.saving")}
            </>
          ) : deletingIds.size > 0 ? (
            <>
              <Save size={16} className="mr-1" />
              {t("ops.collection.save_and_close", { count: deletingIds.size })}
            </>
          ) : (
            <>
              <X size={16} className="mr-1" />
              {t("common.close")}
            </>
          )}
        </button>
      </div>
    </AppShellModal>
  );
}
