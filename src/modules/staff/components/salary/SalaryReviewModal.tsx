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
// The popup is rendered through <AppShellModal> — the SAME shell as the Trip
// List view: same full-width size (max-w 96rem below the app header), same
// no-blur overlay, same fade/scale animation, same gradient header/footer and
// round red-hover dismiss, and the same English/Telugu chrome vocabulary.
//
// LANGUAGE: the header carries a scoped EN/తెలుగు toggle (the same pattern as
// the performance details pop-up). Flipping it translates this popup alone —
// the app behind keeps the global language. Nothing is persisted.

import { useState, useMemo, useCallback, useEffect, useId } from "react";
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
import { AppShellModal, Button } from "../../../../ui";
import { useI18n } from "../../../../i18n";
import ScopedI18nProvider from "../../../../i18n/ScopedI18nProvider";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { LanguageMiniToggle } from "../performance/LanguageMiniToggle";
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

/** First + last initials for the employee avatar ("Ravi Kumar" → "RK"). */
function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Avatar gradient + status dot per payroll status. */
const AVATAR_TONE: Record<string, string> = {
  Paid: "from-emerald-500 to-teal-600",
  Submitted: "from-sky-500 to-blue-600",
  Pending: "from-amber-500 to-orange-600",
};
const STATUS_DOT: Record<string, string> = {
  Paid: "bg-emerald-500",
  Submitted: "bg-sky-500",
  Pending: "bg-amber-500",
};

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
  const { t, language } = useI18n();
  const titleId = useId();
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

  const employeeUnit = (count: number) =>
    count === 1 ? t("staff.review.employee_one") : t("staff.review.employee_other");

  return (
    <AppShellModal open onClose={onClose} panelClassName="bg-white" ariaLabelledBy={titleId}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white"
        lang={language === "te" ? "te" : undefined}
      >
        {/* Header — the Trip List view treatment: gradient band, icon tile,
            counts, and the round red-hover dismiss. */}
        <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/20">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl">
                  {t("staff.review.title")} — {monthLabel}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-100 bg-amber-50/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    {records.length} {employeeUnit(records.length)} · {pendingCount} {t("common.pending")}
                  </span>
                  {(emailsSentCount > 0 || whatsappSentCount > 0) && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 size={11} />
                      {emailsSentCount > 0 && t("staff.review.emailed_badge", { count: emailsSentCount })}
                      {emailsSentCount > 0 && whatsappSentCount > 0 && " · "}
                      {whatsappSentCount > 0 && t("staff.review.whatsapp_badge", { count: whatsappSentCount })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
              {/* Popup-scoped EN/తెలుగు switch — the app behind is untouched. */}
              <LanguageMiniToggle className="border-slate-200 bg-white shadow-sm" />
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
            {/* LEFT: employee selection */}
            <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50/60 lg:w-[21rem] lg:border-b-0 lg:border-r">
              {/* Header — gradient band with icon tile, live counts and a
                  selected-count chip. */}
              <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                    <ListChecks size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold tracking-tight text-slate-800">
                      {t("staff.review.review_employees")}
                    </h3>
                    <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                      {records.length} {employeeUnit(records.length)} ·{" "}
                      {pendingCount} {t("common.pending")}
                    </p>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-emerald-700 shadow-xs"
                    title={`${selectedCount} ${t("staff.review.selected")}`}
                  >
                    <CheckSquare size={12} />
                    {selectedCount}
                  </span>
                </div>
              </div>

              {/* Toolbar: search + bulk actions */}
              <div className="space-y-2.5 border-b border-slate-200 bg-white px-3 py-3">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                  <input
                    type="text"
                    id="salary-review-search"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder={t("staff.review.search_placeholder")}
                    aria-label={t("staff.review.search_label")}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-9 text-xs font-medium text-slate-700 shadow-inner placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => handleQueryChange("")}
                      aria-label={t("staff.review.clear_search")}
                      className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">
                    <span className="font-bold text-emerald-700 tabular-nums">{selectedCount}</span> {t("staff.review.selected")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleSelectAll(allIds)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-95"
                    >
                      <CheckSquare size={12} /> {t("common.all")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSelectAll([])}
                      disabled={selectedCount === 0}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Square size={12} /> {t("common.none")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Employee list — 10 at a time. Each row is a card: checkbox,
                  status-tinted avatar with a payroll-status dot, name +
                  department, and mail/WhatsApp sent pills. */}
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain max-h-64 lg:max-h-none px-2 py-2">
                  {pageRecords.length > 0 ? (
                    <ul className="space-y-1">
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
                              className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 ring-1 transition-all ${
                                isActive
                                  ? "bg-emerald-50/90 shadow-sm ring-emerald-300"
                                  : isSelected
                                  ? "bg-white shadow-xs ring-emerald-100"
                                  : "bg-white/70 ring-slate-100 hover:bg-white hover:shadow-xs hover:ring-slate-200"
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
                                    className="h-4 w-4 cursor-pointer accent-emerald-600"
                                  />
                                )}
                              </span>

                              <span
                                className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${AVATAR_TONE[r.status] ?? "from-slate-500 to-slate-700"}`}
                              >
                                {initials(r.employeeName)}
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${STATUS_DOT[r.status] ?? "bg-slate-400"}`}
                                />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span
                                  className={`block truncate text-[13px] leading-tight ${
                                    isActive
                                      ? "font-bold text-emerald-800"
                                      : "font-semibold text-slate-700"
                                  }`}
                                >
                                  {r.employeeName}
                                </span>
                                <span className="mt-0.5 block truncate text-[10.5px] text-slate-400">
                                  {r.department}{r.employeeId != null ? ` · #${r.employeeId}` : ""}
                                </span>
                              </span>

                              <span className="flex shrink-0 items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                                    emailsSent > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-300"
                                  }`}
                                >
                                  <Mail size={10} />
                                  {emailsSent}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                                    whatsappsSent > 0 ? "bg-[#25D366]/10 text-[#128C3E]" : "bg-slate-50 text-slate-300"
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
                    <div className="px-2 py-8 text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-300 shadow-xs ring-1 ring-slate-100">
                        <Search size={16} />
                      </div>
                      <p className="text-xs font-medium text-slate-400">
                        {t("staff.review.no_match")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                  <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-3 py-2">
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {`${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(
                        activePage * PAGE_SIZE,
                        filtered.length
                      )}`}
                      <span className="text-slate-300"> {t("staff.review.of")} </span>
                      {filtered.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={activePage <= 1}
                        aria-label={t("staff.review.prev_page")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-bold tabular-nums text-white shadow-xs">
                        {activePage}/{totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={activePage >= totalPages}
                        aria-label={t("staff.review.next_page")}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
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
            <Button
              variant="secondary"
              onClick={() => onDownloadSelected([...selectedIds])}
              disabled={selectedCount === 0}
              icon={
                <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}>
                  <Download size={13} />
                </span>
              }
            >
              {t("common.download")} ({selectedCount})
            </Button>
            <Button
              variant="secondary"
              onClick={onEmailSelected}
              disabled={selectedCount === 0}
              icon={
                <span className={`inline-flex ${uiActionIconMotionClass.mail}`}>
                  <Mail size={13} />
                </span>
              }
            >
              {t("staff.review.email")} ({selectedCount})
            </Button>
            <Button
              variant="custom"
              className="bg-[#25D366] text-white shadow-xs hover:bg-[#1DA851] active:bg-[#1DA851]"
              onClick={onWhatsAppSelected}
              disabled={selectedCount === 0}
              icon={
                <span className={`inline-flex ${uiActionIconMotionClass.whatsapp}`}>
                  <WhatsAppBrandIcon size={13} />
                </span>
              }
            >
              WhatsApp ({selectedCount})
            </Button>
            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={selectedCount === 0 || submitDisabled}
              icon={
                <span className={`inline-flex ${uiActionIconMotionClass.approve}`}>
                  <ClipboardCheck size={15} />
                </span>
              }
            >
              {t("staff.review.submit_selected")} ({selectedCount})
            </Button>
          </div>
        </div>
      </div>
    </AppShellModal>
  );
}

// ---------------------------------------------------------------------------

export default SalaryReviewModal;
