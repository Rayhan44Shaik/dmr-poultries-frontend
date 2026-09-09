// src/modules/staff/components/salary/WhatsAppPayslipsModal.tsx
//
// "Send Payslips by WhatsApp" — mirrors EmailPayslipsModal but for WhatsApp.
// Recipients are shown with their mobile (WhatsApp) numbers, a per-language
// message template is editable, and Send posts to the salary WhatsApp backend
// (like email). If the backend integration is not reachable it offers the same
// A4 payslip PDFs to download so they can be sent from any WhatsApp client.
//
// Rendered through the app-wide <Modal /> for consistent dialog behaviour.

import { useState, useMemo, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { Button, Modal } from "../../../../ui";
import { WhatsAppBrandIcon } from "../../../../ui/WhatsAppBrandIcon";
import { loadEmployees } from "../../../masters/employees/services/employeeService";
import { generatePayslipPdf } from "../../services/payslipPdf";
import { SAMPLE_EMPLOYEE_LIST } from "../../services/staffSampleData";
import type { SalaryRecord } from "../../types/staffDashboard";

type Language = "en" | "te";

const TEMPLATES: Record<
  Language,
  { greeting: string; body: (name: string, month: string) => string }
> = {
  en: {
    greeting: "DMR POULTRIES",
    body: (name, month) =>
      `Dear ${name},\n\nYour salary payslip for ${month} is attached with this message.\n\nRegards,\nDMR POULTRIES`,
  },
  te: {
    greeting: "DMR POULTRIES",
    body: (name, month) =>
      `ప్రియమైన ${name},\n\n${month} నెలకు సంబంధించిన మీ జీతం పేస్లిప్ ఈ మెసేజ్తో జతచేయబడింది.\n\nధన్యవాదాలు,\nDMR POULTRIES`,
  },
};

export type WhatsAppPayslipsModalProps = {
  monthLabel: string;
  records: SalaryRecord[];
  saving?: boolean;
  onClose: () => void;
  onSent: (sent: number, failed: number) => void;
  onSend: (
    ids: string[],
    payload: { language: Language; body: string }
  ) => Promise<{ sent: number; failed: number }>;
};

export function WhatsAppPayslipsModal({
  monthLabel,
  records,
  saving = false,
  onClose,
  onSent,
  onSend,
}: WhatsAppPayslipsModalProps) {
  const [language, setLanguage] = useState<Language>("en");
  const [body, setBody] = useState("");
  const [phones, setPhones] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<{ sent: number; failed: number } | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Resolve employee mobile numbers by id (employee master holds the number).
  useEffect(() => {
    let cancelled = false;
    loadEmployees()
      .then((list) => {
        if (cancelled) return;
        const map: Record<number, string> = {};
        for (const e of list as Array<{ id: number; phoneNumber?: string }>) {
          if (e.phoneNumber) map[e.id] = e.phoneNumber;
        }
        setPhones(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Backend offline — fall back to the sample employee directory so the
        // recipients still show numbers for preview / review.
        const map: Record<number, string> = {};
        for (const e of SAMPLE_EMPLOYEE_LIST) {
          if (e.id != null && e.phoneNumber) map[e.id] = e.phoneNumber;
        }
        setPhones(map);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-seed the message from the template whenever language / month changes.
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
    setBody(seedBody);
  }

  const recipients = useMemo(
    () =>
      records.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        name: r.employeeName,
        phone: phones[r.employeeId] ?? "",
      })),
    [records, phones]
  );

  const withPhone = recipients.filter((r) => r.phone).length;
  const withoutPhone = recipients.length - withPhone;

  const handleSend = async () => {
    setStatus(null);
    setApiDown(false);
    try {
      const result = await onSend(
        records.map((r) => r.id),
        { language, body }
      );
      setStatus(result);
      onSent(result.sent, result.failed);
    } catch {
      // Backend WhatsApp integration unavailable — offer the payslip PDFs so
      // they can be sent from any WhatsApp client.
      setApiDown(true);
      setStatus({ sent: 0, failed: recipients.length });
    }
  };

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
      title="Send Payslips by WhatsApp"
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
              title="Download the A4 payslip PDFs to send from any WhatsApp client"
              icon={<Download size={14} />}
            >
              {downloading ? "Preparing…" : "Download PDFs"}
            </Button>
            <Button
              variant="custom"
              className="bg-[#25D366] text-white shadow-xs hover:bg-[#1DA851] active:bg-[#1DA851]"
              onClick={() => void handleSend()}
              disabled={saving || withPhone === 0}
              loading={saving}
              icon={<WhatsAppBrandIcon size={14} />}
            >
              {saving
                ? "Sending…"
                : `Send ${withPhone} WhatsApp${withPhone === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Language toggle */}
        <div
          role="group"
          aria-label="Message language"
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
                  ? "bg-white text-[#1DA851] shadow-sm"
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
              {withPhone} with WhatsApp
              {withoutPhone > 0 && (
                <span className="text-amber-600"> · {withoutPhone} missing</span>
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
                    r.phone ? "text-slate-500" : "text-amber-600"
                  }`}
                >
                  {r.phone || "No number on file"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label
            htmlFor="whatsapp-payslip-body"
            className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1"
          >
            WhatsApp Message
          </label>
          <textarea
            id="whatsapp-payslip-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#25D366]/25 focus:border-[#25D366]/50 resize-none leading-relaxed"
          />
        </div>

        {/* Attachment note */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          <WhatsAppBrandIcon size={14} className="text-[#25D366] shrink-0" />
          Each payslip PDF will be sent as a WhatsApp message.
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
                {status.sent} WhatsApp{status.sent === 1 ? "" : "s"} queued
                {status.failed > 0 &&
                  `, ${status.failed} failed (no number on file)`}
                .
              </>
            ) : apiDown ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>
                    The WhatsApp service is not reachable. You can download the
                    payslip PDFs and send them from any WhatsApp client — they
                    are the same A4 DMR POULTRIES documents.
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
                  {downloading
                    ? "Preparing PDFs..."
                    : `Download ${records.length} PDF(s)`}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {status.sent} WhatsApp{status.sent === 1 ? "" : "s"} queued,{" "}
                {status.failed} failed (no number on file).
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default WhatsAppPayslipsModal;
