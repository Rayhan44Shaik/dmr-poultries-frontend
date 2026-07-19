import { useState, useEffect } from "react";
import { X, Save, Eye, Calendar, User, CreditCard, Hash, IndianRupee, FileText } from "lucide-react";
import type { Collection } from "../../types/collection";
import { collectionService } from "../../services/collectionService";

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
  onRefresh: () => void;
}

export function EditCollectionModal({
  isOpen,
  onClose,
  shopName,
  mode,
  allCollections,
  onRefresh,
}: EditCollectionModalProps) {
  const shopCollections = allCollections
    .filter((c) => c.shopName === shopName)
    .sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
  const latest = shopCollections.length > 0 ? shopCollections[0] : null;

  const [formData, setFormData] = useState({
    collectionDate: "",
    collectorName: "",
    paymentModeName: "",
    referenceNo: "",
    amount: 0,
    remarks: "",
  });

  useEffect(() => {
    if (latest) {
      setFormData({
        collectionDate: latest.collectionDate,
        collectorName: latest.collectorName,
        paymentModeName: latest.paymentModeName,
        referenceNo: latest.referenceNo || "",
        amount: latest.amount,
        remarks: latest.remarks || "",
      });
    } else {
      setFormData({
        collectionDate: new Date().toISOString().split("T")[0],
        collectorName: "",
        paymentModeName: "Cash",
        referenceNo: "",
        amount: 0,
        remarks: "",
      });
    }
  }, [latest]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!latest) {
      alert("No collection to edit. Please create a new collection.");
      return;
    }
    const updated: Collection = {
      ...latest,
      collectionDate: formData.collectionDate,
      collectorName: formData.collectorName,
      paymentModeName: formData.paymentModeName,
      referenceNo: formData.referenceNo,
      amount: formData.amount,
      remarks: formData.remarks,
    };
    const success = collectionService.updateCollection(updated);
    if (success) {
      onRefresh();
      onClose();
    } else {
      alert("Failed to update. The collection may be older than 10 days.");
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
                  {isView ? "View Collection" : "Edit Collection"}
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
              {/* Latest Collection Details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Latest Collection</h4>
                {renderField({
                  label: "Collection Date",
                  value: formatDate(formData.collectionDate),
                  icon: Calendar,
                })}
                {renderField({
                  label: "Collector",
                  value: formData.collectorName || "-",
                  icon: User,
                })}
                {renderField({
                  label: "Payment Mode",
                  value: formData.paymentModeName,
                  icon: CreditCard,
                })}
                {renderField({
                  label: "Reference No.",
                  value: formData.referenceNo || "-",
                  icon: Hash,
                })}
                {renderField({
                  label: "Amount Received",
                  value: formData.amount,
                  icon: IndianRupee,
                  type: "number",
                })}
                {renderField({
                  label: "Remarks",
                  value: formData.remarks || "-",
                  icon: FileText,
                })}
              </div>

              {/* Recent Collections Table */}
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold text-slate-700">Recent Collections</h4>
                {shopCollections.length === 0 ? (
                  <p className="text-sm text-slate-500">No collections found for this shop.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Collector
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Payment Mode
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {shopCollections.slice(0, 5).map((col) => (
                          <tr key={col.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {formatDate(col.collectionDate)}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-800">
                              {formatCurrency(col.amount)}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {col.collectorName}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {col.paymentModeName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {shopCollections.length > 5 && (
                      <p className="px-3 py-2 text-xs text-slate-400">
                        Showing latest 5 of {shopCollections.length} collections
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
                  label: "Collection Date",
                  value: formData.collectionDate,
                  icon: Calendar,
                  type: "date",
                })}
              </div>
              <div>
                {renderField({
                  label: "Collector",
                  value: formData.collectorName,
                  icon: User,
                  type: "text",
                })}
              </div>
              <div>
                {renderField({
                  label: "Payment Mode",
                  value: formData.paymentModeName,
                  icon: CreditCard,
                  type: "select",
                  options: [
                    { value: "Cash", label: "Cash" },
                    { value: "Bank Transfer", label: "Bank Transfer" },
                    { value: "Cheque", label: "Cheque" },
                  ],
                })}
              </div>
              <div>
                {renderField({
                  label: "Reference No.",
                  value: formData.referenceNo,
                  icon: Hash,
                  type: "text",
                  disabled: formData.paymentModeName === "Cash",
                })}
              </div>
              <div>
                {renderField({
                  label: "Amount Received",
                  value: formData.amount,
                  icon: IndianRupee,
                  type: "number",
                })}
              </div>
              <div className="sm:col-span-2">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <FileText size={14} className="text-slate-400" />
                    Remarks (Optional)
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="Add any notes..."
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
            {isView ? "Close" : "Cancel"}
          </button>
          {!isView && (
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              <Save size={16} />
              Save Changes
            </button>
          )}
          {isView && (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-500"
            >
              <Eye size={16} />
              Read Only
            </button>
          )}
        </div>
      </div>
    </div>
  );
}