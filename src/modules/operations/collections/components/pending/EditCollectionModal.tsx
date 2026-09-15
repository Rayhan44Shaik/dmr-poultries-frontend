import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Save, Eye, Calendar, User, CreditCard, Hash, IndianRupee, FileText, Loader2,
  FileDown, Trash2, Store, Activity, Wallet, ShieldAlert, Clock, UserCog,
} from "lucide-react";
import type { Collection, CollectionApiEntry } from "../../types/collection";
import { collectionService } from "../../services/collectionService";
import { useI18n } from "../../../../../i18n";
import AppShellModal from "../../../../../ui/AppShellModal";
import { localizeTripViewText } from "../../../vehicle-trips/utils/tripViewLocalization";
import { getDeleteWindow } from "../../utils/collectionDeleteWindow";
import { exportCollectionPdf } from "../../utils/exportCollectionPdf";
import { uiActionIconMotionClass } from "../../../../../shared/ui/uiTokens";
import { notify as globalNotify } from "../../../../../ui/notifications/notificationStore";

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
  const shopCollections = allCollections
    .filter((c) => c.shopName === shopName)
    .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
  const latest = shopCollections.length > 0 ? shopCollections[0] : null;
  const selected = collection ?? latest;

  const [formData, setFormData] = useState({
    collectionNo: "",
    collectionDate: "",
    collectorName: "",
    paymentModeName: "",
    referenceNo: "",
    amount: 0,
    remarks: "",
  });

  // Backend-sourced "Recent 10 Shop Credits": newest first, max 10, per shop.
  const [recentList, setRecentList] = useState<CollectionApiEntry[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

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
        detail: {
          collectionNo: formData.collectionNo,
          collectionDate: formData.collectionDate,
          collectorName: formData.collectorName,
          paymentModeName: formData.paymentModeName,
          referenceNo: formData.referenceNo,
          amount: formData.amount,
          remarks: formData.remarks,
          status: selected?.status,
        },
        recent: recentList,
      });
      if (language === "te") globalNotify.info(t("ops.collection.pdf_english_note"));
    } catch {
      globalNotify.error(t("ops.collection.pdf_failed"));
    } finally {
      setPdfBusy(false);
    }
  }, [shopName, formData, recentList, selected, language, t]);

  /* --------------------------------------------------------------------
   * Delete — permitted ONLY within 10 days of the entry date. The window is
   * computed from the collection date; the backend re-checks it and answers
   * 409 outside the window, so this is purely the affordance.
   *
   * Confirming starts a visible countdown instead of deleting straight away,
   * which gives an undo window for a destructive, balance-changing action.
   * ------------------------------------------------------------------ */
  const deleteWindow = getDeleteWindow(formData.collectionDate);
  const canDelete = Boolean(selected) && deleteWindow.canDelete && selected?.status !== "Deleted";

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const countdownRef = useRef<number | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Never leave a timer running behind a closed modal. Only the timer is
  // touched here — the confirm banner is derived from `isOpen` at render time
  // instead of being reset via setState, which would cascade a render.
  useEffect(() => {
    if (!isOpen) clearCountdown();
    return clearCountdown;
  }, [isOpen, clearCountdown]);

  const performDelete = useCallback(async () => {
    if (!selected) return;
    setDeleting(true);
    const ok = await collectionService.deleteCollection(String(selected.id));
    setDeleting(false);
    if (ok) {
      globalNotify.success(t("ops.collection.deleted_success"));
      onRefresh();
      onClose();
    } else {
      globalNotify.error(t("ops.collection.delete_failed"));
    }
  }, [selected, t, onRefresh, onClose]);

  const startDeleteCountdown = useCallback(() => {
    setConfirmingDelete(true);
    setCountdown(5);
    clearCountdown();
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdown();
          setConfirmingDelete(false);
          void performDelete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown, performDelete]);

  const cancelDelete = useCallback(() => {
    clearCountdown();
    setConfirmingDelete(false);
    setCountdown(0);
    globalNotify.info(t("ops.collection.delete_cancelled"));
  }, [clearCountdown, t]);

  const deleteHint = !selected
    ? ""
    : deleteWindow.canDelete
      ? deleteWindow.daysRemaining === 0
        ? t("ops.collection.delete_window_last_day")
        : t("ops.collection.delete_window_open", { days: deleteWindow.daysRemaining })
      : t("ops.collection.delete_window_closed");

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
                    {shopName}
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

                  {/* Delete — enabled only inside the 10-day window. Outside
                    * it the icon is disabled and says why; there is no
                    * override anywhere in the UI. */}
                  <button
                    type="button"
                    onClick={startDeleteCountdown}
                    disabled={!canDelete || confirmingDelete || deleting}
                    aria-label={`${t("ops.collection.delete_collection")} — ${deleteHint}`}
                    className={
                      canDelete && !confirmingDelete && !deleting
                        ? "group relative inline-flex items-center justify-center rounded-xl border border-rose-100 bg-rose-50/70 hover:bg-rose-50/90 p-2 text-rose-500 shadow-sm transition-all active:scale-95"
                        : "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-300 cursor-not-allowed"
                    }
                  >
                    {deleting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <span className={canDelete ? `inline-flex ${uiActionIconMotionClass.delete}` : "inline-flex"}>
                        <Trash2 size={16} />
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
                * The row the user clicked is the reason this modal opened, so
                * it leads: the amount as the hero figure, then the supporting
                * fields on an icon-labelled grid. Everything except numbers
                * follows the active language. */}
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
                        {(() => {
                          const k = "status." + String(selected.status).toLowerCase().replace(/\s+/g, "_");
                          const label = t(k);
                          return label === k ? selected.status : label;
                        })()}
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

                <div className="grid grid-cols-1 gap-5 px-5 py-4 lg:grid-cols-12">
                  {/* Hero amount — numeric, so it stays in Latin digits. */}
                  <div className="lg:col-span-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <IndianRupee size={13} className="text-emerald-600" />
                      {t("operations.amount_received")}
                    </p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700">
                      {formatCurrency(formData.amount)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <Store size={12} className="text-amber-500" />
                      <span className="truncate">{tr(shopName)}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3 lg:col-span-9">
                    {renderField({
                      label: t("ops.collection.collection_no_label"),
                      value: formData.collectionNo || "-",
                      icon: Hash,
                    })}
                    {renderField({
                      label: t("operations.collection_date"),
                      value: formatDate(formData.collectionDate, dateLocale),
                      icon: Calendar,
                    })}
                    {renderField({
                      label: t("common.collector"),
                      value: tr(formData.collectorName) || "-",
                      icon: User,
                    })}
                    {renderField({
                      label: t("operations.payment_mode"),
                      value: tr(formData.paymentModeName),
                      icon: CreditCard,
                    })}
                    {renderField({
                      label: t("operations.reference_no"),
                      value: formData.referenceNo || "-",
                      icon: Hash,
                    })}
                    {renderField({
                      label: t("common.remarks"),
                      value: tr(formData.remarks) || "-",
                      icon: FileText,
                    })}
                  </div>
                </div>
              </div>

              {/* Delete confirmation — inline, with a live countdown so the
                * action can still be called off before it commits. */}
              {confirmingDelete && isOpen && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-rose-700">{t("ops.collection.delete_confirm_title")}</p>
                      <p className="text-xs text-rose-600">{t("ops.collection.delete_confirm_body")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold tabular-nums text-white">
                      <Loader2 size={12} className="animate-spin" />
                      {t("ops.collection.deleting_in", { seconds: countdown })}
                    </span>
                    <button
                      type="button"
                      onClick={cancelDelete}
                      className="rounded-full border border-rose-300 bg-white px-4 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    >
                      {t("ops.collection.undo")}
                    </button>
                  </div>
                </div>
              )}

              {/* Recent 10 Shop Credits — backend-sourced, newest first */}
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <FileText size={15} />
                    </span>
                    {t("ops.collection.recent_10_credits")}
                  </h4>
                  {recentLoading && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 size={12} className="animate-spin" />
                      {t("common.loading")}
                    </span>
                  )}
                </div>
                {recentLoading && recentList.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("ops.collection.loading_recent")}</p>
                ) : recentList.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("ops.collection.no_collections_for_shop")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      {/* Header icons use the same vocabulary as every other
                        * operations table (Trip List, Shop Sales, Recent
                        * Collections) so the columns read identically. */}
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <Hash size={14} className="shrink-0 text-slate-400" />
                              {t("table.s_no")}
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar size={14} className="shrink-0 text-blue-500" />
                              {t("table.date")}
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <FileText size={14} className="shrink-0 text-emerald-500" />
                              {t("table.collection_no")}
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <IndianRupee size={14} className="shrink-0 text-emerald-600" />
                              {t("table.amount")}
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <UserCog size={14} className="shrink-0 text-violet-500" />
                              {t("table.collector")}
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <CreditCard size={14} className="shrink-0 text-sky-500" />
                              {t("operations.payment_mode")}
                            </span>
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span className="inline-flex items-center gap-1.5">
                              <Activity size={14} className="shrink-0 text-orange-500" />
                              {t("table.status")}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {recentList.slice(0, 10).map((col, index) => (
                          <tr
                            key={col.id}
                            className={`transition-colors duration-150 hover:bg-slate-50/80 ${
                              selected && String(selected.id) === String(col.id)
                                ? "bg-blue-50/70 ring-1 ring-inset ring-blue-200"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2.5 text-xs tabular-nums text-slate-400">{index + 1}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">
                              {formatDate(col.collectionDate, dateLocale)}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                              {col.collectionNo || "-"}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs font-bold tabular-nums text-slate-800">
                              {formatCurrency(Number(col.amount) || 0)}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">
                              {tr(col.collector) || "-"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">
                              {tr(col.paymentMode) || "-"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">
                              {(() => {
                                const k = "status." + String(col.status).toLowerCase().replace(/\s+/g, "_");
                                const label = t(k);
                                return label === k ? col.status || "-" : label;
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recentList.length >= 10 && (
                      <p className="px-3 py-2 text-xs text-slate-400">
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
    </AppShellModal>
  );
}