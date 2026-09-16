// tests/payslip/payslip-pdf.smoke.mjs
//
// Renders the REAL payslip document module (payslipPdfDocument.ts — pure,
// Node-safe) with a representative record and verifies the A4 layout:
//
//   • exactly ONE portrait A4 page (nothing overflows to page 2)
//   • DMR POULTRIES appears FIRST (brand header is the top of the sheet)
//   • PAYSLIP + "for the month of …", employee, attendance, earnings/
//     deductions, NET SALARY, amount-in-words, Authorised Signatory and the
//     footer note are all present, in order
//
// Run: npm run test:payslip

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { drawPayslipPdf, drawCombinedPayslipsPdf, amountInWords } from "../../src/modules/staff/services/payslipPdfDocument.ts";

const record = {
  id: "sal-1",
  employeeId: 7,
  employeeName: "Ramesh Kumar",
  department: "Operations",
  role: "Supervisor",
  month: "2026-09",
  basicSalary: 18500,
  overtime: 950,
  incentives: 500,
  fuelAllowance: 0,
  nightAllowance: 250,
  totalGross: 20200,
  leaveDeduction: 600,
  advanceRecovery: 1000,
  loanEMI: 0,
  latePenalty: 0,
  otherDeductions: 0,
  totalDeductions: 1600,
  netSalary: 18600,
  status: "Paid",
  paymentDate: "2026-09-05",
  paymentRef: "NEFT-889123",
  submittedBy: "admin",
  submittedAt: "2026-09-04T10:30:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  workingDays: 26,
  presentDays: 25,
  leaveDays: 1,
  weeklyOffDays: 4,
  monthClosed: false,
  correctionWindowDaysRemaining: 12,
};

const { doc, fileName } = drawPayslipPdf(record);

// ── Page geometry ─────────────────────────────────────────────────────────
const pages = doc.getNumberOfPages();
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
assert.equal(pages, 1, `expected exactly 1 A4 page, got ${pages}`);
assert.ok(Math.abs(pageWidth - 210) < 0.5, `A4 portrait width ~210mm, got ${pageWidth}`);
assert.ok(Math.abs(pageHeight - 297) < 0.5, `A4 portrait height ~297mm, got ${pageHeight}`);

// ── Text content (order matters — the brand must be first) ────────────────
// Extracted with pdfjs-dist from the rendered bytes (the source of truth).
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const pdf = await pdfjs.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise;
assert.equal(pdf.numPages, 1, `pdfjs also sees exactly 1 page, got ${pdf.numPages}`);
const content = await (await pdf.getPage(1)).getTextContent();
const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ");

const ordered = [
  "DMR POULTRIES",
  "PAYSLIP - SEPTEMBER 2026",
  "Ramesh Kumar",
  "Working Days",
  "Amount (Rs.)",
  "Basic Salary",
  "Gross Salary",
  "Total Deductions",
  "NET SALARY",
  "Rs. 18,600.00",
  "Net salary in words",
  "D. Srinivas Chakrapani",
  "Authorised Signatory",
  "This is a computer-generated payslip",
  "Generated on",
];
let cursor = -1;
for (const needle of ordered) {
  const at = text.indexOf(needle);
  assert.ok(at >= 0, `missing text: "${needle}"`);
  assert.ok(at > cursor, `"${needle}" out of order (at ${at}, previous ${cursor})`);
  cursor = at;
}

// ── Amount in words (Indian numbering) ────────────────────────────────────
assert.equal(amountInWords(18600), "Eighteen Thousand Six Hundred Rupees Only");
assert.equal(amountInWords(18600.5), "Eighteen Thousand Six Hundred Rupees and Fifty Paise Only");
assert.equal(amountInWords(0), "Zero Rupees Only");
assert.ok(
  text.includes("Eighteen Thousand Six Hundred Rupees Only"),
  "net salary words rendered on the sheet"
);

// ── File name ─────────────────────────────────────────────────────────────
assert.equal(fileName, "DMR-Poultries-Payslip-Ramesh-Kumar-2026-09.pdf");

// Keep the artefacts for manual inspection.
mkdirSync("tests/payslip/out", { recursive: true });

// ── Combined register PDF — one A4 page per employee in ONE document ──────
const second = {
  ...record,
  id: "sal-2",
  employeeId: 8,
  employeeName: "Lakshmi Devi",
  netSalary: 22100,
};
const combined = drawCombinedPayslipsPdf([record, second, { ...record, id: "sal-3", employeeId: 9, employeeName: "Suresh Babu" }]);
assert.equal(combined.doc.getNumberOfPages(), 3, "combined PDF: one page per employee");
assert.equal(
  combined.fileName,
  "DMR-Poultries-Payslips-2026-09-3-employees.pdf",
  "combined PDF file name"
);
const combinedPdf = await pdfjs.getDocument({ data: new Uint8Array(combined.doc.output("arraybuffer")) }).promise;
assert.equal(combinedPdf.numPages, 3, "pdfjs also sees 3 pages");
for (const [pageNum, name] of [[1, "Ramesh Kumar"], [2, "Lakshmi Devi"], [3, "Suresh Babu"]]) {
  const pageText = await (await combinedPdf.getPage(pageNum)).getTextContent();
  const pageStr = pageText.items.map((item) => item.str).join(" ");
  assert.ok(pageStr.includes(name), `page ${pageNum} carries ${name}`);
  assert.ok(pageStr.includes("DMR POULTRIES"), `page ${pageNum} keeps the brand header`);
}
writeFileSync("tests/payslip/out/sample-payslips-combined.pdf", Buffer.from(combined.doc.output("arraybuffer")));

writeFileSync("tests/payslip/out/sample-payslip.pdf", Buffer.from(doc.output("arraybuffer")));

console.log(`OK — 1 A4 portrait page, brand first, all sections in order.`);
console.log(`OK — combined PDF: 3 employees on 3 pages, brand on every page.`);
console.log(`    samples written to tests/payslip/out/`);
