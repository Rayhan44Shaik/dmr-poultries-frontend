import { useState, useEffect } from "react";
import { X, Save, Eye, Calendar, User, CreditCard, Hash, IndianRupee, FileText, Loader2 } from "lucide-react";
import type { Collection, CollectionApiEntry } from "../../types/collection";
import { collectionService } from "../../services/collectionService";
import { useI18n } from "../../../../../i18n";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
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
  const { t } = useI18n();
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
      alert(t("ops.collection.no_collection_to_edit"));
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
      alert(t("ops.collection.failed_update_locked"));
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                {isView ? <Eye size={20} /> : <Save size={20} />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {isView ? t("ops.collection.view_collection") : t("ops.collection.edit_collection")}
                </h3>
                <p className="text-sm text-slate-500">{shopName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {isView ? (
            <>
              {/* Selected Collection Details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">{t("ops.collection.selected_details")}</h4>
                {renderField({
                  label: t("ops.collection.collection_no_label"),
                  value: formData.collectionNo || "-",
                  icon: Hash,
                })}
                {renderField({
                  label: t("operations.collection_date"),
                  value: formatDate(formData.collectionDate),
                  icon: Calendar,
                })}
                {renderField({
                  label: t("common.collector"),
                  value: formData.collectorName || "-",
                  icon: User,
                })}
                {renderField({
                  label: t("operations.payment_mode"),
                  value: formData.paymentModeName,
                  icon: CreditCard,
                })}
                {renderField({
                  label: t("operations.reference_no"),
                  value: formData.referenceNo || "-",
                  icon: Hash,
                })}
                {renderField({
                  label: t("operations.amount_received"),
                  value: formData.amount,
                  icon: IndianRupee,
                  type: "number",
                })}
                {renderField({
                  label: t("common.remarks"),
                  value: formData.remarks || "-",
                  icon: FileText,
                })}
              </div>

              {/* Recent 10 Shop Credits — backend-sourced, newest first */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">
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
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {t("table.date")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {t("table.collection_no")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {t("table.amount")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {t("table.collector")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {t("operations.payment_mode")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            {t("table.status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {recentList.slice(0, 10).map((col) => (
                          <tr key={col.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {formatDate(col.collectionDate)}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-700">
                              {col.collectionNo || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-800">
                              {formatCurrency(Number(col.amount) || 0)}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {col.collector || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {col.paymentMode || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600">
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
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
              <div className="sm:col-span-2">
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {isView ? t("common.close") : t("common.cancel")}
          </button>
          {!isView && (
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              <Save size={16} />
              {t("ops.collection.save_changes")}
            </button>
          )}
          {isView && (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-500"
            >
              <Eye size={16} />
              {t("ops.collection.read_only")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}