// src/modules/staff/components/salary/SalaryReviewModal.tsx
//
// "Review & Submit" popup for the Salary Register.
//
// Left selection panel (mirrors the Shop Ledger "Select shops" pattern): search,
// All/None, checkbox list, and bottom actions (Download Selected / Email
// Payslips). The payslip preview is on the right (read-only by default; the
// footer Edit toggles inline editing). After a successful email send, "Submit
// Selected" submits only the chosen employees.
//
// The popup is rendered through the app-wide <Modal /> (portal, focus trap,
// Escape / overlay dismissal, ARIA dialog semantics) so it behaves exactly like
// every other dialog in the application.

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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button, Modal } from "../../../../ui";
import { ClassicPayslipSheet } from "./ClassicPayslipSheet";
import {
  computePayslipTotals,
  toAmountValues,
  type AmountFieldKey,
  type AmountValues,
} from "./payslipModel";
import { WhatsAppBrandIcon } from "../../../../ui/WhatsAppBrandIcon";
import type { SalaryRecord } from "../../types/staffDashboard";

/** Number of employees shown per page in the left selection list. */
const PAGE_SIZE = 10;

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
  onWhatsAppSelected: () => void;
  /** Number of payslips successfully emailed (shown once sent). */
  emailsSentCount?: number;
  /** Number of payslips successfully WhatsApp'd (shown once sent). */
  whatsappSentCount?: number;
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
  onWhatsAppSelected,
  emailsSentCount = 0,
  whatsappSentCount = 0,
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

  // Reset the inline editor whenever the viewed employee changes. Done during
  // render (React's "adjust state on prop change" pattern) so it cannot cause
  // a cascading render.
  const [editingFor, setEditingFor] = useState<string | null>(null);
  if (editingFor !== selectedId) {
    setEditingFor(selectedId);
    setEditing(false);
  }

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
          target.tagName === "SELECT" ||
          target.isContentEditable)
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
    // Guard: submitting is only allowed after a successful payslip delivery
    // (email OR WhatsApp). The footer button is disabled via `submitDisabled`,
    // and this guard prevents it firing through any other path.
    if (selectedCount === 0 || submitDisabled) return;
    const afterSave =
      selected && dirty[selected.id] ? handleSave() : Promise.resolve();
    afterSave.then(() => onSubmitSelected([...selectedIds]));
  }, [selected, selectedCount, dirty, handleSave, onSubmitSelected, selectedIds, submitDisabled]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      width="sm:max-w-5xl"
      title={`Review & Submit — ${monthLabel}`}
      description={`${records.length} employee${records.length === 1 ? "" : "s"} · ${pendingCount} pending`}
      bodyClassName="flex flex-col pl-0 pr-0 pt-0 pb-0"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {editing ? (
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                disabled={!dirty || savingId === selected?.id}
                loading={savingId === selected?.id}
                icon={<Save size={13} />}
              >
                {savingId === selected?.id ? "Saving…" : dirty ? "Save" : "Saved"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                disabled={!canEdit}
                title={canEdit ? "Edit this payslip" : "Locked — only Pending records can be edited"}
                icon={canEdit ? <Pencil size={13} /> : <Lock size={13} />}
              >
                {canEdit ? "Edit" : "Locked"}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => onDownloadSelected([...selectedIds])}
              disabled={selectedCount === 0}
              icon={<Download size={13} />}
            >
              Download ({selectedCount})
            </Button>
            <Button
              variant="secondary"
              onClick={onEmailSelected}
              disabled={selectedCount === 0}
              icon={<Mail size={13} />}
            >
              Email ({selectedCount})
            </Button>
            <Button
              variant="custom"
              className="bg-[#25D366] text-white shadow-xs hover:bg-[#1DA851] active:bg-[#1DA851]"
              onClick={onWhatsAppSelected}
              disabled={selectedCount === 0}
              icon={<WhatsAppBrandIcon size={13} />}
            >
              WhatsApp ({selectedCount})
            </Button>
            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || submitDisabled}
              icon={<ClipboardCheck size={15} />}
            >
              Submit Selected ({selectedCount})
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* LEFT: employee selection */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50/60 lg:w-80 lg:border-b-0 lg:border-r">
          {/* Header */}
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <ListChecks size={15} className="text-blue-600" />
                Review employees
              </h3>
              {(emailsSentCount > 0 || whatsappSentCount > 0) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 size={11} />
                  {emailsSentCount > 0 && `${emailsSentCount} emailed`}
                  {emailsSentCount > 0 && whatsappSentCount > 0 && " · "}
                  {whatsappSentCount > 0 && `${whatsappSentCount} WhatsApp'd`}
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
                id="salary-review-search"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by name or department"
                aria-label="Search employees"
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-7 pr-8 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                <span className="font-bold text-emerald-700 tabular-nums">{selectedCount}</span> selected
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleSelectAll(allIds)}
                  className="rounded-md px-2 py-1 font-semibold text-emerald-600 transition hover:bg-emerald-50"
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
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 overscroll-contain max-h-64 lg:max-h-none">
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
                              ? "bg-emerald-50 ring-1 ring-emerald-200"
                              : isSelected
                              ? "bg-emerald-50/40"
                              : "hover:bg-white"
                          }`}
                        >
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isBusy ? (
                              <Loader2 size={13} className="animate-spin text-emerald-500" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelect(r.id)}
                                aria-label={`Select ${r.employeeName}`}
                                className="h-4 w-4 cursor-pointer accent-emerald-600"
                              />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-[13px] leading-tight ${
                                isActive
                                  ? "font-bold text-emerald-700"
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
                                emailsSent > 0 ? "text-emerald-600" : "text-slate-300"
                              }`}
                            >
                              <Mail size={10} />
                              {emailsSent}
                            </span>
                            <span
                              title={`${whatsappsSent} WhatsApp${whatsappsSent === 1 ? "" : "s"} sent`}
                              className={`inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-semibold tabular-nums ${
                                whatsappsSent > 0 ? "text-[#25D366]" : "text-slate-300"
                              }`}
                            >
                              <WhatsAppBrandIcon size={11} />
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
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-5">
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
          <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
            No salary records for this month.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export default SalaryReviewModal;
