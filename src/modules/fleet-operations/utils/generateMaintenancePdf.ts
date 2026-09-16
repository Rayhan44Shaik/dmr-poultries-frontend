// src/modules/fleet-operations/utils/generateMaintenancePdf.ts
//
// DMR POULTRIES — Maintenance Record PDF (A4 portrait).
// Neat table-form document: branded header, full record details, the parts
// bill, the total, and the vehicle's COMPLETE maintenance history till now.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import henImage from "../../../assets/dmr-hen.jpg";
import {
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
  type DmrPoultryHeaderAssets,
} from "../../../utils/drawDmrPoultryHeader";
import { formatTripListDay } from "../../operations/vehicle-trips/utils/formatTripListDay";
import type { MaintenanceEvent } from "../types";

type RGB = [number, number, number];
const NAVY: RGB = [15, 35, 79];
const EMERALD: RGB = [5, 150, 105];
const MUTED: RGB = [90, 100, 115];
const GRID_LINE: RGB = [203, 213, 225];
const TEXT_DARK: RGB = [30, 41, 59];

const money = (value: number) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusLabel = (row: MaintenanceEvent) => {
  if (row.deletedAt) return "Deleted";
  if (row.paymentStatus === "approved") return "Approved";
  return "Pending";
};

export async function generateMaintenancePdf(
  record: MaintenanceEvent,
  vehicleHistory: MaintenanceEvent[],
  vehicleNumber: string,
  language: "en" | "te" = "en"
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 12;
  const assets: DmrPoultryHeaderAssets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });

  const lastTableY = (fallback: number): number => {
    const table = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    return table?.finalY ?? fallback;
  };

  let y = drawPreparedDmrPoultryHeader(
    doc,
    {
      margin,
      top: 9,
      businessName: "DMR POULTRIES",
    },
    assets
  );

  // ── Title band ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(`Maintenance Record — ${vehicleNumber}`, margin, y + 8);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${record.billNumber || "-"} · ${statusLabel(record)}`,
    doc.internal.pageSize.getWidth() - margin,
    y + 8,
    { align: "right" }
  );
  y += 12;

  // ── Record details (label/value grid) ──
  const typeList = (record.maintenanceType || "").split(",").map((s) => s.trim()).filter(Boolean);
  const nextByType = record.nextServiceByType || {};
  const details: [string, string][] = [
    ["Bill Number", record.billNumber || "-"],
    ["Date", formatTripListDay(record.date || record.createdAt, language)],
    ["Vehicle", vehicleNumber],
    ["Current KM", `${Number(record.currentKM || 0).toLocaleString("en-IN")} km`],
    ["Driver", record.driverName || "-"],
    ["Service Type", record.serviceType || "-"],
    ["Garage", record.garage || "-"],
    ["Mechanic", record.mechanic || "-"],
    ["Maintenance Types", typeList.length ? typeList.join(", ") : "-"],
    ["Next Service KM",
      typeList.length
        ? typeList.map((tp) => `${tp}: ${nextByType[tp] != null ? Number(nextByType[tp]).toLocaleString("en-IN") : "-"} km`).join("  |  ")
        : record.nextServiceKM
          ? `${Number(record.nextServiceKM).toLocaleString("en-IN")} km`
          : "-"],
    ["Status", statusLabel(record)],
    ["Remarks", record.remarks || "-"],
  ];
  autoTable(doc, {
    body: details,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: TEXT_DARK, lineColor: GRID_LINE, lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = lastTableY(y) + 5;

  // ── Parts bill ──
  const parts = Array.isArray(record.parts) ? record.parts : [];
  if (parts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("Parts / Spare Parts", margin, y + 4);
    y += 6;
    autoTable(doc, {
      head: [["Item", "Specification", "Qty", "Rate", "Amount"]],
      body: parts.map((p) => [
        p.name || "-",
        p.specification || "-",
        String(p.quantity ?? 0),
        money(Number(p.rate || 0)).replace("INR ", "Rs. "),
        money(Number(p.amount || 0)).replace("INR ", "Rs. "),
      ]),
      startY: y,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: TEXT_DARK, lineColor: GRID_LINE, lineWidth: 0.15 },
      columnStyles: {
        2: { halign: "center", cellWidth: 14 },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
    });
    y = lastTableY(y) + 5;
  }

  // ── Total band ──
  doc.setFillColor(...EMERALD);
  doc.roundedRect(margin, y, doc.internal.pageSize.getWidth() - margin * 2, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL COST", margin + 4, y + 6.6);
  doc.text(money(Number(record.totalCost || 0)), doc.internal.pageSize.getWidth() - margin - 4, y + 6.6, { align: "right" });
  y += 14;

  // ── All maintenance records of this vehicle ──
  if (vehicleHistory.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = drawPreparedDmrPoultryHeader(doc, { margin, top: 9, businessName: "DMR POULTRIES" }, assets);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(`All Maintenance Records — ${vehicleNumber} (${vehicleHistory.length})`, margin, y + 4);
    y += 6;
    autoTable(doc, {
      head: [["Date", "Bill No", "Types", "Garage", "Mechanic", "KM", "Cost", "Status"]],
      body: vehicleHistory.map((row) => [
        formatTripListDay(row.date || row.createdAt, language),
        row.billNumber || "-",
        (row.maintenanceType || "-").split(",")[0].trim() +
          ((row.maintenanceType || "").split(",").filter((s) => s.trim()).length > 1
            ? ` +${(row.maintenanceType || "").split(",").filter((s) => s.trim()).length - 1}`
            : ""),
        row.garage || "-",
        row.mechanic || "-",
        Number(row.currentKM || 0).toLocaleString("en-IN"),
        money(Number(row.totalCost || 0)).replace("INR ", "Rs. "),
        statusLabel(row),
      ]),
      startY: y,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7.6, cellPadding: 1.8, textColor: TEXT_DARK, lineColor: GRID_LINE, lineWidth: 0.15 },
      columnStyles: {
        5: { halign: "right", cellWidth: 18 },
        6: { halign: "right", cellWidth: 24 },
        7: { halign: "center", cellWidth: 18 },
      },
      margin: { left: margin, right: margin },
    });
  }

  doc.save(`maintenance-${vehicleNumber}-${record.billNumber || record.id || "record"}.pdf`);
}

export default generateMaintenancePdf;
