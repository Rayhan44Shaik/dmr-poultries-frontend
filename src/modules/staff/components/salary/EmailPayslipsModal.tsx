// src/modules/staff/components/salary/EmailPayslipsModal.tsx
//
// "Send Payslips by Email" — a clean email composition page (not the WhatsApp
// style). Supports an English / Telugu toggle, shows the selected recipients
// with their email addresses, a subject + body (templated per language with the
// payslip PDF attached), and a Send action.

import { useState, useMemo, useEffect } from "react";
import { X, Mail, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { loadEmployees } from "../../../masters/employees/services/employeeService";
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

  // Re-seed subject/body from the template whenever language or month changes
  // (and the user hasn't manually edited them).
  const seedBody = useMemo(
    () => TEMPLATES[language].body("{name}", monthLabel),
    [language, monthLabel]
  );

  useEffect(() => {
    setSubject(TEMPLATES[language].subject.replace("{month}", monthLabel));
    setBody(seedBody);
  }, [language, monthLabel, seedBody]);

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
    try {
      const result = await onSend(
        records.map((r) => r.id),
        { language, subject, body }
      );
      setStatus(result);
      onSent(result.sent, result.failed);
    } catch {
      setStatus({ sent: 0, failed: recipients.length });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-900/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden sm:max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Send Payslips by Email
              </h3>
              <p className="text-[11px] text-slate-500">
                {records.length} selected · {monthLabel}
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Language toggle */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            {(["en", "te"] as Language[]).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => setLanguage(lng)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  language === lng
                    ? "bg-white text-blue-600 shadow-sm"
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
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed"
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
              className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 border ${
                status.failed === 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {status.failed === 0 ? (
                <CheckCircle2 size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
              {status.sent} email{status.sent === 1 ? "" : "s"} queued
              {status.failed > 0 && `, ${status.failed} failed (no email on file)`}.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={saving || withEmail === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {saving ? "Sending..." : `Send ${withEmail} Email${withEmail === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailPayslipsModal;
