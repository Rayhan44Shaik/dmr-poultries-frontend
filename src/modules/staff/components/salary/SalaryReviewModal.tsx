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
import { ClassicPayslipSheet } from "./ClassicPayslipSheet";
import {
  computePayslipTotals,
  toAmountValues,
  type AmountFieldKey,
  type AmountValues,
} from "./payslipModel";
import type { SalaryRecord } from "../../types/staffDashboard";

export type SalaryReviewModalProps = {
  monthLabel: string;
  records: SalaryRecord[];
  pendingCount: number;
  /** Disables the Submit Selected action (e.g. until payslips are emailed). */
  submitDisabled?: boolean;
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

type FieldKey = AmountFieldKey;
type FieldValues = AmountValues;

export function SalaryReviewModal({
  monthLabel,
  records,
  pendingCount,
  submitDisabled = false,
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
      drafts[record.id] ?? toAmountValues(record),
    [drafts]
  );

  const currentValues = selected ? ensureDraft(selected) : null;
  const currentTotals = currentValues ? computePayslipTotals(currentValues) : null;
  const canEdit = selected?.status === "Pending";

  const setField = useCallback(
    (record: SalaryRecord, key: FieldKey, value: number) => {
      setDrafts((prev) => ({
        ...prev,
        [record.id]: {
          ...(prev[record.id] ?? toAmountValues(record)),
          [key]: value,
        },
      }));
      setDirty((prev) => ({ ...prev, [record.id]: true }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!selected) return;
    const values = drafts[selected.id] ?? toAmountValues(selected);
    const totals = computePayslipTotals(values);
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
                <div className="w-full max-w-[820px]">
                  <div className="bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-slate-200">
                    <ClassicPayslipSheet
                      record={selected}
                      values={currentValues}
                      gross={currentTotals.gross}
                      deductions={currentTotals.deductions}
                      net={currentTotals.net}
                      editing={editing && canEdit}
                      onFieldChange={(key, val) => setField(selected, key, val)}
                    />
                  </div>
                </div>
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

export default SalaryReviewModal;
