// src/modules/staff/services/payslipPdfDocument.ts
//
// DMR POULTRIES — Salary Payslip PDF document (A4 portrait, one employee).
// PURE DRAWING MODULE: no asset imports and no browser APIs, so it can be
// rendered in the browser, in Electron, or from a Node smoke test.
//
// FORMAL PAYSLIP (A4) — white sheet, black rules. Colours only on the
// Earnings (green) / Deductions (red) column headings:
//
//   DMR POULTRIES                  — navy wordmark, centred (no hen)
//   ──── • ● • ────                — red brand divider + navy hairline
//   PAYSLIP - SEPTEMBER 2026       — single left-aligned title
//   ┌───────────────────────────── outer border ─────────────────────────┐
//   │ employee details        — name / id / department                   │
//   │ attendance strip        — working · present · leave · weekly off   │
//   │ earnings | deductions   — classic 4-column table + bold totals     │
//   │ NET SALARY (TAKE HOME)  — bold boxed row, amount in words below    │
//   └────────────────────────────────────────────────────────────────────┘
//                                        ______________
//                                        D. Srinivas Chakrapani
//                                        Authorised Signatory
//   ─── footer ───                 — thin line + centred "computer-generated"
//                                    note + generated-on date

import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  createDmrPoultryPdf,
  DMR_POULTRY_DETAILS,
} from "../../../utils/drawDmrPoultryHeader";
import type { SalaryRecord } from "../types/staffDashboard";

type RGB = [number, number, number];

/** Navy brand ink — wordmark and header hairline only. */
const NAVY: RGB = [15, 35, 79];
/** Red brand accent — the header divider dots only / deductions heading. */
const RED: RGB = [178, 20, 34];
/** Green — earnings heading. */
const GREEN: RGB = [21, 128, 61];
/** Near-black ink — titles, values, net pay, outer border. */
const INK: RGB = [26, 32, 44];
/** Muted grey — labels, address line, notes. */
const MUTED: RGB = [90, 100, 115];
/** Faint grey — zero amounts. */
const FAINT: RGB = [168, 178, 192];
/** Dark slate — every table's border (reads as classic black rule). */
const BORDER: RGB = [71, 85, 105];
/** Light grey — signature rule and footer rule. */
const RULE: RGB = [203, 213, 225];

const MARGIN = 14;

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (value: unknown): string =>
  value == null || value === "" ? "—" : String(value);

const money = (value: unknown): string =>
  toNum(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatMonthLabel(month: string): string {
  if (!month) return "—";
  const [y, m] = month.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

/* ---------------------------------------------------------------------------
 * Amount in words (Indian numbering) — the classic payslip line.
 * ------------------------------------------------------------------------- */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds) out += ONES[hundreds] + " Hundred";
  if (rest) out += (out ? " " : "") + twoDigits(rest);
  return out;
}

/** Indian numbering: crore → lakh → thousand → hundred. */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - n) * 100);
  if (n === 0 && !paise) return "Zero Rupees Only";

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = parts.join(" ") + " Rupees";
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return words + " Only";
}

/* ------------------------------------------------------------------------- */

export type PayslipPdfDocument = {
  doc: jsPDF;
  fileName: string;
};

/**
 * Draws the formal A4 portrait payslip for one salary record.
 *
 * @param record  the salary row (from the register table)
 */
export function drawPayslipPdf(
  record: SalaryRecord
): PayslipPdfDocument {
  const doc = createDmrPoultryPdf("portrait");
  doc.setProperties({
    title: `Payslip — ${record.employeeName} — ${record.month}`,
    subject: "DMR POULTRIES salary payslip",
    author: "DMR POULTRIES",
    creator: "DMR POULTRIES",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  const lastTableY = (fallback: number): number => {
    const table = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    return table?.finalY ?? fallback;
  };

  let y: number;

  /* ── Centered DMR POULTRIES header — wordmark only (no hen) ────────── */
  const brand = DMR_POULTRY_DETAILS;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(brand.businessName, pageWidth / 2, 16, { align: "center" });
  y = 20;

  // Red brand divider: two line segments with three dots at the centre.
  const dividerY = y;
  doc.setDrawColor(RED[0], RED[1], RED[2]);
  doc.setLineWidth(0.45);
  doc.line(MARGIN, dividerY, pageWidth / 2 - 12, dividerY);
  doc.line(pageWidth / 2 + 12, dividerY, pageWidth - MARGIN, dividerY);
  doc.setFillColor(RED[0], RED[1], RED[2]);
  doc.circle(pageWidth / 2 - 4, dividerY, 0.6, "F");
  doc.circle(pageWidth / 2, dividerY, 0.82, "F");
  doc.circle(pageWidth / 2 + 4, dividerY, 0.6, "F");
  y = dividerY + 3.5;

  // Navy hairline closing the header.
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.18);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 7;

  /* ── PAYSLIP title — single left-aligned line ──────────────────────── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(
    `PAYSLIP - ${formatMonthLabel(record.month).toUpperCase()}`,
    MARGIN,
    y + 4.5
  );
  y += 11;

  /* ── Everything from the employee grid to the amount-in-words sits
   *    inside ONE classic outer border, drawn after the content. ──────── */
  const boxTop = y;

  /* ── Employee details (two-column grid) ─────────────────────────────── */
  // Core identity only (name / id / department). Role, salary month & status
  // are left off the document — the period reads in the title line above.
  const employeeRows: Array<[string, string]> = [
    ["Employee Name", fmt(record.employeeName)],
    ["Employee ID", record.employeeId != null ? `#${record.employeeId}` : "—"],
    ["Department", fmt(record.department)],
  ];
  const pairs: string[][] = [];
  for (let i = 0; i < employeeRows.length; i += 2) {
    const a = employeeRows[i];
    const b = employeeRows[i + 1];
    pairs.push([a[0], a[1], b ? b[0] : "", b ? b[1] : ""]);
  }
  const labelCol = contentWidth * 0.19;
  const valueCol = (contentWidth - labelCol * 2) / 2;
  const plainTable = {
    theme: "grid" as const,
    styles: {
      fontSize: 8.5,
      cellPadding: 2.3,
      textColor: INK,
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    margin: { left: MARGIN, right: MARGIN },
  };
  autoTable(doc, {
    ...plainTable,
    body: pairs,
    columnStyles: {
      0: { cellWidth: labelCol, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: valueCol, fontStyle: "bold", textColor: INK },
      2: { cellWidth: labelCol, fontStyle: "bold", textColor: MUTED },
      3: { cellWidth: valueCol, fontStyle: "bold", textColor: INK },
    },
  });
  y = lastTableY(y) + 5;

  /* ── Attendance strip ───────────────────────────────────────────────── */
  autoTable(doc, {
    ...plainTable,
    head: [["Working Days", "Present Days", "Leave Days", "Weekly Off"]],
    body: [[
      fmt(record.workingDays ?? "—"),
      fmt(record.presentDays ?? "—"),
      fmt(record.leaveDays ?? "—"),
      fmt(record.weeklyOffDays ?? "—"),
    ]],
    showHead: "everyPage",
    headStyles: {
      fillColor: 255,
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      cellPadding: { top: 2.4, bottom: 2.4 },
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    styles: {
      ...plainTable.styles,
      fontSize: 9,
      halign: "center",
      fontStyle: "bold",
      cellPadding: { top: 2.6, bottom: 2.6 },
    },
  });
  y = lastTableY(y) + 5;

  /* ── Earnings & Deductions (classic 4-column payslip table) ─────────── */
  const earnings: Array<[string, number]> = [
    ["Basic Salary", toNum(record.basicSalary)],
    ["Overtime", toNum(record.overtime)],
    ["Incentives", toNum(record.incentives)],
    ["Fuel Allowance", toNum(record.fuelAllowance)],
    ["Night Allowance", toNum(record.nightAllowance)],
  ];
  const deductions: Array<[string, number]> = [
    ["Leave Deduction", toNum(record.leaveDeduction)],
    ["Advance Recovery", toNum(record.advanceRecovery)],
    ["Loan EMI", toNum(record.loanEMI)],
    ["Late Penalty", toNum(record.latePenalty)],
    ["Other Deductions", toNum(record.otherDeductions)],
  ];

  const tableBody: (string | number)[][] = [];
  for (let i = 0; i < Math.max(earnings.length, deductions.length); i += 1) {
    const e = earnings[i];
    const d = deductions[i];
    tableBody.push([
      e ? e[0] : "",
      e ? money(e[1]) : "",
      d ? d[0] : "",
      d ? money(d[1]) : "",
    ]);
  }
  tableBody.push([
    "Gross Salary",
    money(record.totalGross),
    "Total Deductions",
    money(record.totalDeductions),
  ]);

  autoTable(doc, {
    ...plainTable,
    head: [["Earnings", "Amount (Rs.)", "Deductions", "Amount (Rs.)"]],
    body: tableBody,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: 255,
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 2.6, bottom: 2.6 },
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    styles: {
      ...plainTable.styles,
      fontSize: 8.5,
      cellPadding: { top: 2.2, bottom: 2.2 },
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.31 },
      1: { cellWidth: contentWidth * 0.19, halign: "right" },
      2: { cellWidth: contentWidth * 0.31 },
      3: { cellWidth: contentWidth * 0.19, halign: "right" },
    },
    didParseCell: (data) => {
      // Colour the Earnings / Deductions column headings (green / red).
      if (data.section === "head") {
        const raw = data.cell.raw;
        if (raw === "Earnings") data.cell.styles.textColor = GREEN;
        if (raw === "Deductions") data.cell.styles.textColor = RED;
        return;
      }
      if (data.section !== "body") return;
      const isTotalRow = data.row.index === tableBody.length - 1;
      const isAmountCol = data.column.index === 1 || data.column.index === 3;
      if (isTotalRow) {
        // Totals row — bold ink, no fill.
        data.cell.styles.fontStyle = "bold";
        return;
      }
      // Mute zero amounts so real numbers stand out.
      if (isAmountCol && data.cell.raw === "0.00") {
        data.cell.styles.textColor = FAINT;
      }
    },
  });
  y = lastTableY(y) + 6;

  /* ── NET SALARY — bold boxed row (the classic take-home line) ───────── */
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, y, contentWidth, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("NET SALARY (TAKE HOME)", MARGIN + 4, y + 7.2);
  doc.setFontSize(12.5);
  // "Rs." not "₹" — jsPDF's built-in helvetica has no rupee glyph.
  doc.text(`Rs. ${money(record.netSalary)}`, pageWidth - MARGIN - 4, y + 7.4, {
    align: "right",
  });
  y += 11;

  /* ── Amount in words (inside the border box) ────────────────────────── */
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Net salary in words: ${amountInWords(toNum(record.netSalary))}`,
    MARGIN + 2,
    y + 5.5
  );
  y += 9;

  /* ── The classic outer border around the payslip body ───────────────── */
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.35);
  doc.rect(MARGIN, boxTop, contentWidth, y - boxTop);
  y += 6;

  /* ── Signature (single, right-aligned) ─────────────────────────────── */
  const sigRight = pageWidth - MARGIN;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.18);
  doc.line(sigRight - 42, y + 13, sigRight, y + 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("D. Srinivas Chakrapani", sigRight, y + 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Authorised Signatory", sigRight, y + 21, { align: "right" });

  /* ── Footer — thin line + small centered note ──────────────────────── */
  const generatedStr = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const footerLineY = pageHeight - 17;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, footerLineY, pageWidth - MARGIN, footerLineY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    "This is a computer-generated payslip and does not require a physical signature.",
    pageWidth / 2,
    footerLineY + 4.5,
    { align: "center" }
  );
  doc.setFontSize(7);
  doc.setTextColor(148, 158, 172);
  doc.text(
    `Generated on ${generatedStr}  ·  ${brand.businessName}`,
    pageWidth / 2,
    footerLineY + 8.5,
    { align: "center" }
  );

  const safeName = (record.employeeName || "Employee")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
  const fileName = `DMR-Poultries-Payslip-${safeName}-${record.month}.pdf`;

  return { doc, fileName };
}
