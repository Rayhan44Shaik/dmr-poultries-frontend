// src/modules/staff/components/salary/SalaryReviewModal.tsx
//
// "Review & Submit" popup for the Salary Register.
//
// Left selection panel (mirrors the Shop Ledger "Select shops" pattern): search,
// All/None, checkbox list, and bottom actions (Download Selected / Email
// Payslips). The payslip preview is on the right (read-only by default; the
// footer Edit toggles inline editing). After a successful email send, "Submit
// Selected" submits only the chosen employees.

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  X,
  Download,
  Save,
  Pencil,
  Loader2,
  Lock,
  ClipboardCheck,
  Mail,
  ListChecks,
  CheckSquare,
  Square,
  CheckCircle2,
} from "lucide-react";
import BrandMark from "../../../../ui/BrandMark";
import type { SalaryRecord } from "../../types/staffDashboard";

export type SalaryReviewModalProps = {
  monthLabel: string;
  records: SalaryRecord[];
  pendingCount: number;
  /** Disables the Submit Selected action (e.g. until payslips are emailed). */
  submitDisabled?: boolean;
  formatCurrency?: (amount: number) => string;
  onClose: () => void;
  /** Submit only the given (selected + emailed) employee ids. */
  onSubmitSelected: (ids: string[]) => void;
  onSaveRecord: (record: SalaryRecord) => Promise<void>;
  // Selection (owned by the page's salary table).
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onDownloadSelected: (ids: string[]) => void;
  onEmailSelected: () => void;
  /** Number of payslips successfully emailed (shown once sent). */
  emailsSentCount?: number;
};

type FieldKey =
  | "basicSalary"
  | "overtime"
  | "incentives"
  | "fuelAllowance"
  | "nightAllowance"
  | "leaveDeduction"
  | "advanceRecovery"
  | "loanEMI"
  | "latePenalty"
  | "otherDeductions";

type FieldValues = Record<FieldKey, number>;

const EARNING_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "basicSalary", label: "Basic Salary" },
  { key: "overtime", label: "Overtime" },
  { key: "incentives", label: "Incentives" },
  { key: "fuelAllowance", label: "Fuel Allowance" },
  { key: "nightAllowance", label: "Night Allowance" },
];

const DEDUCTION_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "leaveDeduction", label: "Leave Deduction" },
  { key: "advanceRecovery", label: "Advance Recovery" },
  { key: "loanEMI", label: "Loan EMI" },
  { key: "latePenalty", label: "Late Penalty" },
  { key: "otherDeductions", label: "Other Deductions" },
];

function toFieldValues(record: SalaryRecord): FieldValues {
  return {
    basicSalary: record.basicSalary || 0,
    overtime: record.overtime || 0,
    incentives: record.incentives || 0,
    fuelAllowance: record.fuelAllowance || 0,
    nightAllowance: record.nightAllowance || 0,
    leaveDeduction: record.leaveDeduction || 0,
    advanceRecovery: record.advanceRecovery || 0,
    loanEMI: record.loanEMI || 0,
    latePenalty: record.latePenalty || 0,
    otherDeductions: record.otherDeductions || 0,
  };
}

function computeTotals(values: FieldValues): {
  gross: number;
  deductions: number;
  net: number;
} {
  const gross =
    values.basicSalary +
    values.overtime +
    values.incentives +
    values.fuelAllowance +
    values.nightAllowance;
  const deductions =
    values.leaveDeduction +
    values.advanceRecovery +
    values.loanEMI +
    values.latePenalty +
    values.otherDeductions;
  return { gross, deductions, net: gross - deductions };
}

function AmountCell({
  value,
  editing,
  onChange,
  formatCurrency,
}: {
  value: number;
  editing: boolean;
  onChange: (next: number) => void;
  formatCurrency: (amount: number) => string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  if (!editing) {
    return (
      <span className="block text-right text-sm font-medium text-slate-800 tabular-nums">
        {formatCurrency(value)}
      </span>
    );
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(Number(String(text).replace(/[^0-9.]/g, "")) || 0)
      }
      className="w-full text-right text-sm tabular-nums px-2 py-1 rounded-md border border-blue-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

export function SalaryReviewModal({
  monthLabel,
  records,
  pendingCount,
  submitDisabled = false,
  formatCurrency = (amt) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amt || 0),
  onClose,
  onSubmitSelected,
  onSaveRecord,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDownloadSelected,
  onEmailSelected,
  emailsSentCount = 0,
}: SalaryReviewModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, FieldValues>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const selected = useMemo(() => {
    const byId = records.find((r) => r.id === selectedId);
    if (byId) return byId;
    // Default to the first Pending employee so the Edit option is visible.
    return records.find((r) => r.status === "Pending") ?? records[0] ?? null;
  }, [records, selectedId]);

  useEffect(() => {
    setEditing(false);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        String(r.employeeId ?? "").includes(q)
    );
  }, [records, query]);

  const allIds = useMemo(() => records.map((r) => r.id), [records]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  // Arrow-key navigation across the filtered list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const idx = filtered.findIndex((r) => r.id === selected?.id);
        const nextIdx =
          idx < 0 ? 0 : (idx + dir + filtered.length) % filtered.length;
        setSelectedId(filtered[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected]);

  const ensureDraft = useCallback(
    (record: SalaryRecord): FieldValues =>
      drafts[record.id] ?? toFieldValues(record),
    [drafts]
  );

  const currentValues = selected ? ensureDraft(selected) : null;
  const currentTotals = currentValues ? computeTotals(currentValues) : null;
  const canEdit = selected?.status === "Pending";

  const setField = useCallback(
    (record: SalaryRecord, key: FieldKey, value: number) => {
      setDrafts((prev) => ({
        ...prev,
        [record.id]: {
          ...(prev[record.id] ?? toFieldValues(record)),
          [key]: value,
        },
      }));
      setDirty((prev) => ({ ...prev, [record.id]: true }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!selected) return;
    const values = drafts[selected.id] ?? toFieldValues(selected);
    const totals = computeTotals(values);
    const merged: SalaryRecord = {
      ...selected,
      basicSalary: values.basicSalary,
      overtime: values.overtime,
      incentives: values.incentives,
      fuelAllowance: values.fuelAllowance,
      nightAllowance: values.nightAllowance,
      leaveDeduction: values.leaveDeduction,
      advanceRecovery: values.advanceRecovery,
      loanEMI: values.loanEMI,
      latePenalty: values.latePenalty,
      otherDeductions: values.otherDeductions,
      totalGross: totals.gross,
      totalDeductions: totals.deductions,
      netSalary: totals.net,
    };
    setSavingId(selected.id);
    try {
      await onSaveRecord(merged);
      setDirty((prev) => ({ ...prev, [selected.id]: false }));
      setEditing(false);
    } catch {
      // Notification already shown by the page handler; keep editing on.
    } finally {
      setSavingId(null);
    }
  }, [selected, drafts, onSaveRecord]);

  const handleSubmit = useCallback(() => {
    if (selectedCount === 0) return;
    const afterSave =
      selected && dirty[selected.id] ? handleSave() : Promise.resolve();
    afterSave.then(() => onSubmitSelected([...selectedIds]));
  }, [selected, selectedCount, dirty, handleSave, onSubmitSelected, selectedIds]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/60 p-0 sm:p-4">
      <div
        className="bg-white w-full sm:max-w-5xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden sm:max-h-[94vh]"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Review &amp; Submit — {monthLabel}
              </h3>
              <p className="text-[11px] text-slate-500">
                {records.length} employee{records.length === 1 ? "" : "s"} ·{" "}
                {pendingCount} pending
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* LEFT: selection panel (mirrors Shop Ledger "Select shops") */}
          <aside className="w-72 shrink-0 flex flex-col min-h-0 border-r border-slate-100 bg-slate-50/70">
            {/* Panel header */}
            <div className="space-y-2.5 border-b border-slate-100 bg-white/70 px-3.5 py-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                    <ListChecks size={12} />
                  </span>
                  Select employees
                </span>
                {emailsSentCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} /> {emailsSentCount} emailed
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleSelectAll(allIds)}
                  className={`flex h-7 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition ${
                    allSelected
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CheckSquare size={11} /> All
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSelectAll([])}
                  disabled={selectedCount === 0}
                  className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Square size={11} /> None
                </button>
              </div>

              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employees..."
                  aria-label="Search employees"
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                />
              </div>
            </div>

            {/* Employee list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
              <div className="space-y-0.5">
                {filtered.map((r) => {
                  const isActive = r.id === selected?.id;
                  const isSelected = selectedIds.has(r.id);
                  const isBusy = savingId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`group flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                        isActive
                          ? "border-blue-200 bg-blue-50/70 ring-1 ring-blue-300"
                          : isSelected
                          ? "border-blue-100 bg-blue-50/40"
                          : "border-transparent hover:border-slate-200/70 hover:bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${r.employeeName}`}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        title={r.employeeName}
                        className="flex min-w-0 flex-1 items-center text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-xs ${
                              isActive
                                ? "font-bold text-blue-700"
                                : "font-semibold text-slate-700"
                            }`}
                          >
                            {r.employeeName}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {r.department}
                          </span>
                        </span>
                      </button>
                      {isBusy ? (
                        <Loader2 size={13} className="shrink-0 animate-spin text-blue-500" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-slate-400">
                  No employees match “{query}”.
                </p>
              )}
            </div>
          </aside>

          {/* RIGHT: payslip (scrollable) */}
          {selected && currentValues && currentTotals ? (
            <div className="flex-1 min-w-0 overflow-y-auto bg-slate-100 p-5">
              <div className="flex justify-center">
                <PayslipDocument
                  record={selected}
                  values={currentValues}
                  totals={currentTotals}
                  editing={editing && canEdit}
                  formatCurrency={formatCurrency}
                  onFieldChange={(key, val) => setField(selected, key, val)}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              No salary records for this month.
            </div>
          )}
        </div>

        {/* Footer: Close + Edit on the left, Download / Email / Submit on the right */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
            {editing ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || savingId === selected?.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {savingId === selected?.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                {savingId === selected?.id ? "Saving..." : dirty ? "Save" : "Saved"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={!canEdit}
                title={canEdit ? "Edit this payslip" : "Locked — only Pending records can be edited"}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canEdit ? <Pencil size={13} /> : <Lock size={13} />}
                {canEdit ? "Edit" : "Locked"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownloadSelected([...selectedIds])}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-semibold shadow-sm transition hover:from-blue-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={13} /> Download ({selectedCount})
            </button>
            <button
              type="button"
              onClick={onEmailSelected}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail size={13} /> Email ({selectedCount})
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || submitDisabled}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <ClipboardCheck size={15} />
              Submit Selected ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple, clean A4-portrait payslip document (single column).
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
}: {
  label: string;
  value?: number | string | null;
}) {
  return (
    <div className="px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-800 tabular-nums mt-0.5">
        {value ?? "—"}
      </div>
    </div>
  );
}

function LineRow({
  label,
  value,
  editing,
  onChange,
  formatCurrency,
}: {
  label: string;
  value: number;
  editing: boolean;
  onChange: (next: number) => void;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="px-3 py-1.5 flex items-center justify-between gap-3">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="w-40 text-right">
        <AmountCell
          value={value}
          editing={editing}
          onChange={onChange}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}

function PayslipDocument({
  record,
  values,
  totals,
  editing,
  formatCurrency,
  onFieldChange,
}: {
  record: SalaryRecord;
  values: FieldValues;
  totals: { gross: number; deductions: number; net: number };
  editing: boolean;
  formatCurrency: (amount: number) => string;
  onFieldChange: (key: FieldKey, value: number) => void;
}) {
  const monthLabel = (() => {
    if (!record.month) return "";
    const [y, m] = record.month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  })();

  return (
    <div className="w-full max-w-[420px] bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
      {/* Header — same document identity as the payslip view:
          DMR POULTRIES brand, "Payslip" title, period. */}
      <div className="border-b border-slate-200 px-5 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <BrandMark size="xs" />
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-slate-900">
            DMR POULTRIES
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-center gap-2">
          <span className="text-sm font-bold tracking-tight text-slate-900">Payslip</span>
          <span className="text-slate-300">·</span>
          <span className="text-xs font-semibold text-slate-600">{monthLabel}</span>
        </div>
      </div>

      {/* Employee */}
      <div className="grid grid-cols-2 gap-y-2 px-5 py-3 border-b border-slate-200 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Employee
          </div>
          <div className="font-semibold text-slate-800 truncate">
            {record.employeeName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Department
          </div>
          <div className="font-semibold text-slate-800 truncate">
            {record.department}
          </div>
        </div>
        <div className="col-span-2 grid grid-cols-4 gap-2 pt-1">
          <Stat label="Working" value={record.workingDays} />
          <Stat label="Present" value={record.presentDays} />
          <Stat label="Leave" value={record.leaveDays} />
          <Stat label="Weekly Off" value={record.weeklyOffDays} />
        </div>
      </div>

      {/* Earnings */}
      <div className="px-5 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          Earnings
        </div>
        <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
          {EARNING_FIELDS.map((f) => (
            <LineRow
              key={f.key}
              label={f.label}
              value={values[f.key]}
              editing={editing}
              onChange={(v) => onFieldChange(f.key, v)}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-3 pt-2 mt-1 border-t border-slate-100 text-sm font-bold">
          <span className="text-slate-700">Gross Salary</span>
          <span className="text-slate-900 tabular-nums">
            {formatCurrency(totals.gross)}
          </span>
        </div>
      </div>

      {/* Deductions */}
      <div className="px-5 pb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1">
          Deductions
        </div>
        <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
          {DEDUCTION_FIELDS.map((f) => (
            <LineRow
              key={f.key}
              label={f.label}
              value={values[f.key]}
              editing={editing}
              onChange={(v) => onFieldChange(f.key, v)}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-3 pt-2 mt-1 border-t border-slate-100 text-sm font-bold">
          <span className="text-slate-700">Total Deductions</span>
          <span className="text-rose-700 tabular-nums">
            {formatCurrency(totals.deductions)}
          </span>
        </div>
      </div>

      {/* Net payable — the take-home band, brand emerald like the payslip view */}
      <div className="px-5 py-3 flex items-center justify-between bg-emerald-600 text-white">
        <span className="text-[11px] font-bold uppercase tracking-wider">
          Net Salary (Take Home)
        </span>
        <span className="text-lg font-extrabold tabular-nums">
          {formatCurrency(totals.net)}
        </span>
      </div>
    </div>
  );
}

export default SalaryReviewModal;
