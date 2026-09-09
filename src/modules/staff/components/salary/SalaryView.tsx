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

import { Lock, Info, Download } from "lucide-react";
import type { SalaryRecord } from "../../types/staffDashboard";
import { Button, Modal } from "../../../../ui";
import { ClassicPayslipSheet } from "./ClassicPayslipSheet";
import { computePayslipTotals, toAmountValues } from "./payslipModel";

export type SalaryViewProps = {
  record: SalaryRecord;
  onClose: () => void;
  onDownload?: () => void;
  downloading?: boolean;
};

export function SalaryView({
  record,
  onClose,
  onDownload,
  downloading = false,
}: SalaryViewProps) {
  if (!record) return null;

  const values = toAmountValues(record);
  const totals = computePayslipTotals(values);

  const correctionOpen =
    record.status === "Paid" &&
    record.correctionWindowDaysRemaining != null &&
    record.correctionWindowDaysRemaining > 0;

  const monthLabel = (() => {
    if (!record.month) return "";
    const [y, m] = record.month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  })();

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      aria-label={`Payslip — ${record.employeeName}`}
      title={`Payslip — ${record.employeeName}`}
      description={`${monthLabel}${record.employeeId != null ? ` · Employee #${record.employeeId}` : ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onDownload && (
            <Button
              variant="primary"
              onClick={onDownload}
              loading={downloading}
              icon={<Download size={14} />}
            >
              {downloading ? "Downloading…" : "Download PDF"}
            </Button>
          )}
        </>
      }
    >
      <div className="bg-slate-100 px-3 py-6 sm:px-6">
        <div className="mx-auto max-w-[900px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-slate-200">
          <ClassicPayslipSheet record={record} values={values} {...totals} />
        </div>

        {/* Lifecycle notices — UI state, kept below the formal document */}
        {record.monthClosed && (
          <div className="mx-auto mt-4 flex max-w-[760px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600">
            <Lock size={14} className="shrink-0" />
            <span>This payroll month is closed. All records are permanently locked.</span>
          </div>
        )}
        {record.status === "Paid" && !record.monthClosed && (
          <div
            className={`mx-auto mt-4 flex max-w-[760px] items-center gap-2 rounded-xl border p-3 text-xs ${
              correctionOpen
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-100 text-slate-600"
            }`}
          >
            {correctionOpen ? <Info size={14} className="shrink-0" /> : <Lock size={14} className="shrink-0" />}
            <span>
              {correctionOpen
                ? `Correction window open — ${record.correctionWindowDaysRemaining} day(s) remaining to mark unpaid.`
                : "Correction window expired — paid salary is permanently locked."}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SalaryView;
