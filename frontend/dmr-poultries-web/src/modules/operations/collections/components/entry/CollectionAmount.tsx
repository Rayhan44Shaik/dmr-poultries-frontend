import { Calculator } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface Props {
  amount: number;
  remarks: string;
  previousBalance: number;
  receivedToday: number;
  remainingBalance: number; // can be negative
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

// Format number with Indian comma separators (e.g., 100000 -> 1,00,000.00)
const formatWithCommas = (num: number): string => {
  if (isNaN(num)) return "0.00";
  const parts = num.toFixed(2).split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1] || "00";
  // Indian numbering: group last 3 digits, then groups of 2
  const lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  const formattedInteger =
    otherNumbers !== ""
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return formattedInteger + "." + decimalPart;
};

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
  // Local input state – stores the raw number string (without commas) while editing
  const [inputValue, setInputValue] = useState<string>(
    amount ? amount.toFixed(2) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Sync with external `amount` when it changes (e.g., after reset)
  useEffect(() => {
    if (!isFocusedRef.current) {
      // When not focused, show formatted value with commas
      setInputValue(amount ? formatWithCommas(amount) : "");
    }
  }, [amount]);

  const handleFocus = () => {
    isFocusedRef.current = true;
    // On focus, convert formatted string back to raw number for easy typing
    const raw = parseFloat(inputValue.replace(/,/g, ""));
    if (!isNaN(raw)) {
      setInputValue(raw.toFixed(2));
    } else {
      setInputValue("");
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const raw = parseFloat(inputValue.replace(/,/g, ""));
    if (!isNaN(raw)) {
      const rounded = Math.round(raw * 100) / 100;
      onAmountChange(rounded);
      // Show formatted with commas
      setInputValue(formatWithCommas(rounded));
    } else {
      onAmountChange(0);
      setInputValue("0.00");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits, decimal point, and minus sign (for negative)
    let val = e.target.value.replace(/[^0-9.-]/g, "");
    // Allow only one decimal point
    const parts = val.split(".");
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("");
    }
    // Allow only one minus sign at the start
    if (val.startsWith("-")) {
      val = "-" + val.slice(1).replace(/-/g, "");
    } else {
      val = val.replace(/-/g, "");
    }
    setInputValue(val);
  };

  // Determine status and display
  const displayPrevious = showSummary ? previousBalance : 0;
  const displayReceived = showSummary ? receivedToday : 0;
  const displayRemaining = showSummary ? remainingBalance : 0;

  let statusText = "";
  let statusClass = "";
  if (!showSummary) {
    statusText = "N/A";
    statusClass = "bg-gray-200 text-gray-700";
  } else if (displayRemaining < 0) {
    statusText = "Overpaid";
    statusClass = "bg-blue-200 text-blue-800";
  } else if (displayRemaining === 0) {
    statusText = "Completed";
    statusClass = "bg-green-200 text-green-800";
  } else {
    statusText = "Pending";
    statusClass = "bg-yellow-200 text-yellow-800";
  }

  const formattedRemaining = displayRemaining < 0
    ? `- ${inr(Math.abs(displayRemaining))}`
    : inr(displayRemaining);

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <Calculator size={16} />
        </div>
        <h2 className="text-lg font-semibold text-green-800">Collection Amount</h2>
      </div>

      {/* Amount Input */}
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

      {/* Remarks */}
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

      {/* After Collection Summary */}
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
            <span className={`text-base font-extrabold ${
              displayRemaining < 0 ? "text-blue-600" : displayRemaining === 0 ? "text-green-700" : "text-red-600"
            }`}>
              {formattedRemaining}
            </span>
          </div>
          <div className="pt-1">
            <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${statusClass}`}>
              {statusText}
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