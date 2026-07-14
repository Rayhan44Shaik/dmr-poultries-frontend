import { useEffect, useState } from "react";
import type { Bank } from "../types/bank";
import { useNotification } from "../../../../context/NotificationContext";

type BankFormProps = {
  bank?: Bank | null;
  onSave: (bank: any) => void;
  onCancel: () => void;
};

function BankForm({ bank, onSave, onCancel }: BankFormProps) {
  const { showNotification } = useNotification();

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
          className="px-6 py-2 border rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          {bank ? "Update Bank" : "Save Bank"}
        </button>
      </div>
    </div>
  );
}

export default BankForm;