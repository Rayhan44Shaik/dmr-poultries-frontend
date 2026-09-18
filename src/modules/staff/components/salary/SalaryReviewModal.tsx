// src/modules/staff/components/salary/SalaryReviewModal.tsx
//
// "Review & Submit" popup for the Salary Register.
//
// Left selection panel (mirrors the Shop Ledger "Select shops" pattern): a
// FULL scrollable list — no pagination — with search, All/None (acting on the
// employees actually visible under the current search + status filter), and
// All / Unpaid / Paid status chips. The payslip preview is on the right
// (read-only by default; the footer Edit toggles inline editing). "Submit
// Selected" submits first (Pending → Paid); "Send Payslip" beside it opens
// the submitted-only Send Payslips popup (Mail / WhatsApp).
//
// The popup is rendered through <AppShellModal> — the SAME shell as the Trip
// List view: same full-width size (max-w 96rem below the app header), same
// no-blur overlay, same fade/scale animation, same gradient header/footer and
// round red-hover dismiss, and the same English/Telugu chrome vocabulary.
//
// LANGUAGE: the header carries a scoped EN/తెలుగు pill (no tooltip, popup
// scope only). Flipping it translates this popup alone — the app behind
// keeps the global language. Nothing is persisted.

import { useState, useMemo, useCallback, useEffect, useRef, useId } from "react";
import {
  Search,
  X,
  Download,
  FileText,
  Files,
  Save,
  Pencil,
  Loader2,
  Lock,
  ClipboardCheck,
  ListChecks,
  CheckSquare,
  Square,
  ChevronDown,
} from "lucide-react";
import { AppShellModal, Button } from "../../../../ui";
import { useI18n } from "../../../../i18n";
import ScopedI18nProvider from "../../../../i18n/ScopedI18nProvider";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { ClassicPayslipSheet } from "./ClassicPayslipSheet";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import {
  computePayslipTotals,
  isSalaryPaid,
  toAmountValues,
  type AmountFieldKey,
  type AmountValues,
} from "./payslipModel";
import { loadEmployees } from "../../../masters/employees/services/employeeService";
import { salaryDisplayText, salaryMatchesQuery } from "../../utils/salaryDisplay";
import type { SalaryRecord } from "../../types/staffDashboard";

export type SalaryReviewModalProps = {
  monthLabel: string;
  records: SalaryRecord[];
  onClose: () => void;
  /** Submit the given selected employee ids (Pending → Paid). */
  onSubmitSelected: (ids: string[]) => void;
  onSaveRecord: (record: SalaryRecord) => Promise<void>;
  // Selection (owned by the page's salary table).
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  /** Download the given ids as INDIVIDUAL payslip PDFs (one file each). */
  onDownloadSelected: (ids: string[]) => void;
  /** Download the given ids as ONE combined PDF (one page per employee). */
  onDownloadSelectedCombined: (ids: string[]) => void;
};

type FieldKey = AmountFieldKey;
type FieldValues = AmountValues;

export function SalaryReviewModal(props: SalaryReviewModalProps) {
  // Seed the popup scope from the global language; the toggle inside then
  // drives ONLY this popup (never persisted, never touches the app behind).
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <SalaryReviewModalBody {...props} />
    </ScopedI18nProvider>
  );
}

function SalaryReviewModalBody({
  monthLabel,
  records,
  onClose,
  onSubmitSelected,
  onSaveRecord,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDownloadSelected,
  onDownloadSelectedCombined,
}: SalaryReviewModalProps) {
  const { t, language, toggleLanguage } = useI18n();
  const titleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // List filter beside All/None — show everyone, only unpaid (Pending or
  // Submitted), or only paid.
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [drafts, setDrafts] = useState<Record<string, FieldValues>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Download menu (footer): individual PDFs vs all-in-one PDF.
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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
    const byStatus =
      statusFilter === "all"
        ? records
        : records.filter((r) =>
            statusFilter === "paid" ? isSalaryPaid(r) : !isSalaryPaid(r)
          );
    const q = query.trim();
    if (!q) return byStatus;
    return byStatus.filter(
      (r) =>
        salaryMatchesQuery(r.employeeName, q) ||
        salaryMatchesQuery(r.department, q) ||
        String(r.employeeId ?? "").includes(q)
    );
  }, [records, query, statusFilter]);

  const handleStatusFilterChange = useCallback((value: "all" | "unpaid" | "paid") => {
    setStatusFilter(value);
  }, []);

  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const selectedCount = selectedIds.size;
  // Per-chip counts from the FULL record set — the chips must always show
  // what each filter WILL list, even when a side is empty (e.g. nothing
  // submitted yet → Paid = 0).
  const statusCounts = useMemo(
    () => ({
      all: records.length,
      unpaid: records.filter((r) => !isSalaryPaid(r)).length,
      paid: records.filter((r) => isSalaryPaid(r)).length,
    }),
    [records]
  );
  // ONE-TIME SUBMIT: only the PENDING employees inside the selection are
  // submitted. Already Submitted/Paid rows are never submitted again — even
  // when "All" is selected — so the button counts exactly those.
  const pendingSelectedIds = useMemo(
    () => records.filter((r) => selectedIds.has(r.id) && r.status === "Pending").map((r) => r.id),
    [records, selectedIds]
  );
  const pendingSelectedCount = pendingSelectedIds.length;

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  // Arrow-key navigation across the full list; the active row is scrolled
  // into view so keyboard users never lose their place.
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

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-emp-id="${CSS.escape(selectedId)}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  // Close the footer download menu on outside click / Escape.
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDownloadMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [downloadMenuOpen]);

  // Employee-master contact lookup — roster rows show the department beside
  // the employee's mobile number.
  const [contacts, setContacts] = useState<Record<number, string>>({});
  useEffect(() => {
    let cancelled = false;
    loadEmployees()
      .then((list) => {
        if (cancelled) return;
        const map: Record<number, string> = {};
        for (const e of list as Array<{ id: number; phoneNumber?: string }>) {
          if (e.phoneNumber) map[e.id] = e.phoneNumber;
        }
        setContacts(map);
      })
      .catch(() => {
        if (!cancelled) setContacts({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    // Submit ONLY the pending employees of the selection (Pending → Paid) —
    // one time. Already submitted/paid rows are skipped. A dirty edit on the
    // viewed employee is saved first; the payslip email goes out from the
    // page handler for exactly the submitted rows.
    if (pendingSelectedCount === 0) return;
    const afterSave =
      selected && dirty[selected.id] ? handleSave() : Promise.resolve();
    afterSave.then(() => onSubmitSelected(pendingSelectedIds));
  }, [selected, pendingSelectedCount, pendingSelectedIds, dirty, handleSave, onSubmitSelected]);

  return (
    <AppShellModal open onClose={onClose} panelClassName="bg-white" ariaLabelledBy={titleId}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white"
        lang={language === "te" ? "te" : undefined}
      >
        {/* Header — the Trip List view treatment: gradient band, icon tile,
            and the round red-hover dismiss. No count chips here — the table
            footer and the status chips already carry the numbers. */}
        <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/20">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <h2 id={titleId} className="min-w-0 truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl">
                {t("staff.review.title")} — {monthLabel}
              </h2>
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
              {/* Popup-scoped EN/తెలుగు pill, no tooltip — the app behind is untouched. */}
              <ViewLanguageToggle
                language={language}
                onToggle={toggleLanguage}
                tone="emerald"
                labelMode="target"
                ariaLabel={t("staff.popup.language_toggle")}
              />
              <button
                type="button"
                onClick={onClose}
                className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
                aria-label={t("staff.review.close_view")}
              >
                <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                  <X size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Body — employee selection + payslip preview (panels scroll inside). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* LEFT: employee selection — full scrollable list, no pagination */}
            <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50/60 lg:w-[28rem] lg:border-b-0 lg:border-r">
              {/* Header */}
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-slate-800">
                  <ListChecks size={16} className="text-emerald-600" />
                  {t("staff.review.review_employees")}
                </h3>
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
                    placeholder={t("staff.review.search_placeholder")}
                    aria-label={t("staff.review.search_label")}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-7 pr-8 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => handleQueryChange("")}
                      aria-label={t("staff.review.clear_search")}
                      className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-500">
                    <span className="font-bold text-emerald-700 tabular-nums">{selectedCount}</span> {t("staff.review.selected")}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100/80 p-0.5" role="group" aria-label={t("staff.register.filter_by_status")}>
                      {(
                        [
                          { value: "all", label: t("common.all"), count: statusCounts.all },
                          { value: "unpaid", label: t("common.pending"), count: statusCounts.unpaid },
                          { value: "paid", label: t("common.paid"), count: statusCounts.paid },
                        ] as const
                      ).map((opt) => {
                        const active = statusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleStatusFilterChange(opt.value)}
                            aria-pressed={active}
                            title={`${opt.label} — ${opt.count}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all duration-200 ${
                              active
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-500 hover:bg-white hover:text-slate-800"
                            }`}
                          >
                            {opt.label}
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors duration-200 ${
                                active ? "bg-white/25 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
                              }`}
                            >
                              {opt.count}
                            </span>
                          </button>
                        );
                      })}
                    </span>
                    <span className="text-slate-300">|</span>
                    {/* All/None act on the employees VISIBLE under the current
                        search + status filter — never on the whole register. */}
                    <button
                      type="button"
                      onClick={() => onToggleSelectAll(filteredIds)}
                      disabled={filteredIds.length === 0}
                      className="rounded-md px-2 py-1 font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="inline-flex items-center gap-1"><CheckSquare size={12} /> {t("common.all")}</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => onToggleSelectAll([])}
                      disabled={selectedCount === 0}
                      className="rounded-md px-2 py-1 font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="inline-flex items-center gap-1"><Square size={12} /> {t("common.none")}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Employee list — the full filtered roster, simply scrollable. */}
              <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 overscroll-contain">
                {filtered.length > 0 ? (
                  <ul ref={listRef} className="space-y-0.5">
                    {filtered.map((r) => {
                      const isActive = r.id === selected?.id;
                      const isSelected = selectedIds.has(r.id);
                      const isBusy = savingId === r.id;
                      const displayName = salaryDisplayText(r.employeeName, language);
                      const mobile = contacts[r.employeeId] ?? "";
                      return (
                        <li key={r.id} data-emp-id={r.id}>
                          <div
                            onClick={() => setSelectedId(r.id)}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
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
                                  aria-label={t("staff.review.select_employee", { name: r.employeeName })}
                                  className="h-[18px] w-[18px] cursor-pointer accent-emerald-600"
                                />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span
                                className={`block truncate text-sm leading-tight ${
                                  isActive
                                    ? "font-bold text-emerald-700"
                                    : "font-medium text-slate-700"
                                }`}
                              >
                                {displayName}
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-slate-400">
                                <span className="truncate">{salaryDisplayText(r.department, language)}</span>
                                {mobile && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="truncate tabular-nums">{mobile}</span>
                                  </>
                                )}
                              </span>
                            </span>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                                isSalaryPaid(r)
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-600"
                              }`}
                            >
                              {isSalaryPaid(r)
                                ? t("common.paid")
                                : t("common.pending")}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : query.trim() ? (
                  <p className="px-2 py-8 text-center text-xs text-slate-400">
                    {t("staff.review.no_match")}
                  </p>
                ) : (
                  <div className="px-3 py-8 text-center">
                    <p className="text-xs font-semibold text-slate-500">
                      {statusFilter === "paid"
                        ? t("staff.review.empty_paid")
                        : t("staff.review.empty_pending")}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                      {statusFilter === "paid"
                        ? t("staff.review.empty_paid_hint")
                        : t("staff.review.empty_pending_hint")}
                    </p>
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
                {t("staff.review.no_records")}
              </div>
            )}
          </div>
        </div>

        {/* Footer — the Trip List view treatment with the review actions.
            Every icon plays the shared hover animation, like the trip view. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4 md:px-8">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              icon={
                <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                  <X size={13} />
                </span>
              }
            >
              {t("common.close")}
            </Button>
            {editing ? (
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                disabled={!dirty || savingId === selected?.id}
                loading={savingId === selected?.id}
                icon={<Save size={13} />}
              >
                {savingId === selected?.id ? t("staff.review.saving") : dirty ? t("common.save") : t("staff.review.saved")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                disabled={!canEdit}
                icon={
                  canEdit ? (
                    <span className={`inline-flex ${uiActionIconMotionClass.edit}`}>
                      <Pencil size={13} />
                    </span>
                  ) : (
                    <Lock size={13} />
                  )
                }
              >
                {canEdit ? t("common.edit") : t("staff.review.locked")}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Download menu — Individual PDFs (one file per employee) or ALL
                selected payslips combined into ONE PDF. */}
            <div className="relative" ref={downloadMenuRef}>
              <Button
                variant="secondary"
                onClick={() => {
                  // One employee selected → download their single payslip
                  // straight away; several → offer Individual PDFs or the
                  // All in One PDF.
                  if (selectedCount === 1) {
                    onDownloadSelected([...selectedIds]);
                  } else {
                    setDownloadMenuOpen((o) => !o);
                  }
                }}
                disabled={selectedCount === 0}
                aria-haspopup={selectedCount > 1 ? "menu" : undefined}
                aria-expanded={selectedCount > 1 ? downloadMenuOpen : undefined}
                icon={
                  <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}>
                    <Download size={13} />
                  </span>
                }
              >
                {t("common.download")} ({selectedCount})
                <ChevronDown size={12} className={`transition-transform ${downloadMenuOpen ? "rotate-180" : ""}`} />
              </Button>
              {downloadMenuOpen && (
                <div
                  role="menu"
                  aria-label={t("staff.review.download_menu_label")}
                  className="absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl animate-scale-in"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      onDownloadSelected([...selectedIds]);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 transition hover:bg-emerald-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Files size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        {t(
                          selectedCount === 1
                            ? "staff.review.download_individual_one"
                            : "staff.review.download_individual_other",
                          { count: selectedCount }
                        )}
                      </span>
                      <span className="block text-[11px] font-medium text-slate-400">{t("staff.register.download_individual_hint")}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      onDownloadSelectedCombined([...selectedIds]);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 transition hover:bg-emerald-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <FileText size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        {t(
                          selectedCount === 1
                            ? "staff.review.download_single_one"
                            : "staff.review.download_single_other",
                          { count: selectedCount }
                        )}
                      </span>
                      <span className="block text-[11px] font-medium text-slate-400">{t("staff.register.download_single_hint")}</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={pendingSelectedCount === 0}
              icon={
                <span className={`inline-flex ${uiActionIconMotionClass.approve}`}>
                  <ClipboardCheck size={15} />
                </span>
              }
            >
              {t("staff.review.submit_selected")} ({pendingSelectedCount})
            </Button>
          </div>
        </div>
      </div>
    </AppShellModal>
  );
}

// ---------------------------------------------------------------------------

export default SalaryReviewModal;
