/**
 * Collection view → A4 portrait PDF.
 *
 * Uses the same global letterhead every other export in the app uses
 * (`drawPreparedDmrPoultryHeader` — DMR masthead with the hen logo), so the
 * masthead, margins and footer match the Trip List view exactly.
 *
 * The sheet carries the SHOP NAME and the recent-credits table the view modal
 * shows — and nothing else. The old "Collection Details" panel (the selected
 * entry, repeated field by field) was removed: the modal already shows it, and
 * the receipt is about the shop's credit history.
 *
 * LANGUAGE NOTE: jsPDF's built-in Helvetica has no Telugu glyphs, and no
 * Telugu font is embedded in this app. Rendering Telugu through it produces
 * blank boxes, so the PDF is deliberately generated in English even when the
 * UI is switched to Telugu. Embedding a Unicode Telugu face (e.g. Noto Sans
 * Telugu) would be the fix, and this is the single place to change.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import henImage from "../../../../assets/dmr-hen.jpg";
import {
  createDmrPoultryPdf,
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
} from "../../../../utils/drawDmrPoultryHeader";
import type { CollectionApiEntry } from "../types/collection";

type RGB = [number, number, number];

const COLOR = {
  navy: [15, 35, 79] as RGB,
  slate: [71, 85, 105] as RGB,
  muted: [100, 116, 139] as RGB,
  border: [218, 226, 237] as RGB,
  header: [20, 50, 99] as RGB,
  white: [255, 255, 255] as RGB,
  rowAlt: [247, 249, 252] as RGB,
  panelBg: [248, 250, 252] as RGB,
  /** Pure black for table data — figures must read as printed, not grey. */
  value: [0, 0, 0] as RGB,
  black: [0, 0, 0] as RGB,
};

const PAGE_MARGIN = 14;

/** 210 mm − 14 mm − 14 mm. */
const CONTENT_WIDTH = 182;

function setText(doc: jsPDF, color: RGB): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFill(doc: jsPDF, color: RGB): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: jsPDF, color: RGB): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDay = (value: string | null | undefined): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Strip characters a filesystem would object to. */
function safeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

export interface ExportCollectionPdfOptions {
  shopName: string;
  /** Recent credits for the same shop, newest first — exactly what the view shows. */
  recent?: CollectionApiEntry[];
  filename?: string;
}

/**
 * The shop block: one label, one name, generous margins. Everything else the
 * old panel carried (collection no, collector, mode, reference, remarks) is
 * deliberately gone — the view modal is where an individual entry is read.
 */
function drawShopBlock(doc: jsPDF, startY: number, shopName: string): number {
  const blockH = 18;

  setFill(doc, COLOR.panelBg);
  setDraw(doc, COLOR.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE_MARGIN, startY, CONTENT_WIDTH, blockH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  setText(doc, COLOR.muted);
  doc.text("SHOP", PAGE_MARGIN + 5, startY + 6.4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, COLOR.black);
  const nameLines = doc.splitTextToSize(shopName || "-", CONTENT_WIDTH - 10);
  doc.text(nameLines[0] ?? "-", PAGE_MARGIN + 5, startY + 13.2);

  return startY + blockH;
}

function drawFooters(doc: jsPDF, generatedAt: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    setDraw(doc, COLOR.border);
    doc.setLineWidth(0.25);
    doc.line(PAGE_MARGIN, pageHeight - 10, pageWidth - PAGE_MARGIN, pageHeight - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    setText(doc, COLOR.muted);
    doc.text("DMR POULTRIES • Confidential", PAGE_MARGIN, pageHeight - 6);
    doc.text(generatedAt, pageWidth / 2, pageHeight - 6, { align: "center" });
    doc.text(`Page ${page} of ${total}`, pageWidth - PAGE_MARGIN, pageHeight - 6, {
      align: "right",
    });
  }
}

/** Build and download the A4 portrait collection PDF. */
export async function exportCollectionPdf(options: ExportCollectionPdfOptions): Promise<void> {
  const { shopName, recent = [] } = options;

  const doc = createDmrPoultryPdf("portrait");
  const assets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });

  const headerBottom = drawPreparedDmrPoultryHeader(
    doc,
    { margin: PAGE_MARGIN, top: 7 },
    assets,
  );

  // Title strip: what this document is (the shop itself gets its own block).
  let y = headerBottom + 3;
  setFill(doc, COLOR.header);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 9, 1.6, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.6);
  setText(doc, COLOR.white);
  doc.text("COLLECTION RECEIPT", PAGE_MARGIN + 4, y + 6);

  // The shop name, and nothing else — no per-entry field dump.
  y = drawShopBlock(doc, y + 12, shopName);

  const rows = recent.slice(0, 10).map((row, index) => [
    String(index + 1),
    formatDay(row.collectionDate),
    row.collectionNo || "-",
    formatMoney(Number(row.amount) || 0),
    row.collector || "-",
    row.paymentMode || "-",
    row.status || "-",
  ]);

  if (rows.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, COLOR.navy);
    doc.text("RECENT 10 CREDITS", PAGE_MARGIN, y + 9);

    autoTable(doc, {
      startY: y + 12,
      margin: { right: PAGE_MARGIN, bottom: 17, left: PAGE_MARGIN },
      tableWidth: CONTENT_WIDTH,
      head: [["#", "DATE", "COLLECTION NO", "AMOUNT", "COLLECTOR", "MODE", "STATUS"]],
      body: rows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.4,
        cellPadding: 2.2,
        lineColor: COLOR.border,
        lineWidth: 0.2,
        // Printed-black body so every figure is legible on paper.
        textColor: COLOR.black,
      },
      headStyles: {
        fillColor: COLOR.header,
        textColor: COLOR.white,
        fontStyle: "bold",
        fontSize: 7.6,
        halign: "left",
      },
      alternateRowStyles: { fillColor: COLOR.rowAlt },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 26 },
        2: { cellWidth: 38 },
        3: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: COLOR.black },
        4: { cellWidth: 32 },
        5: { cellWidth: 24 },
        6: { cellWidth: 24 },
      },
    });
  }

  const generatedAt = `Generated ${new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  drawFooters(doc, generatedAt);

  const stamp = (recent[0]?.collectionDate || new Date().toISOString()).slice(0, 10);
  doc.save(safeFilename(options.filename ?? `collection-${shopName}-${stamp}.pdf`));
}
