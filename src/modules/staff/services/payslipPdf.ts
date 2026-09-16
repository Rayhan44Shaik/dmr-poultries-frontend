// src/modules/staff/services/payslipPdf.ts
//
// DMR POULTRIES — Salary Payslip PDF (browser entry point).
//
// The document itself is drawn by `payslipPdfDocument.ts` (pure, Node-safe).
// This wrapper renders the document and turns it into a Blob / object URL /
// file download.
//
// Downloading ALWAYS works: the payslip is generated in the browser with the
// same branded A4 portrait layout that will be attached to emails.

import { drawPayslipPdf, drawCombinedPayslipsPdf } from "./payslipPdfDocument";
import type { SalaryRecord } from "../types/staffDashboard";

export { amountInWords } from "./payslipPdfDocument";

export type PayslipPdfResult = {
  fileName: string;
  blob: Blob;
  /** Object URL for previews. The caller revokes it. */
  url: string;
};

/**
 * Builds the A4 portrait payslip for one salary record.
 *
 * @param record  the salary row (from the register table)
 * @param mode    "download" saves the file; "preview" only builds it
 */
export async function generatePayslipPdf(
  record: SalaryRecord,
  mode: "download" | "preview" = "download"
): Promise<PayslipPdfResult> {
  const { doc, fileName } = drawPayslipPdf(record);

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  if (mode === "download") {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return { fileName, blob, url };
}

/**
 * Builds ONE combined A4 PDF containing every given employee's payslip —
 * one page per employee (the register's "All in One PDF" download).
 *
 * @param records  the salary rows to include, in register order
 * @param mode     "download" saves the file; "preview" only builds it
 */
export async function generateCombinedPayslipPdf(
  records: SalaryRecord[],
  mode: "download" | "preview" = "download"
): Promise<PayslipPdfResult> {
  if (records.length === 0) throw new Error("No salary records to combine");
  const { doc, fileName } = drawCombinedPayslipsPdf(records);

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  if (mode === "download") {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return { fileName, blob, url };
}
