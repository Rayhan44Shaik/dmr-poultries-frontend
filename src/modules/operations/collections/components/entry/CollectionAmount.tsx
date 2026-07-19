import { Calculator } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface Props {
  amount: number;
  remarks: string;
  previousBalance: number;
  receivedToday: number;
  remainingBalance: number;
  showSummary: boolean;
  amountError?: string;
  onAmountChange: (value: number) => void;
  onRemarksChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  disableSave: boolean;
}

const inr = (n: number) =>
  "₹ " + Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function CollectionAmount({
  amount,
  remarks,
  previousBalance,
  receivedToday,
  remainingBalance,
  showSummary,
  amountError,
  onAmountChange,
  onRemarksChange,
  onSave,
  onCancel,
  isSaving,
  disableSave,
}: Props) {
  // Local input value as string to allow raw typing
  const [inputValue, setInputValue] = useState<string>(amount ? amount.toFixed(2) : "");
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Sync with external `amount` when it changes (e.g., after edit load)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setInputValue(amount ? amount.toFixed(2) : "");
    }
  }, [amount]);

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // Parse and round to two decimals
    const raw = parseFloat(inputValue);
    if (!isNaN(raw)) {
      const rounded = Math.round(raw * 100) / 100;
      onAmountChange(rounded);
      setInputValue(rounded.toFixed(2));
    } else {
      // If invalid, reset to 0
      onAmountChange(0);
      setInputValue("0.00");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only digits and a single decimal point
    const sanitized = val.replace(/[^0-9.]/g, "");
    // Prevent multiple dots
    const parts = sanitized.split(".");
    const final = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized;
    setInputValue(final);
  };

  const displayPrevious = showSummary ? previousBalance : 0;
  const displayReceived = showSummary ? receivedToday : 0;
  const displayRemaining = showSummary ? remainingBalance : 0;

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <Calculator size={16} />
        </div>
        <h2 className="text-lg font-semibold text-green-800">Collection Amount</h2>
      </div>

      {/* Amount Received – inline */}
      <div className="flex items-center gap-4">
        <label htmlFor="amount" className="whitespace-nowrap text-sm font-medium text-slate-700">
          Amount Received <span className="text-red-500">*</span>
        </label>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
          <input
            ref={inputRef}
            id="amount"
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`h-10 w-full rounded-md border ${amountError ? "border-red-500" : "border-slate-300"} pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            placeholder="0.00"
          />
        </div>
      </div>
      {amountError && <p className="mt-1 text-xs text-red-500">{amountError}</p>}
      <p className="mt-1 text-xs text-slate-400">Enter the amount received from the selected shop.</p>

      {/* Remarks – inline */}
      <div className="mt-4 flex items-center gap-4">
        <label htmlFor="remarks" className="whitespace-nowrap text-sm font-medium text-slate-700">
          Remarks (Optional)
        </label>
        <input
          id="remarks"
          type="text"
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder="Enter remarks..."
          className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* After Collection */}
      <div className="mt-5 flex-1 rounded-xl border border-green-200 bg-green-50 p-4">
        <h3 className="mb-3 text-base font-bold text-green-800">After Collection</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Opening Balance</span>
            <span className="text-base font-bold text-slate-800">{inr(displayPrevious)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Received Today</span>
            <span className="text-base font-bold text-green-700">{inr(displayReceived)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-700">Remaining Balance</span>
            <span className={`text-base font-extrabold ${displayRemaining === 0 ? "text-green-700" : "text-red-600"}`}>
              {inr(displayRemaining)}
            </span>
          </div>
          <div className="pt-1">
            <span
              className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                displayRemaining === 0 ? "bg-green-200 text-green-800" : "bg-yellow-200 text-yellow-800"
              }`}
            >
              {displayRemaining === 0 ? "Completed" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disableSave || isSaving}
          className={`rounded-md px-5 py-2 text-sm font-medium text-white transition ${
            disableSave || isSaving
              ? "cursor-not-allowed bg-slate-400"
              : "bg-green-700 hover:bg-green-800"
          }`}
        >
          {isSaving ? "Saving..." : "Save Collection"}
        </button>
      </div>
    </div>
  );
}