// src/modules/operations/orders/pdf/generateOrdersPdf.ts
// DMR POULTRIES — Order Collection PDF.
//
// Reuses the EXISTING branded letterhead (drawPreparedDmrPoultryHeader — the
// same header used by the Shop Delivery receipt and the Trip Report PDF) and
// the same autoTable conventions (grid theme, EMERALD header, showHead
// "everyPage", page footer with "Page x of y"), so the document looks native
// to the existing ERP. Long shop lists paginate automatically; rows are never
// split across pages.

import autoTable from "jspdf-autotable";
import type { Trip } from "../../../../shared/trip";
import henImage from "../../../../assets/dmr-hen.jpg";
import {
  createDmrPoultryPdf,
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
  type DmrPoultryHeaderAssets,
} from "../../../../utils/drawDmrPoultryHeader";
import type { OrdersProgress } from "../types";
import {
  formatDeliveredAtLabel,
  rowsInSequence,
  type ShopDeliveryBreakdown,
} from "../ordersUtils";
import { parseOrderRef } from "../types";
import { ordersTranslate } from "../i18n/ordersI18n";

type RGB = [number, number, number];

const NAVY: RGB = [15, 35, 79];
const EMERALD: RGB = [5, 150, 105];
const MUTED: RGB = [90, 100, 115];
const GRID_LINE: RGB = [203, 213, 225];
const TEXT_DARK: RGB = [30, 41, 59];
const NOT_LISTED_AMBER: RGB = [146, 64, 14];
const NOT_LISTED_ROW: RGB = [255, 251, 235];
const ALT_ROW: RGB = [248, 249, 251];

export type OrdersPdfInput = {
  trip: Trip;
  supervisorMobile: string;
  progress: OrdersProgress | null;
  breakdown: ShopDeliveryBreakdown[];
  language?: "en" | "te";
  /**
   * "download" (default) also saves the file to disk. "preview" only builds
   * it, so the caller can show it in the check-before-send popup.
   */
  mode?: "download" | "preview";
};

/** The built document — the popup previews `url`, the button saves `blob`. */
export type OrdersPdfResult = {
  fileName: string;
  blob: Blob;
  /** Object URL for the preview frame. The caller revokes it. */
  url: string;
  /** "Page x of y" — handy to confirm the whole report is in the document. */
  pages: number;
};

const toNum = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (value: unknown): string =>
  value == null || value === "" ? "—" : String(value);
const kg = (value: unknown): string => `${toNum(value).toFixed(2)} kg`;
const count = (value: unknown): string => toNum(value).toLocaleString("en-IN");

export async function generateOrdersPdf({
  trip,
  supervisorMobile,
  progress,
  breakdown,
  language = "en",
  mode = "download",
}: OrdersPdfInput): Promise<OrdersPdfResult> {
  const doc = createDmrPoultryPdf("portrait");
  doc.setProperties({
    title: `${trip.tripNo || "Trip"} — Shop Delivery Report`,
    subject: "DMR POULTRIES shop delivery report",
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

  // ─── Which ORDER(S) this vehicle is delivering ─────────────────────────
  // Every assigned row carries "[ORDER] O:<orderTripNo>" and a finished
  // assignment tags the trip remarks with "order:<orderTripNo>" — both are
  // read so the report always names the order, never just the vehicle trip.
  const orderRefs = Array.from(
    new Set(
      [
        ...rowsInSequence(trip)
          .map((r) => parseOrderRef(r.remarks))
          .filter((v): v is string => Boolean(v)),
        ...String(trip.remarks ?? "")
          .split("|")
          .map((tag) => tag.trim())
          .filter((tag) => tag.startsWith("order:"))
          .map((tag) => tag.slice("order:".length).trim())
          .filter(Boolean),
      ].filter(Boolean)
    )
  );
  const orderDateOf = (ref: string): string => {
    const m = /^ORD-(\d{4})(\d{2})(\d{2})-\d+$/.exec(ref);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  };
  const orderNoLabel = orderRefs.length > 0 ? orderRefs.join(", ") : "—";
  const orderDateLabel =
    orderRefs.map(orderDateOf).filter(Boolean).join(", ") || "—";

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

  const simpleTable = (
    head: string[],
    body: (string | number)[][],
    opts: {
      widths?: Array<number | null>;
      /** Marks rows that must be highlighted as "added during delivery". */
      additionalRows?: Set<number>;
    } = {}
  ) => {
    const widths = opts.widths ?? [];
    const columnStyles: Record<
      string,
      {
        cellWidth?: number;
        halign?: "left" | "center" | "right";
        fontStyle?: "normal" | "bold" | "italic";
      }
    > = {};
    let used = 0;
    widths.forEach((w, i) => {
      if (w != null) {
        columnStyles[String(i)] = { cellWidth: w };
        used += w;
      }
    });
    if (used < contentWidth) {
      const freeCols = head.map((_, i) => (widths[i] == null ? i : -1)).filter((i) => i >= 0);
      if (freeCols.length > 0) {
        const share = (contentWidth - used) / freeCols.length;
        freeCols.forEach((i) => {
          columnStyles[String(i)] = { ...(columnStyles[String(i)] ?? {}), cellWidth: share };
        });
      }
    }
    autoTable(doc, {
      head: [head],
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
        cellPadding: { top: 2, bottom: 2 },
        valign: "middle",
        textColor: TEXT_DARK,
        lineColor: GRID_LINE,
        lineWidth: 0.15,
      },
      columnStyles,
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.row.index % 2 === 1) {
            data.cell.styles.fillColor = ALT_ROW;
          }
          const isAdditional = opts.additionalRows?.has(data.row.index) === true;
          if (isAdditional) {
            data.cell.styles.fillColor = NOT_LISTED_ROW as unknown as number;
            data.cell.styles.textColor = NOT_LISTED_AMBER;
            const lastCol = head.length - 1;
            if (data.column.index === 1 || data.column.index === lastCol) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });
    y = lastTableY(y) + 5;
  };

  // ─── PAGE 1: branded letterhead (same as Shop Delivery / Trip Report) ──
  y = drawPreparedDmrPoultryHeader(doc, { margin, top: 8 }, assets) + 3;

  ensureSpace(16);
  doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
  doc.roundedRect(margin, y, contentWidth, 11, 1.6, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(ordersTranslate("orders.pdf_report_title", language), margin + 4, y + 7.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(trip.tripNo || "—", pageWidth - margin - 4, y + 7.2, { align: "right" });
  y += 14;

  // ─── TRIP DETAILS ────────────────────────────────────────────────────
  drawSectionBand("TRIP DETAILS");
  kvGrid([
    ["Trip No", fmt(trip.tripNo)],
    ["Trip Date", fmt(trip.tripDate)],
    ["Vehicle No", fmt(trip.vehicleNo)],
    ["Bird Type", fmt(trip.birdType)],
    ["Supervisor", fmt(trip.supervisorName)],
    ["Supervisor Mobile", fmt(supervisorMobile)],
    ["Driver", fmt(trip.driverName)],
    ["Farm", fmt(trip.sourceFarm)],
    ["Farm Address", fmt(trip.farmAddress)],
    ["Avg Bird Weight", trip.avgBirdWeight ? kg(trip.avgBirdWeight) : "—"],
    ["Completed At", formatDeliveredAtLabel(trip.submittedAtTimestamp)],
  ]);

  // ─── ORDER SUMMARY ───────────────────────────────────────────────────
  drawSectionBand("ORDER DETAILS");
  kvGrid([
    ["Order No", orderNoLabel],
    ["Order Date", orderDateLabel],
    ["Order Shops", count(breakdown.filter((b) => b.ordered).length)],
    ["Order Boxes", count(breakdown.reduce((s, b) => s + b.orderedBoxes, 0))],
    ["Order Birds", count(breakdown.reduce((s, b) => s + b.orderedBirds, 0))],
    ["Order Weight", kg(breakdown.reduce((s, b) => s + b.orderedWeight, 0))],
    ["Total Shops", count(progress?.totalShops ?? 0)],
    ["Total Boxes", count(progress?.totalBoxes ?? 0)],
    ["Total Weight", kg(progress?.totalWeight ?? 0)],
    ["Total Birds", count(progress?.totalBirds ?? 0)],
    ["Delivered", `${progress?.deliveredShops ?? 0} / ${progress?.totalShops ?? 0}`],
    ["Pending", count(progress?.pendingShops ?? 0)],
    ["Additional Shops", count(progress?.additionalShopCount ?? 0)],
    ["Status", fmt(progress?.status ?? "")],
  ]);

  // ─── SHOP DELIVERY REPORT (ordered vs delivered, with differences) ────
  // The report covers the ORIGINAL order list: Delivered · Delivered with
  // Difference · NOT DELIVERED (visible shortfall). Shops Step 4 delivered
  // that were never in the original order are listed separately below as
  // NOT LISTED SHOP DELIVERIES — never hidden.
  const diffStr = (value: number): string =>
    value === 0 ? "0" : value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  const statusStr = (b: ShopDeliveryBreakdown): string =>
    b.status === "delivered_with_diff"
      ? ordersTranslate("orders.status_delivered_diff", language)
      : b.status === "part_delivered"
        ? ordersTranslate("orders.status_part_delivered", language)
        : b.status === "not_delivered"
          ? ordersTranslate("orders.status_not_delivered", language)
          : ordersTranslate("orders.status_delivered", language);
  const listedRows = breakdown.filter((b) => b.ordered);
  const seqBody: (string | number)[][] = listedRows.map((b, index) => [
    b.serialNo || index + 1,
    b.shopName,
    b.village || "—",
    b.mobile || "—",
    b.orderedBirds > 0 ? count(b.orderedBirds) : "—",
    b.deliveredBirds > 0 ? count(b.deliveredBirds) : "—",
    diffStr(b.birdDifference),
    b.orderedBoxes > 0 ? count(b.orderedBoxes) : "—",
    b.deliveredBoxes > 0 ? count(b.deliveredBoxes) : "—",
    diffStr(b.boxDifference),
    statusStr(b),
    formatDeliveredAtLabel(b.deliveredAt, true),
  ]);
  if (seqBody.length === 0) {
    seqBody.push([
      "—",
      ordersTranslate("orders.no_saved_collection", language),
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—",
    ]);
  }

  drawSectionBand(
    ordersTranslate("orders.pdf_report_title", language),
    `${ordersTranslate("orders.pdf_order_no", language)}: ${orderNoLabel}`
  );
  ensureSpace(30);
  simpleTable(
    [
      "Seq",
      ordersTranslate("orders.col_shop_name", language),
      ordersTranslate("orders.col_village", language),
      ordersTranslate("orders.shop_mobile", language),
      ordersTranslate("orders.ordered_birds", language),
      ordersTranslate("orders.delivered_birds", language),
      `${ordersTranslate("orders.col_difference", language)} (${ordersTranslate("orders.word_birds", language)})`,
      ordersTranslate("orders.ordered_boxes", language),
      ordersTranslate("orders.delivered_boxes", language),
      `${ordersTranslate("orders.col_difference", language)} (${ordersTranslate("orders.word_boxes", language)})`,
      ordersTranslate("orders.col_delivery_status", language),
      ordersTranslate("orders.col_delivered_at", language),
    ],
    seqBody,
    {
      // Room for real shop names (a 45-shop vehicle must not turn into a
      // wall of two-line rows) and a one-line delivery time.
      widths: [8, 34, 16, 18, 10, 10, 10, 10, 10, 10, 20, null],
    }
  );

  // ─── NOT LISTED SHOP DELIVERIES (Step 4 shops absent from the order) ──
  const notListedRows = breakdown.filter((b) => b.status === "not_listed");
  if (notListedRows.length > 0) {
    ensureSpace(26);
    drawSectionBand(
      ordersTranslate("orders.not_listed_deliveries", language),
      `${notListedRows.length} shop(s)`
    );
    const notListedBody: (string | number)[][] = notListedRows.map((b, index) => [
      index + 1,
      b.shopName,
      b.village || "—",
      b.mobile || "—",
      count(b.deliveredBirds),
      count(b.deliveredBoxes),
      kg(b.deliveredWeight),
      formatDeliveredAtLabel(b.deliveredAt),
    ]);
    simpleTable(
      [
        "Seq",
        ordersTranslate("orders.col_shop_name", language),
        ordersTranslate("orders.col_village", language),
        ordersTranslate("orders.shop_mobile", language),
        ordersTranslate("orders.delivered_birds", language),
        ordersTranslate("orders.delivered_boxes", language),
        ordersTranslate("orders.delivered_weight", language),
        ordersTranslate("orders.col_delivered_at", language),
      ],
      notListedBody,
      {
        widths: [8, 42, 24, 26, 16, 16, 16, null],
        additionalRows: new Set(notListedRows.map((_, i) => i)),
      }
    );
  }

  // ─── FINAL TOTALS (shop-level, ordered vs delivered) ─────────────────────
  // Aggregated over the shop delivery breakdown: Total Shops, Listed,
  // Not Listed, ordered/delivered birds & boxes, box difference, and
  // total/delivered weight. Shown even when there is no delivery yet
  // (delivered figures read 0).
  {
    const orderedRows = breakdown.filter((b) => b.ordered);
    const notListedCount = breakdown.filter((b) => b.status === "not_listed").length;
    const sum = (rows: ShopDeliveryBreakdown[], key: (b: ShopDeliveryBreakdown) => number): number =>
      rows.reduce((s, b) => s + key(b), 0);
    const orderedBirds = sum(orderedRows, (b) => b.orderedBirds);
    const deliveredBirds = sum(breakdown, (b) => b.deliveredBirds);
    const orderedBoxes = sum(orderedRows, (b) => b.orderedBoxes);
    const deliveredBoxes = sum(breakdown, (b) => b.deliveredBoxes);
    const totalWeight = sum(orderedRows, (b) => b.orderedWeight);
    const deliveredWeight = sum(breakdown, (b) => b.deliveredWeight);

    ensureSpace(30);
    drawSectionBand(ordersTranslate("orders.pdf_totals", language));
    kvGrid([
      [ordersTranslate("orders.col_total_shops", language), count(orderedRows.length)],
      [ordersTranslate("orders.listed_shops", language), count(orderedRows.length)],
      [ordersTranslate("orders.not_listed_shops", language), count(notListedCount)],
      [ordersTranslate("orders.ordered_birds", language), count(orderedBirds)],
      [ordersTranslate("orders.delivered_birds", language), count(deliveredBirds)],
      [ordersTranslate("orders.ordered_boxes", language), count(orderedBoxes)],
      [ordersTranslate("orders.delivered_boxes", language), count(deliveredBoxes)],
      [ordersTranslate("orders.box_difference", language), diffStr(deliveredBoxes - orderedBoxes)],
      [ordersTranslate("orders.total_weight", language), kg(totalWeight)],
      [ordersTranslate("orders.delivered_weight", language), kg(deliveredWeight)],
    ]);
  }

  // ─── FOOTER / PAGE CHROME (same pattern as the Trip Report PDF) ─────
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
      doc.text(`DMR POULTRIES — ${ordersTranslate("orders.pdf_report_title", language)}`, margin, 5);
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
  const fileName = `${safeTripNo}_ShopDeliveryReport.pdf`;
  if (mode === "download") doc.save(fileName);
  const blob = doc.output("blob") as Blob;
  return { fileName, blob, url: URL.createObjectURL(blob), pages: pageCount };
}
