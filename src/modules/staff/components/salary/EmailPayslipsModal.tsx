// src/modules/staff/components/salary/EmailPayslipsModal.tsx
//
// "Send Payslips by Email" — a clean email composition page (not the WhatsApp
// style). Supports an English / Telugu toggle, shows the selected recipients
// with their email addresses, a subject + body (templated per language with the
// payslip PDF attached), and a Send action.
//
// Rendered through the app-wide <Modal /> for consistent dialog behaviour.

import { useState, useMemo, useEffect } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Button, Modal } from "../../../../ui";
import { loadEmployees } from "../../../masters/employees/services/employeeService";
import { generatePayslipPdf } from "../../services/payslipPdf";
import type { SalaryRecord } from "../../types/staffDashboard";

type Language = "en" | "te";

const TEMPLATES: Record<Language, { subject: string; body: (name: string, month: string) => string }> = {
  en: {
    subject: "Your Salary Payslip — {month}",
    body: (name, month) =>
      `Dear ${name},\n\nPlease find attached your salary payslip for ${month}.\n\nRegards,\nDMR POULTRIES`,
  },
  te: {
    subject: "మీ జీతం పేస్లిప్ — {month}",
    body: (name, month) =>
      `ప్రియమైన ${name},\n\n${month} నెలకు సంబంధించిన మీ జీతం పేస్లిప్ జతచేయబడింది. దయచేసి అటాచ్మెంట్ను చూడండి.\n\nధన్యవాదాలు,\nDMR POULTRIES`,
  },
};

export type EmailPayslipsModalProps = {
  monthLabel: string;
  records: SalaryRecord[];
  saving?: boolean;
  onClose: () => void;
  onSent: (sent: number, failed: number) => void;
  onSend: (
    ids: string[],
    payload: { language: Language; subject: string; body: string }
  ) => Promise<{ sent: number; failed: number }>;
};

export function EmailPayslipsModal({
  monthLabel,
  records,
  saving = false,
  onClose,
  onSent,
  onSend,
}: EmailPayslipsModalProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emails, setEmails] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<{ sent: number; failed: number } | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Resolve employee emails by id (employee master has the email address).
  useEffect(() => {
    let cancelled = false;
    loadEmployees()
      .then((list) => {
        if (cancelled) return;
        const map: Record<number, string> = {};
        for (const e of list as Array<{ id: number; email?: string }>) {
          if (e.email) map[e.id] = e.email;
        }
        setEmails(map);
      })
      .catch(() => {
        /* use whatever we have */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-seed subject/body from the template whenever language or month changes.
  const seedBody = useMemo(
    () => TEMPLATES[language].body("{name}", monthLabel),
    [language, monthLabel]
  );

  // Adjust state during render (React's recommended pattern for resetting
  // derived text fields when their source changes) rather than in an effect,
  // so a language/month change cannot cause a cascading render.
  const [seedKey, setSeedKey] = useState(() => `${language}|${monthLabel}`);
  if (seedKey !== `${language}|${monthLabel}`) {
    setSeedKey(`${language}|${monthLabel}`);
    setSubject(TEMPLATES[language].subject.replace("{month}", monthLabel));
    setBody(seedBody);
  }

  const recipients = useMemo(
    () =>
      records.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        name: r.employeeName,
        email: emails[r.employeeId] ?? "",
      })),
    [records, emails]
  );

  const withEmail = recipients.filter((r) => r.email).length;
  const withoutEmail = recipients.length - withEmail;

  const handleSend = async () => {
    setStatus(null);
    setApiDown(false);
    try {
      const result = await onSend(
        records.map((r) => r.id),
        { language, subject, body }
      );
      setStatus(result);
      onSent(result.sent, result.failed);
    } catch {
      // Backend email service unavailable — offer the branded PDFs so the
      // payslips can still be sent by downloading and attaching them.
      setApiDown(true);
      setStatus({ sent: 0, failed: recipients.length });
    }
  };

  /** Fallback: download the same A4 DMR POULTRIES payslip PDFs that would
   *  have been attached, so they can be sent from any mail app. */
  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      for (const record of records) {
        await generatePayslipPdf(record, "download");
        if (records.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title="Send Payslips by Email"
      description={`${records.length} selected · ${monthLabel}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void handleDownloadAll()}
              disabled={downloading || records.length === 0}
              loading={downloading}
              icon={<Download size={14} />}
            >
              {downloading ? "Preparing…" : "Download PDFs"}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSend()}
              disabled={saving || withEmail === 0}
              loading={saving}
              icon={<Send size={14} />}
            >
              {saving ? "Sending…" : `Send ${withEmail} Email${withEmail === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Language toggle */}
        <div
          role="group"
          aria-label="Email language"
          className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200"
        >
          {(["en", "te"] as Language[]).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              aria-pressed={language === lng}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                language === lng
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {lng === "en" ? "English" : "Telugu"}
            </button>
          ))}
        </div>

        {/* Recipients */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Recipients</span>
            <span>
              {withEmail} with email
              {withoutEmail > 0 && (
                <span className="text-amber-600"> · {withoutEmail} missing</span>
              )}
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
            {recipients.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-1.5 text-xs"
              >
                <span className="text-slate-700 truncate">
                  {r.name}{" "}
                  <span className="text-slate-400">#{r.employeeId}</span>
                </span>
                <span
                  className={`truncate max-w-[55%] text-right ${
                    r.email ? "text-slate-500" : "text-amber-600"
                  }`}
                >
                  {r.email || "No email on file"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label
            htmlFor="email-payslip-subject"
            className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1"
          >
            Subject
          </label>
          <input
            id="email-payslip-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="email-payslip-body"
            className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1"
          >
            Message
          </label>
          <textarea
            id="email-payslip-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none leading-relaxed"
          />
        </div>

        {/* Attachment note */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          Each payslip PDF will be attached to its recipient's email.
        </div>

        {/* Status */}
        {status && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              status.failed === 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-2"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            {status.failed === 0 ? (
              <>
                <CheckCircle2 size={14} className="shrink-0" />
                {status.sent} email{status.sent === 1 ? "" : "s"} queued
                {status.failed > 0 && `, ${status.failed} failed (no email on file)`}.
              </>
            ) : apiDown ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>
                    The email service is not reachable. You can download the
                    payslip PDFs and attach them to your own email — they are
                    the same A4 DMR POULTRIES documents.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadAll()}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  {downloading ? "Preparing PDFs..." : `Download ${records.length} PDF(s)`}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {status.sent} email{status.sent === 1 ? "" : "s"} queued, {status.failed} failed (no email on file).
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default EmailPayslipsModal;
