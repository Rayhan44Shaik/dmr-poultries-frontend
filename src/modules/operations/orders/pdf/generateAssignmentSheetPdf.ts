// src/modules/operations/orders/pdf/generateAssignmentSheetPdf.ts
// DMR POULTRIES — Shop Assignment Sheet PDF (Tab 2 · Order Assignment).
//
// The document the supervisor receives / the operator confirms before a
// WhatsApp send: the same branded letterhead as every other DMR PDF (hen
// logo + DMR header), the trip facts, the order summary, and the shops to
// deliver IN DELIVERY ORDER with their assigned share (boxes / birds / est.
// weight / shop mobile). Reuses the existing header assets and the autoTable
// grid conventions, so it looks native to the ERP.

import autoTable from "jspdf-autotable";
import type { Trip } from "../../../../shared/trip";
import henImage from "../../../../assets/dmr-hen.jpg";
import {
  createDmrPoultryPdf,
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
  type DmrPoultryHeaderAssets,
} from "../../../../utils/drawDmrPoultryHeader";
import type { AssignmentSheetRow } from "../ordersUtils";
import { ordersTranslate } from "../i18n/ordersI18n";

type RGB = [number, number, number];

const NAVY: RGB = [15, 35, 79];
const EMERALD: RGB = [5, 150, 105];
const MUTED: RGB = [90, 100, 115];
const GRID_LINE: RGB = [203, 213, 225];
const TEXT_DARK: RGB = [30, 41, 59];
const ALT_ROW: RGB = [248, 249, 251];

export type AssignmentSheetPdfInput = {
  trip: Trip;
  supervisorMobile: string;
  orderTripNo: string;
  orderDate: string;
  /** Shops in DELIVERY order (the vehicle's sequence). */
  rows: AssignmentSheetRow[];
  /** Vehicle master box capacity (0 = unknown). */
  capacity: number;
  /** Boxes already on the truck from OTHER orders (for the available math). */
  alreadyAssignedOther: number;
  language?: "en" | "te";
  /** "download" (default) saves the file; "preview" only builds it. */
  mode?: "download" | "preview";
};

export type AssignmentSheetPdfResult = {
  fileName: string;
  blob: Blob;
  url: string;
  pages: number;
};

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (value: unknown): string =>
  value == null || value === "" ? "—" : String(value);
const count = (value: unknown): string => toNum(value).toLocaleString("en-IN");

// Preparing the hen logo + header artwork fetches the image and runs canvas
// work — expensive. Cache the prepared assets once per session so the sheet
// RE-BUILDS in milliseconds when only the shop sequence (or language) changes.
let headerAssetsPromise: Promise<DmrPoultryHeaderAssets> | null = null;
function loadHeaderAssets(): Promise<DmrPoultryHeaderAssets> {
  if (!headerAssetsPromise) {
    headerAssetsPromise = prepareDmrPoultryHeaderAssets({ henUrl: henImage });
    // A failed prepare falls back to a fresh attempt on the next build.
    headerAssetsPromise.catch(() => {
      headerAssetsPromise = null;
    });
  }
  return headerAssetsPromise;
}

export async function generateAssignmentSheetPdf({
  trip,
  supervisorMobile,
  orderTripNo,
  orderDate,
  rows,
  capacity,
  alreadyAssignedOther,
  language = "en",
  mode = "download",
}: AssignmentSheetPdfInput): Promise<AssignmentSheetPdfResult> {
  const t = (key: string, params?: Record<string, string | number>) =>
    ordersTranslate(key, language, params);

  const doc = createDmrPoultryPdf("portrait");
  doc.setProperties({
    title: `${trip.tripNo || "Trip"} — DMR POULTRIES`,
    subject: "DMR POULTRIES shop assignment sheet",
    author: "DMR POULTRIES",
    creator: "DMR POULTRIES",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const footerTop = pageHeight - 11;

  const generatedStr = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const assets: DmrPoultryHeaderAssets = await loadHeaderAssets();

  const lastTableY = (fallback: number): number => {
    const table = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    return table?.finalY ?? fallback;
  };

  let y = 0;
  const newPage = () => {
    doc.addPage();
    y = margin;
  };
  const ensureSpace = (needed: number) => {
    if (y + needed > footerTop - 4) newPage();
  };

  const drawSectionBand = (label: string, sub?: string) => {
    ensureSpace(14);
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.roundedRect(margin, y, contentWidth, 7.5, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(label, margin + 3, y + 5.1);
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(215, 222, 230);
      doc.text(sub, pageWidth - margin - 3, y + 5.1, { align: "right" });
    }
    y += 10.5;
  };

  const kvGrid = (gridRows: Array<[string, string]>) => {
    const pairs: string[][] = [];
    for (let i = 0; i < gridRows.length; i += 2) {
      const a = gridRows[i];
      const b = gridRows[i + 1];
      pairs.push([a[0], a[1], b ? b[0] : "", b ? b[1] : ""]);
    }
    const labelCol = contentWidth * 0.24;
    const valueCol = (contentWidth - labelCol * 2) / 2;
    autoTable(doc, {
      body: pairs,
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2.3, textColor: TEXT_DARK, lineColor: GRID_LINE, lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: labelCol, fontStyle: "bold", textColor: MUTED },
        1: { cellWidth: valueCol },
        2: { cellWidth: labelCol, fontStyle: "bold", textColor: MUTED },
        3: { cellWidth: valueCol },
      },
      margin: { left: margin, right: margin, top: 12, bottom: 12 },
    });
    y = lastTableY(y) + 5;
  };

  const totalBoxes = rows.reduce((s, r) => s + r.boxes, 0);
  const availableAfter = capacity > 0 ? Math.max(0, capacity - alreadyAssignedOther - totalBoxes) : 0;

  // ─── PAGE 1: branded letterhead (hen logo + DMR header) ─────────────
  y = drawPreparedDmrPoultryHeader(doc, { margin, top: 8 }, assets) + 3;

  // ─── TRIP DETAILS ────────────────────────────────────────────────────
  drawSectionBand("TRIP DETAILS");
  kvGrid([
    [t("orders.col_trip_no"), fmt(trip.tripNo)],
    [t("orders.col_date"), fmt(trip.tripDate)],
    [t("orders.vehicle_no"), fmt(trip.vehicleNo)],
    [t("orders.vehicle_box_capacity"), capacity > 0 ? count(capacity) : "—"],
    [t("orders.supervisor"), fmt(trip.supervisorName)],
    [t("orders.supervisor_mobile"), fmt(supervisorMobile)],
    [t("orders.driver"), fmt(trip.driverName)],
    [t("orders.farm_city"), fmt(trip.farmAddress || trip.sourceFarm)],
  ]);

  // ─── ORDER / ASSIGNMENT SUMMARY ─────────────────────────────────────
  drawSectionBand(t("orders.assignment_details"));
  kvGrid([
    [t("orders.pdf_order_date"), fmt(orderDate)],
    [t("orders.col_total_shops"), count(rows.length)],
    [t("orders.col_assigned_boxes"), count(totalBoxes)],
    [
      t("orders.available_boxes"),
      capacity > 0 ? `${count(availableAfter)} / ${count(capacity)}` : "—",
    ],
  ]);

  // ─── SHOPS TO DELIVER (in delivery order) ────────────────────────────
  drawSectionBand(
    t("orders.shops_to_deliver"),
    t("orders.assignment_sheet_sub", {
      shops: rows.length,
      boxes: count(totalBoxes),
    })
  );
  const body: (string | number)[][] = rows.map((row, index) => [
    row.serialNo || index + 1,
    row.shopName,
    row.village || "—",
    row.mobile || "—",
    count(row.boxes),
    row.birds > 0 ? count(row.birds) : "—",
  ]);
  if (body.length === 0) {
    body.push(["—", t("orders.sequence_empty"), "—", "—", "0", "—"]);
  }
  // Column plan (content 182mm): the fixed columns get exactly what their
  // content needs, Shop Name takes the REST and wraps — long names can never
  // squeeze City/Mobile/Boxes/Birds again. Available at a glance with 30+
  // shops: every page repeats the header and keeps clear of the page chrome.
  const COL_SEQ = 10;
  const COL_CITY = 28;
  const COL_MOBILE = 28;
  const COL_BOXES = 16;
  const COL_BIRDS = 18;
  const COL_SHOP = contentWidth - COL_SEQ - COL_CITY - COL_MOBILE - COL_BOXES - COL_BIRDS;
  autoTable(doc, {
    head: [
      [
        "Seq",
        t("orders.col_shop_name"),
        t("orders.city"),
        t("orders.col_mobile"),
        t("orders.boxes"),
        t("orders.birds"),
      ],
    ],
    body,
    startY: y,
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: EMERALD,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      cellPadding: { top: 2.6, bottom: 2.6 },
      lineColor: EMERALD,
      lineWidth: 0.1,
    },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 1.6, right: 1.6 },
      valign: "middle",
      overflow: "linebreak",
      textColor: TEXT_DARK,
      lineColor: GRID_LINE,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: COL_SEQ, halign: "center" },
      1: { cellWidth: COL_SHOP, halign: "left" },
      2: { cellWidth: COL_CITY },
      3: { cellWidth: COL_MOBILE, halign: "center" },
      4: { cellWidth: COL_BOXES, halign: "right", fontStyle: "bold" },
      5: { cellWidth: COL_BIRDS, halign: "right" },
    },
    // Top clears the running navy page strip; bottom clears the footer line.
    margin: { left: margin, right: margin, top: 12, bottom: 12 },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index % 2 === 1) {
        data.cell.styles.fillColor = ALT_ROW;
      }
    },
  });
  y = lastTableY(y) + 5;

  // ─── TOTALS (boxes are the figure that matters) ──────────────────────
  drawSectionBand(t("orders.pdf_totals"));
  kvGrid([
    [t("orders.col_total_shops"), count(rows.length)],
    [t("orders.col_assigned_boxes"), count(totalBoxes)],
  ]);

  // ─── FOOTER / PAGE CHROME (same pattern as the other DMR PDFs) ──────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    const w = doc.internal.pageSize.getWidth();
    if (p > 1) {
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.rect(0, 0, w, 7.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("DMR POULTRIES", margin, 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(trip.tripNo || "", w - margin, 5, { align: "right" });
    }
    doc.setDrawColor(GRID_LINE[0], GRID_LINE[1], GRID_LINE[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, h - 9, w - margin, h - 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`Page ${p} of ${pageCount}`, margin, h - 5.5);
    doc.text(`Generated on ${generatedStr}`, w - margin, h - 5.5, { align: "right" });
  }

  const safeTripNo = String(trip.tripNo || "Trip").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const fileName = `${safeTripNo}_${orderTripNo.replace(/[^a-zA-Z0-9_-]+/g, "_")}_ShopAssignment.pdf`;
  if (mode === "download") doc.save(fileName);
  const blob = doc.output("blob") as Blob;
  return { fileName, blob, url: URL.createObjectURL(blob), pages: pageCount };
}
