// src/modules/fleet-operations/utils/generateMaintenancePdf.ts
//
// DMR POULTRIES — Maintenance Record PDF (A4 portrait).
// Rendered from a styled DOM sheet and captured with html2canvas, so Telugu
// shapes perfectly (jsPDF core fonts cannot render Telugu script). The layout
// mirrors the view: branded header, the record's details in an EQUAL
// two-pair-per-column grid, the parts bill, the total band and the vehicle's
// complete maintenance history.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { formatTripListDay } from "../../operations/vehicle-trips/utils/formatTripListDay";
import { localizeMaintenanceText, localizeMaintenanceName } from "./maintenanceLocalization";
import type { MaintenanceEvent } from "../types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const inr = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusLabel = (row: MaintenanceEvent, t: Translate) => {
  if (row.deletedAt) return t("status.deleted");
  if (row.paymentStatus === "approved") return t("status.approved");
  return t("status.pending");
};

const esc = (v: string) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BRAND_GREEN = "#0d7a3f";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

/** Builds the printable sheet. All sizes are px @ 794 width (= A4 @96dpi). */
function buildSheet(
  record: MaintenanceEvent,
  vehicleHistory: MaintenanceEvent[],
  vehicleNumber: string,
  language: "en" | "te",
  t: Translate
): HTMLElement {
  const sheet = document.createElement("div");
  sheet.style.cssText = `position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:${INK};font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Telugu',sans-serif;font-size:13px;line-height:1.45;`;

  const day = (row: MaintenanceEvent) => formatTripListDay(row.date || row.createdAt, language);
  const status = statusLabel(record, t);
  const types = (record.maintenanceType || "").split(",").map((s) => s.trim()).filter(Boolean);
  const nextByType = record.nextServiceByType || {};
  const parts = Array.isArray(record.parts) ? record.parts : [];

  // ── Details — EQUAL two-pair columns (label | value | label | value) ──
  const detailPairs: [string, string][] = [
    [t("fleet.maintenance_view.bill_number"), record.billNumber || "—"],
    [t("common.date"), day(record)],
    [t("common.vehicle"), vehicleNumber],
    [t("fleet.maintenance_form.current_km"), `${Number(record.currentKM || 0).toLocaleString("en-IN")} KM`],
    [t("common.driver"), localizeMaintenanceName(record.driverName, language) || "—"],
    [t("fleet.maintenance_form.service_type"), localizeMaintenanceText(record.serviceType, language) || "—"],
    [t("operations.maintenance_garage"), localizeMaintenanceName(record.garage, language) || "—"],
    [t("fleet.maintenance_form.mechanic"), localizeMaintenanceName(record.mechanic, language) || "—"],
    [t("operations.maintenance_type"), types.length ? types.map((tp) => localizeMaintenanceText(tp, language)).join(", ") : "—"],
    [t("fleet.maintenance_form.next_service_km"),
      types.length
        ? types.map((tp) => `${localizeMaintenanceText(tp, language)}: ${nextByType[tp] != null ? `${Number(nextByType[tp]).toLocaleString("en-IN")} KM` : "—"}`).join(" · ")
        : record.nextServiceKM ? `${Number(record.nextServiceKM).toLocaleString("en-IN")} KM` : "—"],
    [t("common.status"), status],
    [t("common.remarks"), record.remarks || "—"],
  ];
  // Two EQUAL side-by-side columns, each column its own label/value pairs
  // (left column gets the first half of the fields, right the second).
  const half = Math.ceil(detailPairs.length / 2);
  const column = (pairs: [string, string][], last: boolean) =>
    pairs
      .map(
        ([label, value]) => `
        <div style="padding:7px 10px;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${MUTED};background:#f8fafc;border-bottom:1px solid ${LINE};${last ? '' : `border-right:1px solid ${LINE};`}">${esc(label)}</div>
        <div style="padding:7px 10px;font-size:12px;font-weight:700;color:${INK};word-break:break-word;border-bottom:1px solid ${LINE};${last ? '' : `border-right:1px solid ${LINE};`}">${esc(value)}</div>`
      )
      .join("");
  const cells = `<div style="display:grid;grid-template-columns:1fr 1fr;grid-column-gap:14px;">
        <div style="display:grid;grid-template-columns:auto 1fr;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">${column(detailPairs.slice(0, half), false)}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;border:1px solid ${LINE};border-radius:8px;overflow:hidden;">${column(detailPairs.slice(half), true)}</div>
      </div>`;

  const partsRows = parts
    .map(
      (p, i) => `
      <tr style="background:${i % 2 ? "#fbfdfc" : "#ffffff"};">
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};font-weight:600;">${esc(localizeMaintenanceText(p.name, language) || "-")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${MUTED};">${esc(p.specification || "-")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:center;font-weight:700;">${p.quantity ?? 0}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;">${inr(Number(p.rate || 0))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-weight:700;">${inr(Number(p.amount || 0))}</td>
      </tr>`
    )
    .join("");

  const historyRows = vehicleHistory
    .map((row, i) => {
      const st = statusLabel(row, t);
      const tone = row.deletedAt ? "#b91c1c" : row.paymentStatus === "approved" ? "#047857" : "#b45309";
      const typeList = (row.maintenanceType || "").split(",").filter((s) => s.trim());
      return `
      <tr style="background:${i % 2 ? "#fbfdfc" : "#ffffff"};">
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};white-space:nowrap;font-weight:600;">${esc(day(row))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};font-weight:700;color:${BRAND_GREEN};">${esc(row.billNumber || "-")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};">${esc(localizeMaintenanceText(typeList[0], language) || "-")}${typeList.length > 1 ? ` +${typeList.length - 1}` : ""}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${MUTED};">${esc(localizeMaintenanceName(row.garage, language) || "-")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};color:${MUTED};">${esc(localizeMaintenanceName(row.mechanic, language) || "-")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-weight:600;">${Number(row.currentKM || 0).toLocaleString("en-IN")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:right;font-weight:700;">${inr(Number(row.totalCost || 0))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid ${LINE};text-align:center;color:${tone};font-weight:700;">${esc(st)}</td>
      </tr>`;
    })
    .join("");

  const th = (label: string, align = "left") =>
    `<th style="padding:7px 10px;text-align:${align};background:#f1f5f9;color:#334155;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border-bottom:2px solid ${LINE};">${esc(label)}</th>`;

  sheet.innerHTML = `
    <div style="background:${BRAND_GREEN};padding:18px 24px;color:#ffffff;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div style="font-size:21px;font-weight:800;letter-spacing:.02em;">DMR POULTRIES</div>
        <div style="font-size:11px;font-weight:600;color:#d1fae5;">${esc(t("fleet.maintenance_view.original"))}</div>
      </div>
      <div style="margin-top:2px;font-size:12px;color:#d1fae5;font-weight:600;">${esc(t("fleet.maintenance_view.report_title"))}</div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 24px 10px;">
      <div style="font-size:16px;font-weight:800;color:${BRAND_GREEN};">${esc(vehicleNumber)}</div>
      <div style="font-size:11px;color:${MUTED};font-weight:600;">${esc(record.billNumber || "-")} · ${esc(status)}</div>
    </div>

    ${cells}

    ${
      parts.length
        ? `<div style="margin:16px 24px 0;font-size:12px;font-weight:800;color:${INK};">${esc(t("fleet.maintenance_form.parts_title"))}</div>
    <table style="margin:6px 24px 0;width:calc(100% - 48px);border-collapse:collapse;border:1px solid ${LINE};">
      <thead><tr>${th(t("fleet.parts.item_name"))}${th(t("fleet.parts.specification"))}${th(t("fleet.parts.qty"), "center")}${th(t("fleet.parts.rate"), "right")}${th(t("fleet.parts.amount"), "right")}</tr></thead>
      <tbody>${partsRows}</tbody>
    </table>`
        : ""
    }

    <div style="margin:16px 24px 0;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#ecfdf5,#ffffff 55%,#ecfdf5);border:1px solid #a7f3d0;border-radius:8px;padding:10px 14px;">
      <span style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#047857;">${esc(t("fleet.parts.total_cost"))}</span>
      <span style="font-size:16px;font-weight:800;color:#047857;">${inr(Number(record.totalCost || 0))}</span>
    </div>

    ${
      vehicleHistory.length
        ? `<div style="margin:18px 24px 0;font-size:12px;font-weight:800;color:${INK};">${esc(t("fleet.maintenance_view.all_records"))} — ${esc(vehicleNumber)} (${vehicleHistory.length})</div>
    <table style="margin:6px 24px 0;width:calc(100% - 48px);border-collapse:collapse;border:1px solid ${LINE};">
      <thead><tr>${th(t("common.date"))}${th(t("fleet.maintenance_view.bill_number"))}${th(t("operations.maintenance_type"))}${th(t("operations.maintenance_garage"))}${th(t("fleet.maintenance_form.mechanic"))}${th(t("fleet.maintenance_form.current_km"), "right")}${th(t("fleet.parts.total_cost"), "right")}${th(t("common.status"), "center")}</tr></thead>
      <tbody>${historyRows}</tbody>
    </table>`
        : ""
    }

    <div style="margin:18px 24px 0;padding:10px 0 16px;border-top:1px solid ${LINE};font-size:9.5px;color:#94a3b8;text-align:center;">
      ${esc(t("fleet.maintenance_view.pdf_footer"))}
    </div>`;

  document.body.appendChild(sheet);
  return sheet;
}

export async function generateMaintenancePdf(
  record: MaintenanceEvent,
  vehicleHistory: MaintenanceEvent[],
  vehicleNumber: string,
  language: "en" | "te" = "en",
  t: Translate
): Promise<void> {
  const sheet = buildSheet(record, vehicleHistory, vehicleNumber, language, t);
  try {
    // Fonts/images inside the sheet need a beat to lay out before capture.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Slice the tall capture into A4 pages.
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
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, sliceH / pxPerMm, undefined, "FAST");
    }
    pdf.save(`maintenance-${vehicleNumber}-${record.billNumber || record.id || "record"}.pdf`);
  } finally {
    sheet.remove();
  }
}

export default generateMaintenancePdf;
