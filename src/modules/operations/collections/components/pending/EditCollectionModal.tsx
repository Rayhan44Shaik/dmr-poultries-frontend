import { useState, useEffect } from "react";
import { X, Save, Eye } from "lucide-react";
import type { Collection } from "../../types/collection";
import { collectionService } from "../../services/collectionService";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {mode === "edit" ? "Edit Collection" : "View Collection"} – {shopName}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Collection Date
            </label>
            <input
              type="date"
              value={formData.collectionDate}
              onChange={(e) => handleChange("collectionDate", e.target.value)}
              disabled={mode === "view"}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Collector
            </label>
            <input
              type="text"
              value={formData.collectorName}
              onChange={(e) => handleChange("collectorName", e.target.value)}
              disabled={mode === "view"}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Payment Mode
            </label>
            <select
              value={formData.paymentModeName}
              onChange={(e) => handleChange("paymentModeName", e.target.value)}
              disabled={mode === "view"}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reference No.
            </label>
            <input
              type="text"
              value={formData.referenceNo}
              onChange={(e) => handleChange("referenceNo", e.target.value)}
              disabled={mode === "view" || formData.paymentModeName === "Cash"}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Amount Received
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => handleChange("amount", parseFloat(e.target.value) || 0)}
              disabled={mode === "view"}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Remarks (Optional)
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              disabled={mode === "view"}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          {mode === "edit" && (
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save size={16} />
              Save Changes
            </button>
          )}
          {mode === "view" && (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
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