import { useEffect, useState } from "react";
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Bank Name <span className="text-red-500">*</span>
          </label>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g., State Bank of India"
            className="w-full border rounded-lg p-2.5"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Branch <span className="text-red-500">*</span>
          </label>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="e.g., Guntur Main"
            className="w-full border rounded-lg p-2.5"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Account Number <span className="text-red-500">*</span>
          </label>
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
            placeholder="6-20 alphanumeric"
            className="w-full border rounded-lg p-2.5"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            IFSC Code <span className="text-red-500">*</span>
          </label>
          <input
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            placeholder="e.g., SBIN0012345"
            className="w-full border rounded-lg p-2.5"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            UPI ID
          </label>
          <input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g., user@hdfc"
            className="w-full border rounded-lg p-2.5"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-slate-700">
            Status <span className="text-red-500">*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
            className="w-full border rounded-lg p-2.5"
            disabled={isSaving}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-6 py-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
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
  );
}

export default BankForm;
