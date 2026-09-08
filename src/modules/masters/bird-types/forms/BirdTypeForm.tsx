import { useEffect, useState } from "react";
import type { BirdType } from "../types/birdType";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import {
  Bird,
  Weight,
  FileText,
} from "lucide-react";

type BirdTypeFormProps = {
  birdType?: BirdType | null;
  onSave: (birdType: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function BirdTypeForm({ birdType, onSave, onCancel, isSaving = false }: BirdTypeFormProps) {
  const { showNotification } = useSafeNotification();
  const [birdTypeName, setBirdTypeName] = useState("");
  const [averageWeight, setAverageWeight] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const isEditing = !!birdType;

  useEffect(() => {
    if (birdType) {
      setBirdTypeName(birdType.birdType);
      setAverageWeight(birdType.averageWeight);
      setDescription(birdType.description ?? "");
      setStatus(birdType.status);
    } else {
      setBirdTypeName("");
      setAverageWeight("");
      setDescription("");
      setStatus("Active");
    }
  }, [birdType]);

  const handleSubmit = () => {
    if (isSaving) return;

    if (!birdTypeName || averageWeight === "" || averageWeight <= 0) {
      showNotification("Please fill all required fields with valid values.", "error");
      return;
    }

    onSave({
      birdType: birdTypeName,
      averageWeight: Number(averageWeight),
      description,
      status,
    });
  };

  // Form-local design shared with the Vehicle master form: compact 40px
  // fields, slate border, soft background, emerald focus ring.
  const inputClass = () =>
    "w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const fieldLabel = (text: string, required = false) => (
    <label className="block mb-1.5 text-xs font-semibold text-slate-600">
      {text}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </h3>
      <div className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
    </div>
  );

  const title = isEditing ? "Edit Bird Type" : "Add Bird Type";
  const subtitle = isEditing ? "Update details" : "Fill in the details";

  const toggleStatus = () => {
    if (!isSaving) {
      setStatus(status === "Active" ? "Inactive" : "Active");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200">
      {/* Header — rounded on its own corners: the card must not clip
          (overflow-hidden), keeping dropdown/popup overflow scrollable. */}
      <div className="rounded-t-2xl px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/70 via-white to-white">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
            <Bird size={22} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={isSaving}
            aria-label={`Status: ${status}. Toggle status.`}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status === "Active" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold ${
              status === "Active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-8 space-y-7">
        <section className="space-y-3">
          {sectionHeading("Bird Type Details")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              {fieldLabel("Bird Type", true)}
              <div className="relative">
                <Bird className={iconWrapperClass} size={16} />
                <input
                  value={birdTypeName}
                  onChange={(e) => setBirdTypeName(e.target.value)}
                  placeholder="e.g., Broiler, Layer"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Average Weight (kg)", true)}
              <div className="relative">
                <Weight className={iconWrapperClass} size={16} />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={averageWeight}
                  onChange={(e) => setAverageWeight(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g., 1.5"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative sm:col-span-2">
              {fieldLabel("Description")}
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                  rows={2}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-y"
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-5 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm hover:shadow font-semibold text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSaving && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSaving ? "Saving..." : isEditing ? "Update Bird Type" : "Save Bird Type"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BirdTypeForm;
