// src/utils/exportUtils.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/** One brand identity for every PDF the product emits. */
const BRAND_NAME = 'DMR POULTRIES';
const BRAND_TAGLINE = 'Poultry Distribution & Logistics';
const BRAND_GREEN: [number, number, number] = [5, 150, 105];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const HAIRLINE: [number, number, number] = [226, 232, 240];

export interface PdfFilterChip {
  label: string;
  value: string;
}

export interface PdfSummaryStat {
  label: string;
  value: string;
}

export interface ExportToPDFOptions {
  /** "Applied filters" line — what this report was narrowed to. */
  filters?: PdfFilterChip[];
  /** Cumulative totals across the whole filtered set, not just this page. */
  summary?: PdfSummaryStat[];
  /** Columns rendered right-aligned (numeric). */
  numericColumns?: number[];
  /** Overrides the "Report" descriptor under the title. */
  subtitle?: string;
}

/**
 * Generates and downloads a neat, branded A4 portrait report.
 *
 * Layout, top to bottom: brand bar, DMR header block with generation
 * timestamp, the report title, the filters this data was narrowed by, a
 * cumulative totals strip, then the data table with a footer on every page.
 * Everything is measured off `pageWidth`/`pageHeight` so it stays inside the
 * A4 margins no matter how many columns a caller passes.
 */
export const exportToPDF = (
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  options: ExportToPDFOptions = {}
): void => {
  const { filters = [], summary = [], numericColumns = [], subtitle } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 14; // page margin
  const contentWidth = pageWidth - M * 2;

  // -- Brand bar ------------------------------------------------------------
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // -- Brand block ----------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(BRAND_NAME, M, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(BRAND_TAGLINE, M, 21);

  // Generated-on stamp, right aligned against the same margin.
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('GENERATED', pageWidth - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(stamp, pageWidth - M, 19, { align: 'right' });

  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.4);
  doc.line(M, 25, pageWidth - M, 25);

  // -- Report title ---------------------------------------------------------
  let y = 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, M, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(subtitle ?? `${rows.length} record${rows.length === 1 ? '' : 's'}`, pageWidth - M, y, { align: 'right' });
  y += 6;

  // -- Applied filters ------------------------------------------------------
  // Wrapped by hand so a long filter set cannot overflow the right margin.
  if (filters.length) {
    const text = filters.map((f) => `${f.label}: ${f.value}`).join('   |   ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(text, contentWidth - 6) as string[];
    const boxH = lines.length * 4 + 5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...HAIRLINE);
    doc.roundedRect(M, y, contentWidth, boxH, 1.5, 1.5, 'FD');
    doc.setTextColor(...MUTED);
    lines.forEach((line, i) => doc.text(line, M + 3, y + 6 + i * 4));
    y += boxH + 4;
  }

  // -- Cumulative totals ----------------------------------------------------
  // Evenly divided cards; these are the totals for the entire filtered set.
  if (summary.length) {
    const gap = 3;
    const cardW = (contentWidth - gap * (summary.length - 1)) / summary.length;
    const cardH = 14;
    summary.forEach((stat, i) => {
      const x = M + i * (cardW + gap);
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text(stat.label.toUpperCase(), x + 2.5, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_GREEN);
      doc.text(stat.value, x + 2.5, y + 11);
    });
    y += cardH + 5;
  }

  // -- Data table -----------------------------------------------------------
  const columnStyles: Record<number, { halign: 'right' }> = {};
  numericColumns.forEach((i) => { columnStyles[i] = { halign: 'right' }; });

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows.length ? rows : [[{ content: 'No records match the selected filters.', colSpan: headers.length, styles: { halign: 'center', textColor: MUTED } }] as never],
    theme: 'grid',
    margin: { left: M, right: M, bottom: 18 },
    tableWidth: 'auto',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      textColor: INK,
      lineColor: HAIRLINE,
      lineWidth: 0.1,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: BRAND_GREEN,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2.5,
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles,
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setDrawColor(...HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(M, pageHeight - 12, pageWidth - M, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`${BRAND_NAME}  •  Confidential`, M, pageHeight - 7.5);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - M,
        pageHeight - 7.5,
        { align: 'right' }
      );
    },
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Generates and downloads a clean, formatted Excel sheet.
 */
export const exportToExcel = (
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void => {
  const worksheetData = [
    [title],
    [], // Blank row
    headers,
    ...rows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Summary');

  // Trigger download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};