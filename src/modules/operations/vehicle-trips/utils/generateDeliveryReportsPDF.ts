// src/modules/operations/vehicle-trips/utils/generateDeliveryReportsPDF.ts
//
// DMR POULTRIES — Step 4 (Shop Delivery) reports, in the SAME branded format
// as the Step 3 Pickup Report: global DMR letterhead, navy section bands,
// emerald table headers, box-wise tables and a cumulative summary.
//
// Two separate documents are produced:
//   • generateShopsDeliveryReportPDF  — SHOP-WISE delivery report (shops read
//     from the Step 4 delivery rows / Orders assignment plan).
//   • generateBoxesDeliveryReportPDF  — BOX-WISE delivery report (boxes read
//     from the Step 3 pickup `boxDetails`, delivered birds reduced by mortality).

import autoTable from "jspdf-autotable";
import type { ShopDelivery, BoxDetail } from "../types/trip";
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

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (value: unknown): string =>
  value == null || value === "" ? "—" : String(value);
const count = (value: unknown): string => toNum(value).toLocaleString("en-IN");

export interface DeliveryReportContext {
  tripNo: string;
  tripDate: string;
  vehicleNo: string;
  driverName?: string;
  supervisorName?: string;
}

export interface ShopMasterRef {
  id?: string | number;
  shopId?: string | number;
  shopName?: string;
  name?: string;
  city?: string;
  village?: string;
  mobile?: string;
  phoneNumber?: string;
}

/** Shared DMR report chrome: header assets, section band + footer painters. */
function buildReportShell(
  doc: ReturnType<typeof createDmrPoultryPdf>,
  margin: number,
  contentWidth: number,
  pageHeight: number
) {
  const footerTop = pageHeight - 11;
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
      doc.text(sub, margin + contentWidth - 3, y + 5.1, { align: "right" });
    }
    y += 10.5;
  };

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

  const finishPages = (pageTitle: string, tripNo: string, generatedStr: string) => {
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
        doc.text(pageTitle, margin, 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(tripNo || "", w - margin, 5, { align: "right" });
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
  };

  return { y: () => y, setY: (n: number) => (y = n), lastTableY, ensureSpace, drawSectionBand, kvGrid, finishPages };
}

const loadAssets = async (): Promise<DmrPoultryHeaderAssets> =>
  prepareDmrPoultryHeaderAssets({ henUrl: henImage });

async function reportPreamble(doc: ReturnType<typeof createDmrPoultryPdf>, title: string, tripNo: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const assets = await loadAssets();
  let y = drawPreparedDmrPoultryHeader(doc, { margin, top: 8 }, assets) + 3;

  doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
  doc.roundedRect(margin, y, contentWidth, 11, 1.6, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin + 4, y + 7.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(tripNo || "—", pageWidth - margin - 4, y + 7.2, { align: "right" });
  return y + 14;
}

function saveReport(doc: ReturnType<typeof createDmrPoultryPdf>, tripNo: string, suffix: string) {
  const safeTripNo = String(tripNo || "Trip").replace(/[^a-zA-Z0-9_-]+/g, "_");
  doc.save(`${safeTripNo}_${suffix}.pdf`);
}

/** Shop master lookup by id. */
function shopIndex(shops: ShopMasterRef[]): Map<number, ShopMasterRef> {
  const map = new Map<number, ShopMasterRef>();
  (shops || []).forEach((s) => {
    const id = toNum(s.id ?? s.shopId);
    if (id > 0) map.set(id, s);
  });
  return map;
}

export async function generateShopsDeliveryReportPDF({
  rows,
  shops = [],
  context,
}: {
  rows: ShopDelivery[];
  shops?: ShopMasterRef[];
  context: DeliveryReportContext;
}): Promise<void> {
  const doc = createDmrPoultryPdf("portrait");
  doc.setProperties({
    title: `${context.tripNo || "Trip"} — Shop Delivery Report`,
    subject: "DMR POULTRIES shop delivery report",
    author: "DMR POULTRIES",
    creator: "DMR POULTRIES",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const generatedStr = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const shell = buildReportShell(doc, margin, contentWidth, pageHeight);
  const startY = await reportPreamble(doc, "SHOP DELIVERY REPORT", context.tripNo);
  shell.setY(startY);

  shell.drawSectionBand("TRIP DETAILS");
  shell.kvGrid([
    ["Trip No", fmt(context.tripNo)],
    ["Trip Date", fmt(context.tripDate)],
    ["Vehicle", fmt(context.vehicleNo)],
    ["Driver", fmt(context.driverName)],
    ["Supervisor", fmt(context.supervisorName)],
    ["Status", rows.length ? `${rows.length} Delivery(ies)` : "None"],
  ]);

  const master = shopIndex(shops);
  const list = rows.filter((r) => r && (Number(r.shopId) > 0 || r.shopName));
  shell.drawSectionBand("SHOP-WISE DELIVERIES", `${list.length} Shop(s)`);

  let totalBoxes = 0;
  let totalBirds = 0;
  let totalWeight = 0;
  let totalMortality = 0;
  let totalMortKg = 0;

  const body: (string | number)[][] = list.map((r, index) => {
    const shop = master.get(Number(r.shopId));
    const boxes = (r.selectedBoxIds?.length ?? 0) || toNum(r.boxNo);
    const birds = toNum(r.birds);
    const weight = toNum(r.weight);
    const mort = toNum(r.mortality);
    const mortKg = toNum(r.mortKg);
    totalBoxes += boxes;
    totalBirds += birds;
    totalWeight += weight;
    totalMortality += mort;
    totalMortKg += mortKg;
    return [
      String(r.serialNo || index + 1),
      r.shopName || shop?.shopName || shop?.name || `Shop ${r.shopId}`,
      shop?.city || shop?.village || "—",
      shop?.mobile || shop?.phoneNumber || "—",
      count(boxes),
      count(birds),
      weight.toFixed(2),
    ];
  });

  if (body.length === 0) {
    body.push(["—", "No shop deliveries recorded", "—", "—", "0", "0", "0.00"]);
  }

  const COL_SEQ = 12;
  const COL_CITY = 34;
  const COL_MOBILE = 30;
  const COL_BOXES = 16;
  const COL_BIRDS = 24;
  const COL_WEIGHT = 26;
  const COL_SHOP = contentWidth - COL_SEQ - COL_CITY - COL_MOBILE - COL_BOXES - COL_BIRDS - COL_WEIGHT;

  autoTable(doc, {
    head: [["S.No", "Shop Name", "City", "Mobile", "Boxes", "Birds", "Weight (KG)"]],
    body,
    startY: shell.y(),
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: EMERALD, textColor: 255, fontStyle: "bold", fontSize: 8.5,
      halign: "center", valign: "middle",
      cellPadding: { top: 2.6, bottom: 2.6 }, lineColor: EMERALD, lineWidth: 0.1,
    },
    styles: {
      font: "helvetica", fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 1.6, right: 1.6 },
      valign: "middle", overflow: "linebreak", textColor: TEXT_DARK,
      lineColor: GRID_LINE, lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: COL_SEQ, halign: "center" },
      1: { cellWidth: COL_SHOP, halign: "left", fontStyle: "bold" },
      2: { cellWidth: COL_CITY },
      3: { cellWidth: COL_MOBILE, halign: "center" },
      4: { cellWidth: COL_BOXES, halign: "right" },
      5: { cellWidth: COL_BIRDS, halign: "right" },
      6: { cellWidth: COL_WEIGHT, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });
  shell.setY(shell.lastTableY(shell.y()) + 6);

  shell.drawSectionBand("CUMULATIVE SUMMARY");
  shell.kvGrid([
    ["Total Shops", count(list.length)],
    ["Total Boxes", count(totalBoxes)],
    ["Total Birds Delivered", count(totalBirds)],
    ["Total Weight Delivered", `${totalWeight.toFixed(2)} KG`],
    ["Mortality Birds", count(totalMortality)],
    ["Mortality Weight", `${totalMortKg.toFixed(2)} KG`],
  ]);

  shell.finishPages("DMR POULTRIES — SHOP DELIVERY REPORT", context.tripNo, generatedStr);
  saveReport(doc, context.tripNo, "ShopDeliveryReport");
}

export async function generateBoxesDeliveryReportPDF({
  boxDetails = [],
  deliveries = [],
  context,
}: {
  boxDetails?: BoxDetail[];
  deliveries?: ShopDelivery[];
  context: DeliveryReportContext;
}): Promise<void> {
  const doc = createDmrPoultryPdf("portrait");
  doc.setProperties({
    title: `${context.tripNo || "Trip"} — Box Delivery Report`,
    subject: "DMR POULTRIES box delivery report",
    author: "DMR POULTRIES",
    creator: "DMR POULTRIES",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const generatedStr = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const shell = buildReportShell(doc, margin, contentWidth, pageHeight);
  const startY = await reportPreamble(doc, "BOX DELIVERY REPORT", context.tripNo);
  shell.setY(startY);

  shell.drawSectionBand("TRIP DETAILS");
  shell.kvGrid([
    ["Trip No", fmt(context.tripNo)],
    ["Trip Date", fmt(context.tripDate)],
    ["Vehicle", fmt(context.vehicleNo)],
    ["Driver", fmt(context.driverName)],
    ["Supervisor", fmt(context.supervisorName)],
    ["Boxes Loaded", count(boxDetails.length)],
  ]);

  // Delivered birds/weight per box, reduced by mortality: allocate each
  // delivery row evenly across the boxes it selected (same split the shop
  // receipt PDF uses), then sum per box.
  const delBirdsByBox = new Map<number, number>();
  const delWeightByBox = new Map<number, number>();
  deliveries.forEach((d) => {
    const ids = (d.selectedBoxIds || []).map((id) => toNum(id)).filter((n) => n > 0);
    if (ids.length === 0) return;
    const birdsEach = Math.floor(toNum(d.birds) / ids.length);
    const weightEach = toNum(d.weight) / ids.length;
    ids.forEach((id) => {
      delBirdsByBox.set(id, (delBirdsByBox.get(id) || 0) + birdsEach);
      delWeightByBox.set(id, (delWeightByBox.get(id) || 0) + weightEach);
    });
  });

  const totalMortality = deliveries.reduce((s, d) => s + toNum(d.mortality), 0);
  const totalMortKg = deliveries.reduce((s, d) => s + toNum(d.mortKg), 0);

  shell.drawSectionBand("BOX-WISE DELIVERIES", `${boxDetails.length} Box(es)`);

  let totalFarmBirds = 0;
  let totalDeliveredBirds = 0;
  let totalWeight = 0;
  const body: (string | number)[][] = boxDetails.map((b, index) => {
    const farmBirds = toNum(b.birds);
    const weight = toNum(b.weight);
    const delivered = delBirdsByBox.get(toNum(b.boxNo)) ?? 0;
    totalFarmBirds += farmBirds;
    totalDeliveredBirds += delivered;
    totalWeight += weight;
    return [
      String(index + 1),
      `#${b.boxNo}`,
      count(farmBirds),
      count(delivered),
      weight.toFixed(2),
    ];
  });

  if (body.length === 0) {
    body.push(["—", "No box entries recorded", "0", "0", "0.00"]);
  }

  autoTable(doc, {
    head: [["S.No", "Box", "Farm Birds", "Delivered Birds", "Weight (KG)"]],
    body,
    startY: shell.y(),
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    headStyles: {
      fillColor: EMERALD, textColor: 255, fontStyle: "bold", fontSize: 8.5,
      halign: "center", valign: "middle",
      cellPadding: { top: 2.6, bottom: 2.6 }, lineColor: EMERALD, lineWidth: 0.1,
    },
    styles: {
      font: "helvetica", fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2 },
      valign: "middle", textColor: TEXT_DARK,
      lineColor: GRID_LINE, lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" },
      1: { cellWidth: 30, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 42, halign: "right" },
      3: { cellWidth: 46, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 48, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });
  shell.setY(shell.lastTableY(shell.y()) + 6);

  shell.drawSectionBand("CUMULATIVE SUMMARY");
  shell.kvGrid([
    ["Total Boxes Loaded", count(boxDetails.length)],
    ["Total Farm Birds", count(totalFarmBirds)],
    ["Total Delivered Birds", count(totalDeliveredBirds)],
    ["Total DC Weight", `${totalWeight.toFixed(2)} KG`],
    ["Mortality Birds", count(totalMortality)],
    ["Mortality Weight", `${totalMortKg.toFixed(2)} KG`],
  ]);

  shell.finishPages("DMR POULTRIES — BOX DELIVERY REPORT", context.tripNo, generatedStr);
  saveReport(doc, context.tripNo, "BoxDeliveryReport");
}
