// src/modules/operations/fuel-expenses/utils/generateFuelPdf.ts
//
// DMR POULTRIES — Fuel Expense Record & Vehicle History PDF (A4 portrait).
// Rendered from a styled DOM sheet and captured with html2canvas, ensuring
// pristine Telugu typography, DMR official branding header, structured
// key metrics, GPS coordinates with Google Maps Location URL, receipt slip,
// and the vehicle's complete fuel history table.

import jsPDF from "jspdf";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import type { FuelExpense } from "../types/fuelExpense";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const inr = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BRAND_GREEN = "#0d7a3f";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

function buildSheet(
  record: FuelExpense,
  vehicleHistory: FuelExpense[],
  vehicleNumber: string,
  language: "en" | "te",
  t: Translate
): HTMLElement {
  const sheet = document.createElement("div");
  sheet.style.cssText = `position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:${INK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Telugu',sans-serif;font-size:13px;line-height:1.45;`;

  const isTrip = record.sourceType === "TRIP" || !!record.tripNo || !!record.tripId;
  const isDeleted = record.deleted === true || record.status === "Deleted";
  const isApproved = !isDeleted && (isTrip || record.status === "Approved");

  const statusLabel = isDeleted
    ? t("common.deleted") || "Deleted"
    : isApproved
    ? isTrip
      ? t("ops.fuel.approved_trip_completion") || "Approved (Trip Completion)"
      : t("common.approved") || "Approved"
    : t("common.pending") || "Pending";

  const statusColor = isDeleted ? "#b91c1c" : isApproved ? "#047857" : "#b45309";
  const statusBg = isDeleted ? "#fef2f2" : isApproved ? "#ecfdf5" : "#fffbeb";
  const statusBorder = isDeleted ? "#fecaca" : isApproved ? "#a7f3d0" : "#fde68a";

  const hasGps =
    record.gpsLat != null &&
    record.gpsLon != null &&
    Number.isFinite(Number(record.gpsLat)) &&
    Number.isFinite(Number(record.gpsLon)) &&
    !(Number(record.gpsLat) === 0 && Number(record.gpsLon) === 0);

  const mapsUrl = hasGps
    ? `https://www.google.com/maps?q=${Number(record.gpsLat).toFixed(6)},${Number(record.gpsLon).toFixed(6)}`
    : "";

  const day = (d: string | undefined) => formatTripListDay(d, language);

  // ── Two Equal Column Attribute Pairs ──
  const detailPairs: [string, string][] = [
    [t("ops.fuel.bill_no") || "Bill Number", record.billNo || "—"],
    [t("common.date") || "Date", day(record.date || record.createdDate)],
    [t("common.vehicle") || "Vehicle", vehicleNumber],
    [t("common.driver") || "Driver", localizeTripViewText(record.driverName || "—", language)],
    [t("ops.fuel.source") || "Source", isTrip ? (t("ops.fuel.trip_diesel") || "Trip Diesel") : (t("ops.fuel.manual_bill") || "Manual Bill")],
    [t("ops.fuel.source_linked_trip") || "Linked Trip", record.tripNo || "—"],
    [t("ops.fuel.odometer_meter") || "Odometer Reading", record.meterReading > 0 ? `${Number(record.meterReading).toLocaleString("en-IN")} KM` : "—"],
    [t("ops.fuel.litres") || "Diesel Quantity", `${Number(record.litres).toFixed(2)} Litres`],
    [t("ops.fuel.rate_per_l") || "Rate / Litre", `Rs. ${Number(record.rate).toFixed(2)} / L`],
    [t("ops.fuel.total_cost") || "Total Amount", inr(record.amount)],
    [t("ops.fuel.petrol_bunk") || "Petrol Bunk", localizeTripViewText(record.petrolBunk || "—", language)],
    [t("common.status") || "Status", statusLabel],
  ];

  const half = Math.ceil(detailPairs.length / 2);
  const renderColumn = (pairs: [string, string][]) =>
    pairs
      .map(
        ([label, value], index) => `
        <div style="display:flex;justify-content:space-between;gap:12px;padding:7px 12px;${index > 0 ? `border-top:1px solid ${LINE};` : ""}">
          <span style="width:105px;flex-shrink:0;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};padding-top:2px;">${esc(label)}</span>
          <span style="min-width:0;flex:1;text-align:right;font-size:12px;font-weight:700;color:${INK};word-break:break-word;">${esc(value)}</span>
        </div>`
      )
      .join("");

  const historyRows = (vehicleHistory || [])
    .map((row, i) => {
      const isCur = String(row.id) === String(record.id);
      const isRowTrip = row.sourceType === "TRIP" || !!row.tripNo;
      const isRowDeleted = row.deleted === true || row.status === "Deleted";
      const isRowApproved = !isRowDeleted && (isRowTrip || row.status === "Approved");
      const st = isRowDeleted
        ? (t("common.deleted") || "Deleted")
        : isRowApproved
        ? isRowTrip ? (t("ops.fuel.approved_trip_completion") || "Approved") : (t("common.approved") || "Approved")
        : (t("common.pending") || "Pending");
      const tone = isRowDeleted ? "#b91c1c" : isRowApproved ? "#047857" : "#b45309";

      return `
      <tr style="background:${isCur ? "#ecfdf5" : i % 2 ? "#fbfdfc" : "#ffffff"};font-weight:${isCur ? "700" : "500"};">
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};white-space:nowrap;">${esc(day(row.date || row.createdDate))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};font-family:monospace;font-weight:700;color:${isCur ? BRAND_GREEN : INK};">${esc(row.billNo || "—")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};">${esc(isRowTrip ? (row.tripNo || "Trip") : "Manual")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${MUTED};">${esc(row.petrolBunk || "—")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-weight:700;color:#2563eb;">${Number(row.litres || 0).toFixed(2)} L</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;">Rs. ${Number(row.rate || 0).toFixed(2)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-weight:800;color:#047857;">${inr(Number(row.amount || 0))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:center;color:${tone};font-weight:700;">${esc(st)}</td>
      </tr>`;
    })
    .join("");

  const th = (label: string, align = "left") =>
    `<th style="padding:7px 10px;text-align:${align};background:#f1f5f9;color:#334155;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border-bottom:2px solid ${LINE};">${esc(label)}</th>`;

  sheet.innerHTML = `
    <!-- Global DMR Poultries Brand Header -->
    <div style="background:${BRAND_GREEN};padding:18px 24px;color:#ffffff;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-size:22px;font-weight:800;letter-spacing:.03em;">DMR POULTRIES</div>
        <div style="font-size:11px;font-weight:700;color:#d1fae5;letter-spacing:.05em;text-transform:uppercase;">ORIGINAL VOUCHER</div>
      </div>
      <div style="margin-top:2px;font-size:12px;color:#d1fae5;font-weight:600;">Fuel Expense &amp; Diesel Fill Report</div>
    </div>

    <!-- Record Identity Strip -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 24px 10px;">
      <div>
        <div style="font-size:16px;font-weight:800;color:${BRAND_GREEN};">${esc(vehicleNumber)}</div>
        <div style="font-size:11px;color:${MUTED};font-weight:600;margin-top:1px;">${esc(record.billNo)} · ${esc(day(record.date || record.createdDate))}</div>
      </div>
      <div style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;color:${statusColor};background:${statusBg};border:1px solid ${statusBorder};">
        ${esc(statusLabel)}
      </div>
    </div>

    <!-- Attribute Pairs Grid (2 Equal Columns) -->
    <div style="margin:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div style="border:1px solid ${LINE};border-radius:8px;overflow:hidden;background:#ffffff;">${renderColumn(detailPairs.slice(0, half))}</div>
      <div style="border:1px solid ${LINE};border-radius:8px;overflow:hidden;background:#ffffff;">${renderColumn(detailPairs.slice(half))}</div>
    </div>

    <!-- GPS Location & Google Maps Link Card -->
    ${
      hasGps
        ? `<div style="margin:14px 24px 0;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:8px;padding:10px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#166534;">GPS LOCATION &amp; MAP LINK</span>
          <span style="font-size:11px;font-weight:700;color:#047857;font-family:monospace;">${Number(record.gpsLat).toFixed(6)}°N, ${Number(record.gpsLon).toFixed(6)}°E</span>
        </div>
        <div style="margin-top:4px;font-size:11px;font-weight:600;color:#14532d;word-break:break-word;">
          Google Maps URL: <a href="${esc(mapsUrl)}" style="color:#0284c7;text-decoration:underline;">${esc(mapsUrl)}</a>
        </div>
      </div>`
        : ""
    }

    <!-- Total Cost Highlight Band -->
    <div style="margin:14px 24px 0;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#ecfdf5,#ffffff 55%,#ecfdf5);border:1px solid #a7f3d0;border-radius:8px;padding:10px 16px;">
      <span style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#047857;">TOTAL FUEL COST</span>
      <span style="font-size:18px;font-weight:800;color:#047857;">${inr(Number(record.amount || 0))}</span>
    </div>

    <!-- Vehicle Complete Fuel History Table -->
    ${
      vehicleHistory && vehicleHistory.length > 0
        ? `<div style="margin:16px 24px 0;font-size:12px;font-weight:800;color:${INK};">
            Vehicle Fuel Entries — ${esc(vehicleNumber)} (${vehicleHistory.length})
          </div>
          <table style="margin:6px 24px 0;width:calc(100% - 48px);border-collapse:collapse;border:1px solid ${LINE};font-size:11.5px;">
            <thead><tr>
              ${th(t("common.date") || "Date")}
              ${th(t("ops.fuel.bill_no") || "Bill No")}
              ${th(t("ops.fuel.source") || "Source")}
              ${th(t("ops.fuel.petrol_bunk") || "Bunk")}
              ${th(t("ops.fuel.litres") || "Litres", "right")}
              ${th(t("ops.fuel.rate_per_l") || "Rate", "right")}
              ${th(t("ops.fuel.total_cost") || "Amount", "right")}
              ${th(t("common.status") || "Status", "center")}
            </tr></thead>
            <tbody>${historyRows}</tbody>
          </table>`
        : ""
    }

    <!-- Remarks / Notes -->
    ${
      record.remarks
        ? `<div style="margin:14px 24px 0;border:1px solid ${LINE};background:#f8fafc;border-radius:8px;padding:8px 12px;font-size:11.5px;">
            <strong style="color:${MUTED};font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:2px;">REMARKS / NOTES</strong>
            <span style="color:${INK};">${esc(record.remarks)}</span>
          </div>`
        : ""
    }

    <!-- Footer -->
    <div style="margin:18px 24px 0;padding:10px 0 16px;border-top:1px solid ${LINE};font-size:9.5px;color:#94a3b8;text-align:center;">
      Computer generated fuel expense report · DMR Poultries Fleet Operations Management
    </div>`;

  document.body.appendChild(sheet);
  return sheet;
}

export async function generateFuelPdf(
  record: FuelExpense,
  vehicleHistory: FuelExpense[],
  vehicleNumber: string,
  language: "en" | "te" = "en",
  t: Translate
): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const sheet = buildSheet(record, vehicleHistory, vehicleNumber, language, t);

  try {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const canvas = await html2canvas(sheet, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pxPerMm = canvas.width / pageW;
    const pageHpx = Math.floor(pageH * pxPerMm);
    const pages = Math.max(1, Math.ceil(canvas.height / pageHpx));

    for (let i = 0; i < pages; i++) {
      const sliceH = Math.min(pageHpx, canvas.height - i * pageHpx);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, i * pageHpx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (i > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, sliceH / pxPerMm, undefined, "FAST");
    }

    pdf.save(`fuel-${vehicleNumber}-${record.billNo || record.id || "record"}.pdf`);
  } finally {
    sheet.remove();
  }
}

export default generateFuelPdf;
