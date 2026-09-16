// src/modules/staff/components/salary/SendPayslipsModal.tsx
//
// "Send Payslips" popup for the Salary Register — SUBMITTED employees only,
// with a Mail / WhatsApp channel switch.
//
// Same shell and size as Review & Submit / the Trip List view (AppShellModal
// at z-70, above Review): gradient header with a submitted-count chip (the
// popup follows the global language — no switch), a channel tab bar, a
// Review-style recipient list on the left (search, All/None, full
// scrollable list, click a row to preview) and the message details on the
// right (recipient card, editable subject + message with the name filled
// in, shop-ledger style Check PDF / Hide card).
//
// Flow: payslips are submitted FIRST (Review & Submit moves Pending → Paid);
// this popup only ever lists submitted records. Sending here never gates
// anything — it just delivers payslips and reports true sent/failed counts.
//
// LANGUAGE: popup-scoped pill (seeded from global, no tooltip). Flipping it
// translates this popup's chrome AND re-seeds the message templates — the app
// behind keeps the global language. Nothing is persisted.

import { useState, useMemo, useEffect, useRef, useId } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Download,
  Eye,
  EyeOff,
  FileText,
  ListChecks,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Send,
  Square,
  X,
} from "lucide-react";
import { AppShellModal, Button } from "../../../../ui";
import { ScopedI18nProvider, useI18n, type Language } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { usePopupGuard } from "./usePopupGuard";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import PdfBlobPreview from "../../../reports/components/PdfBlobPreview";
import { WhatsAppBrandIcon } from "../../../../ui/WhatsAppBrandIcon";
import { loadEmployees } from "../../../masters/employees/services/employeeService";
import { generatePayslipPdf } from "../../services/payslipPdf";
import { SAMPLE_EMPLOYEE_LIST } from "../../services/staffSampleData";
import { salaryDisplayText, salaryMatchesQuery } from "../../utils/salaryDisplay";
import type { SalaryRecord } from "../../types/staffDashboard";

export type SendChannel = "email" | "whatsapp";

// Payslip cover messages — short, warm and professional, in English and
// Telugu. {name} is replaced per recipient at preview/edit time; {month} is
// filled at seed time. Email stays formal; WhatsApp reads like a friendly
// note from the office.
const EMAIL_TEMPLATES: Record<Language, { subject: string; body: (name: string, month: string) => string }> = {
  en: {
    subject: "Salary Payslip — {month}",
    body: (name, month) =>
      `Dear ${name},\n\nYour salary payslip for ${month} is attached.\n\nThank you for your hard work and dedication.\n\nWarm regards,\nDMR Poultries`,
  },
  te: {
    subject: "జీతం పేస్లిప్ — {month}",
    body: (name, month) =>
      `ప్రియమైన ${name},\n\n${month} నెల మీ జీతం పేస్లిప్ జతచేయబడింది. దయచేసి చూడండి.\n\nమీ కృషికి మరియు అంకితభావానికి ధన్యవాదాలు.\n\nగౌరవంతో,\nDMR Poultries`,
  },
};

const WA_TEMPLATES: Record<Language, { body: (name: string, month: string) => string }> = {
  en: {
    body: (name, month) =>
      `Hello ${name}! 👋\n\nYour salary payslip for ${month} is attached with this message.\n\nThank you for your hard work — proud to have you on the team. 🙏\n\n— DMR Poultries`,
  },
  te: {
    body: (name, month) =>
      `నమస్కారం ${name}! 👋\n\n${month} నెల మీ జీతం పేస్లిప్ ఈ మెసేజ్‌తో జతచేయబడింది.\n\nమీ కృషికి ధన్యవాదాలు — మీరు మా టీమ్‌లో భాగమవడం మా గర్వం. 🙏\n\n— DMR Poultries`,
  },
};

export type SendPayslipsModalProps = {
  monthLabel: string;
  /** Submitted (Paid) records to send — the modal refilters defensively. */
  records: SalaryRecord[];
  initialChannel?: SendChannel;
  saving?: boolean;
  onClose: () => void;
  onSent: (channel: SendChannel, sent: number, failed: number) => void;
  onSendEmail: (
    ids: string[],
    payload: { language: Language; subject: string; body: string }
  ) => Promise<{ sent: number; failed: number }>;
  onSendWhatsApp: (
    ids: string[],
    payload: { language: Language; body: string }
  ) => Promise<{ sent: number; failed: number }>;
};

export function SendPayslipsModal(props: SendPayslipsModalProps) {
  // Seed the popup scope from the global language; the toggle inside then
  // drives ONLY this popup (never persisted, never touches the app behind).
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <SendPayslipsDialog {...props} />
    </ScopedI18nProvider>
  );
}

function SendPayslipsDialog({
  monthLabel,
  records,
  initialChannel = "email",
  saving = false,
  onClose,
  onSent,
  onSendEmail,
  onSendWhatsApp,
}: SendPayslipsModalProps) {
  const { t, language, toggleLanguage } = useI18n();
  const titleId = useId();
  const [channel, setChannel] = useState<SendChannel>(initialChannel);
  // Templates seed from the active scope language on mount — the popup must
  // never open with an empty subject/message. Switching language re-seeds.
  const [subject, setSubject] = useState(() =>
    EMAIL_TEMPLATES[language].subject.replace("{month}", monthLabel)
  );
  const [emailBody, setEmailBody] = useState(() => EMAIL_TEMPLATES[language].body("{name}", monthLabel));
  const [waBody, setWaBody] = useState(() => WA_TEMPLATES[language].body("{name}", monthLabel));
  const [emails, setEmails] = useState<Record<number, string>>({});
  const [phones, setPhones] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<SendChannel, { sent: number; failed: number } | null>>({
    email: null,
    whatsapp: null,
  });
  const [apiDown, setApiDown] = useState<Record<SendChannel, boolean>>({ email: false, whatsapp: false });
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingOne, setDownloadingOne] = useState(false);

  // Submitted-only recipient list (defensive: the page already filters).
  const submitted = useMemo(
    () => records.filter((r) => r.status === "Paid" || r.status === "Submitted"),
    [records]
  );
  // Everything starts selected; the user may narrow it down.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(submitted.map((r) => r.id))
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Payslip attachment preview (shop-ledger style show / hide).
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfFile, setPdfFile] = useState<{ name: string; url: string } | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  // Background isolation: no scroll, no Review-popup arrow navigation, and
  // Escape closes only this popup.
  usePopupGuard(onClose);

  // Resolve employee contacts by id (employee master holds them).
  useEffect(() => {
    let cancelled = false;
    loadEmployees()
      .then((list) => {
        if (cancelled) return;
        const mailMap: Record<number, string> = {};
        const phoneMap: Record<number, string> = {};
        for (const e of list as Array<{ id: number; email?: string; phoneNumber?: string }>) {
          if (e.email) mailMap[e.id] = e.email;
          if (e.phoneNumber) phoneMap[e.id] = e.phoneNumber;
        }
        setEmails(mailMap);
        setPhones(phoneMap);
      })
      .catch(() => {
        if (cancelled) return;
        // Backend offline — fall back to the sample employee directory so the
        // recipients still show contacts for preview / review.
        const mailMap: Record<number, string> = {};
        const phoneMap: Record<number, string> = {};
        for (const e of SAMPLE_EMPLOYEE_LIST) {
          if (e.id != null && e.email) mailMap[e.id] = e.email;
          if (e.id != null && e.phoneNumber) phoneMap[e.id] = e.phoneNumber;
        }
        setEmails(mailMap);
        setPhones(phoneMap);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke the attachment object URL when the popup closes.
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  // Re-seed templates whenever the popup language or month changes. Adjust
  // state during render (React's recommended pattern) rather than in an
  // effect, so the change cannot cause a cascading render.
  const [seedKey, setSeedKey] = useState(() => `${language}|${monthLabel}`);
  if (seedKey !== `${language}|${monthLabel}`) {
    setSeedKey(`${language}|${monthLabel}`);
    setSubject(EMAIL_TEMPLATES[language].subject.replace("{month}", monthLabel));
    setEmailBody(EMAIL_TEMPLATES[language].body("{name}", monthLabel));
    setWaBody(WA_TEMPLATES[language].body("{name}", monthLabel));
  }

  const recipients = useMemo(
    () =>
      submitted.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        name: salaryDisplayText(r.employeeName, language),
        rawName: r.employeeName,
        department: salaryDisplayText(r.department, language),
        email: emails[r.employeeId] ?? "",
        phone: phones[r.employeeId] ?? "",
      })),
    [submitted, emails, phones, language]
  );

  // Bilingual search across name, department, id and both contacts.
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        salaryMatchesQuery(r.rawName, q) ||
        salaryMatchesQuery(submitted.find((s) => s.id === r.id)?.department ?? "", q) ||
        String(r.employeeId).includes(q) ||
        r.email.toLowerCase().includes(q.toLowerCase()) ||
        r.phone.toLowerCase().includes(q.toLowerCase())
    );
  }, [recipients, submitted, query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  const targetRecords = useMemo(
    () => submitted.filter((r) => selectedIds.has(r.id)),
    [submitted, selectedIds]
  );
  const withContact = (ch: SendChannel) =>
    recipients.filter((r) => (ch === "email" ? r.email : r.phone)).length;
  const selectedWithContact = (ch: SendChannel) =>
    recipients.filter((r) => selectedIds.has(r.id) && (ch === "email" ? r.email : r.phone)).length;
  const unselectedCount = submitted.length - targetRecords.length;

  const preview = recipients.find((r) => r.id === previewId) ?? recipients[0] ?? null;
  const previewRecord = submitted.find((r) => r.id === preview?.id) ?? null;

  const activeBody = channel === "email" ? emailBody : waBody;
  const setActiveBody = channel === "email" ? setEmailBody : setWaBody;
  // The box shows the message with the recipient's name filled in.
  const resolvedBody = preview ? activeBody.replace(/\{name\}/g, preview.name) : activeBody;

  const handleBodyChange = (value: string) => {
    // Convert the greeting line back to the {name} template on edit, so every
    // recipient still gets their own name (send uses the template).
    const name = preview?.name ?? "";
    if (!name) {
      setActiveBody(value);
      return;
    }
    const lines = value.split("\n");
    const idx = lines[0].indexOf(name);
    if (idx >= 0) {
      lines[0] = lines[0].slice(0, idx) + "{name}" + lines[0].slice(idx + name.length);
    }
    setActiveBody(lines.join("\n"));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetPdf = () => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setPdfFile(null);
    setPdfOpen(false);
    setPdfBusy(false);
  };

  const selectPreview = (id: string) => {
    setPreviewId(id);
    resetPdf();
  };

  const handleTogglePdf = async () => {
    if (pdfOpen) {
      setPdfOpen(false);
      return;
    }
    if (pdfBusy || !previewRecord) return;
    if (pdfFile) {
      setPdfOpen(true);
      return;
    }
    setPdfBusy(true);
    try {
      const built = await generatePayslipPdf(previewRecord, "preview");
      pdfUrlRef.current = built.url;
      setPdfFile({ name: built.fileName, url: built.url });
      setPdfOpen(true);
    } finally {
      setPdfBusy(false);
    }
  };

  const handleDownloadOne = async () => {
    if (!previewRecord || downloadingOne) return;
    setDownloadingOne(true);
    try {
      await generatePayslipPdf(previewRecord, "download");
    } finally {
      setDownloadingOne(false);
    }
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    setStatus((prev) => ({ ...prev, [channel]: null }));
    setApiDown((prev) => ({ ...prev, [channel]: false }));
    try {
      const result =
        channel === "email"
          ? await onSendEmail(
              targetRecords.map((r) => r.id),
              { language, subject, body: emailBody }
            )
          : await onSendWhatsApp(
              targetRecords.map((r) => r.id),
              { language, body: waBody }
            );
      setStatus((prev) => ({ ...prev, [channel]: result }));
      onSent(channel, result.sent, result.failed);
    } catch {
      // Backend channel unavailable — offer the branded PDFs so the payslips
      // can still go out from any mail app / WhatsApp client.
      setApiDown((prev) => ({ ...prev, [channel]: true }));
      setStatus((prev) => ({ ...prev, [channel]: { sent: 0, failed: targetRecords.length } }));
    } finally {
      setSending(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      for (const record of targetRecords) {
        await generatePayslipPdf(record, "download");
        if (targetRecords.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  const channelStatus = status[channel];
  const channelDown = apiDown[channel];
  const sendCount = selectedWithContact(channel);
  const sendLabel =
    channel === "email"
      ? t(sendCount === 1 ? "staff.send.send_email_one" : "staff.send.send_email_other", { count: sendCount })
      : t(sendCount === 1 ? "staff.send.send_wa_one" : "staff.send.send_wa_other", { count: sendCount });
  const channelContactLabel = (has: boolean) =>
    has ? "" : t(channel === "email" ? "staff.send.no_email" : "staff.send.no_phone");

  return (
    <AppShellModal open onClose={onClose} panelClassName="bg-white" ariaLabelledBy={titleId} zIndex={70}>
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
                <Send className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl">
                  {t("staff.send.title")} — {monthLabel}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} />
                    {t("staff.send.submitted_chip", { count: submitted.length })}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {t("staff.send.selected_line", {
                      selected: targetRecords.length,
                      total: submitted.length,
                      month: monthLabel,
                    })}
                  </span>
                </div>
              </div>
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
                aria-label={t("staff.send.close_view")}
              >
                <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                  <X size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>

        {submitted.length === 0 ? (
          /* Empty — nothing submitted yet, so nothing can be sent. */
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Send size={22} />
            </span>
            <p className="text-sm font-bold text-slate-700">{t("staff.send.empty_title")}</p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">{t("staff.send.empty_desc")}</p>
          </div>
        ) : (
          <>
            {/* Channel toggle — one neat centred segmented control; the freed
                band height goes to the message / PDF preview below. */}
            <div className="flex shrink-0 justify-center border-b border-slate-100 bg-slate-50/60 px-6 py-2 md:px-8">
              <div
                role="tablist"
                aria-label={t("staff.send.title")}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
              >
                {(["email", "whatsapp"] as SendChannel[]).map((ch) => {
                  const active = channel === ch;
                  const count = withContact(ch);
                  return (
                    <button
                      key={ch}
                      role="tab"
                      type="button"
                      aria-selected={active}
                      onClick={() => setChannel(ch)}
                      className={`flex h-7 items-center gap-1.5 rounded-lg px-4 text-[12px] font-bold transition-all active:scale-[0.98] ${
                        active
                          ? ch === "email"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-[#25D366] text-white shadow-sm"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                    >
                      {ch === "email" ? <Mail size={13} /> : <WhatsAppBrandIcon size={13} />}
                      {t(ch === "email" ? "staff.send.channel_email" : "staff.send.channel_whatsapp")}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body — recipient selection + message (panels scroll inside). */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                {/* LEFT: recipient selection */}
                <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-50/60 lg:w-96 lg:border-b-0 lg:border-r">
                  <div className="border-b border-slate-200 bg-white px-4 py-3">
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <ListChecks size={15} className="text-emerald-600" />
                      {t("staff.send.select_recipients")}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                      {targetRecords.length} / {submitted.length}
                    </p>
                  </div>

                  <div className="space-y-2 border-b border-slate-200 bg-white px-3 py-2.5">
                    <div className="relative">
                      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        placeholder={t("staff.send.search_placeholder")}
                        aria-label={t("staff.send.search_label")}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-7 pr-8 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">
                        <span className="font-bold text-emerald-700 tabular-nums">{targetRecords.length}</span>{" "}
                        {t("staff.review.selected")}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedIds(new Set(submitted.map((r) => r.id)))}
                          className="rounded-md px-2 py-1 font-semibold text-emerald-600 transition hover:bg-emerald-50"
                        >
                          <span className="inline-flex items-center gap-1"><CheckSquare size={12} /> {t("common.all")}</span>
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedIds(new Set())}
                          disabled={targetRecords.length === 0}
                          className="rounded-md px-2 py-1 font-semibold text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="inline-flex items-center gap-1"><Square size={12} /> {t("common.none")}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 max-h-64 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 lg:max-h-none">
                      {filtered.length > 0 ? (
                        <ul className="space-y-0.5">
                          {filtered.map((r) => {
                            const isActive = r.id === preview?.id;
                            const isSelected = selectedIds.has(r.id);
                            const contact = channel === "email" ? r.email : r.phone;
                            return (
                              <li key={r.id}>
                                <div
                                  onClick={() => selectPreview(r.id)}
                                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition ${
                                    isActive
                                      ? channel === "email"
                                        ? "bg-emerald-50 ring-1 ring-emerald-200"
                                        : "bg-[#25D366]/10 ring-1 ring-[#25D366]/30"
                                      : isSelected
                                        ? channel === "email"
                                          ? "bg-emerald-50/40"
                                          : "bg-[#25D366]/5"
                                        : "hover:bg-white"
                                  }`}
                                >
                                  <span
                                    className="flex h-4 w-4 shrink-0 items-center justify-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelect(r.id)}
                                      aria-label={t(channel === "email" ? "staff.send.aria_send_email" : "staff.send.aria_send_wa", { name: r.name })}
                                      className={`h-4 w-4 cursor-pointer ${channel === "email" ? "accent-emerald-600" : "accent-[#25D366]"}`}
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className={`block truncate text-[13px] leading-tight ${
                                        isActive
                                          ? channel === "email"
                                            ? "font-bold text-emerald-700"
                                            : "font-bold text-[#128C3E]"
                                          : "font-medium text-slate-700"
                                      }`}
                                    >
                                      {r.name}
                                    </span>
                                    <span
                                      className={`block truncate text-[10.5px] tabular-nums ${
                                        contact ? "text-slate-400" : "font-medium text-amber-600"
                                      }`}
                                    >
                                      {contact || channelContactLabel(false)}
                                    </span>
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="px-2 py-8 text-center text-xs text-slate-400">
                          {t("staff.send.no_match", { query })}
                        </p>
                      )}
                    </div>

                  </div>
                </aside>

                {/* RIGHT: recipient details + message */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-100/60 px-4 py-4 sm:px-5">
                  {preview && previewRecord ? (
                    <>
                      <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-xs shadow-xs">
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">{t("staff.send.employee")}:</span>{" "}
                            <span className="text-slate-700">{preview.name}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-500">{t("staff.send.id")}:</span>{" "}
                            <span className="tabular-nums text-slate-700">#{preview.employeeId}</span>
                          </div>
                          <div className="min-w-0 sm:col-span-2">
                            <span className="font-semibold text-slate-500">
                              {t(channel === "email" ? "staff.send.email" : "staff.send.whatsapp")}:
                            </span>{" "}
                            {(channel === "email" ? preview.email : preview.phone) ? (
                              <span className="tabular-nums text-slate-700">
                                {channel === "email" ? preview.email : preview.phone}
                              </span>
                            ) : (
                              <span className="font-medium text-amber-600">{t("staff.send.not_available")}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {channel === "email" && (
                        <div>
                          <label
                            htmlFor="send-payslip-subject"
                            className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
                          >
                            <Mail size={11} className="text-emerald-600" />
                            {t("staff.send.subject")}
                          </label>
                          <input
                            id="send-payslip-subject"
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-inner outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="send-payslip-body"
                          className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
                        >
                          <MessageSquare size={11} className={channel === "email" ? "text-emerald-600" : "text-[#1DA851]"} />
                          {t("staff.send.message")}
                        </label>
                        <textarea
                          id="send-payslip-body"
                          value={resolvedBody}
                          onChange={(e) => handleBodyChange(e.target.value)}
                          rows={8}
                          className={`min-h-44 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed shadow-inner outline-none focus:ring-2 ${
                            channel === "email"
                              ? "focus:border-emerald-500 focus:ring-emerald-500/20"
                              : "focus:border-[#25D366]/50 focus:ring-[#25D366]/25"
                          }`}
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                            <FileText size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-700">
                              {pdfFile?.name ?? `${preview.name} · Payslip`}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400">
                              {t("staff.send.pdf_attachment", { month: monthLabel })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleTogglePdf()}
                            disabled={pdfBusy && !pdfOpen}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pdfBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : pdfOpen ? (
                              <EyeOff size={12} />
                            ) : (
                              <Eye size={12} />
                            )}
                            {pdfOpen ? t("staff.send.hide") : t("staff.send.check_pdf")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadOne()}
                            disabled={downloadingOne}
                            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downloadingOne ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}{" "}
                            {t("staff.send.download")}
                          </button>
                        </div>

                        {pdfOpen && (
                          <div className="mt-3 h-80 overflow-hidden rounded-lg border border-slate-200 bg-slate-200/60">
                            {pdfFile ? (
                              <PdfBlobPreview key={pdfFile.url} url={pdfFile.url} />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
                                <Loader2 size={15} className="animate-spin text-red-500" />
                                {t("staff.send.preparing_pdfs")}
                              </div>
                            )}
                          </div>
                        )}

                        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                          {t("staff.send.verify_note", { name: preview.name })}
                        </p>
                      </div>

                      <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                          channel === "email"
                            ? "border-emerald-200/70 bg-emerald-50/60 text-emerald-800"
                            : "border-[#25D366]/25 bg-[#25D366]/10 text-[#128C3E]"
                        }`}
                      >
                        {channel === "email" ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                        ) : (
                          <WhatsAppBrandIcon size={14} className="shrink-0 text-[#1DA851]" />
                        )}
                        {t(channel === "email" ? "staff.send.attach_note_email" : "staff.send.attach_note_wa")}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">{t("staff.send.no_match", { query })}</p>
                  )}

                  {/* Status (per channel) */}
                  {channelStatus && (
                    <div
                      className={`animate-fade-in rounded-xl border px-3 py-2 text-xs ${
                        channelStatus.failed === 0
                          ? "flex items-center gap-2 border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {channelStatus.failed === 0 ? (
                        <>
                          <CheckCircle2 size={14} className="shrink-0" />
                          {t("staff.send.status_sent", { sent: channelStatus.sent })}
                          {unselectedCount > 0 && ` · ${t("staff.send.not_selected", { count: unselectedCount })}`}.
                        </>
                      ) : channelDown ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{t(channel === "email" ? "staff.send.api_down_email" : "staff.send.api_down_wa")}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleDownloadAll()}
                            disabled={downloading}
                            className="group inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
                          >
                            {downloading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}>
                                <Download size={13} />
                              </span>
                            )}
                            {downloading
                              ? t("staff.send.preparing_pdfs")
                              : t(
                                  targetRecords.length === 1
                                    ? "staff.send.download_count_one"
                                    : "staff.send.download_count_other",
                                  { count: targetRecords.length }
                                )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle size={14} className="shrink-0" />
                          {t("staff.send.status_sent", { sent: channelStatus.sent })},{" "}
                          {t("staff.send.status_failed", { failed: channelStatus.failed })}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
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
          </div>
          {submitted.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {channel === "email" ? (
                <Button
                  variant="primary"
                  onClick={() => void handleSend()}
                  disabled={sending || saving || sendCount === 0}
                  loading={sending}
                  icon={
                    <span className={`inline-flex ${uiActionIconMotionClass.mail}`}>
                      <Mail size={13} />
                    </span>
                  }
                >
                  {sending ? t("staff.send.sending") : sendLabel}
                </Button>
              ) : (
                <Button
                  variant="custom"
                  className="bg-[#25D366] text-white shadow-xs hover:bg-[#1DA851] active:bg-[#1DA851]"
                  onClick={() => void handleSend()}
                  disabled={sending || saving || sendCount === 0}
                  loading={sending}
                  icon={
                    <span className={`inline-flex ${uiActionIconMotionClass.whatsapp}`}>
                      <WhatsAppBrandIcon size={13} />
                    </span>
                  }
                >
                  {sending ? t("staff.send.sending") : sendLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShellModal>
  );
}

export default SendPayslipsModal;
