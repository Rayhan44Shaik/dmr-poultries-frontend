import { useEffect, useState } from "react";
import { Landmark, MapPin, Hash, AtSign, CreditCard } from "lucide-react";
import type { Bank } from "../types/bank";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

type BankFormProps = {
  bank?: Bank | null;
  onSave: (bank: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function BankForm({ bank, onSave, onCancel, isSaving = false }: BankFormProps) {
  const { showNotification } = useSafeNotification();
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  useEffect(() => {
    if (bank) {
      setBankName(bank.bankName);
      setBranch(bank.branch);
      setAccountNumber(bank.accountNumber);
      setIfscCode(bank.ifscCode);
      setUpiId(bank.upiId ?? "");
      setStatus(bank.status);
    } else {
      setBankName("");
      setBranch("");
      setAccountNumber("");
      setIfscCode("");
      setUpiId("");
      setStatus("Active");
    }
  }, [bank]);

  const handleSubmit = () => {
    if (isSaving) return;

    // Required fields
    if (!bankName || !branch || !accountNumber || !ifscCode) {
      showNotification("Please fill all required fields.", "error");
      return;
    }

    // Account number: accept alphanumeric, at least 6 characters
    if (!/^[A-Za-z0-9]{6,20}$/.test(accountNumber)) {
      showNotification("Account Number must be 6-20 alphanumeric characters.", "error");
      return;
    }

    // IFSC: 11 characters, first 4 letters, 5th is 0, last 6 alphanumeric
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      showNotification("IFSC must be 11 characters (e.g., SBIN0012345).", "error");
      return;
    }

    // UPI: optional, but if provided, must be in valid format (username@bank)
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
      showNotification("UPI ID must be in format username@bank (e.g., user@hdfc).", "error");
      return;
    }

    onSave({
      bankName,
      branch,
      accountNumber,
      ifscCode: ifscCode.toUpperCase(),
      upiId,
      status,
    });
  };

  // Form-local design shared with the Vehicle master form: compact 40px
  // fields, slate border, soft background, emerald focus ring.
  const inputClass = () =>
    "w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 appearance-none";

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const fieldLabel = (text: string, hint?: string, required = false) => (
    <label className="block mb-1.5 text-xs font-semibold text-slate-600">
      {text}
      {required && <span className="text-red-500"> *</span>}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
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

  const title = bank ? "Edit Bank" : "Add Bank";
  const subtitle = bank ? "Update details" : "Fill in the details";

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
            <Landmark size={22} />
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
          {sectionHeading("Bank Details")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              {fieldLabel("Bank Name", undefined, true)}
              <div className="relative">
                <Landmark className={iconWrapperClass} size={16} />
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., State Bank of India"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Branch", undefined, true)}
              <div className="relative">
                <MapPin className={iconWrapperClass} size={16} />
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g., Guntur Main"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {sectionHeading("Account Details")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              {fieldLabel("Account Number", undefined, true)}
              <div className="relative">
                <CreditCard className={iconWrapperClass} size={16} />
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                  placeholder="6-20 alphanumeric"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("IFSC Code", undefined, true)}
              <div className="relative">
                <Hash className={iconWrapperClass} size={16} />
                <input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g., SBIN0012345"
                  className={inputClass()}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("UPI ID", "(Optional)")}
              <div className="relative">
                <AtSign className={iconWrapperClass} size={16} />
                <input
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g., user@hdfc"
                  className={inputClass()}
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
            {isSaving ? "Saving..." : bank ? "Update Bank" : "Save Bank"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BankForm;
