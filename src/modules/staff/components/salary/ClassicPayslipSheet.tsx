// src/modules/staff/components/salary/ClassicPayslipSheet.tsx
//
// The classic DMR POULTRIES formal payslip — reproduced on screen from the
// exact layout the downloadable A4 PDF draws (`payslipPdfDocument.ts`):
//
//   [hen mark]                     centred, no box
//   DMR POULTRIES                  navy wordmark, centred
//   ──── • ● • ────                red brand divider
//   ───────────────────            navy hairline
//   PAYSLIP - SEPTEMBER 2026       left-aligned, single line under heading
//   ┌──────────────────────────── single black outer border ────────────┐
//   │  employee grid   — name / id / department                         │
//   │  attendance strip— working · present · leave · weekly off         │
//   │  EARNINGS  |  DEDUCTIONS   — classic 4-column table + bold totals │
//   │  NET SALARY (TAKE HOME)  — bold boxed row                         │
//   │  Net salary in words: …                                           │
//   └───────────────────────────────────────────────────────────────────┘
//                                  ______________
//                                  Authorised Signatory
//                                  D. Srinivas Chakrapani
//   ─── footer ───  computer-generated note · generated on date
//
// Single white sheet, black rules, no colour bands — the formal register
// document. Re-used as the read-only payslip (SalaryView) and as the
// editable Review & Submit preview (SalaryReviewModal).
//
// A truly central single-source payslip so both screens can never drift.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import BrandMark from "../../../../ui/BrandMark";
import { amountInWords } from "../../services/payslipPdfDocument";
import type { SalaryRecord } from "../../types/staffDashboard";
import {
  DEDUCTION_FIELDS,
  EARNING_FIELDS,
  type AmountFieldKey,
  type AmountValues,
} from "./payslipModel";

/* ---------------------------------------------------------------------------
 * Brand palette (mirrors the PDF inks).
 * ------------------------------------------------------------------------- */

const NAVY = "#0f234f"; // 15,35,79
const RED = "#b21422"; // 178,20,34  (brand accent / deductions)
const GREEN = "#15803d"; // 34,197,94 darker — earnings heading
const INK = "#1a202c"; // 26,32,44
const MUTED = "#5a6473"; // 90,100,115
const FAINT = "#a8b2c0"; // 168,178,192
const BORDER = "#475569"; // 71,85,105  (slate-600)
const RULE = "#cbd5e1"; // 203,213,225 (slate-300)

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
 * Small rule helpers.
 * ------------------------------------------------------------------------- */

const cellPad: CSSProperties = { padding: "5px 10px" };

/** Amount display cell (plain Indian number, right aligned). While editing it
 *  becomes a small numeric input; `key={amount}` remounts the field when the
 *  underlying amount changes so the draft always starts from the current value
 *  (no effect needed to sync). */
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
        className="w-full min-w-[5.5rem] rounded-sm border border-blue-400 bg-white px-1 py-0.5 text-right font-medium tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30"
        style={{ fontSize: 12 }}
      />
    );
  }

  const zero = !amount;
  return (
    <span
      className="tabular-nums font-medium"
      style={{ color: zero ? FAINT : INK, fontSize: 12 }}
    >
      {fmtMoney(amount)}
    </span>
  );
}

function AttendanceCell({ label, value }: { label: string; value?: number | string | null }) {
  const shown = value === 0 ? "0" : value == null ? "—" : String(value);
  return (
    <td
      className="border text-center"
      style={{ borderColor: BORDER, ...cellPad }}
    >
      <div className="font-bold text-slate-500" style={{ color: MUTED, fontSize: 9, letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="mt-0.5 font-bold tabular-nums" style={{ color: INK, fontSize: 13 }}>
        {shown}
      </div>
    </td>
  );
}

/* ---------------------------------------------------------------------------
 * The sheet itself.
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
  /** Optional footer strip rendered under the sheet (status / lifecycle). */
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
  const monthLabel = formatMonthLabel(record.month);
  const businessName = "DMR POULTRIES";
  const titleMonth = monthLabel.toUpperCase();

  // Employee grid — same core identity fields as the register (name / id /
  // department). Role, salary month & status are left off this document; the
  // period already reads in the title line above.
  const employeeRows: [string, string][] = [
    ["Employee Name", toText(record.employeeName)],
    ["Employee ID", record.employeeId != null ? `#${record.employeeId}` : "—"],
    ["Department", toText(record.department)],
  ];

  const earningsRows = EARNING_FIELDS;
  const deductionRows = DEDUCTION_FIELDS;
  const bodyRows = Math.max(earningsRows.length, deductionRows.length);

  return (
    <div
      className="w-full bg-white text-slate-800"
      style={{ fontFamily: "Helvetica, Arial, ui-sans-serif, system-ui", color: INK }}
    >
      {/* ── Centred brand header ──────────────────────────────────────── */}
      <div className="px-6 pb-1 pt-7 text-center">
        <div className="flex justify-center">
          <BrandMark size="md" />
        </div>
        <div
          className="mt-1 font-extrabold tracking-[0.16em]"
          style={{ color: NAVY, fontSize: 22, lineHeight: 1.1 }}
        >
          {businessName}
        </div>

        {/* red divider — line • • line */}
        <div className="mt-3 flex items-center justify-center">
          <div style={{ height: 1, width: "42%", background: RED }} />
          <div className="mx-[7px] flex items-center gap-[3px]" style={{ color: RED }}>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: RED, display: "inline-block" }} />
            <span style={{ width: 5, height: 5, borderRadius: 999, background: RED, display: "inline-block" }} />
            <span style={{ width: 3, height: 3, borderRadius: 999, background: RED, display: "inline-block" }} />
          </div>
          <div style={{ height: 1, width: "42%", background: RED }} />
        </div>
        {/* navy hairline */}
        <div className="mt-[6px]" style={{ height: 1, background: NAVY }} />
      </div>

      {/* ── Title — single left-aligned line under the heading ───────── */}
      <div className="px-4 pt-6">
        <div
          className="text-left"
          style={{ color: INK }}
        >
          <span className="font-extrabold tracking-[0.08em]" style={{ fontSize: 16 }}>PAYSLIP</span>
          <span className="mx-2" style={{ color: MUTED }}>–</span>
          <span className="font-semibold tracking-[0.05em]" style={{ color: MUTED, fontSize: 15 }}>
            {titleMonth}
          </span>
        </div>
      </div>

      {/* ── Body inside one classic black outer border ───────────────── */}
      <div className="mx-4 mt-3 mb-5" style={{ border: `1.2px solid ${INK}` }}>
        {/* Employee grid — name / id / department (single column) */}
        <table className="w-full border-collapse">
          <tbody>
            {employeeRows.map(([label, value], i) => (
              <tr key={label} style={{ borderBottom: i === employeeRows.length - 1 ? "none" : `0.6px solid ${BORDER}` }}>
                <td className="w-[38%]" style={{ ...cellPad, verticalAlign: "top" }}>
                  <span className="font-bold" style={{ color: MUTED, fontSize: 10.5, letterSpacing: "0.05em" }}>
                    {label}
                  </span>
                </td>
                <td style={{ ...cellPad, verticalAlign: "top" }}>
                  <span className="font-bold text-slate-800" style={{ color: INK, fontSize: 13 }}>
                    {value}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Attendance strip */}
        <div
          className="my-[6px]"
          style={{ borderTop: `0.6px solid ${BORDER}`, borderBottom: `0.6px solid ${BORDER}`, backgroundColor: "#fafafa" }}
        >
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <AttendanceCell label="Working Days" value={record.workingDays} />
                <AttendanceCell label="Present Days" value={record.presentDays} />
                <AttendanceCell label="Leave Days" value={record.leaveDays} />
                <AttendanceCell label="Weekly Off" value={record.weeklyOffDays} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Earnings & Deductions — classic 4-column table */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="border text-left font-bold"
                style={{ borderColor: BORDER, color: GREEN, fontSize: 12, letterSpacing: "0.06em", padding: "8px 10px" }}
              >
                EARNINGS
              </th>
              <th
                className="border text-left font-bold"
                style={{ borderColor: BORDER, color: INK, fontSize: 10.5, letterSpacing: "0.02em", padding: "8px 10px", textAlign: "right", fontWeight: 600 }}
              >
                Amount (Rs.)
              </th>
              <th
                className="border text-left font-bold"
                style={{ borderColor: BORDER, color: RED, fontSize: 12, letterSpacing: "0.06em", padding: "8px 10px" }}
              >
                DEDUCTIONS
              </th>
              <th
                className="border text-left font-bold"
                style={{ borderColor: BORDER, color: INK, fontSize: 10.5, letterSpacing: "0.02em", padding: "8px 10px", textAlign: "right", fontWeight: 600 }}
              >
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
                  <td style={{ border: `0.6px solid ${BORDER}`, ...cellPad }}>
                    <span style={{ color: e ? INK : "transparent", fontSize: 12 }}>{e ? e.label : "·"}</span>
                  </td>
                  <td style={{ border: `0.6px solid ${BORDER}`, ...cellPad, textAlign: "right" }}>
                    {e ? (
                      <AmountCell
                        amount={values[e.key]}
                        editing={editing}
                        onChange={onFieldChange ? (v) => onFieldChange(e.key, v) : undefined}
                      />
                    ) : null}
                  </td>
                  <td style={{ border: `0.6px solid ${BORDER}`, ...cellPad }}>
                    <span style={{ color: d ? INK : "transparent", fontSize: 12 }}>{d ? d.label : "·"}</span>
                  </td>
                  <td style={{ border: `0.6px solid ${BORDER}`, ...cellPad, textAlign: "right" }}>
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
            <tr key="totals" style={{ background: "#f8fafc" }}>
              <td style={{ border: `0.8px solid ${BORDER}`, ...cellPad }}>
                <span className="font-bold" style={{ color: INK, fontSize: 12.5 }}>Gross Salary</span>
              </td>
              <td style={{ border: `0.8px solid ${BORDER}`, ...cellPad, textAlign: "right" }}>
                <span className="font-bold tabular-nums" style={{ color: INK, fontSize: 12.5 }}>{fmtMoney(gross)}</span>
              </td>
              <td style={{ border: `0.8px solid ${BORDER}`, ...cellPad }}>
                <span className="font-bold" style={{ color: INK, fontSize: 12.5 }}>Total Deductions</span>
              </td>
              <td style={{ border: `0.8px solid ${BORDER}`, ...cellPad, textAlign: "right" }}>
                <span className="font-bold tabular-nums" style={{ color: INK, fontSize: 12.5 }}>{fmtMoney(deductions)}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* NET SALARY — bold boxed row */}
        <div
          className="flex items-center justify-between"
          style={{ borderTop: `1.2px solid ${INK}`, padding: "9px 12px", backgroundColor: "#fafafa" }}
        >
          <span className="font-extrabold tracking-[0.04em]" style={{ color: INK, fontSize: 13 }}>
            NET SALARY (TAKE HOME)
          </span>
          <span className="font-extrabold tabular-nums" style={{ color: INK, fontSize: 18 }}>
            Rs. {fmtMoney(net)}
          </span>
        </div>

        {/* Amount in words */}
        <div
          className="px-[10px] pb-2.5 italic"
          style={{ borderTop: `0.6px solid ${BORDER}`, color: MUTED, fontSize: 11.5, paddingTop: 6 }}
        >
          Net salary in words: {amountInWords(Number(net) || 0)}
        </div>
      </div>

      {/* ── Signature ────────────────────────────────────────────────── */}
      <div className="flex justify-end px-8 pb-2">
        <div className="text-center">
          <div style={{ borderTop: `1px solid ${INK}`, width: 160 }} />
          <div className="mt-1.5 font-bold" style={{ color: INK, fontSize: 12 }}>
            D. Srinivas Chakrapani
          </div>
          <div className="mt-0.5" style={{ color: MUTED, fontSize: 11 }}>
            Authorised Signatory
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <div style={{ borderTop: `1px solid ${RULE}` }} />
        <div className="pt-1 text-center" style={{ color: MUTED, fontSize: 10 }}>
          This is a computer-generated payslip and does not require a physical signature.
        </div>
        <div className="mt-0.5 text-center" style={{ color: "#949ea8", fontSize: 9.5 }}>
          Generated on {new Date().toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
          })} · DMR POULTRIES
        </div>
      </div>

      {/* Optional status / lifecycle strip below the document */}
      {note ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">{note}</div>
      ) : null}
    </div>
  );
}

export default ClassicPayslipSheet;
