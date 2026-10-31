import autoTable from "jspdf-autotable";
import type { jsPDF } from "jspdf";
import { createDmrPoultryPdf, drawPreparedDmrPoultryHeader, prepareDmrPoultryHeaderAssets } from "../../../../utils/drawDmrPoultryHeader";
import henImage from "../../../../assets/dmr-hen.jpg";
import { formatVehicleNumber } from "../../../../utils/format";
import type { TripExpenseRow } from "../services/tripExpensesService";

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const dayLabel = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "—";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return `${WEEKDAYS_SHORT[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

export async function exportOperationExpensesPdf(
  rows: TripExpenseRow[],
  options: { includeMasterBunks: boolean; fromDate?: string; toDate?: string; filename: string },
): Promise<void> {
  const doc = createDmrPoultryPdf("landscape");
  const assets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });
  const margin = 12;
  const headerBottom = drawPreparedDmrPoultryHeader(doc, { margin }, assets);
  const range = [options.fromDate, options.toDate].filter(Boolean).join(" to ") || "All days";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("OPERATION EXPENSES", margin, headerBottom + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${rows.length} trips · ${range} · ${options.includeMasterBunks ? "All bunks" : "Other bunks only"}`,
    doc.internal.pageSize.getWidth() - margin,
    headerBottom + 5,
    { align: "right" },
  );

  const headers = ["S.No", "Trip Number", "Day", "Vehicle No.", "Emp", "Advance", "Meals", "S.PC", "V.M", "Diesel", "Others", "Total", "Remarks"];
  const body = rows.map((row, index) => [
    index + 1,
    row.tripNo,
    dayLabel(row.tripDate),
    formatVehicleNumber(row.vehicleNo),
    row.employeeCount,
    money(row.advanceAmount),
    money(row.meals),
    money(row.supervisorPc),
    money(row.vehicleMaintenance),
    money(row.diesel),
    money(row.others),
    money(row.totalExpense),
    row.remarks || "—",
  ]);

  const repeatHeader = () => drawPreparedDmrPoultryHeader(doc, { margin }, assets);
  autoTable(doc, {
    startY: headerBottom + 10,
    head: [headers],
    body,
    theme: "grid",
    margin: { left: margin, right: margin, top: headerBottom + 5, bottom: 13 },
    styles: { fontSize: 6.6, cellPadding: 1.45, valign: "middle", textColor: [30, 41, 59], lineColor: [205, 205, 205], lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: [35, 35, 35], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 6.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      4: { halign: "center" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right" },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) repeatHeader();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    },
  });

  const lastTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const totals = rows.reduce(
    (sum, row) => ({
      advance: sum.advance + Number(row.advanceAmount || 0),
      meals: sum.meals + Number(row.meals || 0),
      supervisorPc: sum.supervisorPc + Number(row.supervisorPc || 0),
      vehicleMaintenance: sum.vehicleMaintenance + Number(row.vehicleMaintenance || 0),
      diesel: sum.diesel + Number(row.diesel || 0),
      others: sum.others + Number(row.others || 0),
      total: sum.total + Number(row.totalExpense || 0),
    }),
    { advance: 0, meals: 0, supervisorPc: 0, vehicleMaintenance: 0, diesel: 0, others: 0, total: 0 },
  );
  autoTable(doc, {
    startY: (lastTable.lastAutoTable?.finalY ?? headerBottom + 20) + 7,
    head: [["Trips", "Advance", "Meals", "S.PC", "V.M", "Diesel", "Others", "Total"]],
    body: [[
      String(rows.length),
      money(totals.advance),
      money(totals.meals),
      money(totals.supervisorPc),
      money(totals.vehicleMaintenance),
      money(totals.diesel),
      money(totals.others),
      money(totals.total),
    ]],
    theme: "grid",
    margin: { left: margin, right: margin, top: headerBottom + 5, bottom: 13 },
    pageBreak: "auto",
    headStyles: { fillColor: [35, 35, 35], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7 },
    bodyStyles: { fillColor: [242, 242, 242], textColor: [52, 68, 115], fontStyle: "bold", halign: "center", fontSize: 8, cellPadding: 3 },
    styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) repeatHeader();
    },
  });

  doc.save(`${options.filename}.pdf`);
}
