import { useMemo, useState } from "react";
import { CheckCircle2, IndianRupee, ReceiptText, X } from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { amountInWords } from "../../collections/utils/amountInWords";
import { useI18n } from "../../../../i18n";
import MasterDropdown from "../../../masters/components/MasterDropdown";
import type { ManualExpense, ManualExpenseDraft } from "../services/tripExpensesService";

const TYPES = ["Office", "Employee", "Utilities", "Supplies", "Repairs", "Travel", "Food", "Other"];
const today = () => new Date().toISOString().slice(0, 10);
const fieldLabelClass = "mb-1 block text-xs font-semibold text-slate-600";
const fieldControlClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

export function ManualExpenseForm({
  saving,
  initialData,
  onClose,
  onSave,
}: {
  saving: boolean;
  initialData?: ManualExpense | null;
  onClose: () => void;
  onSave: (draft: ManualExpenseDraft) => Promise<void>;
}) {
  const { language } = useI18n();
  const wordsLanguage = language === "te" ? "te" : "en";
  const editing = Boolean(initialData);
  const [expenseDate, setExpenseDate] = useState(initialData?.expenseDate || today());
  const [amountText, setAmountText] = useState(initialData ? String(initialData.amount) : "");
  const [expenseType, setExpenseType] = useState(initialData?.expenseType ?? "Office");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [remarks, setRemarks] = useState(initialData?.remarks ?? "");
  const amount = Number(amountText.replace(/,/g, "")) || 0;
  const formatted = useMemo(() => (amount ? amount.toLocaleString("en-IN") : ""), [amount]);
  const valid = Boolean(expenseDate && amount > 0 && description.trim().length >= 2);

  return (
    <div className="animate-in fade-in slide-in-from-top-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-600">
            <ReceiptText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{editing ? "Edit Expense" : "Add Expense"}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="group inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <X size={15} className="shrink-0 transition-transform duration-200 group-hover:rotate-90" />
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => void onSave({ expenseDate, amount, expenseType, description: description.trim(), remarks: remarks.trim() })}
            className="group inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-40"
          >
            <CheckCircle2 size={15} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
            {saving ? "Saving…" : editing ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[190px_220px_260px_minmax(240px,1.25fr)_minmax(200px,0.8fr)]">
        <div>
          <label className={fieldLabelClass}>Date <span className="text-red-500">*</span></label>
          <DatePicker value={expenseDate} onChange={setExpenseDate} className="w-full" required hideClear />
        </div>
        <div>
          <label className={fieldLabelClass}>Expense type <span className="text-red-500">*</span></label>
          <MasterDropdown
            hideLabel
            label="Expense type"
            value={expenseType}
            options={TYPES.map((type) => ({ value: type, label: type }))}
            onChange={setExpenseType}
            placeholder="Select expense type"
            searchable
            allowClear={false}
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Amount <span className="text-red-500">*</span></label>
          <div className="relative">
            <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
            <input
              inputMode="numeric"
              value={formatted}
              onChange={(e) => setAmountText(e.target.value.replace(/[^0-9]/g, ""))}
              className={`${fieldControlClass} pl-8 font-semibold`}
              placeholder="10,000"
            />
          </div>
          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            {amount ? amountInWords(amount, wordsLanguage) : "Enter an amount"}
          </p>
        </div>
        <div>
          <label className={fieldLabelClass}>Expense details <span className="text-red-500">*</span></label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={fieldControlClass}
            placeholder="A4 sheets, books, electricity bill…"
            maxLength={300}
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Remarks</label>
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={fieldControlClass}
            placeholder="Optional note"
            maxLength={1000}
          />
        </div>
      </div>
    </div>
  );
}
