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
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/** Number of employees shown per page in the left selection list. */
const PAGE_SIZE = 10;
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
  const [page, setPage] = useState(1);

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
  const selectedCount = selectedIds.size;

  // Pagination — show PAGE_SIZE employees at a time. `activePage` is clamped
  // so the slice/indicator never overflow even if the list shrinks.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const pageRecords = useMemo(
    () => filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE),
    [filtered, activePage]
  );

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  // Arrow-key navigation across the current page.
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
      if (pageRecords.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const idx = pageRecords.findIndex((r) => r.id === selected?.id);
        const nextIdx =
          idx < 0 ? 0 : (idx + dir + pageRecords.length) % pageRecords.length;
        setSelectedId(pageRecords[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageRecords, selected]);

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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* LEFT: employee selection */}
          <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50/60">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <ListChecks size={15} className="text-blue-600" />
                  Review employees
                </h4>
                {emailsSentCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} /> {emailsSentCount} emailed
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {records.length} employee{records.length === 1 ? "" : "s"} ·{" "}
                {pendingCount} pending
              </p>
            </div>

            {/* Toolbar: search + bulk actions */}
            <div className="space-y-2 border-b border-slate-200 bg-white px-3 py-2.5">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search by name or department"
                  aria-label="Search employees"
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-7 pr-8 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => handleQueryChange("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-500">
                  <span className="font-bold text-blue-700 tabular-nums">{selectedCount}</span> selected
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleSelectAll(allIds)}
                    className="rounded-md px-2 py-1 font-semibold text-blue-600 transition hover:bg-blue-50"
                  >
                    <span className="inline-flex items-center gap-1"><CheckSquare size={12} /> All</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => onToggleSelectAll([])}
                    disabled={selectedCount === 0}
                    className="rounded-md px-2 py-1 font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1"><Square size={12} /> None</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Employee list — 10 at a time */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 overscroll-contain">
                {pageRecords.length > 0 ? (
                  <ul className="space-y-0.5">
                    {pageRecords.map((r) => {
                      const isActive = r.id === selected?.id;
                      const isSelected = selectedIds.has(r.id);
                      const isBusy = savingId === r.id;
                      const emailsSent = r.emailsSent ?? 0;
                      const whatsappsSent = r.whatsappsSent ?? 0;
                      return (
                        <li key={r.id}>
                          <div
                            onClick={() => setSelectedId(r.id)}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                              isActive
                                ? "bg-blue-50 ring-1 ring-blue-200"
                                : isSelected
                                ? "bg-blue-50/40"
                                : "hover:bg-white"
                            }`}
                          >
                            <span
                              className="flex h-4 w-4 shrink-0 items-center justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isBusy ? (
                                <Loader2 size={13} className="animate-spin text-blue-500" />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onToggleSelect(r.id)}
                                  aria-label={`Select ${r.employeeName}`}
                                  className="h-4 w-4 cursor-pointer accent-blue-600"
                                />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-[13px] leading-tight ${
                                  isActive
                                    ? "font-bold text-blue-700"
                                    : "font-medium text-slate-700"
                                }`}
                                title={r.employeeName}
                              >
                                {r.employeeName}
                              </span>
                              <span className="block truncate text-[10.5px] text-slate-400">
                                {r.department}
                              </span>
                            </span>

                            <span className="flex shrink-0 items-center gap-0.5">
                              <span
                                title={`${emailsSent} email${emailsSent === 1 ? "" : "s"} sent`}
                                className={`inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold tabular-nums ${
                                  emailsSent > 0 ? "text-blue-600" : "text-slate-300"
                                }`}
                              >
                                <Mail size={10} />
                                {emailsSent}
                              </span>
                              <span
                                title={`${whatsappsSent} WhatsApp${whatsappsSent === 1 ? "" : "s"} sent`}
                                className={`inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold tabular-nums ${
                                  whatsappsSent > 0 ? "text-emerald-600" : "text-slate-300"
                                }`}
                              >
                                <MessageCircle size={10} />
                                {whatsappsSent}
                              </span>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-2 py-8 text-center text-xs text-slate-400">
                    No employees match your search.
                  </p>
                )}
              </div>

              {/* Pagination */}
              {filtered.length > 0 && (
                <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-3 py-1.5">
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {`${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(
                      activePage * PAGE_SIZE,
                      filtered.length
                    )}`}
                    <span className="text-slate-300"> of </span>
                    {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={activePage <= 1}
                      aria-label="Previous page"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className="px-1 text-[11px] font-semibold text-slate-600 tabular-nums">
                      {activePage}/{totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage >= totalPages}
                      aria-label="Next page"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
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
