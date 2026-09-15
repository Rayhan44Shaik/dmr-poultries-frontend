// src/modules/staff/components/salary/ClassicPayslipSheet.tsx
//
// The DMR POULTRIES payslip rendered on screen for the Salary Register.
// It is the same document family as the downloadable A4 payslip, but laid out
// compact & wide so it reads well in the Review & Submit preview and the
// row-click view without a tall scroll:
//
//   DMR POULTRIES                  navy wordmark, centred (no hen mark)
//   ───── ● ─────                   slim red accent line
//   PAYSLIP - SEPTEMBER 2026       single left-aligned title
//   ┌──────────────────────────── single clean outer border ────────────┐
//   │  Employee | ID | Department    (one compact side-by-side row)      │
//   │  Working · Present · Leave · Weekly Off   (attendance, one row)    │
//   │  EARNINGS  |  DEDUCTIONS  — classic 4-column table + bold totals   │
//   │  NET SALARY  — emphasised band                                     │
//   │  Net salary in words: …                                            │
//   └────────────────────────────────────────────────────────────────────┘
//                                     ______________
//                                     D. Srinivas Chakrapani
//                                     Authorised Signatory
//
// Re-used as the read-only payslip (SalaryView) and as the editable Review &
// Submit preview (SalaryReviewModal), so both screens never drift.

import { useState } from "react";
import type { ReactNode } from "react";
import { amountInWords } from "../../services/payslipPdfDocument";
import type { SalaryRecord } from "../../types/staffDashboard";
import {
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  type AmountFieldKey,
  type AmountValues,
} from "./payslipModel";

/* ---------------------------------------------------------------------------
 * Brand palette.
 * ------------------------------------------------------------------------- */

const NAVY = "#0f234f"; // brand wordmark
const RED = "#b21422"; // accent / deductions
const GREEN = "#15803d"; // earnings
const INK = "#1a202c";
const MUTED = "#64748b";
const FAINT = "#a8b2c0";
const BORDER = "#94a3b8"; // slate-400, softer rule
const STRONG = "#475569"; // slate-600

const fmtMoney = (value: unknown): string =>
  (Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const toText = (value: unknown): string =>
  value == null || value === "" ? "—" : String(value);

function formatMonthLabel(month: string): string {
  if (!month) return "—";
  const [y, m] = month.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

/* ---------------------------------------------------------------------------
 * Cells.
 * ------------------------------------------------------------------------- */

const cellPad = "8px 12px";

/** Label/value pair stacked compactly for the employee + attendance row. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div
        className="font-semibold uppercase"
        style={{ color: MUTED, fontSize: 9, letterSpacing: "0.08em" }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 truncate font-bold tabular-nums"
        style={{ color: INK, fontSize: 14 }}
      >
        {value}
      </div>
    </div>
  );
}

/** Amount display cell (right aligned). Inline-editable in review mode. */
function AmountCell({
  amount,
  editing,
  onChange,
}: {
  amount: number;
  editing?: boolean;
  onChange?: (next: number) => void;
}) {
  const [text, setText] = useState(String(amount));

  if (editing && onChange) {
    return (
      <input
        key={amount}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(Number(String(text).replace(/[^0-9.]/g, "")) || 0)}
        aria-label="Editable amount"
        className="w-full min-w-[6rem] rounded-sm border border-blue-400 bg-white px-1.5 py-0.5 text-right font-medium tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30"
        style={{ fontSize: 13 }}
      />
    );
  }

  const zero = !amount;
  return (
    <span
      className="tabular-nums font-medium"
      style={{ color: zero ? FAINT : INK, fontSize: 13 }}
    >
      {fmtMoney(amount)}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * The sheet itself — compact & wide.
 * ------------------------------------------------------------------------- */

export type ClassicPayslipSheetProps = {
  record: SalaryRecord;
  /** Drafted values — equals the record's fields for read-only display. */
  values: AmountValues;
  gross: number;
  deductions: number;
  net: number;
  editing?: boolean;
  /** Live update for an editable amount field. */
  onFieldChange?: (key: AmountFieldKey, value: number) => void;
  /** Optional strip rendered under the sheet (status / lifecycle). */
  note?: ReactNode;
};

export function ClassicPayslipSheet({
  record,
  values,
  gross,
  deductions,
  net,
  editing = false,
  onFieldChange,
  note,
}: ClassicPayslipSheetProps) {
  const titleMonth = formatMonthLabel(record.month).toUpperCase();
  const businessName = "DMR POULTRIES";

  const earningsRows = EARNING_FIELDS;
  const deductionRows = DEDUCTION_FIELDS;
  const bodyRows = Math.max(earningsRows.length, deductionRows.length);

  return (
    <div
      className="w-full bg-white text-slate-800"
      style={{ fontFamily: "Helvetica, Arial, ui-sans-serif, system-ui", color: INK }}
    >
      {/* ── Brand line ──────────────────────────────────────────────── */}
      <div className="px-6 pb-2 pt-5 text-center">
        <div
          className="font-extrabold tracking-[0.2em]"
          style={{ color: NAVY, fontSize: 22, lineHeight: 1 }}
        >
          {businessName}
        </div>
        {/* slim red accent */}
        <div className="mt-2 flex items-center justify-center gap-[3px]" style={{ color: RED }}>
          <div style={{ height: 1, width: 70, background: RED }} />
          <span style={{ width: 4, height: 4, borderRadius: 999, background: RED, display: "inline-block" }} />
          <div style={{ height: 1, width: 70, background: RED }} />
        </div>
      </div>

      {/* ── Title — single line under the heading ───────────────────── */}
      <div className="px-6 pb-3">
        <div className="flex items-baseline gap-2 border-b-2 pb-2" style={{ borderColor: INK }}>
          <span className="font-extrabold tracking-[0.1em]" style={{ color: INK, fontSize: 16 }}>
            PAYSLIP
          </span>
          <span className="font-semibold tracking-[0.06em]" style={{ color: MUTED, fontSize: 14 }}>
            – {titleMonth}
          </span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="mx-6 mb-4 border" style={{ borderColor: STRONG, borderWidth: 1.5 }}>

        {/* Employee + attendance — compact stacked rows */}
        <div className="border-b" style={{ borderColor: BORDER }}>
          <div
            className="grid grid-cols-3 items-stretch"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
            <div className="border-r p-2.5" style={{ borderColor: BORDER }}>
              <Field label="Employee" value={toText(record.employeeName)} />
            </div>
            <div className="border-r p-2.5" style={{ borderColor: BORDER }}>
              <Field label="Employee ID" value={record.employeeId != null ? `#${record.employeeId}` : "—"} />
            </div>
            <div className="p-2.5">
              <Field label="Department" value={toText(record.department)} />
            </div>
          </div>

          {/* Attendance strip */}
          <div
            className="grid grid-cols-4 divide-x divide-slate-300 bg-slate-50/70 text-center"
            style={{ color: INK }}
          >
            <div className="py-2">
              <div className="font-semibold uppercase" style={{ color: MUTED, fontSize: 8.5, letterSpacing: "0.06em" }}>
                Working
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: INK, lineHeight: 1 }}>
                {record.workingDays ?? "—"}
              </div>
            </div>
            <div className="py-2">
              <div className="font-semibold uppercase" style={{ color: MUTED, fontSize: 8.5, letterSpacing: "0.06em" }}>
                Present
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: INK, lineHeight: 1 }}>
                {record.presentDays ?? "—"}
              </div>
            </div>
            <div className="py-2">
              <div className="font-semibold uppercase" style={{ color: MUTED, fontSize: 8.5, letterSpacing: "0.06em" }}>
                Leave
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: INK, lineHeight: 1 }}>
                {record.leaveDays ?? "—"}
              </div>
            </div>
            <div className="py-2">
              <div className="font-semibold uppercase" style={{ color: MUTED, fontSize: 8.5, letterSpacing: "0.06em" }}>
                Weekly Off
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: INK, lineHeight: 1 }}>
                {record.weeklyOffDays ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions — classic 4-column table */}
        <table className="w-full border-collapse" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th className="border-b text-left font-extrabold" style={{ borderColor: BORDER, color: GREEN, padding: cellPad, letterSpacing: "0.05em" }}>
                EARNINGS
              </th>
              <th className="border-b text-right font-semibold" style={{ borderColor: BORDER, color: MUTED, padding: cellPad }}>
                Amount (Rs.)
              </th>
              <th className="border-b border-l text-left font-extrabold" style={{ borderColor: BORDER, color: RED, padding: cellPad, letterSpacing: "0.05em" }}>
                DEDUCTIONS
              </th>
              <th className="border-b text-right font-semibold" style={{ borderColor: BORDER, color: MUTED, padding: cellPad }}>
                Amount (Rs.)
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: bodyRows }).map((_, i) => {
              const e = earningsRows[i];
              const d = deductionRows[i];
              return (
                <tr key={i}>
                  <td className="border-b px-3 py-[5px]" style={{ borderColor: BORDER }}>
                    <span style={{ color: e ? INK : "transparent" }}>{e ? e.label : "·"}</span>
                  </td>
                  <td className="border-b px-3 py-[5px] text-right" style={{ borderColor: BORDER }}>
                    {e ? (
                      <AmountCell
                        amount={values[e.key]}
                        editing={editing}
                        onChange={onFieldChange ? (v) => onFieldChange(e.key, v) : undefined}
                      />
                    ) : null}
                  </td>
                  <td className="border-b border-l px-3 py-[5px]" style={{ borderColor: BORDER }}>
                    <span style={{ color: d ? INK : "transparent" }}>{d ? d.label : "·"}</span>
                  </td>
                  <td className="border-b px-3 py-[5px] text-right" style={{ borderColor: BORDER }}>
                    {d ? (
                      <AmountCell
                        amount={values[d.key]}
                        editing={editing}
                        onChange={onFieldChange ? (v) => onFieldChange(d.key, v) : undefined}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr>
              <td className="px-3 py-1.5" style={{ color: INK }}>
                <span className="font-extrabold" style={{ fontSize: 13 }}>Gross Salary</span>
              </td>
              <td className="px-3 py-1.5 text-right font-extrabold tabular-nums" style={{ color: INK, fontSize: 13 }}>
                {fmtMoney(gross)}
              </td>
              <td className="border-l px-3 py-1.5" style={{ borderColor: BORDER, color: INK }}>
                <span className="font-extrabold" style={{ fontSize: 13 }}>Total Deductions</span>
              </td>
              <td className="px-3 py-1.5 text-right font-extrabold tabular-nums" style={{ color: INK, fontSize: 13 }}>
                {fmtMoney(deductions)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* NET SALARY — emphasised band */}
        <div
          className="flex items-center justify-between gap-4 border-t px-4 py-2.5"
          style={{ borderColor: INK, borderTopWidth: 2, backgroundColor: "#f4f6f8" }}
        >
          <span className="font-extrabold tracking-[0.05em]" style={{ color: NAVY, fontSize: 13 }}>
            NET SALARY
          </span>
          <span className="font-extrabold tabular-nums" style={{ color: NAVY, fontSize: 20, lineHeight: 1 }}>
            Rs. {fmtMoney(net)}
          </span>
        </div>

        {/* Amount in words */}
        <div
          className="italic"
          style={{ borderTop: `1px solid ${BORDER}`, color: MUTED, fontSize: 11.5, padding: "7px 12px" }}
        >
          Net salary in words: {amountInWords(Number(net) || 0)}
        </div>
      </div>

      {/* ── Signature ────────────────────────────────────────────────── */}
      <div className="px-6 pb-4">
        <div className="ml-auto w-[200px] text-center">
          {/* Open signing space above the rule so the signature fits neatly. */}
          <div aria-hidden="true" style={{ height: 64 }} />
          <div style={{ borderTop: `1px solid ${INK}` }} />
          <div className="mt-1.5 font-bold" style={{ color: INK, fontSize: 12.5 }}>
            D. Srinivas Chakrapani
          </div>
          <div className="mt-0.5" style={{ color: MUTED, fontSize: 10.5 }}>
            Authorised Signatory
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="px-6 pb-5">
        <div style={{ borderTop: `1px solid ${BORDER}` }} />
        <div className="pt-1 text-center" style={{ color: MUTED, fontSize: 9.5 }}>
          This is a computer-generated payslip and does not require a physical signature.
        </div>
        <div className="mt-0.5 text-center" style={{ color: "#94a3b8", fontSize: 9 }}>
          Generated on {new Date().toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
          })} · DMR POULTRIES
        </div>
      </div>

      {/* Optional strip below the document */}
      {note ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">{note}</div>
      ) : null}
    </div>
  );
}

export default ClassicPayslipSheet;
