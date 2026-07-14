import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ---- PDF Export ----
export function exportToPDF(
  title: string,
  headers: string[],
  rows: any[][],
  filename: string
) {
  const doc = new jsPDF("l", "mm", "a4");
  const margin = 14;

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text(title, margin, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(`Generated on: ${dateStr}`, margin, 26);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 32,
    theme: "striped",
    tableWidth: "auto",
    margin: { left: 0, right: 0 },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [240, 242, 245] },
    styles: { fontSize: 10, cellPadding: 2, halign: "center" },
  });

  doc.save(`${filename}.pdf`);
}

// ---- Excel Export ----
export function exportToExcel(
  title: string,
  headers: string[],
  rows: any[][],
  filename: string
) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  const colWidths = headers.map((_, idx) => ({
    wch: Math.max(headers[idx].length * 1.2, 15),
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}