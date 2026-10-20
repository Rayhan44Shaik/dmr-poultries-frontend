import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ShopSale, ShopSaleSummary } from "../types/shopSale";
import { cleanDeliveryShopName } from "../../vehicle-trips/utils/shopDisplayName";
import { drawPreparedDmrPoultryHeader, prepareDmrPoultryHeaderAssets } from "../../../../utils/drawDmrPoultryHeader";
import henImage from "../../../../assets/dmr-hen.jpg";

type ExportMatrix = { headers: string[]; rows: (string | number)[][] };

function matrix(sales: ShopSale[], includeMortality = true): ExportMatrix {
  const includeSubShop = sales.some((sale) => Boolean(sale.subShopName?.trim()));
  const includeRemark = sales.some((sale) => Boolean(sale.remark?.trim()));
  const headers = ["S.No", "Date", "Shop Name"];
  if (includeSubShop) headers.push("Sub Shop Name");
  headers.push("Birds", "Weight (KG)");
  if (includeMortality) headers.push("Mortality");
  headers.push("Rate", "Amount");
  if (includeRemark) headers.push("Remark");

  return {
    headers,
    rows: sales.map((sale, index) => {
      const row: (string | number)[] = [index + 1, sale.tripDate, cleanDeliveryShopName(sale.shopName) || sale.shopName];
      if (includeSubShop) row.push(sale.subShopName?.trim() || "—");
      row.push(Number(sale.totalBirds || 0), Number(sale.totalWeight || 0).toFixed(2));
      if (includeMortality) row.push(Number(sale.mortality || 0));
      row.push(Number(sale.rate || 0).toFixed(2), Number(sale.amount || 0).toFixed(2));
      if (includeRemark) row.push(sale.remark?.trim() || "—");
      return row;
    }),
  };
}

function kpis(sales: ShopSale[], summary: ShopSaleSummary, includeMortality = true): [string[], string[]] {
  const mortality = sales.reduce((sum, sale) => sum + Number(sale.mortality || 0), 0);
  const headers = ["Shops", "Birds", "Weight (KG)"];
  const values = [String(summary.totalShops), summary.totalBirds.toLocaleString("en-IN"), summary.totalWeight.toFixed(2)];
  if (includeMortality) {
    headers.push("Mortality");
    values.push(mortality.toLocaleString("en-IN"));
  }
  headers.push("Average Rate", "Average Weight (KG)", "Amount");
  values.push(summary.averageRate.toFixed(2), summary.averageWeightPerBird.toFixed(2), summary.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  return [headers, values];
}

export async function exportShopSalesPdf(sales: ShopSale[], summary: ShopSaleSummary, filename: string): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const assets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });
  // The Shop Sales PDF is intentionally financial-only: mortality remains in
  // the interactive view, but the document contains exactly the requested
  // Date/Shop/Sub-shop/Birds/Weight/Rate/Amount register.
  const { headers, rows } = matrix(sales, false);
  const margin = 12;
  const headerBottom = drawPreparedDmrPoultryHeader(doc, { margin }, assets);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("SHOP SALES", margin, headerBottom + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${sales.length} records`, doc.internal.pageSize.getWidth() - margin, headerBottom + 5, { align: "right" });

  const repeatHeader = () => drawPreparedDmrPoultryHeader(doc, { margin }, assets);
  autoTable(doc, {
    startY: headerBottom + 10,
    head: [headers],
    body: rows,
    theme: "grid",
    margin: { left: margin, right: margin, top: headerBottom + 5, bottom: 13 },
    styles: { fontSize: 6.6, cellPadding: 1.55, valign: "middle", textColor: [30, 41, 59], lineColor: [205, 205, 205], lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: [35, 35, 35], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 6.8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) repeatHeader();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    },
  });

  const lastTable = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const [kpiHeaders, kpiValues] = kpis(sales, summary, false);
  autoTable(doc, {
    startY: (lastTable.lastAutoTable?.finalY ?? headerBottom + 20) + 7,
    head: [kpiHeaders],
    body: [kpiValues],
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
  doc.save(`${filename}.pdf`);
}

export function exportShopSalesExcel(sales: ShopSale[], summary: ShopSaleSummary, filename: string): void {
  const { headers, rows } = matrix(sales);
  const [kpiHeaders, kpiValues] = kpis(sales, summary);
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["DMR POULTRIES — SHOP SALES"],
    [],
    headers,
    ...rows,
    [],
    ["SHOP SALES KPI SUMMARY"],
    kpiHeaders,
    kpiValues,
  ]);
  worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(12, header.length + 3) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shop Sales");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
