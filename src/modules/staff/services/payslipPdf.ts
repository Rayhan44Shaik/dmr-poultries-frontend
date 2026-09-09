// src/modules/staff/services/payslipPdf.ts
//
// DMR POULTRIES — Salary Payslip PDF (browser entry point).
//
// The document itself is drawn by `payslipPdfDocument.ts` (pure, Node-safe).
// This wrapper prepares the hen brand asset (needs the canvas API), renders
// the document and turns it into a Blob / object URL / file download.
//
// Downloading ALWAYS works: the payslip is generated in the browser with the
// same branded A4 portrait layout that will be attached to emails.

import henImage from "../../../assets/dmr-hen.jpg";
import {
  prepareDmrPoultryHeaderAssets,
} from "../../../utils/drawDmrPoultryHeader";
import { drawPayslipPdf } from "./payslipPdfDocument";
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
  const assets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });
  const { doc, fileName } = drawPayslipPdf(record, assets);

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
