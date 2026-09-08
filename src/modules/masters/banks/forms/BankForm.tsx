import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import {
  masterInputClass,
  masterIconClass,
  masterLabelClass,
} from "../../components/masterFormStyles";
import { useId, useEffect, useState } from "react";
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
  const formId = useId();
  const fieldId = (text: string) => `${formId}-${text.replace(/\s+/g, "-")}`;
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
      showNotification(
        "Account Number must be 6-20 alphanumeric characters.",
        "error",
      );
      return;
    }

    // IFSC: 11 characters, first 4 letters, 5th is 0, last 6 alphanumeric
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      showNotification(
        "IFSC must be 11 characters (e.g., SBIN0012345).",
        "error",
      );
      return;
    }

    // UPI: optional, but if provided, must be in valid format (username@bank)
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
      showNotification(
        "UPI ID must be in format username@bank (e.g., user@hdfc).",
        "error",
      );
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

  const inputClass = masterInputClass;
  const iconWrapperClass = masterIconClass;

  const fieldLabel = (text: string, hint?: string, required = false) => (
    <label htmlFor={fieldId(text)} className={masterLabelClass}>
      {text}
      {required && <span className="text-red-500"> *</span>}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <MasterSectionHeading>{label}</MasterSectionHeading>
  );

  const title = bank ? "Edit Bank" : "Add Bank";
  const subtitle = bank ? "Update details" : "Fill in the details";

  return (
    <MasterForm
      title={title}
      subtitle={subtitle}
      icon={<Landmark size={20} />}
      status={status}
      onStatusChange={setStatus}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSaving={isSaving}
      submitLabel={bank ? "Update Bank" : "Save Bank"}
    >
      <section className="space-y-3">
        {sectionHeading("Bank Details")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            {fieldLabel("Bank Name", undefined, true)}
            <div className="relative">
              <Landmark className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Bank Name")}
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
                id={fieldId("Branch")}
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
                id={fieldId("Account Number")}
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
                id={fieldId("IFSC Code")}
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
                id={fieldId("UPI ID")}
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
    </MasterForm>
  );
}

export default BankForm;
