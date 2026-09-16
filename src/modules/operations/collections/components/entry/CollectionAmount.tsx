import { Calculator, AlertTriangle, CheckCircle, Clock, X, Save, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "../../../../../i18n";
import { amountInWords } from "../../utils/amountInWords";

/**
 * One line of the collection preview: the period it belongs to (Before
 * collection / Collection entry / After approval) and the single figure for
 * that period. The old layout printed the same label twice — once as a section
 * header and again beside the amount — so each row now names its figure once.
 */
function PreviewRow({
  period,
  label,
  value,
  valueClass,
  emphasized = false,
}: {
  period: string;
  label: string;
  value: string;
  valueClass: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 ${
        emphasized ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{period}</p>
        <p className="truncate text-[13px] font-semibold text-slate-700">{label}</p>
      </div>
      <span className={`shrink-0 text-sm font-bold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

interface CollectionAmountProps {
  amount: number;
  remarks: string;
  currentOutstanding: number;
  receivedToday: number;
  projectedBalance: number;
  showSummary: boolean;
  ledgerLoaded: boolean;
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
  currentOutstanding,
  receivedToday,
  projectedBalance,
  showSummary,
  ledgerLoaded,
  amountError,
  onAmountChange,
  onRemarksChange,
  onSave,
  onCancel,
  isSaving,
  disableSave,
}: CollectionAmountProps) {
  const { t, language } = useI18n();
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
    // Allow only digits and decimal point
    let val = e.target.value.replace(/[^0-9.]/g, "");
    // Allow only one decimal point
    const parts = val.split(".");
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("");
    }
    setInputValue(val);
  };

  // Amount in words — read from what is in the box right now, so the words
  // keep pace with the typing instead of waiting for the field to blur; the
  // saved `amount` is the fallback whenever the text isn't a number yet.
  // Blank while nothing is entered, so the hint can show instead.
  const typedAmount = parseFloat(inputValue.replace(/,/g, ""));
  const wordsAmount = Number.isNaN(typedAmount) ? amount : typedAmount;
  const displayAmountWords = wordsAmount > 0 ? amountInWords(wordsAmount, language) : "";

  // Determine display values - show zeros when ledger not loaded
  const displayOutstanding = (showSummary && ledgerLoaded) ? currentOutstanding : 0;
  const displayReceived = (showSummary && ledgerLoaded) ? receivedToday : 0;
  const displayProjected = (showSummary && ledgerLoaded) ? projectedBalance : 0;

  let statusText = "";
  let statusClass = "";
  let statusIcon = null;
  
  if (!showSummary || !ledgerLoaded) {
    statusText = t("ops.collection.status.select_shop");
    statusClass = "bg-slate-100 text-slate-600";
    statusIcon = <Clock size={10} />;
  } else if (displayProjected < 0) {
    statusText = t("ops.collection.status.overpaid");
    statusClass = "bg-blue-100 text-blue-800 border-blue-200";
    statusIcon = <AlertTriangle size={10} />;
  } else if (displayProjected === 0) {
    statusText = t("ops.collection.status.fully_collected");
    statusClass = "bg-green-100 text-green-800 border-green-200";
    statusIcon = <CheckCircle size={10} />;
  } else {
    statusText = t("ops.collection.status.pending_approval");
    statusClass = "bg-amber-100 text-amber-800 border-amber-200";
    statusIcon = <Clock size={10} />;
  }

  const formattedProjected = displayProjected < 0
    ? `- ${inr(Math.abs(displayProjected))}`
    : inr(displayProjected);

  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Calculator size={16} />
        </div>
        <h2 className="text-lg font-semibold text-emerald-800">{t("ops.collection.amount_title")}</h2>
      </div>

      {/* Amount Input */}
      <div className="flex items-center gap-4">
        <label htmlFor="amount" className="whitespace-nowrap text-sm font-medium text-slate-700">
          {t("operations.amount_received")} <span className="text-red-500">*</span>
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
            className={`h-10 w-full rounded-md border ${amountError ? "border-red-500" : "border-slate-300"} pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            placeholder="0.00"
          />
        </div>
      </div>
      {amountError && <p className="mt-1 text-xs text-red-500">{amountError}</p>}
      {/* The figure read back in words, so a mistyped amount is caught before
        * saving. Telugu keeps its own words while the digits stay Latin. */}
      <p
        className={`mt-1.5 text-xs font-medium ${
          displayAmountWords ? "text-emerald-700" : "text-slate-400"
        }`}
        aria-live="polite"
      >
        {displayAmountWords || t("ops.collection.enter_amount_hint")}
      </p>

      {/* Remarks */}
      <div className="mt-4 flex items-center gap-4">
        <label htmlFor="remarks" className="whitespace-nowrap text-sm font-medium text-slate-700">
          {t("ops.collection.remarks_optional")}
        </label>
        <input
          id="remarks"
          type="text"
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder={t("placeholder.enter_remarks")}
          className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      {/* Collection Preview Calculation */}
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
        <h3 className="mb-2.5 text-sm font-bold text-emerald-800 flex items-center gap-2">
          <Calculator size={14} />
          {t("ops.collection.preview")}
        </h3>
        
        {/* One row per figure. Each row states its period once, so
          * "Current Outstanding" is never printed twice for the same value. */}
        <div className="space-y-2">
        <PreviewRow
          period={t("ops.collection.before_collection")}
          label={t("ops.collection.current_outstanding")}
          value={inr(displayOutstanding)}
          valueClass="text-slate-800"
        />
        <PreviewRow
          period={t("ops.collection.collection_entry")}
          label={t("ops.collection.received_today")}
          value={inr(displayReceived)}
          valueClass="text-emerald-700"
          emphasized
        />
        <PreviewRow
          period={t("ops.collection.after_approval")}
          label={t("ops.collection.projected_balance")}
          value={formattedProjected}
          valueClass={
            displayProjected < 0
              ? "text-blue-600"
              : displayProjected === 0
                ? "text-emerald-700"
                : "text-rose-600"
          }
          emphasized
        />

          {/* Status line — only once there is a ledger to talk about. Until a
            * shop is picked the three figures above are enough; no "Select a
            * shop" chip, no ledger hint competing with the picker. */}
          {showSummary && ledgerLoaded && (
            <div className="pt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border ${statusClass}`}>
                {statusIcon}
                {statusText}
              </span>
              {displayProjected < 0 ? (
                <p className="mt-1.5 text-[11px] text-blue-600">
                  {t("ops.collection.overpaid_hint")}
                </p>
              ) : displayProjected === 0 ? (
                <p className="mt-1.5 text-[11px] text-emerald-600">
                  {t("ops.collection.fully_collected_hint")}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-amber-600">
                  {t("ops.collection.pending_hint")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions. Icons animate on hover using the same vocabulary as the Trip
        * wizard: the X rotates a quarter turn, Save lifts slightly, and a
        * spinner replaces Save while the request is in flight. */}
      <div className="mt-auto pt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="group inline-flex items-center gap-2 rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          <X size={15} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disableSave || isSaving}
          aria-busy={isSaving || undefined}
          className={`group inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium text-white transition ${
            disableSave || isSaving
              ? "cursor-not-allowed bg-slate-400"
              : "bg-emerald-700 hover:bg-emerald-800"
          }`}
        >
          {isSaving ? (
            <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden />
          ) : (
            <Save
              size={15}
              className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5"
              aria-hidden
            />
          )}
          {isSaving ? t("common.saving") : t("ops.collection.save_collection")}
        </button>
      </div>
    </div>
  );
}