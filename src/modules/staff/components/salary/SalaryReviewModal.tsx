// src/modules/staff/components/salary/SalaryReviewModal.tsx
//
// "Review & Submit" popup for the Salary Register.
//
// A simple, neat A4-portrait payslip (plain DMR POULTRIES title, no proprietor
// block / hen logo / status badges) with an employee list on the left and the
// payslip on the right. The payslip is read-only by default; an "Edit" button
// turns the amount fields into inputs so a Pending record can be corrected.

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  X,
  Download,
  Save,
  Pencil,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import type { SalaryRecord } from "../../types/staffDashboard";

export type SalaryReviewModalProps = {
  monthLabel: string;
  records: SalaryRecord[];
  pendingCount: number;
  saving: boolean;
  formatCurrency?: (amount: number) => string;
  onClose: () => void;
  onSubmitMonth: () => void;
  onDownload: (record: SalaryRecord) => void;
  downloadingId?: string | null;
  /** Persist edits to a single salary record (Pending only). */
  onSaveRecord: (record: SalaryRecord) => Promise<void>;
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

const NAVY = "#0f234f";

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
  saving,
  formatCurrency = (amt) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amt || 0),
  onClose,
  onSubmitMonth,
  onDownload,
  downloadingId,
  onSaveRecord,
}: SalaryReviewModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    records[0]?.id ?? null
  );
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, FieldValues>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  // Leave edit mode when switching employees.
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
    const id = selected?.id;
    if (id && dirty[id]) {
      void handleSave().then(() => onSubmitMonth());
    } else {
      onSubmitMonth();
    }
  }, [selected, dirty, handleSave, onSubmitMonth]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-slate-900/60 p-0 sm:p-4">
      <div className="bg-slate-100 w-full sm:max-w-5xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden sm:max-h-[94vh]">
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
          {/* LEFT: employee list */}
          <div className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full bg-transparent text-xs text-slate-700 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map((r) => {
                const active = r.id === selected?.id;
                const isDirty = dirty[r.id];
                const vals = drafts[r.id] ?? toFieldValues(r);
                const net =
                  vals.basicSalary +
                  vals.overtime +
                  vals.incentives +
                  vals.fuelAllowance +
                  vals.nightAllowance -
                  vals.leaveDeduction -
                  vals.advanceRecovery -
                  vals.loanEMI -
                  vals.latePenalty -
                  vals.otherDeductions;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 transition ${
                      active ? "bg-blue-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {r.employeeName}
                        </span>
                        {isDirty && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {r.department} · {r.employeeId}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-800 tabular-nums shrink-0">
                      {formatCurrency(net)}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">
                  No employees match your search.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: payslip */}
          {selected && currentValues && currentTotals ? (
            <div className="flex-1 min-w-0 overflow-y-auto bg-slate-100 p-5 flex justify-center">
              <PayslipDocument
                record={selected}
                values={currentValues}
                totals={currentTotals}
                editing={editing && canEdit}
                canEdit={canEdit}
                formatCurrency={formatCurrency}
                onFieldChange={(key, val) => setField(selected, key, val)}
                savingId={savingId}
                dirty={Boolean(dirty[selected.id])}
                onToggleEdit={() => setEditing((e) => !e)}
                onSave={handleSave}
                onDownload={() => onDownload(selected)}
                downloading={downloadingId === selected.id}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              No salary records for this month.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
          <p className="text-[11px] text-slate-500 max-w-md truncate">
            Select an employee to review their payslip. Use Edit to adjust a
            Pending record, then submit the month.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || pendingCount === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ClipboardCheck size={15} />
              )}
              {saving ? "Submitting..." : `Submit Month (${pendingCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple, neat A4-portrait payslip document.
// ---------------------------------------------------------------------------

function Detail({
  label,
  value,
  alignRight = false,
}: {
  label: string;
  value: string;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "text-right" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-800 truncate">
        {value}
      </div>
    </div>
  );
}

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
      <div className="w-32 text-right">
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
  canEdit,
  formatCurrency,
  onFieldChange,
  savingId,
  dirty,
  onToggleEdit,
  onSave,
  onDownload,
  downloading,
}: {
  record: SalaryRecord;
  values: FieldValues;
  totals: { gross: number; deductions: number; net: number };
  editing: boolean;
  canEdit: boolean;
  formatCurrency: (amount: number) => string;
  onFieldChange: (key: FieldKey, value: number) => void;
  savingId: string | null;
  dirty: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const monthLabel = (() => {
    if (!record.month) return "";
    const [y, m] = record.month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  })();

  return (
    <div className="w-full max-w-[480px] bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden">
      {/* Title */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <div
            className="text-lg font-extrabold tracking-wide"
            style={{ color: NAVY }}
          >
            DMR POULTRIES
          </div>
          <div className="text-[11px] text-slate-500">Salary Payslip</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            For the month of
          </div>
          <div className="text-sm font-semibold text-slate-800">
            {monthLabel}
          </div>
        </div>
      </div>

      {/* Employee details */}
      <div className="px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-4 border-b border-slate-200">
        <Detail label="Employee Name" value={record.employeeName} />
        <Detail label="Employee ID" value={String(record.employeeId)} alignRight />
        <Detail label="Department" value={record.department} />
        <Detail label="Role" value={record.role || "—"} alignRight />
      </div>

      {/* Attendance summary */}
      <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/60">
        <Stat label="Working" value={record.workingDays} />
        <Stat label="Present" value={record.presentDays} />
        <Stat label="Leave" value={record.leaveDays} />
        <Stat label="Weekly Off" value={record.weeklyOffDays} />
      </div>

      {/* Earnings | Deductions */}
      <section className="border-b border-slate-200">
        <div className="grid grid-cols-2">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50/60 border-r border-slate-200">
            Earnings
          </div>
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50/60">
            Deductions
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-200">
          <div className="divide-y divide-slate-100">
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
          <div className="divide-y divide-slate-100">
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
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Gross Salary
            </span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {formatCurrency(totals.gross)}
            </span>
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Total Deductions
            </span>
            <span className="text-sm font-bold text-rose-700 tabular-nums">
              {formatCurrency(totals.deductions)}
            </span>
          </div>
        </div>
      </section>

      {/* Net payable */}
      <div className="px-5 py-4">
        <div
          className="rounded-lg px-4 py-3 flex items-center justify-between text-white"
          style={{ background: NAVY }}
        >
          <span className="text-[11px] uppercase tracking-wider text-blue-100">
            Net Salary Payable
          </span>
          <span className="text-2xl font-extrabold tabular-nums">
            {formatCurrency(totals.net)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}
          {downloading ? "Preparing..." : "Download Payslip"}
        </button>
        {canEdit &&
          (editing ? (
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || savingId === record.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {savingId === record.id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              {savingId === record.id
                ? "Saving..."
                : dirty
                ? "Save Changes"
                : "Saved"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              <Pencil size={13} /> Edit
            </button>
          ))}
      </div>
    </div>
  );
}

export default SalaryReviewModal;
