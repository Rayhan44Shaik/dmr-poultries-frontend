import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X, Save, Eye, Calendar, User, CreditCard, Hash, IndianRupee, FileText, Loader2,
  FileDown, Trash2, Store, Activity, Wallet, Clock, UserCog, Search, Settings2,
} from "lucide-react";
import type { Collection, CollectionApiEntry } from "../../types/collection";
import { collectionService } from "../../services/collectionService";
import { useI18n } from "../../../../../i18n";
import AppShellModal from "../../../../../ui/AppShellModal";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import { formatTripListDay } from "../../../vehicle-trips/utils/formatTripListDay";
import { getDeleteWindowForStatus } from "../../utils/collectionDeleteWindow";
import { collectionStatusKey, collectionStatusLabel } from "../../utils/collectionStatusLabel";
import { exportCollectionPdf } from "../../utils/exportCollectionPdf";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { notify as globalNotify } from "../../../../../ui/notifications/notificationStore";
import { PendingDeleteNotification } from "../../../../../components/common/PendingDeleteNotification";
import { usePendingDelete } from "../../../../../hooks/usePendingDelete";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string, locale = "en-IN") => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  mode: "view" | "edit";
  allCollections: Collection[];
  /** The specific collection this modal was opened for (view/edit target). */
  collection?: Collection | null;
  onRefresh: () => void;
}

export function EditCollectionModal({
  isOpen,
  onClose,
  shopName,
  mode,
  allCollections,
  collection,
  onRefresh,
}: EditCollectionModalProps) {
  const { t, language } = useI18n();
  // Telugu view: dates render with Telugu month/weekday names, but every
  // NUMERIC value (amounts, counts, reference numbers) stays in Latin digits
  // so the figures remain unambiguous, exactly as the Trip view does it.
  const dateLocale = language === "te" ? "te-IN" : "en-IN";
  const tr = useCallback(
    (value: string | null | undefined) => localizeTripViewText(value, language, { cleanShopCode: true }),
    [language],
  );

  // Backend-sourced "Recent 10 Shop Credits": newest first, max 10, per shop,
  // across every status (including deleted history).
  const [recentList, setRecentList] = useState<CollectionApiEntry[]>([]);
  /** Free-text filter over this shop's credits. */
  const [creditSearch, setCreditSearch] = useState("");
  const [recentLoading, setRecentLoading] = useState(false);

  const shopCollections = allCollections
    .filter((c) => c.shopName === shopName)
    .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
  const latest = shopCollections.length > 0 ? shopCollections[0] : null;
  /**
   * Which entry the detail block is showing.
   *
   * Defaults to the collection the modal was opened for (falling back to the
   * shop's latest), but picking a row in the credits table below overrides it
   * — so the user can step through a shop's history one entry at a time and
   * watch the detail above follow, without closing and reopening the modal.
   */
  const openKey = `${isOpen ? "1" : "0"}:${shopName}:${collection?.id ?? ""}`;
  const [pick, setPick] = useState<{ key: string; id: string } | null>(null);
  // Tying the pick to the open context means a reopen — or opening on a
  // different row — discards it automatically, with no reset effect.
  const pickedId = pick && pick.key === openKey ? pick.id : null;
  const setPickedId = (id: string) => setPick({ key: openKey, id });
  const pickedCached =
    pickedId == null ? null : shopCollections.find((c) => String(c.id) === pickedId) ?? null;
  const pickedApi =
    pickedId == null ? null : recentList.find((c) => String(c.id) === pickedId) ?? null;
  // Deleted records are deliberately absent from allCollections, so map a
  // picked recent API row into the shared detail shape. Memoizing keeps the
  // selected object stable and prevents the form-sync effect from re-running
  // when unrelated modal state changes.
  const pickedFromRecent = useMemo<Collection | null>(() => {
    if (!pickedApi) return null;
    return {
      id: String(pickedApi.id),
      collectionNo: pickedApi.collectionNo,
      collectionDate: pickedApi.collectionDate,
      shopName: pickedApi.shopName,
      collectorName: pickedApi.collector,
      paymentModeName: pickedApi.paymentMode,
      referenceNo: pickedApi.referenceNo,
      amount: Number(pickedApi.amount),
      remarks: pickedApi.remarks,
      status:
        pickedApi.deleted || pickedApi.status === "Deleted"
          ? "Deleted"
          : pickedApi.status === "Approved"
            ? "Approved"
            : "Pending",
      createdDate: pickedApi.createdAt ?? pickedApi.collectionDate,
      createdBy: pickedApi.createdBy,
      approvedDate: pickedApi.approvedAt ?? undefined,
      approvedBy: pickedApi.approvedBy ?? undefined,
      numericId: pickedApi.id,
      numericShopId: pickedApi.shopId,
    };
  }, [pickedApi]);
  const selected = pickedFromRecent ?? pickedCached ?? collection ?? latest;

  const [formData, setFormData] = useState({
    collectionNo: "",
    collectionDate: "",
    collectorName: "",
    paymentModeName: "",
    referenceNo: "",
    amount: 0,
    remarks: "",
  });

  useEffect(() => {
    let cancelled = false;
    const shopId = collectionService.getShopIdForName(shopName);
    if (!isOpen || !shopId) {
      if (!isOpen) setRecentList([]);
      return;
    }
    setRecentLoading(true);
    collectionService
      .fetchRecentCollectionsForShop(shopId, 10)
      .then((rows) => {
        if (!cancelled) setRecentList(rows);
      })
      .catch(() => {
        // Fall back to the page-level cache so the modal never goes empty.
        if (!cancelled) setRecentList([]);
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, shopName]);

  useEffect(() => {
    if (selected) {
      setFormData({
        collectionNo: selected.collectionNo || "",
        collectionDate: selected.collectionDate,
        collectorName: selected.collectorName,
        paymentModeName: selected.paymentModeName,
        referenceNo: selected.referenceNo || "",
        amount: selected.amount,
        remarks: selected.remarks || "",
      });
    } else {
      setFormData({
        collectionNo: "",
        collectionDate: new Date().toISOString().split("T")[0],
        collectorName: "",
        paymentModeName: "Cash",
        referenceNo: "",
        amount: 0,
        remarks: "",
      });
    }
  }, [selected]);

  /**
   * Credits filtered by the search box. Matches the raw English value AND its
   * Telugu rendering, so a user reading in either language finds the row.
   */
  const filteredCredits = useMemo(() => recentList.filter((col) => {
    const q = creditSearch.trim().toLowerCase();
    if (!q) return true;
    const squashed = q.replace(/\s+/g, "");
    const statusKey = collectionStatusKey(col.status);
    const statusLabel = t(statusKey);
    const candidates = [
      col.collectionNo,
      col.collectionDate,
      formatDate(col.collectionDate, dateLocale),
      String(col.amount ?? ""),
      col.collector,
      col.paymentMode,
      col.referenceNo,
      col.status,
      statusLabel === statusKey ? "" : statusLabel,
      tr(col.collector),
      tr(col.paymentMode),
    ];
    return candidates.some((value) => {
      const text = String(value ?? "").toLowerCase();
      return text.includes(q) || text.replace(/\s+/g, "").includes(squashed);
    });
  }), [recentList, creditSearch, t, dateLocale, language, tr]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!selected) {
      // Was a blocking window.alert: it froze the modal, could not be
      // dismissed with Escape, and bypassed the shared toast vocabulary.
      globalNotify.warning(t("ops.collection.no_collection_to_edit"));
      return;
    }
    const updated: Collection = {
      ...selected,
      collectionDate: formData.collectionDate,
      collectorName: formData.collectorName,
      paymentModeName: formData.paymentModeName,
      referenceNo: formData.referenceNo,
      amount: formData.amount,
      remarks: formData.remarks,
    };
    const success = await collectionService.updateCollection(updated);
    if (success) {
      onRefresh();
      onClose();
    } else {
      globalNotify.error(t("ops.collection.failed_update_locked"));
    }
  };

  /* --------------------------------------------------------------------
   * PDF export — A4 portrait on the shared DMR letterhead.
   * ------------------------------------------------------------------ */
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    setPdfBusy(true);
    try {
      await exportCollectionPdf({
        shopName,
        // Exactly the rows the view table shows, so the PDF and the screen
        // can never disagree — including when the search box is filtering.
        recent: filteredCredits.slice(0, 10),
      });
      if (language === "te") globalNotify.info(t("ops.collection.pdf_english_note"));
    } catch {
      globalNotify.error(t("ops.collection.pdf_failed"));
    } finally {
      setPdfBusy(false);
    }
  }, [shopName, filteredCredits, language, t]);

  /* --------------------------------------------------------------------
   * Delete — permitted ONLY within 10 days of the entry date. The window is
   * computed from the collection date; the backend re-checks it and answers
   * 409 outside the window, so this is purely the affordance.
   *
   * Confirming starts a visible countdown instead of deleting straight away,
   * which gives an undo window for a destructive, balance-changing action.
   * ------------------------------------------------------------------ */
  const deleteWindow = getDeleteWindowForStatus(
    selected?.collectionDate ?? formData.collectionDate,
    selected?.status,
  );
  const isPendingEntry = String(selected?.status ?? "").toLowerCase().startsWith("pending");
  const canDelete = Boolean(selected) && deleteWindow.canDelete && selected?.status !== "Deleted";

  /**
   * Deletion goes through the shared delayed-delete UX — the same compact pop
   * the Trip List shows: a 10-second countdown with a Cancel button, and the
   * delete only commits when the timer runs out.
   */
  const performDelete = useCallback(
    async (id: string) => {
      const ok = await collectionService.deleteCollection(id);
      if (ok) {
        globalNotify.success(t("ops.collection.deleted_success"));
        onRefresh();
        onClose();
      } else {
        globalNotify.error(t("ops.collection.delete_failed"));
      }
    },
    [t, onRefresh, onClose],
  );

  const pendingDelete = usePendingDelete<string>(performDelete);

  const deleteHint = !selected
    ? ""
    : !deleteWindow.canDelete
      ? isPendingEntry
        ? t("ops.collection.delete_today_only")
        : t("ops.collection.delete_window_closed")
      : isPendingEntry
        ? t("ops.collection.delete_window_today")
        : deleteWindow.daysRemaining === 0
          ? t("ops.collection.delete_window_last_day")
          : t("ops.collection.delete_window_open", { days: deleteWindow.daysRemaining });

  if (!isOpen) return null;

  const isView = mode === "view";

  const renderField = ({
    label,
    value,
    icon: Icon,
    type = "text",
    disabled = false,
    options,
  }: {
    label: string;
    value: any;
    icon: any;
    type?: "text" | "date" | "number" | "select";
    disabled?: boolean;
    options?: { value: string; label: string }[];
  }) => {
    const commonClass =
      "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

    if (isView) {
      return (
        <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Icon size={16} className="text-slate-400" />
            <span>{label}</span>
          </div>
          <div className="text-sm font-medium text-slate-800">
            {type === "number" ? formatCurrency(value) : value || "-"}
          </div>
        </div>
      );
    }

    if (type === "select") {
      return (
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Icon size={14} className="text-slate-400" />
            {label}
          </label>
          <select
            value={value}
            onChange={(e) => handleChange(label.toLowerCase().replace(/\s/g, ""), e.target.value)}
            disabled={disabled}
            className={commonClass}
          >
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <Icon size={14} className="text-slate-400" />
          {label}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) =>
            handleChange(
              label.toLowerCase().replace(/\s/g, ""),
              type === "number" ? parseFloat(e.target.value) || 0 : e.target.value
            )
          }
          disabled={disabled}
          className={commonClass}
          placeholder={type === "number" ? "0.00" : ""}
        />
      </div>
    );
  };

  return (
    // Same shell as the Trip List view: one global panel size
    // (max-w 96rem, max-h 100vh − header − gaps), centred against the whole
    // page including the sidebar, with no backdrop blur.
    <AppShellModal open={isOpen} onClose={onClose} panelClassName="bg-white">
      <div className="bg-white w-full h-full overflow-hidden flex flex-col rounded-2xl">
        {/* Header — matches the Trip view: gradient strip, gradient icon tile,
          * title + status line, circular close button. */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 rounded-t-2xl">
          <div className="px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1 sm:flex-none">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-400/20 text-white shrink-0">
                {isView ? <Eye className="w-6 h-6" /> : <Save className="w-6 h-6" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                  {isView ? t("ops.collection.view_collection") : t("ops.collection.edit_collection")}
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    {tr(shopName)}
                  </span>
                  {isView && (
                    <span className="text-xs font-medium text-slate-400">{t("ops.collection.read_only")}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 w-full sm:w-auto">
              {isView && (
                <>
                  {/* Download PDF — same red PDF affordance and hover
                    * animation the Trip List view uses. */}
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf()}
                    disabled={pdfBusy}
                    aria-label={t("ops.collection.download_pdf")}
                    className="group relative inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50/70 hover:bg-red-50/80 p-2 text-red-500 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    {pdfBusy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}>
                        <FileDown size={16} />
                      </span>
                    )}
                  </button>

                </>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close")}
                className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
              >
                <X size={18} className={uiActionIconMotionClass.close} />
              </button>
            </div>
          </div>
        </div>

        {/* Body — scrolls inside the panel, which is what makes the modal the
          * same height regardless of content, exactly like the Trip view. */}
        <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto flex-1">
          {isView ? (
            <>
              {/* ── Selected entry, shown first ───────────────────────────
                * The row the user clicked is the reason this modal opened.
                * Every field gets an equally readable, colour-coded card;
                * numbers remain in Latin digits in both languages. */}
              <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100/70 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Wallet size={15} />
                    </span>
                    <h4 className="text-sm font-bold text-slate-700">{t("ops.collection.selected_entry")}</h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected?.status && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        <Activity size={12} className="text-orange-500" />
                        {collectionStatusLabel(selected.status, t)}
                      </span>
                    )}
                    {/* The delete clock, stated plainly rather than hidden in a tooltip. */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        deleteWindow.canDelete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <Clock size={12} />
                      {deleteHint}
                    </span>
                  </div>
                </div>

                {/* Every selected-entry field is a self-contained, colour-coded
                  * box. The uniform grid makes the value scan one field at a
                  * time without the old amount/metadata spacing imbalance. */}
                <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      key: "amount",
                      label: t("operations.amount_received"),
                      value: formatCurrency(formData.amount),
                      icon: IndianRupee,
                      surface: "border-emerald-200 bg-emerald-50/65",
                      iconClass: "bg-emerald-100 text-emerald-700 ring-emerald-200",
                      valueClass: "text-lg text-emerald-800 tabular-nums",
                    },
                    {
                      key: "collection",
                      label: t("ops.collection.collection_no_label"),
                      value: formData.collectionNo || "-",
                      icon: FileText,
                      surface: "border-teal-200 bg-teal-50/60",
                      iconClass: "bg-teal-100 text-teal-700 ring-teal-200",
                      valueClass: "text-slate-800",
                    },
                    {
                      key: "day",
                      label: t("common.day"),
                      value: formatTripListDay(formData.collectionDate, language),
                      icon: Calendar,
                      surface: "border-blue-200 bg-blue-50/60",
                      iconClass: "bg-blue-100 text-blue-700 ring-blue-200",
                      valueClass: "text-slate-800 tabular-nums",
                    },
                    {
                      key: "shop",
                      label: t("table.shop"),
                      value: tr(shopName) || "-",
                      icon: Store,
                      surface: "border-amber-200 bg-amber-50/60",
                      iconClass: "bg-amber-100 text-amber-700 ring-amber-200",
                      valueClass: "text-slate-800",
                    },
                    {
                      key: "collector",
                      label: t("common.collector"),
                      value: tr(formData.collectorName) || "-",
                      icon: UserCog,
                      surface: "border-violet-200 bg-violet-50/60",
                      iconClass: "bg-violet-100 text-violet-700 ring-violet-200",
                      valueClass: "text-slate-800",
                    },
                    {
                      key: "payment",
                      label: t("operations.payment_mode"),
                      value: tr(formData.paymentModeName) || "-",
                      icon: CreditCard,
                      surface: "border-sky-200 bg-sky-50/60",
                      iconClass: "bg-sky-100 text-sky-700 ring-sky-200",
                      valueClass: "text-slate-800",
                    },
                    {
                      key: "reference",
                      label: t("operations.reference_no"),
                      value: formData.referenceNo || "-",
                      icon: Hash,
                      surface: "border-indigo-200 bg-indigo-50/60",
                      iconClass: "bg-indigo-100 text-indigo-700 ring-indigo-200",
                      valueClass: "text-slate-800 tabular-nums",
                    },
                    {
                      key: "remarks",
                      label: t("common.remarks"),
                      value: tr(formData.remarks) || "-",
                      icon: FileText,
                      surface: "border-slate-200 bg-slate-50/80",
                      iconClass: "bg-white text-slate-600 ring-slate-200",
                      valueClass: "text-slate-800",
                    },
                  ].map(({ key, label, value, icon: Icon, surface, iconClass, valueClass }) => (
                    <div
                      key={key}
                      className={`flex min-h-[76px] min-w-0 items-start gap-2.5 rounded-xl border p-3 shadow-sm ${surface}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${iconClass}`}>
                        <Icon size={16} strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500">
                          {label}
                        </p>
                        <p className={`mt-0.5 break-words text-[13px] font-bold leading-snug ${valueClass}`}>
                          {value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent 10 Shop Credits — backend-sourced, newest first */}
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                {/* Header sits flush on the table: one surface, one border. */}
                <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-800">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <FileText size={15} />
                    </span>
                    {t("ops.collection.recent_10_credits")}
                    <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 sm:inline">
                      {t("ops.collection.click_row_to_view")}
                    </span>
                  </h4>
                  <div className="flex items-center gap-2">
                    {recentLoading && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Loader2 size={12} className="animate-spin" />
                        {t("common.loading")}
                      </span>
                    )}
                    {/* Search this shop's credits, so a specific entry can be
                      * found and selected without leaving the view. */}
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={creditSearch}
                        onChange={(e) => setCreditSearch(e.target.value)}
                        placeholder={t("ops.collection.search_collections_placeholder")}
                        className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 sm:w-64"
                      />
                      {creditSearch && (
                        <button
                          type="button"
                          onClick={() => setCreditSearch("")}
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
                  <p className="px-4 py-6 text-sm text-slate-500">{t("ops.collection.loading_recent")}</p>
                ) : recentList.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">{t("ops.collection.no_collections_for_shop")}</p>
                ) : filteredCredits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    {t("empty.search_no_results")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Same leading order as Recent Collections: S.No,
                      * Collection No, Day. Amount and Collector share one
                      * equal width and one tighter padding step, so the two
                      * columns read as evenly spaced neighbours. */}
                    <table className="min-w-[1060px] w-full table-fixed divide-y divide-slate-200">
                      <colgroup>
                        <col className="w-[6%]" />
                        <col className="w-[17%]" />
                        <col className="w-[16%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                        <col className="w-[13%]" />
                        <col className="w-[11%]" />
                        <col className="w-[9%]" />
                      </colgroup>
                      {/* Header icons use the same vocabulary as every other
                        * operations table (Trip List, Shop Sales, Recent
                        * Collections) so the columns read identically. */}
                      <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <Hash size={14} className="shrink-0 text-slate-400" />
                              {t("table.s_no")}
                            </span>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <FileText size={14} className="shrink-0 text-emerald-500" />
                              {t("table.collection_no")}
                            </span>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar size={14} className="shrink-0 text-blue-500" />
                              {t("common.day")}
                            </span>
                          </th>
                          <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex w-full items-center justify-end gap-1.5">
                              <IndianRupee size={14} className="shrink-0 text-emerald-600" />
                              {t("table.amount")}
                            </span>
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <UserCog size={14} className="shrink-0 text-violet-500" />
                              {t("table.collector")}
                            </span>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <CreditCard size={14} className="shrink-0 text-sky-500" />
                              {t("operations.payment_mode")}
                            </span>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <Activity size={14} className="shrink-0 text-orange-500" />
                              {t("table.status")}
                            </span>
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <Settings2 size={14} className="shrink-0 text-slate-400" />
                              {t("table.actions")}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredCredits.slice(0, 10).map((col, index) => {
                          const isRowSelected = selected != null && String(selected.id) === String(col.id);
                          return (
                          <tr
                            key={col.id}
                            tabIndex={0}
                            role="button"
                            aria-selected={isRowSelected}
                            onClick={() => setPickedId(String(col.id))}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setPickedId(String(col.id));
                              }
                            }}
                            className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                              isRowSelected
                                ? "bg-blue-50/70 ring-1 ring-inset ring-blue-200"
                                : "hover:bg-slate-50/80"
                            }`}
                          >
                            <td className="px-4 py-3 text-xs font-semibold tabular-nums text-slate-500">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-700">
                              {col.collectionNo || "-"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                              {formatTripListDay(col.collectionDate, language)}
                            </td>
                            <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-800 whitespace-nowrap">
                              {formatCurrency(Number(col.amount) || 0)}
                            </td>
                            <td className="px-3 py-3 text-xs font-medium text-slate-600 truncate">
                              {tr(col.collector) || "-"}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {tr(col.paymentMode) || "-"}
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-slate-600">
                              {collectionStatusLabel(col.status, t) || "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isRowSelected && canDelete ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    pendingDelete.requestDelete(String(col.id), {
                                      label: `${t("ops.collection.delete_collection")} · ${
                                        col.collectionNo || formatCurrency(Number(col.amount) || 0)
                                      }`,
                                    });
                                  }}
                                  disabled={
                                    pendingDelete.isPending(String(col.id)) ||
                                    pendingDelete.isCommitting(String(col.id))
                                  }
                                  aria-label={`${t("ops.collection.delete_collection")} — ${deleteHint}`}
                                  className="group inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 shadow-sm transition-all hover:bg-rose-500 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {pendingDelete.isCommitting(String(col.id)) ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={14} className={uiActionIconMotionClass.delete} />
                                  )}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredCredits.length >= 10 && (
                      <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-400">
                        {t("ops.collection.showing_latest_10", { count: recentList.length })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            // Edit mode – unchanged
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-3">
                {renderField({
                  label: t("operations.collection_date"),
                  value: formData.collectionDate,
                  icon: Calendar,
                  type: "date",
                })}
              </div>
              <div>
                {renderField({
                  label: t("common.collector"),
                  value: formData.collectorName,
                  icon: User,
                  type: "text",
                })}
              </div>
              <div>
                {renderField({
                  label: t("operations.payment_mode"),
                  value: formData.paymentModeName,
                  icon: CreditCard,
                  type: "select",
                  options: [
                    { value: "Cash", label: t("accounts.cash") },
                    { value: "Bank Transfer", label: t("accounts.bank_transfer") },
                    { value: "Cheque", label: t("accounts.cheque") },
                  ],
                })}
              </div>
              <div>
                {renderField({
                  label: t("operations.reference_no"),
                  value: formData.referenceNo,
                  icon: Hash,
                  type: "text",
                  disabled: formData.paymentModeName === "Cash",
                })}
              </div>
              <div>
                {renderField({
                  label: t("operations.amount_received"),
                  value: formData.amount,
                  icon: IndianRupee,
                  type: "number",
                })}
              </div>
              <div className="sm:col-span-2 xl:col-span-3">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <FileText size={14} className="text-slate-400" />
                    {t("ops.collection.remarks_optional")}
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder={t("ops.collection.add_notes")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — same gradient bar and pill buttons as the Trip view. */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95"
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
              <X size={15} />
            </span>
            {isView ? t("common.close") : t("common.cancel")}
          </button>
          {!isView && (
            <button
              type="button"
              onClick={handleSave}
              className="group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all active:scale-95"
            >
              <span className="inline-flex transition-transform duration-200 group-hover:-translate-y-0.5">
                <Save size={15} />
              </span>
              {t("ops.collection.save_changes")}
            </button>
          )}
        </div>
      </div>

      {/* The delayed-delete pop: 10 seconds to change your mind. */}
      <PendingDeleteNotification
        items={pendingDelete.pendingItems}
        onCancel={(id) => pendingDelete.cancel(id)}
      />
    </AppShellModal>
  );
}