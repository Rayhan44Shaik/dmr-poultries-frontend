// src/modules/staff/services/dutyReportPdf.ts
//
// Monthly duty report as a neat PDF (landscape A4):
//   Employee × every day of the month, colour-coded by duty type,
//   with per-employee Duty / Leave / Off / WO counts.
//
// Days that have not happened yet (after today) are left BLANK — they are
// not yet completed and are never counted. An "as of" date is printed in
// the header so the reader knows exactly what the report covers.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Employee } from "../types/staffDashboard";
import type { SampleMonthDuties } from "./staffSampleData";

/** ISO date (YYYY-MM-DD) of today, local time. */
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** True when the ISO date is strictly after today (not yet completed). */
export function isFutureDate(date: string): boolean {
  return date > todayStr();
}

/** Short label that fits a ~6 mm PDF column. */
export function getDutyShortLabel(dutyType: string | null): string {
  switch (dutyType) {
    case "Delivery":
      return "Duty";
    case "Driver":
      return "Drv";
    case "Rest":
      return "Leave";
    case "Repair":
      return "Rep";
    case "Office":
    case "OfficeDuty":
      return "Ofc";
    case "Collection":
      return "Coll";
    case "WeeklyOff":
      return "WO";
    case "Off":
      return "Off";
    default:
      return dutyType ? dutyType.slice(0, 4) : "";
  }
}

type Tint = { fill: [number, number, number]; text: [number, number, number] };

const TINTS: Record<string, Tint> = {
  Duty: { fill: [220, 252, 231], text: [21, 128, 61] }, // green
  Drv: { fill: [219, 234, 254], text: [29, 78, 216] }, // blue
  Leave: { fill: [241, 245, 249], text: [71, 85, 105] }, // slate
  Rep: { fill: [254, 243, 199], text: [180, 83, 9] }, // amber
  Ofc: { fill: [224, 231, 255], text: [67, 56, 202] }, // indigo
  Coll: { fill: [204, 251, 241], text: [15, 118, 110] }, // teal
  Other: { fill: [245, 243, 255], text: [109, 40, 217] }, // violet
  // Core-crew colour swap: Weekly Off = purple, Off = rose.
  WeeklyOffCore: { fill: [243, 232, 255], text: [126, 34, 206] }, // purple
  OffCore: { fill: [255, 228, 230], text: [190, 18, 58] }, // rose
  // Other roles keep Weekly Off in rose.
  WeeklyOffOther: { fill: [255, 228, 230], text: [190, 18, 58] }, // rose
  OffOther: { fill: [243, 232, 255], text: [126, 34, 206] }, // purple
};

const CORE_ROLES = new Set(["Supervisor", "Driver", "Helper", "Loader"]);

function tintFor(dutyType: string, role: string): Tint {
  if (dutyType === "WeeklyOff") return TINTS[CORE_ROLES.has(role) ? "WeeklyOffCore" : "WeeklyOffOther"];
  if (dutyType === "Off") return TINTS[CORE_ROLES.has(role) ? "OffCore" : "OffOther"];
  return TINTS[getDutyShortLabel(dutyType)] ?? TINTS.Other;
}

export interface MonthReportInput {
  data: SampleMonthDuties;
  employees: Employee[];
}

/** Build the monthly duty report PDF (pure — returns the doc). */
export function buildMonthDutiesPdf({ data, employees }: MonthReportInput): jsPDF {
  const monthName = new Date(data.year, data.month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const asOf = new Date();
  const asOfStr = asOf.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const today = todayStr();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text("DMR Poultries — Monthly Duty Report", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${monthName}   ·   ${data.days.length} days   ·   as of ${asOfStr}`, margin, 17.5);
  doc.text(
    "Days after the “as of” date are not yet completed — shown blank and not counted.",
    margin,
    21.5
  );

  // Per-employee rows. Counts cover COMPLETED days only (up to today) —
  // a day that has not happened yet is never counted.
  const counts = (cells: { dutyType: string | null; date: string }[]) => {
    let duty = 0;
    let leave = 0;
    let off = 0;
    let wo = 0;
    for (const c of cells) {
      if (c.date > today) continue; // not yet completed
      if (c.dutyType === "Rest") leave += 1;
      else if (c.dutyType === "Off") off += 1;
      else if (c.dutyType === "WeeklyOff") wo += 1;
      else if (c.dutyType) duty += 1;
    }
    return { duty, leave, off, wo };
  };

  const dayNames = data.days.map((d) => String(d.dayNum));
  const weekdayLetters = data.days.map((d) =>
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(d.date + "T00:00:00").getDay()]
  );

  const body = employees
    .map((emp) => {
      const cells = data.byEmployee[emp.id];
      if (!cells) return null;
      const c = counts(cells);
      return [
        emp.employeeName,
        emp.role,
        ...cells.map((cell) => {
          if (cell.dutyType && cell.date <= today) return getDutyShortLabel(cell.dutyType);
          if (cell.dutyType && isFutureDate(cell.date)) return `*${getDutyShortLabel(cell.dutyType)}`;
          if (isFutureDate(cell.date)) return "";
          return "·"; // past day with no entry yet
        }),
        c.duty,
        c.leave,
        c.off,
        c.wo,
      ];
    })
    .filter((r): r is (string | number)[] => Boolean(r));

  const nDays = data.days.length;
  const firstDayCol = 2;
  const countCols = 4;
  const nameW = 36;
  const roleW = 18;
  const countW = 9;
  const dayW = (pageWidth - margin * 2 - nameW - roleW - countW * countCols) / nDays;

  // Pre-computed tint per (row, day column) — applied in didParseCell.
  const rowTints: (Tint | null)[][] = employees.map((emp) => {
    const cells = data.byEmployee[emp.id] ?? [];
    return cells.map((cell) =>
      cell.dutyType && cell.date <= today ? tintFor(cell.dutyType, emp.role) : null
    );
  });

  autoTable(doc, {
    startY: 25,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6,
      cellPadding: 0.7,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      overflow: "ellipsize",
    },
    head: [dayNames, weekdayLetters],
    body,
    columnStyles: {
      0: { cellWidth: nameW, fontSize: 6.5, fontStyle: "bold", textColor: [30, 41, 59] },
      1: { cellWidth: roleW, fontSize: 5.5, textColor: [100, 116, 139] },
    },
    didParseCell: (hook) => {
      const col = hook.column.index;
      if (hook.section === "head") {
        hook.cell.styles.fontStyle = "bold";
        hook.cell.styles.fontSize = 5.5;
        hook.cell.styles.fillColor = [248, 250, 252];
        return;
      }
      if (col < 0 || col > nDays + countCols + firstDayCol - 1) return;
      if (col >= firstDayCol + nDays) {
        // count columns
        hook.cell.styles.cellWidth = countW;
        hook.cell.styles.halign = "center";
        return;
      }
      if (col < firstDayCol) return;
      hook.cell.styles.cellWidth = dayW;
      hook.cell.styles.halign = "center";
      const rowIdx = hook.row.index;
      const dayIdx = col - firstDayCol;
      const tint = rowTints[rowIdx]?.[dayIdx];
      const value = String(hook.cell.raw ?? "");
      if (tint) {
        hook.cell.styles.fillColor = tint.fill;
        hook.cell.styles.textColor = tint.text;
        hook.cell.styles.fontStyle = "bold";
      } else if (value.startsWith("*")) {
        // future day with a planned/entered duty (sample data) — light tint
        hook.cell.styles.textColor = [148, 163, 184];
        hook.cell.text = [value.slice(1)];
      } else if (value === "") {
        hook.cell.styles.fillColor = [250, 250, 252];
      }
    },
  });

  // Legend
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 25;
  let y = finalY + 7;
  const legend: { label: string; tint: Tint }[] = [
    { label: "Duty", tint: TINTS.Duty },
    { label: "Leave", tint: TINTS.Leave },
    { label: "Repair", tint: TINTS.Rep },
    { label: "Office", tint: TINTS.Ofc },
    { label: "Weekly Off (Supervisor/Driver/Helper/Loader)", tint: TINTS.WeeklyOffCore },
    { label: "Off (Supervisor/Driver/Helper/Loader)", tint: TINTS.OffCore },
    { label: "Weekly Off (other roles)", tint: TINTS.WeeklyOffOther },
    { label: "Other (free text)", tint: TINTS.Other },
  ];
  doc.setFontSize(7);
  let x = margin;
  for (const item of legend) {
    const w = doc.getTextWidth(item.label) + 7;
    if (x + w > pageWidth - margin) {
      x = margin;
      y += 5;
    }
    doc.setFillColor(item.tint.fill[0], item.tint.fill[1], item.tint.fill[2]);
    doc.rect(x, y - 2.6, 5, 3.2, "FD");
    doc.setTextColor(item.tint.text[0], item.tint.text[1], item.tint.text[2]);
    doc.text(item.label, x + 6.5, y);
    x += w;
  }
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated on ${new Date().toLocaleString("en-IN")}  ·  Counts cover completed days only (up to ${asOfStr}).  Grey = not yet completed, “·” = past day with no entry yet.  An assigned duty overrides an approved leave.`,
    margin,
    y + 6
  );

  return doc;
}

/** Build and save (download) the monthly duty report PDF. */
export function downloadMonthDutiesPdf(input: MonthReportInput): void {
  const monthName = new Date(input.data.year, input.data.month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  buildMonthDutiesPdf(input).save(`Duty-Report-${monthName.replace(" ", "-")}.pdf`);
}
