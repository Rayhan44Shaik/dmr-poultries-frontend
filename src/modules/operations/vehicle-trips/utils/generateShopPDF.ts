import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxDetail } from "../types/trip";
import { ShopDeliveryWithExtra } from "../components/Step_4/useShopDeliveryForm";

// ─── Shared Shape Helpers ─────────────────────────────────────────────

// FIXED: Reverted to the strictly correct array-of-pairs syntax for jsPDF.lines
function drawDiamond(doc: jsPDF, cx: number, cy: number, size: number) {
  doc.lines(
    [[size, size], [-size, size], [-size, -size], [size, -size]],
    cx,
    cy - size,
    [1, 1],
    "F",
    true
  );
}

function drawFlourish(doc: jsPDF, x: number, y: number, isRight = false) {
  doc.saveGraphicsState();
  doc.setLineWidth(0.6);
  doc.setDrawColor(180, 25, 35);
  const scaleX = isRight ? -1 : 1;
  doc.line(x, y, x - 12 * scaleX, y);
  doc.setFillColor(180, 25, 35);
  doc.circle(x - 13 * scaleX, y, 0.8, "F");
  doc.circle(x - 6 * scaleX, y - 1.8, 0.6, "F");
  doc.circle(x - 6 * scaleX, y + 1.8, 0.6, "F");
  doc.restoreGraphicsState();
}

// ─── VECTOR ICONS ──────────────────────────────────────────────────────

// FIXED: doc.polygon completely removed, using absolutely valid array-of-pairs for doc.lines
function drawSupervisorIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.saveGraphicsState();
  const primaryColor = color;
  
  // 1. Draw Suit Shoulders & Base using strictly correct lines format
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.lines(
    [
      [-3, 0],
      [-3.8, 2.5],
      [-3.8, 4],
      [3.8, 4],
      [3.8, 2.5],
      [3, 0]
    ],
    x - 3, y,
    [1, 1],
    "F",
    true
  );

  // 2. Collar Cutouts (White)
  doc.setFillColor(255, 255, 255);
  doc.triangle(x - 1.5, y + 0.5, x - 0.3, y + 0.5, x - 1.5, y + 2.5, "F");
  doc.triangle(x + 1.5, y + 0.5, x + 0.3, y + 0.5, x + 1.5, y + 2.5, "F");

  // 3. Tie
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(x - 0.4, y + 0.5, 0.8, 2, "F");
  doc.triangle(x - 0.6, y + 2.5, x + 0.6, y + 2.5, x, y + 3.2, "F");

  // 4. Face
  doc.setFillColor(255, 255, 255);
  doc.circle(x, y - 2, 1.5, "F");
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.circle(x, y - 2, 1.5, "S");

  // 5. Hard Hat
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(x - 2.5, y - 3.5, 5, 1, 0.2, 0.2, "F");
  doc.rect(x - 1.5, y - 5, 3, 2, "F");
  doc.circle(x, y - 5, 1.5, "F");
  doc.rect(x - 0.9, y - 5, 0.4, 1.3, "F");
  doc.rect(x - 0.1, y - 5, 0.4, 1.3, "F");
  
  doc.restoreGraphicsState();
}

function drawTruckIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.saveGraphicsState();
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x - 2.6, y - 2.5, 3.2, 3.5, 0.4, 0.4, "F");
  doc.roundedRect(x + 0.6, y - 1.5, 3.6, 2.5, 0.4, 0.4, "F");
  doc.circle(x - 1.2, y + 1.2, 0.7, "F");
  doc.circle(x + 2.4, y + 1.2, 0.7, "F");
  doc.restoreGraphicsState();
}

function drawPhoneIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.saveGraphicsState();
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x - 1.8, y - 3, 3.6, 6, 0.8, 0.8, "F");
  doc.restoreGraphicsState();
}

function drawStoreIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.saveGraphicsState();
  doc.setFillColor(color[0], color[1], color[2]);
  doc.triangle(x - 2.8, y - 0.5, x + 2.8, y - 0.5, x, y - 3.5, "F");
  doc.roundedRect(x - 2.4, y - 0.5, 4.8, 3.5, 0.3, 0.3, "F");
  doc.restoreGraphicsState();
}

function drawCalendarIcon(doc: jsPDF, x: number, y: number, color: [number, number, number]) {
  doc.saveGraphicsState();
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x - 2.4, y - 2.4, 4.8, 4.8, 0.4, 0.4, "F");
  doc.setFillColor(255, 255, 255);
  doc.rect(x - 2.4, y - 2.4, 4.8, 1.2, "F");
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(x - 1.4, y - 3.2, 0.6, 1.2, "F");
  doc.rect(x + 0.8, y - 3.2, 0.6, 1.2, "F");
  doc.restoreGraphicsState();
}

// ─── Vector DMR Logo (Left) ──────────────────────────────────────────

function drawVectorDMRLogo(doc: jsPDF, x: number, y: number) {
  doc.saveGraphicsState();
  const cx = x + 12;
  const cy = y + 12;
  doc.setDrawColor(15, 43, 92);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, 11, "S");
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, 9.8, "S");
  doc.setFillColor(210, 35, 42);
  doc.circle(cx - 1.6, cy - 8.8, 1.1, "F");
  doc.circle(cx, cy - 9.6, 1.2, "F");
  doc.circle(cx + 1.6, cy - 8.8, 1.1, "F");
  doc.setFillColor(15, 43, 92);
  doc.circle(cx, cy - 7, 1.6, "F");
  doc.setFillColor(245, 158, 11);
  doc.triangle(cx + 1.2, cy - 7.3, cx + 2.8, cy - 6.7, cx + 1.2, cy - 6.1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(210, 35, 42);
  doc.text("DMR", cx, cy + 2.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.5);
  doc.setTextColor(15, 43, 92);
  doc.text("POULTRY", cx, cy + 6, { align: "center" });
  doc.restoreGraphicsState();
}

// ─── MAIN PDF GENERATOR ──────────────────────────────────────────────

export function generateShopPDF(
  row: ShopDeliveryWithExtra,
  safeBoxDetails: BoxDetail[],
  tripNo?: string,
  vehicleNo?: string,
  supervisorName?: string,
  supervisorPhone?: string,
  tripDate?: string,
  logoLeftUrl?: string,
  logoRightUrl?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log("✅ 1. PDF generation STARTED...");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const primaryNavy: [number, number, number] = [15, 43, 92];
      const accentRed: [number, number, number] = [210, 35, 42];
      const totalRowBg: [number, number, number] = [225, 235, 248];
      const cardBorder: [number, number, number] = [205, 218, 235];
      const textDark: [number, number, number] = [15, 23, 42];
      const textGray: [number, number, number] = [70, 80, 95];

      let startY = 12;

      // ─── 1. HEADER LOGOS ──────────────────────────────────────────────

      try {
        if (logoLeftUrl && typeof logoLeftUrl === "string") {
          doc.addImage(logoLeftUrl, "PNG", 14, startY, 25, 25);
        } else {
          drawVectorDMRLogo(doc, 14, startY);
        }
      } catch (e) {
        console.warn("Left logo failed, using vector fallback:", e);
        drawVectorDMRLogo(doc, 14, startY);
      }

      try {
        if (logoRightUrl && typeof logoRightUrl === "string") {
          const logoX = pageWidth - 39;
          const logoY = startY;
          const logoW = 25;
          const logoH = 25;

          doc.saveGraphicsState();
          doc.setFillColor(248, 249, 250);
          doc.setDrawColor(220, 225, 232);
          doc.setLineWidth(0.3);
          doc.roundedRect(logoX - 1.5, logoY - 1.5, logoW + 3, logoH + 3, 2, 2, "FD");
          doc.restoreGraphicsState();

          doc.addImage(logoRightUrl, "PNG", logoX, logoY, logoW, logoH);
        }
      } catch (e) {
        console.warn("Hen image failed to load. PDF will continue without it:", e);
      }

      // Main Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      doc.text("DMR POULTRY", pageWidth / 2, startY + 15, { align: "center" });

      const lineY = startY + 23;
      doc.setDrawColor(200, 212, 228);
      doc.setLineWidth(0.5);
      doc.line(45, lineY, pageWidth - 45, lineY);
      doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      drawDiamond(doc, pageWidth / 2, lineY, 1.5);

      startY += 28;

      // ─── 2. INFO CARDS ────────────────────────────────────────────────

      const isBoxMode = row.deliveryMode === "box";
      const dateValue = tripDate || new Date().toLocaleDateString();

      // Top Card
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      doc.setFillColor(252, 254, 255);
      doc.roundedRect(14, startY, pageWidth - 28, 20, 3, 3, "FD");
      doc.setFontSize(9.5);

      drawSupervisorIcon(doc, 20, startY + 7.5, primaryNavy);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Supervisor Name :", 25, startY + 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(supervisorName || "", 57, startY + 8);
      doc.line(57, startY + 9, 108, startY + 9);

      drawTruckIcon(doc, 116, startY + 7.5, primaryNavy);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Vehicle No :", 121, startY + 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(vehicleNo || "", 143, startY + 8);
      doc.line(143, startY + 9, 188, startY + 9);

      drawPhoneIcon(doc, 20, startY + 14.5, primaryNavy);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Mobile No :", 25, startY + 15);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(supervisorPhone || "", 57, startY + 15);
      doc.line(57, startY + 16, 108, startY + 16);

      startY += 23;

      // Bottom Card
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      doc.setFillColor(252, 254, 255);
      doc.roundedRect(14, startY, pageWidth - 28, 14, 3, 3, "FD");
      doc.line(122, startY, 122, startY + 14);

      drawStoreIcon(doc, 20, startY + 7, primaryNavy);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Shop Name :", 25, startY + 7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(row.shopName || "", 49, startY + 7.5);
      doc.line(49, startY + 8.5, 115, startY + 8.5);

      drawCalendarIcon(doc, 129, startY + 7, primaryNavy);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text("Date :", 134, startY + 7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(dateValue, 148, startY + 7.5);
      doc.line(148, startY + 8.5, 188, startY + 8.5);

      startY += 18;

      // ─── 3. TABLE DATA ────────────────────────────────────────────────

      const isWeightMode = !isBoxMode;
      const headers = isBoxMode
        ? ["Box No", "Birds No.", "Weight (Kg)"]
        : ["Box No", "Birds No.", "Weight (Farm) (kg)"];

      let tableRows: any[] = [];
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

      const totalBoxCount = tableData.length;
      tableRows.push([
        `TOTAL             ${totalBoxCount}`,
        totalBirds.toLocaleString(),
        totalWeight.toFixed(2),
      ]);

      // ─── 4. AUTOTABLE ──────────────────────────────────────────────────

      autoTable(doc, {
        startY: startY,
        head: [headers],
        body: tableRows,
        theme: "grid",
        margin: { left: 14, right: 14 },
        headStyles: {
          fillColor: primaryNavy,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10,
          halign: "center",
          valign: "middle",
          cellPadding: 3.5,
        },
        styles: {
          fontSize: 9.5,
          cellPadding: 2.5,
          valign: "middle",
          textColor: textDark,
          lineColor: [210, 220, 235],
          lineWidth: 0.25,
        },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "center" },
          2: { halign: "center" },
        },
        didParseCell: function (data) {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fillColor = totalRowBg;
            data.cell.styles.textColor = primaryNavy;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
            data.cell.styles.halign = data.column.index === 0 ? "left" : "center";
          }
        },
      });

      let finalY = (doc as any).lastAutoTable.finalY || startY + 50;

      // ─── 5. WEIGHT MODE EXTRAS ────────────────────────────────────────

      if (isWeightMode) {
        const mortalityBirds = Number(row.mortality) || 0;
        const mortalityWeight = Number(row.mortKg) || 0;
        const finalBirds = totalBirds - mortalityBirds;
        const finalWeight = totalWeight - mortalityWeight;

        finalY += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
        doc.text(`MORTALITY : ${mortalityBirds}`, 16, finalY);
        doc.text(`MORTALITY (KG) : ${mortalityWeight.toFixed(2)} kg`, 90, finalY);

        finalY += 6;
        doc.text(`FINAL BIRDS : ${finalBirds}`, 16, finalY);
        doc.text(`FINAL WEIGHT : ${finalWeight.toFixed(2)} kg`, 90, finalY);

        finalY += 6;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(textGray[0], textGray[1], textGray[2]);
        doc.text("(AFTER MORTALITY DEDUCTION)", 16, finalY);
      }

      // ─── 6. FOOTER ─────────────────────────────────────────────────────

      const renderFooter = (pageNumber: number, totalPages: number) => {
        doc.setPage(pageNumber);
        const footerY = pageHeight - 25;

        doc.setDrawColor(200, 212, 228);
        doc.setLineWidth(0.4);
        doc.line(25, footerY - 8, pageWidth - 25, footerY - 8);
        doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
        drawDiamond(doc, pageWidth / 2, footerY - 8, 1.2);

        doc.setFont("times", "italic");
        doc.setFontSize(22);
        doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
        doc.text("Thank You", pageWidth / 2, footerY + 1, { align: "center" });

        drawFlourish(doc, pageWidth / 2 - 25, footerY - 1, false);
        drawFlourish(doc, pageWidth / 2 + 25, footerY - 1, true);

        // Safe straight line (completely bypasses doc.lines scale errors)
        const waveTop = pageHeight - 12;
        doc.setDrawColor(accentRed[0], accentRed[1], accentRed[2]);
        doc.setLineWidth(2.5);
        doc.line(0, waveTop, pageWidth, waveTop + 4);

        doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
        doc.rect(0, pageHeight - 8, pageWidth, 8, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 10, pageHeight - 2.5);
        doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 10, pageHeight - 2.5, { align: "right" });
      };

      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        renderFooter(i, totalPages);
      }

      // ─── 7. SAVE & RESOLVE ─────────────────────────────────────────────

      const suffix = isBoxMode ? "Box" : "Weight";
      const cleanShopName = (row.shopName || "Shop").replace(/\s+/g, "_");
      
      console.log("✅ 2. PDF Built. Forcing download...");
      
      // Use Blob + virtual link to guarantee bypassing browser blockers
      const pdfBlob = doc.output('blob');
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ShopDelivery_${cleanShopName}_${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      
      console.log("✅ 3. Download triggered!");
      resolve();

    } catch (error: any) {
      console.error("❌ CRITICAL ERROR caught inside PDF generator:", error);
      reject(new Error(error?.message || "Failed to generate PDF. Check browser console."));
    }
  });
}