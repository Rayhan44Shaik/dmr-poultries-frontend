// src/modules/staff/components/salary/SalaryView.tsx
//
// The payslip document view — styled like the actual payslip document:
//
//   DMR POULTRIES            ← brand (logo + wordmark), centered
//   Payslip · September 2026 ← document title + period
//   [Employee][Department][Month][Status]   ← small info boxes
//   Working · Present · Leave · Weekly Off  ← attendance strip
//   [ Earnings ]  [ Deductions ]            ← two small side-by-side boxes
//   NET SALARY (TAKE HOME)        ₹00,000   ← emerald take-home band
//   Payment details (quiet, two-column)
//
// Rendered inside the global <Modal />, so it inherits the app-wide focus
// trap, Escape/overlay handling, portal and footer rhythm instead of a
// hand-rolled overlay.

import type { ReactNode } from "react";
import { X, Lock, Info, Download } from "lucide-react";
import type { SalaryRecord } from "../../types/staffDashboard";
import { Button, Modal } from "../../../../ui";
import BrandMark from "../../../../ui/BrandMark";
import { uiBadgeClass } from "../../../../shared/ui/uiTokens";

export type SalaryViewProps = {
  record: SalaryRecord;
  onClose: () => void;
  formatCurrency?: (amount: number) => string;
  onDownload?: () => void;
  downloading?: boolean;
};

/* ---------------------------------------------------------------------------
 * Small building blocks — one treatment each, kept deliberately tiny.
 * ------------------------------------------------------------------------- */

/** Small labelled info box (the "side boxes" row under the brand header). */
function InfoBox({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div
        className="mt-0.5 truncate text-xs font-semibold text-slate-800"
        title={typeof value === "string" ? value : undefined}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

/** One attendance stat inside the sunken strip. */
function Stat({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
        {value ?? "—"}
      </div>
    </div>
  );
}

/** One earnings/deductions line. Zero amounts are muted, not hidden. */
function AmountRow({
  label,
  amount,
  formatCurrency,
}: {
  label: string;
  amount: number;
  formatCurrency: (amount: number) => string;
}) {
  const muted = !amount;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="truncate text-xs text-slate-600">{label}</span>
      <span
        className={`shrink-0 text-xs font-semibold tabular-nums ${
          muted ? "text-slate-300" : "text-slate-800"
        }`}
      >
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

/** A small side box: heading, lines, and a total footer. */
function AmountBox({
  title,
  titleClass,
  rows,
  totalLabel,
  total,
  totalClass,
  formatCurrency,
}: {
  title: string;
  titleClass: string;
  rows: { label: string; amount: number }[];
  totalLabel: string;
  total: number;
  totalClass: string;
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={`border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${titleClass}`}>
        {title}
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <AmountRow key={row.label} label={row.label} amount={row.amount} formatCurrency={formatCurrency} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-3 py-2">
        <span className="text-xs font-bold text-slate-700">{totalLabel}</span>
        <span className={`text-xs font-bold tabular-nums ${totalClass}`}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

/** Quiet label/value pair for the payment details block. */
function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="truncate text-xs font-medium text-slate-700" title={typeof value === "string" ? value : undefined}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export function SalaryView({
  record,
  onClose,
  formatCurrency = (amt) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amt || 0),
  onDownload,
  downloading = false,
}: SalaryViewProps) {
  if (!record) return null;

  const monthLabel = (() => {
    if (!record.month) return "";
    const [y, m] = record.month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  })();

  const correctionOpen =
    record.status === "Paid" &&
    record.correctionWindowDaysRemaining != null &&
    record.correctionWindowDaysRemaining > 0;

  const statusBadge = (() => {
    if (record.status === "Submitted") {
      return <span className={uiBadgeClass("info")}><Lock size={11} /> Submitted</span>;
    }
    if (record.status === "Paid") {
      return <span className={uiBadgeClass("success")}>Paid</span>;
    }
    return <span className={uiBadgeClass("warning")}>Pending</span>;
  })();

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      aria-label={`Payslip — ${record.employeeName}`}
      showCloseButton={false}
      bodyClassName="px-0 py-0"
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
      {/* ── Document header: DMR POULTRIES → Payslip → period ─────────── */}
      <div className="relative border-b border-slate-100 px-6 pb-4 pt-6 text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close payslip"
          title="Close payslip"
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} />
        </button>

        <div className="flex items-center justify-center gap-2.5">
          <BrandMark size="sm" />
          <span className="text-[15px] font-extrabold tracking-[0.14em] text-slate-900">
            DMR POULTRIES
          </span>
        </div>

        <h3 className="mt-3 text-base font-bold tracking-tight text-slate-900">
          Payslip
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {monthLabel || record.month}
          {record.employeeId != null && (
            <>
              <span className="mx-1.5 text-slate-300">·</span>
              Employee #{record.employeeId}
            </>
          )}
        </p>
      </div>

      {/* ── Employee info — small side boxes ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-4">
        <InfoBox label="Employee" value={record.employeeName} />
        <InfoBox label="Department" value={record.department || "—"} />
        <InfoBox label="Salary Month" value={record.month} />
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Status
          </div>
          <div className="mt-1">{statusBadge}</div>
        </div>
      </div>

      {/* ── Attendance strip ──────────────────────────────────────────── */}
      <div className="mx-5 grid grid-cols-4 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/70">
        <Stat label="Working" value={record.workingDays} />
        <Stat label="Present" value={record.presentDays} />
        <Stat label="Leave" value={record.leaveDays} />
        <Stat label="Weekly Off" value={record.weeklyOffDays} />
      </div>

      {/* ── Earnings / Deductions — two small side-by-side boxes ──────── */}
      <div className="grid gap-3 px-5 pt-4 sm:grid-cols-2">
        <AmountBox
          title="Earnings"
          titleClass="text-emerald-700"
          rows={[
            { label: "Basic Salary", amount: record.basicSalary || 0 },
            { label: "Overtime", amount: record.overtime || 0 },
            { label: "Incentives", amount: record.incentives || 0 },
            { label: "Fuel Allowance", amount: record.fuelAllowance || 0 },
            { label: "Night Allowance", amount: record.nightAllowance || 0 },
          ]}
          totalLabel="Gross Salary"
          total={record.totalGross || 0}
          totalClass="text-slate-900"
          formatCurrency={formatCurrency}
        />
        <AmountBox
          title="Deductions"
          titleClass="text-rose-700"
          rows={[
            { label: "Leave Deduction", amount: record.leaveDeduction || 0 },
            { label: "Advance Recovery", amount: record.advanceRecovery || 0 },
            { label: "Loan EMI", amount: record.loanEMI || 0 },
            { label: "Late Penalty", amount: record.latePenalty || 0 },
            { label: "Other Deductions", amount: record.otherDeductions || 0 },
          ]}
          totalLabel="Total Deductions"
          total={record.totalDeductions || 0}
          totalClass="text-rose-700"
          formatCurrency={formatCurrency}
        />
      </div>

      {/* ── Net salary — the take-home band ───────────────────────────── */}
      <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-white">
        <span className="text-[11px] font-bold uppercase tracking-wider">
          Net Salary (Take Home)
        </span>
        <span className="text-lg font-extrabold tabular-nums">
          {formatCurrency(record.netSalary)}
        </span>
      </div>

      {/* ── Payment details — quiet, two columns ──────────────────────── */}
      <div className="px-5 py-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Payment Details
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
          <Detail label="Payment Date" value={record.paymentDate ?? "—"} />
          <Detail label="Payment Reference" value={record.paymentRef ?? "—"} />
          <Detail label="Submitted By" value={record.submittedBy ?? "—"} />
          <Detail
            label="Submitted At"
            value={record.submittedAt ? new Date(record.submittedAt).toLocaleString() : "—"}
          />
        </dl>
      </div>

      {/* ── Lifecycle notices ─────────────────────────────────────────── */}
      {record.monthClosed && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600">
          <Lock size={14} className="shrink-0" />
          <span>This payroll month is closed. All records are permanently locked.</span>
        </div>
      )}
      {record.status === "Paid" && !record.monthClosed && (
        <div
          className={`mx-5 mb-4 flex items-center gap-2 rounded-xl border p-3 text-xs ${
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
    </Modal>
  );
}
