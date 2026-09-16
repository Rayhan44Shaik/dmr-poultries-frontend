// src/modules/staff/components/salary/SalaryView.tsx
//
// The read-only payslip that opens when a salary-register row is clicked.
// It renders the SAME classic DMR POULTRIES formal payslip document used by
// the A4 PDF and by the Review & Submit preview (see ClassicPayslipSheet) so
// the register's payslip always looks identical everywhere.
//
// The sheet itself is shown on a light slate stage inside the app-wide
// <Modal /> (inherits focus trap, Escape/overlay handling, footer rhythm).
// Read-only lifecycle notices (paid / correction window / month closed) are
// listed below the sheet — they are UI state, not part of the formal document.
//
// LANGUAGE: the footer carries a scoped EN/తెలుగు pill (no tooltip, popup
// scope only). Flipping it translates the popup's chrome, month line,
// notices AND the payslip sheet labels/names — the A4 PDF stays in English
// and the app behind keeps the global language.

import { Lock, FileText, CheckCircle2, X, Loader2 } from "lucide-react";
import type { SalaryRecord } from "../../types/staffDashboard";
import { Modal } from "../../../../ui";
import { useI18n } from "../../../../i18n";
import ScopedI18nProvider from "../../../../i18n/ScopedI18nProvider";
import { uiButton } from "../../../../shared/ui/uiTokens";
import { ClassicPayslipSheet } from "./ClassicPayslipSheet";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import { computePayslipTotals, isSalaryPaid, toAmountValues } from "./payslipModel";
import { salaryDisplayText, salaryLocale } from "../../utils/salaryDisplay";

/** Render "YYYY-MM-DD" / ISO as "28 Sep 2026". */
function formatViewDate(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export type SalaryViewProps = {
  record: SalaryRecord;
  onClose: () => void;
  onDownload?: () => void;
  downloading?: boolean;
};

export function SalaryView(props: SalaryViewProps) {
  // Seed the popup scope from the global language; the toggle inside then
  // drives ONLY this popup (never persisted, never touches the app behind).
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <SalaryViewBody {...props} />
    </ScopedI18nProvider>
  );
}

function SalaryViewBody({
  record,
  onClose,
  onDownload,
  downloading = false,
}: SalaryViewProps) {
  const { t, language, toggleLanguage } = useI18n();
  if (!record) return null;

  const values = toAmountValues(record);
  const totals = computePayslipTotals(values);

  const monthLabel = (() => {
    if (!record.month) return "";
    const [y, m] = record.month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString(salaryLocale(language), { month: "long", year: "numeric" });
  })();

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      overlayClassName="backdrop-blur-none bg-black/20"
      closeButtonClassName="text-red-500 hover:bg-red-50 hover:text-red-600"
      aria-label={`${t("staff.view.payslip")} — ${salaryDisplayText(record.employeeName, language)}`}
      title={`${t("staff.view.payslip")} — ${salaryDisplayText(record.employeeName, language)}`}
      description={`${monthLabel}${record.employeeId != null ? ` · ${t("staff.view.employee_no", { id: record.employeeId })}` : ""}`}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {/* Popup-scoped EN/తెలుగు pill, no tooltip. */}
          <ViewLanguageToggle
            language={language}
            onToggle={toggleLanguage}
            tone="emerald"
            labelMode="target"
            ariaLabel={t("staff.popup.language_toggle")}
          />
          <div className="flex items-center gap-2">
            {/* Close and Download PDF carry the same hover "logo animation"
                language as the register toolbar (Reset / Refresh / Review). */}
            <button
              type="button"
              onClick={onClose}
              className={`group relative ${uiButton("secondary", "md")}`}
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]">
                <X size={14} />
              </span>
              {t("common.close")}
            </button>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className={`group relative ${uiButton("primary", "md")}`}
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-pdf)]">
                    <FileText size={14} />
                  </span>
                )}
                {downloading ? t("staff.view.downloading") : t("staff.view.download_pdf")}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="bg-slate-100 px-3 py-6 sm:px-6">
        <div className="mx-auto max-w-[900px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-slate-200">
          <ClassicPayslipSheet record={record} values={values} {...totals} />
        </div>

        {/* Lifecycle notices — UI state, kept below the formal document */}
        {isSalaryPaid(record) && record.paymentDate && (
          <div className="mx-auto mt-4 flex max-w-[760px] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{t("staff.view.paid_on", { date: formatViewDate(record.paymentDate) })}</span>
            {record.paymentRef && (
              <span className="text-emerald-700">· {t("staff.view.ref", { ref: record.paymentRef })}</span>
            )}
          </div>
        )}
        {record.monthClosed && (
          <div className="mx-auto mt-4 flex max-w-[760px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600">
            <Lock size={14} className="shrink-0" />
            <span>{t("staff.view.month_closed")}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SalaryView;
