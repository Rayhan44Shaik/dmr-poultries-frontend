import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxDetail } from "../types/trip";
import { ShopDeliveryWithExtra } from "../components/Step_4/useShopDeliveryForm";

// ─── COLOR PALETTE ──────────────────────────────────────────────────────────
const COLOR = {
  primary: [15, 23, 42] as [number, number, number],       // Dark Navy / Slate 900
  secondary: [30, 58, 138] as [number, number, number],    // Accent Blue 900
  accent: [225, 29, 72] as [number, number, number],       // Rose Red 600
  cardBg: [248, 250, 252] as [number, number, number],     // Light Slate / White
  cardBorder: [226, 232, 240] as [number, number, number], // Clean Slate Border
  iconBg: [239, 246, 255] as [number, number, number],     // Soft Blue Badge Background
  iconStroke: [37, 99, 235] as [number, number, number],   // Bright Blue Icon Vector Stroke
  textDark: [30, 41, 59] as [number, number, number],      // Slate 800 Text
  textMuted: [100, 116, 139] as [number, number, number],  // Slate 500 Subtitle Text
  tableHeader: [15, 43, 92] as [number, number, number],   // Deep Navy
  tableAltRow: [248, 250, 252] as [number, number, number],
  totalBg: [224, 231, 255] as [number, number, number],
};

// ─── PREMIUM VECTOR LOGO ENGINES ───────────────────────────────────────────

/**
 * BRAND LOGO: DMR POULTRY (Corporate Geometric Emblem)
 */
function drawDmrBrandLogo(doc: jsPDF, x: number, y: number, size = 22) {
  doc.saveGraphicsState();

  const cx = x + size / 2;
  const cy = y + size / 2;

  // Outer Rounded Navy Badge
  doc.setFillColor(15, 43, 92);
  doc.roundedRect(x, y, size, size, 4, 4, "F");

  // Sleek Inner Rose Gold Border
  doc.setDrawColor(225, 29, 72);
  doc.setLineWidth(0.6);
  doc.roundedRect(x + 1.2, y + 1.2, size - 2.4, size - 2.4, 3, 3, "S");

  // Central Emblem Circle
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy - 1.5, 5.5, "F");

  // Stylized Monogram Graphic "DMR" Wings
  doc.setFillColor(15, 43, 92);
  doc.triangle(cx - 3.5, cy + 0.5, cx, cy - 5.0, cx + 3.5, cy + 0.5, "F");
  
  doc.setFillColor(225, 29, 72);
  doc.triangle(cx - 2.0, cy + 1.2, cx, cy - 3.0, cx + 2.0, cy + 1.2, "F");

  // Bold Clean Text Base
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DMR", cx, cy + 6.8, { align: "center" });

  doc.restoreGraphicsState();
}

/**
 * SHOP LOGO: ANBU CHICKEN CENTER (Modern Minimalist Retail Badge)
 */
function drawAnbuShopLogo(doc: jsPDF, x: number, y: number, size = 22) {
  doc.saveGraphicsState();

  const cx = x + size / 2;
  const cy = y + size / 2;

  // Crisp White Circular Container with Rose Accent Ring
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(225, 29, 72);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, size / 2 - 0.5, "FD");

  // Inner Soft Rose Ring Background
  doc.setFillColor(254, 242, 242);
  doc.circle(cx, cy, size / 2 - 2, "F");

  // Central Crown / Wing Geometry
  doc.setFillColor(225, 29, 72);
  doc.circle(cx - 2.2, cy - 2.5, 1.6, "F");
  doc.circle(cx + 2.2, cy - 2.5, 1.6, "F");
  doc.circle(cx, cy - 3.5, 2.0, "F");

  // Shield Base Overlay
  doc.setFillColor(15, 43, 92);
  doc.triangle(cx - 4.5, cy - 1.2, cx + 4.5, cy - 1.2, cx, cy + 3.0, "F");

  // Shop Label Text Box
  doc.setFillColor(225, 29, 72);
  doc.roundedRect(cx - 7.5, cy + 3.2, 15, 4.2, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.setTextColor(255, 255, 255);
  doc.text("ANBU", cx, cy + 6.2, { align: "center" });

  doc.restoreGraphicsState();
}

/**
 * HIGH-PRECISION VECTOR FIELD ICONS (Lucide-inspired)
 */
function drawModernIcon(
  doc: jsPDF,
  type: "supervisor" | "vehicle" | "phone" | "store" | "calendar",
  cx: number,
  cy: number
) {
  doc.saveGraphicsState();

  // Circular Soft Blue Badge
  doc.setFillColor(COLOR.iconBg[0], COLOR.iconBg[1], COLOR.iconBg[2]);
  doc.setDrawColor(219, 234, 254);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, 3.8, "FD");

  // Crisp Vector Stroke
  doc.setDrawColor(COLOR.iconStroke[0], COLOR.iconStroke[1], COLOR.iconStroke[2]);
  doc.setLineWidth(0.4);

  switch (type) {
    case "supervisor":
      doc.circle(cx, cy - 1.1, 1.1, "S");
      doc.path([
        { op: "m", c: [cx - 2.0, cy + 2.0] },
        { op: "c", c: [cx - 2.0, cy + 0.6, cx + 2.0, cy + 0.6, cx + 2.0, cy + 2.0] }
      ]);
      doc.stroke();
      break;

    case "vehicle":
      doc.roundedRect(cx - 2.4, cy - 1.5, 3.2, 2.2, 0.3, 0.3, "S");
      doc.roundedRect(cx + 0.8, cy - 0.7, 1.6, 1.4, 0.3, 0.3, "S");
      doc.circle(cx - 1.2, cy + 1.2, 0.6, "S");
      doc.circle(cx + 1.4, cy + 1.2, 0.6, "S");
      break;

    case "phone":
      doc.path([
        { op: "m", c: [cx - 1.5, cy - 1.2] },
        { op: "c", c: [cx - 2.0, cy - 0.2, cx - 0.2, cy + 1.8, cx + 1.0, cy + 1.5] },
        { op: "l", c: [cx + 1.8, cy + 0.7] },
        { op: "c", c: [cx + 2.0, cy + 0.3, cx + 1.5, cy - 0.2, cx + 1.1, cy + 0.1] },
        { op: "l", c: [cx - 0.7, cy - 1.7] },
        { op: "c", c: [cx - 1.0, cy - 2.0, cx - 1.4, cy - 1.6, cx - 1.5, cy - 1.2] }
      ]);
      doc.stroke();
      break;

    case "store":
      doc.triangle(cx - 2.2, cy - 0.4, cx + 2.2, cy - 0.4, cx, cy - 2.2, "S");
      doc.rect(cx - 1.8, cy - 0.4, 3.6, 2.2, "S");
      doc.rect(cx - 0.6, cy + 0.4, 1.2, 1.4, "S");
      break;

    case "calendar":
      doc.roundedRect(cx - 2.1, cy - 2.0, 4.2, 4.0, 0.5, 0.5, "S");
      doc.line(cx - 2.1, cy - 0.7, cx + 2.1, cy - 0.7);
      doc.setFillColor(COLOR.iconStroke[0], COLOR.iconStroke[1], COLOR.iconStroke[2]);
      doc.circle(cx - 1.0, cy + 0.8, 0.3, "F");
      doc.circle(cx + 1.0, cy + 0.8, 0.3, "F");
      break;
  }

  doc.restoreGraphicsState();
}

// ─── MAIN GENERATOR ──────────────────────────────────────────────────────────

export function generateShopPDF(
  row: ShopDeliveryWithExtra,
  safeBoxDetails: BoxDetail[] = [],
  tripNo?: string,
  vehicleNo?: string,
  supervisorName?: string,
  supervisorPhone?: string,
  tripDate?: string,
  logoLeftUrl?: string,
  logoRightUrl?: string,
  supervisorIconUrl?: string,
  vehicleIconUrl?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      let currentY = 12;

      // ─── 1. HEADER LOGOS & TITLE ──────────────────────────────────────────

      // Left Brand Logo
      try {
        if (logoLeftUrl) {
          doc.addImage(logoLeftUrl, "PNG", margin, currentY, 22, 22);
        } else {
          drawDmrBrandLogo(doc, margin, currentY, 22);
        }
      } catch {
        drawDmrBrandLogo(doc, margin, currentY, 22);
      }

      // Right Shop Logo
      try {
        if (logoRightUrl) {
          doc.addImage(logoRightUrl, "PNG", pageWidth - margin - 22, currentY, 22, 22);
        } else {
          drawAnbuShopLogo(doc, pageWidth - margin - 22, currentY, 22);
        }
      } catch {
        drawAnbuShopLogo(doc, pageWidth - margin - 22, currentY, 22);
      }

      // Center Titles
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(COLOR.tableHeader[0], COLOR.tableHeader[1], COLOR.tableHeader[2]);
      doc.text("DMR POULTRY", pageWidth / 2, currentY + 9, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
      doc.text(
        `DELIVERY RECEIPT ${tripNo ? `• TRIP #${tripNo}` : ""}`,
        pageWidth / 2,
        currentY + 16,
        { align: "center" }
      );

      currentY += 26;

      // Divider Line
      doc.setDrawColor(COLOR.cardBorder[0], COLOR.cardBorder[1], COLOR.cardBorder[2]);
      doc.setLineWidth(0.4);
      doc.line(margin, currentY, pageWidth - margin, currentY);

      currentY += 6;

      // ─── 2. INFO CARDS ────────────────────────────────────────────────────

      const isBoxMode = row.deliveryMode === "box";
      const dateValue = tripDate || new Date().toISOString().split("T")[0];

      doc.setFillColor(COLOR.cardBg[0], COLOR.cardBg[1], COLOR.cardBg[2]);
      doc.setDrawColor(COLOR.cardBorder[0], COLOR.cardBorder[1], COLOR.cardBorder[2]);
      doc.roundedRect(margin, currentY, contentWidth, 34, 3, 3, "FD");

      const col1X = margin + 8;
      const col2X = margin + 98;

      doc.setFont("helvetica", "normal");

      // --- ROW 1: Supervisor & Vehicle ---
      if (supervisorIconUrl) {
        try {
          doc.addImage(supervisorIconUrl, "PNG", col1X - 3, currentY + 4, 7, 7);
        } catch {
          drawModernIcon(doc, "supervisor", col1X, currentY + 7);
        }
      } else {
        drawModernIcon(doc, "supervisor", col1X, currentY + 7);
      }
      doc.setFontSize(8.5);
      doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
      doc.text("Supervisor Name :", col1X + 6, currentY + 8);
      doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
      doc.text(supervisorName || "Saifuddin", col1X + 34, currentY + 8);

      if (vehicleIconUrl) {
        try {
          doc.addImage(vehicleIconUrl, "PNG", col2X - 3, currentY + 4, 7, 7);
        } catch {
          drawModernIcon(doc, "vehicle", col2X, currentY + 7);
        }
      } else {
        drawModernIcon(doc, "vehicle", col2X, currentY + 7);
      }
      doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
      doc.text("Vehicle No :", col2X + 6, currentY + 8);
      doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
      doc.text(vehicleNo || "AP-02-CD-5678", col2X + 26, currentY + 8);

      // --- ROW 2: Mobile No ---
      drawModernIcon(doc, "phone", col1X, currentY + 17);
      doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
      doc.text("Mobile No :", col1X + 6, currentY + 18);
      doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
      doc.text(supervisorPhone || "N/A", col1X + 34, currentY + 18);

      // Inner Card Line
      doc.setDrawColor(COLOR.cardBorder[0], COLOR.cardBorder[1], COLOR.cardBorder[2]);
      doc.setLineWidth(0.2);
      doc.line(margin + 4, currentY + 23, pageWidth - margin - 4, currentY + 23);

      // --- ROW 3: Shop Name & Date ---
      drawModernIcon(doc, "store", col1X, currentY + 28);
      doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
      doc.text("Shop Name :", col1X + 6, currentY + 29);
      doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
      doc.text(row.shopName || "Anbu Chicken Center", col1X + 26, currentY + 29);

      drawModernIcon(doc, "calendar", col2X, currentY + 28);
      doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
      doc.text("Date :", col2X + 6, currentY + 29);
      doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
      doc.text(dateValue, col2X + 18, currentY + 29);

      currentY += 40;

      // ─── 3. TABLE SECTION ─────────────────────────────────────────────────

      const headers = isBoxMode
        ? ["Box No", "Birds No.", "Weight (Kg)"]
        : ["Box No", "Birds No.", "Weight (Farm) (kg)"];

      let tableRows: (string | number)[][] = [];
      let totalBirds = 0;
      let totalWeight = 0;

      const tableData = isBoxMode
        ? row.perBoxData || []
        : (() => {
            const selected = row.selectedBoxIds || [];
            return safeBoxDetails.filter((b) => selected.includes(b.boxNo));
          })();

      if (tableData.length === 0) {
        tableRows.push(["—", "—", "—"]);
      } else {
        tableData.forEach((item) => {
          const birds = Number(item.birds) || 0;
          const weight = Number(item.weight) || 0;
          tableRows.push([item.boxNo, birds.toLocaleString(), weight.toFixed(2)]);
          totalBirds += birds;
          totalWeight += weight;
        });
      }

      tableRows.push([
        `TOTAL BOXES: ${tableData.length}`,
        totalBirds.toLocaleString(),
        totalWeight.toFixed(2),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body: tableRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: COLOR.tableHeader,
          textColor: [255, 255, 255],
          fontStyle: "normal",
          fontSize: 9,
          halign: "center",
          valign: "middle",
          cellPadding: 3.5,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
          valign: "middle",
          textColor: COLOR.textDark,
          lineColor: COLOR.cardBorder,
          lineWidth: 0.25,
        },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "center" },
          2: { halign: "center" },
        },
        alternateRowStyles: {
          fillColor: COLOR.tableAltRow,
        },
        didParseCell: (data) => {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fillColor = COLOR.totalBg;
            data.cell.styles.textColor = COLOR.tableHeader;
            data.cell.styles.fontStyle = "normal";
            data.cell.styles.fontSize = 9;
          }
        },
      });

      let finalY = (doc as any).lastAutoTable.finalY || currentY + 40;

      // ─── 4. MORTALITY & FINAL DEDUCTION SUMMARY ───────────────────────────

      if (!isBoxMode) {
        const mortalityBirds = Number(row.mortality) || 0;
        const mortalityWeight = Number(row.mortKg) || 0;
        const finalBirds = totalBirds - mortalityBirds;
        const finalWeight = totalWeight - mortalityWeight;

        finalY += 8;

        doc.setFillColor(COLOR.cardBg[0], COLOR.cardBg[1], COLOR.cardBg[2]);
        doc.setDrawColor(COLOR.cardBorder[0], COLOR.cardBorder[1], COLOR.cardBorder[2]);
        doc.roundedRect(margin, finalY, contentWidth, 20, 2, 2, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(COLOR.accent[0], COLOR.accent[1], COLOR.accent[2]);
        doc.text("MORTALITY DEDUCTIONS", margin + 6, finalY + 6);

        doc.setFontSize(8);
        doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
        doc.text(`Mortality Count: ${mortalityBirds} birds`, margin + 6, finalY + 12);
        doc.text(`Mortality Weight: ${mortalityWeight.toFixed(2)} kg`, margin + 6, finalY + 16);

        doc.setFontSize(8.5);
        doc.setTextColor(COLOR.tableHeader[0], COLOR.tableHeader[1], COLOR.tableHeader[2]);
        doc.text("NET DELIVERED", margin + 100, finalY + 6);

        doc.setFontSize(8.5);
        doc.setTextColor(COLOR.textDark[0], COLOR.textDark[1], COLOR.textDark[2]);
        doc.text(`Final Birds: ${finalBirds} birds`, margin + 100, finalY + 12);
        doc.text(`Final Weight: ${finalWeight.toFixed(2)} kg`, margin + 100, finalY + 16);
      }

      // ─── 5. FOOTER ────────────────────────────────────────────────────────

      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        doc.setDrawColor(COLOR.cardBorder[0], COLOR.cardBorder[1], COLOR.cardBorder[2]);
        doc.setLineWidth(0.4);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(COLOR.textMuted[0], COLOR.textMuted[1], COLOR.textMuted[2]);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, pageHeight - 6);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
      }

      // ─── 6. DOWNLOAD HANDLER ──────────────────────────────────────────────

      const suffix = isBoxMode ? "Box" : "Weight";
      const cleanShopName = (row.shopName || "Anbu_Chicken_Center").replace(/\s+/g, "_");

      const pdfBlob = doc.output("blob");
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement("a");

      downloadLink.href = blobUrl;
      downloadLink.download = `DeliveryReceipt_${cleanShopName}_${suffix}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

      resolve();
    } catch (error: any) {
      reject(new Error(error?.message || "Failed to generate PDF receipt."));
    }
  });
}