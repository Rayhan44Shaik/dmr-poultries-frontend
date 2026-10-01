import autoTable from "jspdf-autotable";
import henImage from "../../../assets/dmr-hen.jpg";
import { exportToExcel } from "../../../utils/exportUtils";
import {
  createDmrPoultryPdf,
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
} from "../../../utils/drawDmrPoultryHeader";

export interface FarmPaymentExportRow {
  tripNo: string;
  tripDate: string;
  farm: string;
  vehicle: string;
  birdType: string;
  birds: number;
  dcWeight: number;
  rate: number;
  totalAmount: number;
}

export interface FarmPaymentExportScope {
  from: string;
  to: string;
  farm: string;
  search: string;
}

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);
const number = (value: number, digits = 2) => new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(value);
const date = (value: string) => value ? value.split("-").reverse().join("-") : "-";
const filename = (scope: FarmPaymentExportScope) =>
  `Farm_Payments_${scope.from || "All"}_to_${scope.to || "All"}`;

function tableRows(rows: FarmPaymentExportRow[]): (string | number)[][] {
  return rows.map((row, index) => [
    index + 1, date(row.tripDate), row.tripNo, row.farm, row.vehicle,
    row.birdType || "-", row.birds, number(row.dcWeight), number(row.rate), money(row.totalAmount),
  ]);
}

export function exportFarmPaymentsExcel(rows: FarmPaymentExportRow[], scope: FarmPaymentExportScope): void {
  const totals = rows.reduce((sum, row) => ({
    birds: sum.birds + row.birds,
    weight: sum.weight + row.dcWeight,
    amount: sum.amount + row.totalAmount,
  }), { birds: 0, weight: 0, amount: 0 });
  // Keep figures numeric in XLSX so users can sort, sum and calculate with
  // the exported weight/rate/amount columns instead of receiving text cells.
  const data: (string | number)[][] = rows.map((row, index) => [
    index + 1, date(row.tripDate), row.tripNo, row.farm, row.vehicle,
    row.birdType || "-", row.birds, row.dcWeight, row.rate, row.totalAmount,
  ]);
  data.push(["", "", "TOTAL", "", "", "", totals.birds, totals.weight, "", totals.amount]);
  exportToExcel(
    "Farm Payments",
    ["S.No", "Date", "Trip No", "Farm", "Vehicle", "Bird Type", "DC Birds", "DC Weight (KG)", "Rate/KG", "Total Amount"],
    data,
    filename(scope),
  );
}

export async function exportFarmPaymentsPdf(rows: FarmPaymentExportRow[], scope: FarmPaymentExportScope): Promise<void> {
  const doc = createDmrPoultryPdf("landscape");
  const assets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });
  const margin = 14;
  const headerBottom = drawPreparedDmrPoultryHeader(doc, { margin, top: 7 }, assets);
  const totals = rows.reduce((sum, row) => ({
    birds: sum.birds + row.birds,
    weight: sum.weight + row.dcWeight,
    amount: sum.amount + row.totalAmount,
  }), { birds: 0, weight: 0, amount: 0 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 35, 79);
  doc.text("FARM PAYMENT REPORT", margin, headerBottom + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const filters = [
    `Period: ${scope.from ? date(scope.from) : "All"} to ${scope.to ? date(scope.to) : "All"}`,
    `Farm: ${scope.farm === "All" ? "All Farms" : scope.farm}`,
    scope.search ? `Search: ${scope.search}` : "",
  ].filter(Boolean).join("   |   ");
  doc.text(filters, margin, headerBottom + 14);
  doc.text(
    `${rows.length} trips   |   DC Birds ${Math.round(totals.birds).toLocaleString("en-IN")}   |   DC Weight ${number(totals.weight)} kg   |   Amount Rs. ${money(totals.amount)}`,
    margin, headerBottom + 20,
  );

  autoTable(doc, {
    startY: headerBottom + 25,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [["S.No", "Date", "Trip No", "Farm", "Vehicle", "Bird Type", "DC Birds", "DC Weight", "Rate/KG", "Total Amount"]],
    body: tableRows(rows),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.2, cellPadding: 2, lineColor: [218, 226, 237], lineWidth: 0.2 },
    headStyles: { fillColor: [20, 50, 99], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: { 0: { halign: "center" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" } },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(218, 226, 237);
    doc.line(margin, height - 10, width - margin, height - 10);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("DMR POULTRIES • Confidential", margin, height - 6);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 6, { align: "right" });
  }
  doc.save(`${filename(scope)}.pdf`);
}
