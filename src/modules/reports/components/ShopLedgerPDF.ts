import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import henImage from "../../../assets/dmr-hen.jpg";
import {
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
  type DmrPoultryHeaderAssets,
} from "../../../utils/drawDmrPoultryHeader";

export interface LedgerTransaction {
  date: string;
  particulars: string;
  birds: number;
  weight: number;
  rate: number;
  debit: number;
  credit: number;
  balance: number;
  type: "sale" | "collection" | "correction";
  paymentMode?: string;
  collectionNo?: string;
}

export interface GeneratedShopLedgerPdf {
  blob: Blob;
  /** Object URL for the blob — caller owns revoking it. */
  url: string;
  filename: string;
}

/** One shop's ledger section plus the shop-master details shown on the PDF. */
export interface ShopLedgerPdfEntry {
  shop: string;
  data: LedgerTransaction[];
  ownerName?: string;
  city?: string;
}

/** Ledger dates are stored as yyyy-MM-dd; the PDF prints dd-MM-yyyy. */
export const formatPdfDate = (value: string): string => {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value;
};

const normalizePaymentMode = (value?: string): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/upi/i.test(raw)) return "UPI";
  if (/union/i.test(raw)) return "Union";
  if (/\bsbi\b/i.test(raw) || /state bank/i.test(raw)) return "SBI";
  if (/bank/i.test(raw)) return "Bank Transfer";
  if (/cheque|check/i.test(raw)) return "Cheque";
  if (/credit/i.test(raw)) return "Credit";
  if (/cash/i.test(raw)) return "Cash";
  return raw;
};

const formatAmount = (value: number): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

// Shared branded palette (matches the Step-4 delivery receipt).
type RGB = [number, number, number];
const NAVY: RGB = [15, 35, 79];
const BORDER_LIGHT: RGB = [200, 200, 200];
const ACCENT_RED: RGB = [142, 30, 30];

// Page geometry — same margins the branded letterhead is designed for.
const PAGE_MARGIN = 12;
const LETTERHEAD_TOP = 7;

/**
 * Draws the branded DMR POULTRIES letterhead plus the weekly-statement title
 * and the two-column shop details (Shop / Owner, City / Period). Used on every
 * page so multi-page statements keep the same header as the Step-4 delivery
 * receipt.
 */
const drawStatementChrome = (
  doc: jsPDF,
  entry: ShopLedgerPdfEntry,
  dateFrom: string,
  dateTo: string,
  assets: DmrPoultryHeaderAssets,
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const midX = pageWidth / 2;

  // Same letterhead as the Step-4 delivery PDF (PROPRIETOR block, centred
  // DMR POULTRIES wordmark with address, hen mark, decorative divider).
  drawPreparedDmrPoultryHeader(
    doc,
    { margin: PAGE_MARGIN, top: LETTERHEAD_TOP },
    assets,
  );

  // ─── Statement title ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("WEEKLY STATEMENT", midX, 48, { align: "center" });

  // ─── Two-column shop details ───
  const labelValue = (label: string, value: string, x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(label, x, y);
    const valueX = x + doc.getTextWidth(label) + 1.5;
    doc.setFont("helvetica", "normal");
    doc.text(value || "-", valueX, y);
  };

  labelValue("Shop: ", entry.shop || "-", PAGE_MARGIN, 54.5);
  labelValue("Owner: ", entry.ownerName || "-", midX, 54.5);
  labelValue("City: ", entry.city || "-", PAGE_MARGIN, 60);
  labelValue("Period: ", `${formatPdfDate(dateFrom)} to ${formatPdfDate(dateTo)}`, midX, 60);

  doc.setDrawColor(BORDER_LIGHT[0], BORDER_LIGHT[1], BORDER_LIGHT[2]);
  doc.setLineWidth(0.25);
  doc.line(PAGE_MARGIN, 63, pageWidth - PAGE_MARGIN, 63);
};

/**
 * Closing "Thank You!" block — decorative centred divider and italic script,
 * copied from the Step-4 delivery receipt so both documents end alike.
 */
const drawThankYouBlock = (doc: jsPDF, finalY: number): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const thanksY = Math.min(Math.max(finalY + 12, pageHeight - 32), pageHeight - 24);

  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.4);
  doc.line(PAGE_MARGIN + 8, thanksY + 3, pageWidth / 2 - 28, thanksY + 3);
  doc.line(pageWidth / 2 + 28, thanksY + 3, pageWidth - PAGE_MARGIN - 8, thanksY + 3);

  doc.setFillColor(ACCENT_RED[0], ACCENT_RED[1], ACCENT_RED[2]);
  doc.circle(pageWidth / 2 - 24, thanksY + 3, 1, "F");
  doc.circle(pageWidth / 2 - 21, thanksY + 2.2, 0.75, "F");
  doc.circle(pageWidth / 2 - 21, thanksY + 3.8, 0.75, "F");
  doc.circle(pageWidth / 2 + 24, thanksY + 3, 1, "F");
  doc.circle(pageWidth / 2 + 21, thanksY + 2.2, 0.75, "F");
  doc.circle(pageWidth / 2 + 21, thanksY + 3.8, 0.75, "F");

  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("Thank You!", pageWidth / 2, thanksY + 4.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text("We appreciate your business", pageWidth / 2, thanksY + 10, { align: "center" });
};

/**
 * Build the Shop Ledger PDF for one shop or a set of shops (one page section
 * per shop). Returns the blob plus an object URL so callers can preview,
 * download or attach the file — nothing is saved automatically.
 *
 * Uses the same branded DMR POULTRIES letterhead as the Step-4 delivery
 * receipt. `preparedAssets` lets callers reuse the prepared hen mark across
 * many generate calls; omit it and the asset is prepared automatically.
 */
export const generateShopLedgerPDF = async (
  allLedgers: ShopLedgerPdfEntry[],
  dateFrom: string,
  dateTo: string,
  selectedShop: string,
  preparedAssets?: DmrPoultryHeaderAssets,
): Promise<GeneratedShopLedgerPdf> => {
  // Prepare the letterhead hen once per call (canvas cut-out); callers that
  // generate many PDFs in a batch pass their own prepared assets.
  const assets =
    preparedAssets ?? (await prepareDmrPoultryHeaderAssets({ henUrl: henImage }));

  // Setup A4 Portrait
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  doc.setProperties({
    title: "Weekly Statement",
    subject: "DMR POULTRIES weekly statement",
    author: "DMR POULTRIES",
    creator: "DMR POULTRIES",
  });

  const headers = ["Date", "Particulars", "Birds", "Weight", "Rate", "Debit", "Credit", "Balance"];

  allLedgers.forEach((entry, index) => {
    const { data } = entry;
    if (index > 0) doc.addPage();

    const pageWidth = doc.internal.pageSize.getWidth();

    // ─── Build Rows ───
    const rows = data.map((t) => {
      let label = t.particulars;
      if (t.particulars !== "Opening Balance") {
        if (t.type === "sale") {
          label = `${t.particulars} : Sale`;
        } else if (t.type === "collection") {
          const paymentMode = normalizePaymentMode(t.paymentMode);
          label = paymentMode
            ? `${t.particulars} : Collection - ${paymentMode}`
            : `${t.particulars} : Collection`;
        } else {
          label = `${t.particulars} : Correction`;
        }
      }

      return [
        formatPdfDate(t.date),
        label,
        t.type === "sale" && t.birds > 0 ? String(t.birds) : "-",
        t.type === "sale" && t.weight > 0 ? t.weight.toFixed(2) : "-",
        t.type === "sale" && t.rate > 0 ? t.rate.toFixed(2) : "-",
        t.debit > 0 ? formatAmount(t.debit) : "-",
        t.credit > 0 ? formatAmount(t.credit) : "-",
        formatAmount(t.balance),
      ];
    });

    // Calculate Totals
    const tx = data.slice(1);
    const totalDebit = tx.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = tx.reduce((sum, t) => sum + t.credit, 0);
    const totalBirds = tx.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.birds, 0);
    const totalWeight = tx.filter((t) => t.type === "sale").reduce((sum, t) => sum + t.weight, 0);
    const closingBalance = data.length > 0 ? data[data.length - 1].balance : 0;

    rows.push([
      "TOTAL",
      "",
      String(totalBirds),
      totalWeight.toFixed(2),
      "",
      formatAmount(totalDebit),
      formatAmount(totalCredit),
      formatAmount(closingBalance),
    ]);

    // ─── AutoTable Styling (letterhead on every page, table below it) ───
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 66,
      margin: { top: 66, bottom: 20, left: PAGE_MARGIN, right: PAGE_MARGIN },
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 8,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 2,
      },
      bodyStyles: {
        valign: "middle",
        fontSize: 7.5,
        textColor: [0, 0, 0],
        cellPadding: 2,
        lineWidth: 0.2,
        lineColor: [100, 100, 100],
      },
      didParseCell: (hookData) => {
        hookData.cell.styles.fontStyle = "normal";
        if (hookData.row.index === rows.length - 1) {
          hookData.cell.styles.fillColor = [240, 240, 240];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
      // Column widths sum to 186mm — the printable width of A4 portrait with
      // 12mm margins (same margins as the branded letterhead).
      columnStyles: {
        0: { cellWidth: 20, halign: "center" }, // Date
        1: { cellWidth: 54, halign: "left" },   // Particulars
        2: { cellWidth: 14, halign: "center" }, // Birds
        3: { cellWidth: 18, halign: "right" },  // Weight
        4: { cellWidth: 14, halign: "right" },  // Rate
        5: { cellWidth: 22, halign: "right" },  // Debit
        6: { cellWidth: 22, halign: "right" },  // Credit
        7: { cellWidth: 22, halign: "right" },  // Balance
      },
      didDrawPage: (data) => {
        // Letterhead + title + shop details on every page of the statement.
        drawStatementChrome(doc, entry, dateFrom, dateTo, assets);

        const pageHeight2 = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        doc.text(`Page ${data.pageNumber}`, pageWidth - PAGE_MARGIN, pageHeight2 - 8, {
          align: "right",
        });
        doc.text("DMR Poultries ERP - Weekly Statement", PAGE_MARGIN, pageHeight2 - 8);
      },
    });

    // Thank-you closing block, same style as the Step-4 delivery receipt.
    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 66;
    drawThankYouBlock(doc, finalY + 2);
  });

  const filename = `ShopLedger_${selectedShop === "All Shops" ? "AllShops" : selectedShop.replace(/\s+/g, "_")}_${formatPdfDate(dateFrom)}_to_${formatPdfDate(dateTo)}.pdf`;
  const blob = doc.output("blob");
  return { blob, url: URL.createObjectURL(blob), filename };
};

/** Prepared letterhead assets for callers that batch many PDFs. */
export const prepareShopLedgerPdfAssets = (): Promise<DmrPoultryHeaderAssets> =>
  prepareDmrPoultryHeaderAssets({ henUrl: henImage });
