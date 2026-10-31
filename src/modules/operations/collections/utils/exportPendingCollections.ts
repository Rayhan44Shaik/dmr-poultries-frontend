import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawPreparedDmrPoultryHeader, prepareDmrPoultryHeaderAssets } from "../../../../utils/drawDmrPoultryHeader";
import henImage from "../../../../assets/dmr-hen.jpg";

export interface PendingCollectionExportRow {
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  balance: number;
  weeklySales: number;
  weeklyApprovedCollections: number;
  recoveryPercentage: number;
  overdueDays: number | null;
  lastCollectionDate: string | null | undefined;
}

const columns = ["S.No", "Shop", "Owner", "Mobile", "Outstanding", "Sales", "Collections", "Recovery %", "Last Collection", "Overdue Days"];

function rows(data: readonly PendingCollectionExportRow[]): (string | number)[][] {
  return data.map((row, index) => [
    index + 1,
    row.shopName,
    row.ownerName || "—",
    row.phoneNumber || "—",
    Number(row.balance || 0).toFixed(2),
    Number(row.weeklySales || 0).toFixed(2),
    Number(row.weeklyApprovedCollections || 0).toFixed(2),
    Number(row.recoveryPercentage || 0).toFixed(2),
    row.lastCollectionDate || "—",
    row.overdueDays ?? "—",
  ]);
}

export async function exportPendingCollectionsPdf(data: readonly PendingCollectionExportRow[], filename: string): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const assets = await prepareDmrPoultryHeaderAssets({ henUrl: henImage });
  const margin = 12;
  const headerBottom = drawPreparedDmrPoultryHeader(doc, { margin }, assets);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("PENDING COLLECTIONS", margin, headerBottom + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.length} shops`, doc.internal.pageSize.getWidth() - margin, headerBottom + 5, { align: "right" });
  autoTable(doc, {
    startY: headerBottom + 10,
    head: [columns],
    body: rows(data),
    theme: "grid",
    margin: { left: margin, right: margin, top: headerBottom + 5, bottom: 13 },
    styles: { fontSize: 7, cellPadding: 1.8, valign: "middle", textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.15 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawPreparedDmrPoultryHeader(doc, { margin }, assets);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${pageNumber}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    },
  });
  doc.save(`${filename}.pdf`);
}

export function exportPendingCollectionsExcel(data: readonly PendingCollectionExportRow[], filename: string): void {
  const sheet = XLSX.utils.aoa_to_sheet([["DMR POULTRIES — PENDING COLLECTIONS"], [], columns, ...rows(data)]);
  sheet["!cols"] = columns.map((label) => ({ wch: Math.max(14, label.length + 3) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pending Collections");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
