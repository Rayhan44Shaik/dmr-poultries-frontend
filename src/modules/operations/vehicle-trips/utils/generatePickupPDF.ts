// src/modules/operations/vehicle-trips/utils/generatePickupPDF.ts
//
// DMR POULTRIES — Professional A4 (portrait) Step 3 Pickup Report PDF.
// Uses the shared branded DMR POULTRIES letterhead (global heading), lists
// EVERY loaded box (box-wise) and ends with a cumulative summary section
// below the box table. Long box lists flow onto additional pages without
// cutting rows.

import autoTable from "jspdf-autotable";
import type { Trip } from "../types/trip";
import henImage from "../../../../assets/dmr-hen.jpg";
import {
  createDmrPoultryPdf,
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
  type DmrPoultryHeaderAssets,
} from "../../../../utils/drawDmrPoultryHeader";

type RGB = [number, number, number];

const NAVY: RGB = [15, 35, 79];
const EMERALD: RGB = [5, 150, 105];
const MUTED: RGB = [90, 100, 115];
const GRID_LINE: RGB = [203, 213, 225];
const TEXT_DARK: RGB = [30, 41, 59];

const toNum = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const fmt = (value: unknown): string =>
  value == null || value === "" ? "—" : String(value);

/** Per-box average weight: stored value wins, else weight ÷ birds (3 dp). */
function boxAvg(birds: number, weight: number, stored?: number | null): string {
  const avg =
    stored != null && Number.isFinite(Number(stored)) && Number(stored) > 0
      ? Number(stored)
      : birds > 0 && weight > 0
        ? Number((weight / birds).toFixed(3))
        : null;
  return avg == null ? "—" : avg.toFixed(3);
}

export interface PickupReportOptions {
  /** Official Step 3 pickup time (already resolved for display). */
  pickupTime?: string;
  /** Vehicle box capacity (boxes / maxBoxes display). */
  maxBoxes?: number;
}

export async function generatePickupReportPDF(
  trip: Trip,
  options: PickupReportOptions = {}
): Promise<void> {
  const doc = createDmrPoultryPdf("portrait");
  doc.setProperties({
    title: `${trip.tripNo || "Trip"} — Pickup Report`,
    subject: "DMR POULTRIES pickup report",
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

  const assets: DmrPoultryHeaderAssets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });

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

  /** Two-column label/value grid rendered as 4-column autoTable rows. */
  const kvGrid = (rows: Array<[string, string]>) => {
    const pairs: string[][] = [];
    for (let i = 0; i < rows.length; i += 2) {
      const a = rows[i];
      const b = rows[i + 1];
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
      margin: { left: margin, right: margin },
    });
    y = lastTableY(y) + 5;
  };

  // ─── PAGE 1: global letterhead + report title ──────────────────────
  y = drawPreparedDmrPoultryHeader(doc, { margin, top: 8 }, assets) + 3;

  ensureSpace(16);
  doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
  doc.roundedRect(margin, y, contentWidth, 11, 1.6, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("PICKUP REPORT", margin + 4, y + 7.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(trip.tripNo || "—", pageWidth - margin - 4, y + 7.2, { align: "right" });
  y += 14;

  // ─── PICKUP DETAILS ────────────────────────────────────────────────
  drawSectionBand("PICKUP DETAILS");
  kvGrid([
    ["Trip No", fmt(trip.tripNo)],
    ["Trip Date", fmt(trip.tripDate)],
    ["Vehicle", fmt(trip.vehicleNo)],
    ["Driver", fmt(trip.driverName)],
    ["Supervisor", fmt(trip.supervisorName)],
    ["Farm", fmt(trip.sourceFarm)],
    ["Pickup Time", fmt(options.pickupTime)],
    ["Status", trip.pickupStepSubmitted ? "Submitted" : "Not submitted"],
  ]);

  // ─── BOX-WISE DETAILS ──────────────────────────────────────────────
  const boxes = Array.isArray(trip.boxDetails) ? trip.boxDetails : [];
  drawSectionBand("BOX-WISE DETAILS", `${boxes.length} Box(es)`);

  if (boxes.length) {
    const boxBody = boxes.map((b, index) => {
      const birds = Number(b.birds || 0);
      const weight = Number(b.weight || 0);
      return [
        String(index + 1),
        `#${b.boxNo}`,
        String(birds),
        weight.toFixed(2),
        boxAvg(birds, weight, b.avgWeight),
      ];
    });
    autoTable(doc, {
      head: [["S.No", "Box", "Birds", "Weight (KG)", "Avg WT (KG)"]],
      body: boxBody,
      startY: y,
      theme: "grid",
      showHead: "everyPage",
      rowPageBreak: "avoid",
      headStyles: {
        fillColor: EMERALD,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
        valign: "middle",
        cellPadding: { top: 2.6, bottom: 2.6 },
        lineColor: EMERALD,
        lineWidth: 0.1,
      },
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2 },
        valign: "middle",
        textColor: TEXT_DARK,
        lineColor: GRID_LINE,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 16, halign: "center" },
        1: { cellWidth: 30, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 40, halign: "right" },
        3: { cellWidth: 48, halign: "right" },
        4: { cellWidth: 48, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });
    y = lastTableY(y) + 6;
  } else {
    ensureSpace(10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("No box entries recorded for this pickup.", margin, y);
    y += 7;
  }

  // ─── CUMULATIVE SUMMARY (below the box table) ──────────────────────
  const totalBirds = toNum(trip.totalBirds) ?? boxes.reduce((s, b) => s + Number(b.birds || 0), 0);
  const dcWeight =
    toNum(trip.dcWeight) ??
    Number(boxes.reduce((s, b) => s + Number(b.weight || 0), 0).toFixed(2));
  const loadedBoxes = toNum(trip.boxes) ?? boxes.filter((b) => Number(b.birds || 0) > 0 || Number(b.weight || 0) > 0).length;
  const avgWeight =
    toNum(trip.avgWeight) && Number(trip.avgWeight) > 0
      ? Number(trip.avgWeight)
      : dcWeight > 0 && totalBirds > 0
        ? Number((dcWeight / totalBirds).toFixed(3))
        : null;

  drawSectionBand("CUMULATIVE SUMMARY");
  const capacityText = options.maxBoxes ? `${loadedBoxes} / ${options.maxBoxes}` : String(loadedBoxes);
  kvGrid([
    ["Total Boxes Loaded", capacityText],
    ["Total Birds", String(totalBirds)],
    ["Total DC Weight", `${Number(dcWeight).toFixed(2)} KG`],
    ["Average Weight", avgWeight != null ? `${avgWeight.toFixed(3)} kg / bird` : "—"],
    ["Pickup Time", fmt(options.pickupTime)],
    ["Status", trip.pickupStepSubmitted ? "Submitted" : "Not submitted"],
  ]);

  // ─── FOOTER / PAGE CHROME ──────────────────────────────────────────
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
      doc.text("DMR POULTRIES — PICKUP REPORT", margin, 5);
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
  const safeVehicle = String(trip.vehicleNo || "Vehicle").replace(/[^a-zA-Z0-9_-]+/g, "_");
  doc.save(`${safeTripNo}_${safeVehicle}_PickupReport.pdf`);
}
